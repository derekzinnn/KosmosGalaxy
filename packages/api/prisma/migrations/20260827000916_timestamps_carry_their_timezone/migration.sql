-- Every DateTime column becomes timestamptz.
--
-- `timestamp without time zone` is an instant with the offset thrown away,
-- and something downstream has to guess it back. Prisma 7 hands reads to the
-- `pg` driver, which guesses using the timezone of the Node process — so on
-- any server not running in UTC every timestamp came back shifted by the local
-- offset. On a machine in America/Sao_Paulo that is three hours.
--
-- It was visible in real rows: one login wrote `users.last_login_at` from
-- Node and `audit_logs.created_at` from Postgres, and the two landed three
-- hours apart describing the same instant.
--
-- `timestamptz` stores the same instant and sends the offset with it, so
-- there is nothing left to guess. Existing values were written as UTC, which
-- is what `AT TIME ZONE 'UTC'` asserts while converting.

ALTER TABLE "audit_logs" ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "invitations" ALTER COLUMN "expires_at" TYPE timestamptz(3) USING "expires_at" AT TIME ZONE 'UTC';
ALTER TABLE "invitations" ALTER COLUMN "accepted_at" TYPE timestamptz(3) USING "accepted_at" AT TIME ZONE 'UTC';
ALTER TABLE "invitations" ALTER COLUMN "revoked_at" TYPE timestamptz(3) USING "revoked_at" AT TIME ZONE 'UTC';
ALTER TABLE "invitations" ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "lesson_progress" ALTER COLUMN "started_at" TYPE timestamptz(3) USING "started_at" AT TIME ZONE 'UTC';
ALTER TABLE "lesson_progress" ALTER COLUMN "completed_at" TYPE timestamptz(3) USING "completed_at" AT TIME ZONE 'UTC';
ALTER TABLE "lesson_progress" ALTER COLUMN "updated_at" TYPE timestamptz(3) USING "updated_at" AT TIME ZONE 'UTC';
ALTER TABLE "lessons" ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "lessons" ALTER COLUMN "updated_at" TYPE timestamptz(3) USING "updated_at" AT TIME ZONE 'UTC';
ALTER TABLE "modules" ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "modules" ALTER COLUMN "updated_at" TYPE timestamptz(3) USING "updated_at" AT TIME ZONE 'UTC';
ALTER TABLE "password_reset_tokens" ALTER COLUMN "expires_at" TYPE timestamptz(3) USING "expires_at" AT TIME ZONE 'UTC';
ALTER TABLE "password_reset_tokens" ALTER COLUMN "used_at" TYPE timestamptz(3) USING "used_at" AT TIME ZONE 'UTC';
ALTER TABLE "password_reset_tokens" ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "refresh_tokens" ALTER COLUMN "expires_at" TYPE timestamptz(3) USING "expires_at" AT TIME ZONE 'UTC';
ALTER TABLE "refresh_tokens" ALTER COLUMN "revoked_at" TYPE timestamptz(3) USING "revoked_at" AT TIME ZONE 'UTC';
ALTER TABLE "refresh_tokens" ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "resources" ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "resources" ALTER COLUMN "updated_at" TYPE timestamptz(3) USING "updated_at" AT TIME ZONE 'UTC';
ALTER TABLE "tenants" ALTER COLUMN "contract_signed_at" TYPE timestamptz(3) USING "contract_signed_at" AT TIME ZONE 'UTC';
ALTER TABLE "tenants" ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "tenants" ALTER COLUMN "updated_at" TYPE timestamptz(3) USING "updated_at" AT TIME ZONE 'UTC';
ALTER TABLE "track_assignments" ALTER COLUMN "due_at" TYPE timestamptz(3) USING "due_at" AT TIME ZONE 'UTC';
ALTER TABLE "track_assignments" ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "tracks" ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "tracks" ALTER COLUMN "updated_at" TYPE timestamptz(3) USING "updated_at" AT TIME ZONE 'UTC';
ALTER TABLE "users" ALTER COLUMN "last_login_at" TYPE timestamptz(3) USING "last_login_at" AT TIME ZONE 'UTC';
ALTER TABLE "users" ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "users" ALTER COLUMN "updated_at" TYPE timestamptz(3) USING "updated_at" AT TIME ZONE 'UTC';
ALTER TABLE "watch_events" ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC';
