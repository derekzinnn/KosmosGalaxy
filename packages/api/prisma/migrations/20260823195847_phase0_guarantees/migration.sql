-- ═══════════════════════════════════════════════════════════════════════════
--  Phase 0 database-level guarantees
--
--  These rules are enforced by PostgreSQL rather than by application code,
--  because a bug in the application must not be able to break them.
--  Prisma cannot express either of them in schema.prisma, so this migration
--  is hand-written and must be kept in step with the schema by hand.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. audit_logs is append-only ──────────────────────────────────────────
--
-- An audit log you can edit is not an audit log. Rows may only ever be
-- inserted; UPDATE and DELETE raise an exception no matter who issues them,
-- including the application's own connection.
--
-- Note on TRUNCATE: row-level triggers do not fire for TRUNCATE, and a
-- statement-level guard would also block `prisma migrate reset` and the test
-- harness. TRUNCATE already requires table-owner privileges, so this is
-- covered by not granting ownership to the application's database role in
-- production. See "Infra requirements" in CLAUDE.md.

CREATE OR REPLACE FUNCTION audit_logs_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();

CREATE TRIGGER audit_logs_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();

-- ── 2. Role and tenancy cannot contradict each other ──────────────────────
--
-- SUPERADMIN is Kosmos staff and belongs to no client company.
-- CLIENT_OWNER and CLIENT_MEMBER always belong to exactly one.
--
-- Without this constraint, a single bug could mint a "SUPERADMIN of Tenant A"
-- or a tenant-less CLIENT_OWNER that the tenant guard cannot scope. Both are
-- now rejected by the database itself.

ALTER TABLE users
  ADD CONSTRAINT users_tenant_role_consistency CHECK (
    (role = 'SUPERADMIN' AND tenant_id IS NULL)
    OR
    (role <> 'SUPERADMIN' AND tenant_id IS NOT NULL)
  );

-- The same invariant for invitations: you cannot invite someone to be a
-- SUPERADMIN of a tenant, nor a CLIENT_MEMBER of nothing.

ALTER TABLE invitations
  ADD CONSTRAINT invitations_tenant_role_consistency CHECK (
    (role = 'SUPERADMIN' AND tenant_id IS NULL)
    OR
    (role <> 'SUPERADMIN' AND tenant_id IS NOT NULL)
  );

-- ── 3. Emails are stored normalised ───────────────────────────────────────
--
-- The application lowercases and trims every email before writing it. This
-- constraint makes that a guarantee rather than a convention, so the UNIQUE
-- index on users.email cannot be bypassed with "Owner@Client.com".

ALTER TABLE users
  ADD CONSTRAINT users_email_normalised CHECK (email = lower(btrim(email)));

ALTER TABLE invitations
  ADD CONSTRAINT invitations_email_normalised CHECK (email = lower(btrim(email)));
