# Kosmos Galaxy

Client onboarding platform for **Kosmos Inteligência Digital**.

A client signs a contract, receives an invitation by email, sets a password, and
works through a classroom-style onboarding track. Kosmos sees exactly who logged
in, who watched what, who is stuck and who has not started.

---

## Status

| Phase       | Scope                                                                        | State       |
| ----------- | ---------------------------------------------------------------------------- | ----------- |
| **Phase 0** | Monorepo, database schema, auth, invitations, RBAC, audit log                | ✅ **Done** |
| **Phase 1** | Course content CRUD, ordering, publishing, track assignment                  | ✅ **Done** |
| Phase 2     | Panda Video, signed playback, player, heartbeat telemetry, sequential unlock | Next        |
| Phase 3     | Client-facing classroom UI and progress experience                           | Not started |
| Phase 4     | Admin console: onboarding funnel, per-client drill-down, audit viewer        | Not started |

---

## Running it

```bash
npm install                       # also runs `prisma generate`
cp packages/api/.env.example packages/api/.env
cp packages/web/.env.example packages/web/.env
npm run db:migrate                # applies migrations to DATABASE_URL
npm run db:seed                   # creates the first SUPERADMIN
npm run dev                       # api on :3333, web on :5173
```

`npm run db:seed` prints the credentials it created. Nothing else can exist
until that account does — there would be nobody to send the first invitation.

| Command                                        | What it does                                             |
| ---------------------------------------------- | -------------------------------------------------------- |
| `npm run dev`                                  | Runs API and web together                                |
| `npm test`                                     | Vitest in both packages (API tests need a live Postgres) |
| `npm run typecheck`                            | `tsc --noEmit` in both packages                          |
| `npm run lint`                                 | ESLint across the monorepo                               |
| `npm run format`                               | Prettier write                                           |
| `npm run build`                                | Production build of both packages                        |
| `npm run db:migrate` / `db:seed` / `db:studio` | Prisma helpers                                           |

---

## Architecture

```
packages/api                      Express 5 + Prisma 7 + PostgreSQL
  prisma/
    schema.prisma                 The whole data model, Phase 0 → Phase 4
    migrations/                   Includes hand-written database guarantees
    seed.ts                       First Kosmos staff account
  src/
    routes/                       HTTP surface, middleware wiring, nothing else
    controllers/                  Read request → call one service → shape response
    services/                     Every business rule and every transaction
    repositories/                 Every database query
    db/                           Prisma client, tenant scope, tenant guard
    middleware/                   auth, RBAC, rate limits, validation, errors
    lib/                          password, tokens, jwt, cookies, logger, errors
    schemas/                      Zod request schemas
  tests/                          Integration tests against a real database

packages/web                      Vite + React 19 + Router + TanStack Query
  src/
    auth/                         Auth context, silent refresh, route guards
    components/ui/                shadcn-style primitives
    components/states/            Loading, empty and error states
    pages/                        One file per route
    lib/                          API client, error → Portuguese copy mapping
    index.css                     Design tokens. Every colour resolves here.
```

**Business rules live in services.** Controllers make no decisions and touch no
database. Repositories run queries and hold no rules.

---

## The tenant guard

The part that matters most. Tenant isolation is enforced in three layers, and
each one assumes the others might fail.

**1. Scope, carried by the request.** Every authenticated request resolves to a
`RequestContext { userId, email, role, tenantId, ip, userAgent }`. Services open
a scope with `runAsContext(context, …)`, which pins a client user to their own
tenant and lets Kosmos staff run globally. The scope travels through
`AsyncLocalStorage` — a backpack strapped to the request that every function it
calls can look inside, however deeply nested.

**2. `ScopedDb`, which supplies the filter.** Repositories never receive a raw
Prisma client. They get a `ScopedDb` that merges the tenant filter in _after_
whatever the caller passed, so a forged `tenantId` in a request body is replaced
rather than obeyed.

**3. The tripwire, which refuses anything unscoped.** A Prisma client extension
inspects every query for a tenant-scoped model and throws
`TenantScopeViolationError` if it is not pinned to the active scope. It does not
quietly repair the query — silent repair hides the bug, and the next query
written the same way may not be repairable.

Opening a hole is possible but never accidental: `runInGlobalScope(reason, …)`
takes a named reason from a closed union, so `grep -r "superadmin:"` lists every
override the codebase can perform.

### Known limits

- **Nested reads inherit their parent's scope.** A query on an unscoped model
  that includes a scoped relation (`track.findMany({ include: { assignments: …
} })`) is not checked, because Prisma reports it as one operation.

  Phase 1 is where this first mattered. A client's tracks could have been read
  as `track.findMany({ where: { assignments: { some: { tenantId } } } })` —
  correct today, and silently every client's tracks the day somebody edits that
  filter, because the guard never sees it. Instead the query runs from the
  guarded side: `trackAssignment.findMany({ include: { track: … } })`.
  `TrackAssignment` carries the tenant column, so the filter is checked.
  **Read a client's content through the assignment, never through the track.**

  PostgreSQL row-level security is the defence-in-depth answer and is
  deliberately deferred — it needs a separate database role.

- **Writes must set the scalar foreign key.** A nested `connect` is invisible to
  the guard; the error message says so when it fires.

### Two things Prisma 7 does that will bite you

- **Prisma promises are lazy.** `db.user.findFirst()` builds a promise and runs
  nothing until it is awaited. A scope callback that _returns_ a query instead
  of awaiting it hands it back after the scope has been restored, and the query
  then executes under whatever scope is active outside. `withTenantScope` and
  `withGlobalScope` await inside the store for exactly this reason.
- **A driver adapter is mandatory.** `new PrismaClient()` with no options throws.
  Prisma compiles the query; `pg` delivers it.

---

## Audit log

`audit(tx, …)` writes through the caller's transaction handle, so an audit row
shares the fate of the action it describes — if the action rolls back, the log
rolls back with it.

`auditDetached(…)` commits on its own and never throws. It exists for one
specific case: a failed login must be recorded _and then_ rejected, and if that
record lived in the request's transaction the rejection would roll the evidence
away.

**The log is append-only, enforced by the database.** `audit_logs` carries
`BEFORE UPDATE` and `BEFORE DELETE` triggers that raise an exception no matter
who issues the statement, including the application's own connection. There is
no update or delete method for audit rows anywhere in the codebase, and ESLint
fails the build if one is added.

> **TRUNCATE caveat.** Row-level triggers do not fire for `TRUNCATE`, and a
> statement-level guard would also block `prisma migrate reset` and the test
> harness. `TRUNCATE` requires table-owner privileges, so this is covered by not
> granting ownership to the application's database role in production. See
> **Infra requirements**.

Actions recorded in Phase 0: `USER_LOGIN_SUCCEEDED`, `USER_LOGIN_FAILED`,
`USER_LOGGED_OUT`, `USER_CREATED`, `USER_ROLE_CHANGED`, `USER_SUSPENDED`,
`USER_REACTIVATED`, `TENANT_CREATED`, `INVITATION_SENT`, `INVITATION_ACCEPTED`,
`INVITATION_REVOKED`, `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_COMPLETED`,
`REFRESH_TOKEN_REUSE_DETECTED`, `TENANT_SCOPE_OVERRIDDEN`.

Added in Phase 1: `TRACK_CREATED`, `TRACK_UPDATED`, `TRACK_DELETED`,
`TRACK_PUBLISHED`, `TRACK_UNPUBLISHED`, `TRACK_ASSIGNED`, `TRACK_UNASSIGNED`,
`MODULE_CREATED`, `MODULE_UPDATED`, `MODULE_DELETED`, `MODULES_REORDERED`,
`LESSON_CREATED`, `LESSON_UPDATED`, `LESSON_DELETED`, `LESSONS_REORDERED`,
`RESOURCE_CREATED`, `RESOURCE_DELETED`.

---

## Database guarantees

Rules PostgreSQL enforces itself, because a bug in the application must not be
able to break them. All live in `prisma/migrations/*_phase0_guarantees/`.

| Guarantee                                             | Why                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| `audit_logs` rejects UPDATE and DELETE                | An audit log you can edit is not an audit log                                  |
| `users.role = SUPERADMIN` **iff** `tenant_id IS NULL` | No "SUPERADMIN of Tenant A"; no tenant-less client user the guard cannot scope |
| Same rule on `invitations`                            | You cannot invite someone to be a SUPERADMIN of a tenant                       |
| `email = lower(btrim(email))` on both tables          | Makes the UNIQUE index unbypassable via `Owner@Client.com`                     |

This migration is hand-written. Prisma cannot express any of it in
`schema.prisma`, so **it must be kept in step with the schema by hand.**

---

## Authentication

**Access token** — a 15-minute JWT (HS256, via `jose`). A festival wristband:
checkable at a glance without asking the database, and for that same reason
impossible to cancel once issued. Held in a JavaScript variable, never in
`localStorage`, so one XSS bug cannot lift a session.

**Refresh token** — 256 bits of randomness in an httpOnly, SameSite=Lax cookie
scoped to `/auth`, stored **SHA-256 hashed**. A locker key: meaningless in
itself, works only because the database holds a matching record, cancellable
instantly. SHA-256 rather than argon2 because the token is already unguessable —
slow hashing would add latency to every refresh and buy nothing.

**Rotation and reuse detection.** Every refresh burns the old token and issues a
new one. Each _login_ opens a **family**; rotation stays inside it. A token that
was already spent turning up again means it was copied, so the whole family is
revoked and `REFRESH_TOKEN_REUSE_DETECTED` is written. Other devices have their
own families and keep working.

> Because rotation is strict, the web client serialises refreshes: one in-flight
> promise per tab, and a **Web Lock** across tabs. Without it, restoring a
> browser window with two tabs open fires two boot refreshes milliseconds apart,
> the second arrives holding the token the first just spent, and both tabs are
> signed out. The fix is on the client on purpose — a grace period on the server
> would have weakened reuse detection instead.

**Passwords** — argon2id, 64 MiB / 3 iterations / parallelism 4. bcrypt makes an
attacker's computer think hard; argon2id makes it think hard _and_ need a lot of
memory, which is what hurts the GPU farms that actually crack passwords. bcrypt
also silently truncates at 72 bytes.

**No enumeration.** Unknown email, wrong password and suspended account all
return the identical `INVALID_CREDENTIALS` body, and a login for an address that
does not exist verifies against a throwaway hash so it takes just as long.
`POST /auth/forgot-password` always answers 202.

---

## API surface (Phase 0)

| Method | Path                         | Access                   |
| ------ | ---------------------------- | ------------------------ |
| `GET`  | `/health`                    | Public                   |
| `POST` | `/auth/login`                | Public, rate limited     |
| `POST` | `/auth/refresh`              | Refresh cookie           |
| `POST` | `/auth/logout`               | Refresh cookie           |
| `GET`  | `/auth/me`                   | Authenticated            |
| `POST` | `/auth/forgot-password`      | Public, rate limited     |
| `POST` | `/auth/reset-password`       | Public, rate limited     |
| `POST` | `/invitations`               | SUPERADMIN, CLIENT_OWNER |
| `GET`  | `/invitations`               | SUPERADMIN, CLIENT_OWNER |
| `GET`  | `/invitations/:token`        | Public                   |
| `POST` | `/invitations/:token/accept` | Public                   |
| `POST` | `/tenants`                   | SUPERADMIN               |
| `GET`  | `/tenants`                   | Authenticated (scoped)   |
| `GET`  | `/tenants/:id`               | Authenticated (scoped)   |

Errors are `{ error: { code, message, details? } }`. **`code` is the contract**
and is English; Portuguese copy lives in `packages/web/src/lib/api-error.ts`,
keyed by code, so the API stays language-neutral. Field-level validation
messages are the exception — they come back already in Portuguese, because the
web forms validate against the same Zod schemas.

---

## Language

All copy a client reads is **Brazilian Portuguese**. All code, comments, commit
messages and identifiers are **English**.

---

## Decisions taken in Phase 0

| Decision                      | Choice                                 | Why                                                                                                                                                                                                               |
| ----------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript version            | **6.0.3**, not 7.0.2                   | `typescript-eslint@8` declares `typescript <6.1.0`. TS 7 means no type-aware linting — and `no-floating-promises` is the single most valuable rule in an auth codebase                                            |
| Superadmin override auditing  | **Once per request per target tenant** | Logging every overriding query would make the log 95% noise within a month. Reading a global list is staff doing their job; _drilling into one named client_ is the audit-worthy act                              |
| Token family revocation       | **Family only**                        | OAuth 2.0 Security BCP. The compromised device's chain dies; the client's other devices stay signed in                                                                                                            |
| Email uniqueness              | **Global**                             | One email, one user, one unambiguous login lookup. If a person ever needs to belong to two client companies, the migration is `@@unique([tenantId, email])` plus a tenant picker                                  |
| Audit action storage          | **String, not a PG enum**              | The list grows constantly; an enum would turn "log one more thing" into a schema migration. A TypeScript union catches typos at compile time                                                                      |
| `AuditLog` foreign keys       | **None**                               | `onDelete: SetNull` is implemented as an UPDATE, which the append-only trigger refuses. The FK and immutability are mutually exclusive, so the log is a standalone ledger with `actorEmail`/`actorRole` snapshots |
| `tenantId` on progress tables | **Denormalised**                       | Derivable through `user`, but Phase 4's funnel filters by tenant constantly, and it lets the guard treat every scoped table identically. Users never change tenant, so it cannot drift                            |
| `WatchEvent.id`               | **BigInt sequence**                    | The only table that grows without bound. Its rows are aggregated, never addressed individually, so BigInt never crosses the JSON boundary                                                                         |
| Table naming                  | **snake_case, plural**                 | We write raw SQL for the triggers and read these tables in the Supabase dashboard                                                                                                                                 |
| `CLIENT_OWNER` invite rights  | **`CLIENT_MEMBER` only**               | Promoting someone to account owner is a decision about the commercial relationship, so it stays with Kosmos. One line in `INVITABLE_ROLES` if you disagree                                                        |
| Email vendor                  | **Deferred**                           | `EmailProvider` interface with a console implementation. Choosing Resend/SES/Postmark later is one new file and one line in the factory                                                                           |

### Decisions taken in Phase 1

| Decision                 | Choice                                           | Why                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reordering               | **Full ordered list, applied in two passes**     | `@@unique([trackId, order])` refuses two rows at one position even momentarily, and a Prisma `@@unique` is a plain index, checked per statement rather than deferred to commit. Every row is parked in negative space first, where nothing collides, then written to 0..n-1. Sending the whole list, rather than "move item 3 up", also makes a stale client view detectable — a set that does not match exactly what exists is rejected |
| Slugs                    | **Derived from the title, made unique**          | One less field to fill in. An explicitly supplied slug is never silently altered: a shared link that changes underneath is worse than a rejected request                                                                                                                                                                                                                                                                                 |
| Publishing               | **Validated, and reports every problem at once** | A track a client cannot finish is worse than one they cannot start. Empty track, empty module, and a required lesson with no video all block publication, and the endpoint returns the whole list so the fix is one pass rather than a game of whack-a-mole. `GET /tracks/:id/readiness` answers the same question without attempting to publish                                                                                         |
| Deleting content         | **Blocked when it would erase history**          | A published or assigned track cannot be deleted, and neither can a lesson or module a client has already started — the schema cascades to `LessonProgress`, so a careless click would silently erase what someone watched. The guard is in place now even though Phase 2 writes the first such row                                                                                                                                       |
| Route shape              | **`/modules/:id`, not `/tracks/:t/modules/:m`**  | Ids are unique, so the ancestry in a URL adds nothing except a second source of truth that can disagree with the database                                                                                                                                                                                                                                                                                                                |
| `pandaVideoId` exposure  | **Staff only; clients get `hasVideo`**           | Phase 2 serves playback through a signed URL. A raw video id reaching a client browser now would make that pointless later, so the client mapper never includes it                                                                                                                                                                                                                                                                       |
| Client-facing reads      | **Through `TrackAssignment`**                    | See **Known limits**. The guarded side of the relation is the only side that can be checked                                                                                                                                                                                                                                                                                                                                              |
| A minimal Clients screen | **Added, though the console is Phase 4**         | Without a way to create a company and invite its owner, the assign dropdown is permanently empty and Phase 1 cannot be used at all. The funnel, drill-down and audit viewer remain Phase 4                                                                                                                                                                                                                                               |

### Decisions taken ahead of Phase 2

| Decision     | Choice                            | Why                                                                                                                                                                                                                                                                                                                                                          |
| ------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Video vendor | **Panda Video, not Bunny Stream** | Kosmos intends to sell courses later. That turns the Panda feature set — per-viewer dynamic watermark, DRM, domain lock — from something this onboarding platform does not need into the thing that protects the product. Choosing it now costs one column rename; choosing it after Phase 2 costs the integration plus re-uploading the whole video library |

**What this trades away, knowingly.** Bunny is cheaper per GB at low volume and
has no plan floor, and the engagement analytics built into Panda is redundant
here — `WatchEvent` and `LessonProgress` stay the source of truth, because the
Phase 4 funnel joins watch data against invitations and logins in our own
Postgres, and no third-party dashboard can do that join. Panda earns its price
on protection, and on billing in BRL with a nota fiscal, which Bunny cannot
issue to a Brazilian company.

**The abstraction is deliberately thin.** A `VideoProvider` interface covers
minting a signed playback URL and reading a real duration — the two things the
API needs — following the `EmailProvider` precedent. It stops at the player:
every vendor ships its own embed, so swapping vendors would still mean rewriting
the player component. Pretending otherwise would buy a false sense of
portability.

### Things flagged as risky

- **Per-email rate limiting is a lockout weapon.** Anyone who knows a client's
  address can burn their quota. It is deliberately loose (40/hour) with
  `skipSuccessfulRequests`, so a client typing the right password never spends
  any of it. The strict limits are per IP and per IP+email. Residual risk — a
  distributed flood temporarily locking one account — is accepted and visible in
  the audit log.
- **`SameSite=Lax` constrains DNS.** See **Infra requirements**.
- **In-memory rate limiting does not survive a second instance.** Fine on one
  container; the moment the API scales horizontally the limits become
  per-instance and effectively multiply. Redis is the fix, deferred.
- **`npm audit` reports a high-severity advisory in `deepmerge-ts`**, reached
  through `@prisma/config`. It is a Prisma **CLI** dependency — it never runs in
  the request path — and the input it merges is our own config file. The only
  offered fix downgrades Prisma to 6.12. Not taken; re-check when Prisma ships
  an updated `@prisma/config`.

---

## Infra requirements

Everything below is handled outside this repository.

**DNS — the one that will silently break production.** The refresh cookie is
`SameSite=Lax`, which a browser only sends when the API and the web app are
_same-site_, meaning they share a registrable domain. So
`app.kosmosgalaxy.com.br` → `api.kosmosgalaxy.com.br` works, and
`app.kosmosgalaxy.com.br` → `kosmos-api.fly.dev` sends no cookie at all: every
silent refresh fails in production while working perfectly in development. If
the API cannot share the domain, the cookie must become `SameSite=None; Secure`
and CSRF protection has to be added.

**`TRUST_PROXY` must match the real number of proxies.** Behind Caddy it is `1`.
Too low and every request appears to come from the proxy — rate limits collapse
into one shared bucket and every audit row records the same useless IP. Too high
and a client can forge their own IP by sending `X-Forwarded-For` themselves.

**The application's database role must not own `audit_logs`.** The append-only
triggers stop UPDATE and DELETE, but a table owner can still `TRUNCATE` the
table or drop the triggers. Migrations run as the owner; the API should connect
as a role with `SELECT, INSERT, UPDATE, DELETE` and no ownership.

**`DATABASE_URL_TEST`** must point at a throwaway database. The suite truncates
every table between tests.

**`JWT_SECRET`** at least 32 bytes (`openssl rand -base64 48`). The API refuses
to boot in production if it still holds the example value.

**Ports.** API `3333`, web `5173` in development. Both behind the reverse proxy
in production.

**Postgres region** São Paulo, per the Supabase project.

**Not yet needed, but coming:** Redis for shared rate limiting once the API runs
more than one instance; a transactional email vendor's API key; Panda Video
credentials in Phase 2.

---

## Testing

```bash
npm test                                    # both packages
npm test --workspace @kosmos/api            # integration tests, needs Postgres
npm test --workspace @kosmos/web            # component and unit tests
```

**132 API tests** run against a real PostgreSQL database — migrations included,
so the triggers and CHECK constraints under test are the real ones. Tests run
single-worker because they truncate between cases.

**The tenant isolation suite is the definition of done for Phase 0.** It proves a
`CLIENT_OWNER` from Tenant A cannot read, update or delete anything belonging to
Tenant B, including by knowing the exact target id, through the HTTP API and by
calling the data layer directly.

`content-isolation.test.ts` is the Phase 1 counterpart to the Phase 0 suite. The
library is shared on purpose — one Track row, many companies — so the question
is not "can Alfa read Beta's track?" but "can Alfa discover that Beta was given
anything at all?". It proves a client sees only their own assignments, only
published ones, never the Panda video id, and cannot reach an authoring endpoint
even for a track they legitimately have.

**20 web tests** cover the error-copy mapping, the login form, the route guard,
and refresh serialisation.

---

## Notes for the next phase

Phase 2 adds Panda Video, signed playback, the player, heartbeat telemetry and
sequential unlock. What Phase 1 already put in place for it:

- **`pandaVideoId` never leaves the API for a client.** `toPublicLesson` sends
  `hasVideo: boolean` instead. Phase 2 should add an endpoint that mints a
  short-lived signed URL per lesson, checked against the caller's assignment —
  not one that hands over the id.
- **Deleting content that has progress is already blocked.** `LESSON_HAS_PROGRESS`
  and `MODULE_HAS_PROGRESS` fire today against a `LessonProgress` table nothing
  writes yet. Once heartbeats land, those guards start doing real work.
- **`LessonProgress` and `WatchEvent` carry a denormalised `tenantId`** and are
  both in the guard's model map, so every progress query must be scoped. Writes
  must set the scalar `tenantId`, not reach it through a nested `connect`.
- **Sequential unlock needs an order that is trustworthy.** Positions are kept
  contiguous 0..n-1: appends take max+1, deletes renumber, and reorders rewrite
  the whole list. Code may rely on that.
- **`durationSeconds` is authored by hand today.** Panda reports the real
  duration; Phase 2 should fill it from the API rather than trusting the form.
