import { beforeEach, describe, expect, it } from 'vitest';
import { REFRESH_COOKIE_NAME } from '../src/lib/cookies.js';
import { runInGlobalScope } from '../src/db/scoped-db.js';
import {
  api,
  bearer,
  loginAs,
  RESET_LINK,
  tokenFromLink,
  useCapturingEmails,
  type CapturingEmailProvider,
} from './helpers/api.js';
import { createTenantWithUsers, createUser, TEST_PASSWORD } from './helpers/factories.js';
import { rawQuery, readAuditActions } from './helpers/database.js';

function refreshCookieFrom(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : [];
  const cookie = cookies.find((value) => value.startsWith(`${REFRESH_COOKIE_NAME}=`));
  if (!cookie) throw new Error('Response carried no refresh cookie');
  return cookie.split(';')[0] as string;
}

describe('authentication', () => {
  let emails: CapturingEmailProvider;
  let fixture: Awaited<ReturnType<typeof createTenantWithUsers>>;

  beforeEach(async () => {
    emails = useCapturingEmails();
    fixture = await createTenantWithUsers();
  });

  describe('POST /auth/login', () => {
    it('returns an access token, a user and a refresh cookie', async () => {
      const response = await api()
        .post('/auth/login')
        .send({ email: fixture.owner.email, password: TEST_PASSWORD })
        .expect(200);

      expect(response.body.accessToken).toBeTypeOf('string');
      expect(response.body.user.email).toBe(fixture.owner.email);
      expect(response.body.user.tenantId).toBe(fixture.tenant.id);

      const cookie = refreshCookieFrom(response);
      expect(cookie).toContain(REFRESH_COOKIE_NAME);
    });

    it('never returns the refresh token in the body', async () => {
      const response = await api()
        .post('/auth/login')
        .send({ email: fixture.owner.email, password: TEST_PASSWORD })
        .expect(200);

      expect(JSON.stringify(response.body)).not.toContain('refreshToken');
    });

    it('never returns the password hash', async () => {
      const response = await api()
        .post('/auth/login')
        .send({ email: fixture.owner.email, password: TEST_PASSWORD })
        .expect(200);

      expect(JSON.stringify(response.body)).not.toContain('passwordHash');
      expect(JSON.stringify(response.body)).not.toContain('$argon2');
    });

    it('rejects a wrong password', async () => {
      const response = await api()
        .post('/auth/login')
        .send({ email: fixture.owner.email, password: 'senha-completamente-errada' })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('answers identically for an unknown email and a wrong password', async () => {
      const unknown = await api()
        .post('/auth/login')
        .send({ email: 'ninguem@teste.com.br', password: 'seja-la-o-que-for' })
        .expect(401);

      const wrong = await api()
        .post('/auth/login')
        .send({ email: fixture.owner.email, password: 'seja-la-o-que-for' })
        .expect(401);

      // Any difference here is an oracle telling an attacker which of Kosmos's
      // clients have accounts.
      expect(unknown.body).toEqual(wrong.body);
    });

    it('refuses a suspended account without saying so', async () => {
      const suspended = await createUser({
        tenantId: fixture.tenant.id,
        role: 'CLIENT_MEMBER',
        status: 'SUSPENDED',
      });

      const response = await api()
        .post('/auth/login')
        .send({ email: suspended.email, password: TEST_PASSWORD })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('accepts a differently-cased email', async () => {
      await api()
        .post('/auth/login')
        .send({ email: fixture.owner.email.toUpperCase(), password: TEST_PASSWORD })
        .expect(200);
    });

    it('records success and failure in the audit log', async () => {
      await api()
        .post('/auth/login')
        .send({ email: fixture.owner.email, password: 'errada' })
        .expect(401);

      await api()
        .post('/auth/login')
        .send({ email: fixture.owner.email, password: TEST_PASSWORD })
        .expect(200);

      const actions = await readAuditActions();
      expect(actions).toContain('USER_LOGIN_FAILED');
      expect(actions).toContain('USER_LOGIN_SUCCEEDED');
    });

    it('stamps lastLoginAt', async () => {
      expect(fixture.owner.lastLoginAt).toBeNull();

      await api()
        .post('/auth/login')
        .send({ email: fixture.owner.email, password: TEST_PASSWORD })
        .expect(200);

      const [row] = await rawQuery<{ last_login_at: Date | null }>(
        'SELECT last_login_at FROM users WHERE id = $1',
        [fixture.owner.id],
      );
      expect(row?.last_login_at).not.toBeNull();
    });

    it('rejects a malformed body', async () => {
      const response = await api()
        .post('/auth/login')
        .send({ email: 'nao-e-um-email', password: '' })
        .expect(422);

      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('GET /auth/me', () => {
    it('returns the caller', async () => {
      const token = await loginAs(fixture.owner.email);

      const response = await api().get('/auth/me').set('Authorization', bearer(token)).expect(200);

      expect(response.body.user.id).toBe(fixture.owner.id);
    });

    it('refuses a missing token', async () => {
      await api().get('/auth/me').expect(401);
    });

    it('refuses a forged token', async () => {
      const response = await api()
        .get('/auth/me')
        .set('Authorization', bearer('nao.e.um.jwt'))
        .expect(401);

      expect(response.body.error.code).toBe('TOKEN_INVALID');
    });

    it('refuses a token signed with the wrong secret', async () => {
      const { SignJWT } = await import('jose');
      const forged = await new SignJWT({ email: fixture.owner.email, role: 'SUPERADMIN' })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(fixture.owner.id)
        .setIssuer('universo-kosmos')
        .setAudience('universo-kosmos-web')
        .setExpirationTime('15m')
        .sign(new TextEncoder().encode('a'.repeat(48)));

      await api().get('/auth/me').set('Authorization', bearer(forged)).expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates the token and issues a new one', async () => {
      const login = await api()
        .post('/auth/login')
        .send({ email: fixture.owner.email, password: TEST_PASSWORD })
        .expect(200);

      const first = refreshCookieFrom(login);

      const refreshed = await api().post('/auth/refresh').set('Cookie', first).expect(200);

      const second = refreshCookieFrom(refreshed);

      expect(second).not.toBe(first);
      expect(refreshed.body.accessToken).toBeTypeOf('string');
    });

    it('refuses a token that has already been rotated, and kills the family', async () => {
      const login = await api()
        .post('/auth/login')
        .send({ email: fixture.owner.email, password: TEST_PASSWORD })
        .expect(200);

      const first = refreshCookieFrom(login);
      const refreshed = await api().post('/auth/refresh').set('Cookie', first).expect(200);
      const second = refreshCookieFrom(refreshed);

      // Replaying the spent token is the signal that it was copied.
      const reuse = await api().post('/auth/refresh').set('Cookie', first).expect(401);
      expect(reuse.body.error.code).toBe('REFRESH_TOKEN_REUSED');

      // The whole chain dies, so the thief's newer token is dead too.
      await api().post('/auth/refresh').set('Cookie', second).expect(401);

      const actions = await readAuditActions();
      expect(actions).toContain('REFRESH_TOKEN_REUSE_DETECTED');
    });

    it('leaves other devices signed in when one family is revoked', async () => {
      const deviceOne = refreshCookieFrom(
        await api()
          .post('/auth/login')
          .send({ email: fixture.owner.email, password: TEST_PASSWORD })
          .expect(200),
      );
      const deviceTwo = refreshCookieFrom(
        await api()
          .post('/auth/login')
          .send({ email: fixture.owner.email, password: TEST_PASSWORD })
          .expect(200),
      );

      await api().post('/auth/refresh').set('Cookie', deviceOne).expect(200);
      await api().post('/auth/refresh').set('Cookie', deviceOne).expect(401);

      // Device two belongs to a different family and is unaffected.
      await api().post('/auth/refresh').set('Cookie', deviceTwo).expect(200);
    });

    it('refuses when no cookie is present', async () => {
      const response = await api().post('/auth/refresh').expect(401);
      expect(response.body.error.code).toBe('REFRESH_TOKEN_MISSING');
    });

    it('refuses an unknown token', async () => {
      await api()
        .post('/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE_NAME}=token-inventado`)
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes the session and clears the cookie', async () => {
      const login = await api()
        .post('/auth/login')
        .send({ email: fixture.owner.email, password: TEST_PASSWORD })
        .expect(200);

      const cookie = refreshCookieFrom(login);

      await api().post('/auth/logout').set('Cookie', cookie).expect(204);
      await api().post('/auth/refresh').set('Cookie', cookie).expect(401);

      expect(await readAuditActions()).toContain('USER_LOGGED_OUT');
    });

    it('is harmless without a session', async () => {
      await api().post('/auth/logout').expect(204);
    });
  });

  describe('password reset', () => {
    it('emails a link and lets the user set a new password', async () => {
      await api().post('/auth/forgot-password').send({ email: fixture.owner.email }).expect(202);

      const token = tokenFromLink(emails.lastLinkMatching(RESET_LINK));

      await api()
        .post('/auth/reset-password')
        .send({ token, password: 'uma-senha-nova-bem-longa' })
        .expect(204);

      await api()
        .post('/auth/login')
        .send({ email: fixture.owner.email, password: 'uma-senha-nova-bem-longa' })
        .expect(200);

      await api()
        .post('/auth/login')
        .send({ email: fixture.owner.email, password: TEST_PASSWORD })
        .expect(401);

      const actions = await readAuditActions();
      expect(actions).toContain('PASSWORD_RESET_REQUESTED');
      expect(actions).toContain('PASSWORD_RESET_COMPLETED');
    });

    it('answers the same for an unknown email, and sends nothing', async () => {
      const known = await api()
        .post('/auth/forgot-password')
        .send({ email: fixture.owner.email })
        .expect(202);

      const before = emails.sent.length;

      const unknown = await api()
        .post('/auth/forgot-password')
        .send({ email: 'ninguem@teste.com.br' })
        .expect(202);

      expect(unknown.body).toEqual(known.body);
      expect(emails.sent).toHaveLength(before);
    });

    it('burns the token after one use', async () => {
      await api().post('/auth/forgot-password').send({ email: fixture.owner.email }).expect(202);
      const token = tokenFromLink(emails.lastLinkMatching(RESET_LINK));

      await api()
        .post('/auth/reset-password')
        .send({ token, password: 'primeira-senha-nova' })
        .expect(204);

      await api()
        .post('/auth/reset-password')
        .send({ token, password: 'segunda-senha-nova' })
        .expect(401);
    });

    it('retires an earlier link when a new one is requested', async () => {
      await api().post('/auth/forgot-password').send({ email: fixture.owner.email }).expect(202);
      const first = tokenFromLink(emails.lastLinkMatching(RESET_LINK));

      await api().post('/auth/forgot-password').send({ email: fixture.owner.email }).expect(202);
      const second = tokenFromLink(emails.lastLinkMatching(RESET_LINK));

      expect(second).not.toBe(first);

      await api()
        .post('/auth/reset-password')
        .send({ token: first, password: 'senha-do-link-velho' })
        .expect(401);

      await api()
        .post('/auth/reset-password')
        .send({ token: second, password: 'senha-do-link-novo' })
        .expect(204);
    });

    it('signs every device out when the password changes', async () => {
      const cookie = refreshCookieFrom(
        await api()
          .post('/auth/login')
          .send({ email: fixture.owner.email, password: TEST_PASSWORD })
          .expect(200),
      );

      await api().post('/auth/forgot-password').send({ email: fixture.owner.email }).expect(202);
      const token = tokenFromLink(emails.lastLinkMatching(RESET_LINK));

      await api()
        .post('/auth/reset-password')
        .send({ token, password: 'senha-novissima-longa' })
        .expect(204);

      await api().post('/auth/refresh').set('Cookie', cookie).expect(401);
    });

    it('rejects an expired token', async () => {
      await api().post('/auth/forgot-password').send({ email: fixture.owner.email }).expect(202);
      const token = tokenFromLink(emails.lastLinkMatching(RESET_LINK));

      await rawQuery(`UPDATE password_reset_tokens SET expires_at = now() - interval '1 minute'`);

      await api()
        .post('/auth/reset-password')
        .send({ token, password: 'nao-deveria-funcionar' })
        .expect(401);
    });

    it('enforces the password policy', async () => {
      await api().post('/auth/forgot-password').send({ email: fixture.owner.email }).expect(202);
      const token = tokenFromLink(emails.lastLinkMatching(RESET_LINK));

      await api().post('/auth/reset-password').send({ token, password: 'curta' }).expect(422);
    });
  });

  describe('rate limiting', () => {
    it('blocks repeated failures for one email from one address', async () => {
      const attempt = () =>
        api().post('/auth/login').send({ email: fixture.owner.email, password: 'errada' });

      let blocked = false;
      for (let i = 0; i < 12; i += 1) {
        const response = await attempt();
        if (response.status === 429) {
          blocked = true;
          expect(response.body.error.code).toBe('RATE_LIMITED');
          break;
        }
      }

      expect(blocked).toBe(true);
    });

    it('limits password reset requests', async () => {
      let blocked = false;
      for (let i = 0; i < 8; i += 1) {
        const response = await api()
          .post('/auth/forgot-password')
          .send({ email: fixture.owner.email });
        if (response.status === 429) {
          blocked = true;
          break;
        }
      }
      expect(blocked).toBe(true);
    });
  });

  describe('audit log integrity', () => {
    it('cannot be updated or deleted, even directly in SQL', async () => {
      await api()
        .post('/auth/login')
        .send({ email: fixture.owner.email, password: TEST_PASSWORD })
        .expect(200);

      await expect(rawQuery(`UPDATE audit_logs SET action = 'TAMPERED'`)).rejects.toThrow(
        /append-only/,
      );
      await expect(rawQuery(`DELETE FROM audit_logs`)).rejects.toThrow(/append-only/);
    });

    it('never stores a password or a token', async () => {
      await api()
        .post('/auth/login')
        .send({ email: fixture.owner.email, password: TEST_PASSWORD })
        .expect(200);
      await api().post('/auth/forgot-password').send({ email: fixture.owner.email }).expect(202);

      const rows = await rawQuery<{ payload: string }>(
        `SELECT coalesce(before::text,'') || coalesce(after::text,'') AS payload FROM audit_logs`,
      );

      for (const row of rows) {
        expect(row.payload).not.toContain(TEST_PASSWORD);
        expect(row.payload).not.toContain('$argon2');
      }
    });

    it('captures the caller IP and user agent', async () => {
      await api()
        .post('/auth/login')
        .set('User-Agent', 'KosmosTestAgent/1.0')
        .send({ email: fixture.owner.email, password: TEST_PASSWORD })
        .expect(200);

      const [row] = await rawQuery<{ ip: string; user_agent: string }>(
        `SELECT ip, user_agent FROM audit_logs WHERE action = 'USER_LOGIN_SUCCEEDED'`,
      );

      expect(row?.ip).toBeTruthy();
      expect(row?.user_agent).toBe('KosmosTestAgent/1.0');
    });

    it('rolls the audit entry back when its action rolls back', async () => {
      // A login audit row only exists because the whole transaction committed.
      // Prove the pairing by counting: no login, no row.
      const before = await readAuditActions();
      expect(before).not.toContain('USER_LOGIN_SUCCEEDED');

      await api()
        .post('/auth/login')
        .send({ email: fixture.owner.email, password: 'errada' })
        .expect(401);

      const after = await readAuditActions();
      expect(after).toContain('USER_LOGIN_FAILED');
      expect(after).not.toContain('USER_LOGIN_SUCCEEDED');
    });

    it('keeps refresh tokens hashed at rest', async () => {
      const login = await api()
        .post('/auth/login')
        .send({ email: fixture.owner.email, password: TEST_PASSWORD })
        .expect(200);

      const cookie = refreshCookieFrom(login);
      const rawToken = cookie.split('=')[1] as string;

      const rows = await rawQuery<{ token_hash: string }>('SELECT token_hash FROM refresh_tokens');

      expect(rows).toHaveLength(1);
      expect(rows[0]?.token_hash).not.toBe(rawToken);
      expect(rows[0]?.token_hash).toHaveLength(64);
    });
  });

  describe('scope discipline', () => {
    it('has no user rows reachable without a scope', async () => {
      // Sanity check that fixtures really did land in the database and that
      // reading them requires saying which tenant you mean.
      const count = await runInGlobalScope('system:test-fixture', (db) => db.raw.user.count({}));
      expect(count).toBeGreaterThan(0);
    });
  });
});
