import type { Prisma } from '../generated/prisma/client.js';
import type { Role, UserStatus } from '../generated/prisma/enums.js';
import type { ScopedDb } from '../db/scoped-db.js';
import { normalizeEmail } from '../lib/normalize.js';

export interface CreateUserInput {
  readonly tenantId: string | null;
  readonly email: string;
  readonly passwordHash: string;
  readonly name: string;
  readonly role: Role;
}

export function findUserByEmail(db: ScopedDb, email: string): Promise<Prisma.UserModel | null> {
  return db.user.findFirst({ where: { email: normalizeEmail(email) } });
}

export function findUserById(db: ScopedDb, id: string): Promise<Prisma.UserModel | null> {
  return db.user.findFirst({ where: { id } });
}

export function createUser(db: ScopedDb, input: CreateUserInput): Promise<Prisma.UserModel> {
  return db.user.create({
    tenantId: input.tenantId,
    email: normalizeEmail(input.email),
    passwordHash: input.passwordHash,
    name: input.name.trim(),
    role: input.role,
  });
}

export function listUsers(db: ScopedDb, tenantId?: string): Promise<Prisma.UserModel[]> {
  return db.user.findMany({
    where: tenantId ? { tenantId } : {},
    orderBy: [{ createdAt: 'asc' }],
  });
}

export function updateUserPassword(
  db: ScopedDb,
  id: string,
  passwordHash: string,
): Promise<Prisma.UserModel> {
  return db.user.update({ where: { id }, data: { passwordHash } });
}

export function updateUserRole(db: ScopedDb, id: string, role: Role): Promise<Prisma.UserModel> {
  return db.user.update({ where: { id }, data: { role } });
}

export function updateUserStatus(
  db: ScopedDb,
  id: string,
  status: UserStatus,
): Promise<Prisma.UserModel> {
  return db.user.update({ where: { id }, data: { status } });
}

export function recordLogin(db: ScopedDb, id: string): Promise<Prisma.UserModel> {
  return db.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
}
