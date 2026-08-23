import { z } from 'zod';

/**
 * Password policy.
 *
 * Length is the only rule. Composition rules ("one uppercase, one symbol")
 * push people towards Password1! and are explicitly discouraged by NIST
 * SP 800-63B; a long passphrase is stronger and easier to remember. The upper
 * bound exists so nobody can hand argon2 a ten-megabyte string and tie up a
 * worker doing it.
 */
export const passwordSchema = z
  .string()
  .min(10, 'A senha precisa ter pelo menos 10 caracteres')
  .max(200, 'A senha é longa demais');

/**
 * Trimmed and lowercased before validation, not after.
 *
 * People paste addresses with a trailing space and type them with capitals.
 * Rejecting " Ze@Padaria.com.br " as malformed would be technically defensible
 * and practically useless. Normalising first also means the value that reaches
 * the database already satisfies the users_email_normalised CHECK constraint.
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Informe um e-mail válido').max(254));

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Informe seu nome completo')
  .max(120, 'O nome é longo demais');

export const roleSchema = z.enum(['SUPERADMIN', 'CLIENT_OWNER', 'CLIENT_MEMBER']);
