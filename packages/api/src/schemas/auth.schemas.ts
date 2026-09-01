import { z } from 'zod';
import { emailSchema, passwordSchema } from './common.js';

export const loginSchema = z.object({
  email: emailSchema,
  // Deliberately not `passwordSchema`: an existing password created under an
  // older policy must still be able to log in. Only *setting* a password is
  // held to the current rules.
  password: z.string().min(1, 'Informe sua senha').max(200),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Informe seu nome')
    .max(120, 'O nome é longo demais'),
});

export type LoginBody = z.infer<typeof loginSchema>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileBody = z.infer<typeof updateProfileSchema>;
