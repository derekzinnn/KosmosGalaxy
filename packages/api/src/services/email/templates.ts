/**
 * Email copy.
 *
 * Everything here is read by a client, so it is written in Brazilian
 * Portuguese. Function and variable names stay in English like the rest of
 * the codebase.
 */
import type { EmailMessage } from './email-provider.js';

interface InvitationEmailInput {
  readonly to: string;
  readonly tenantName: string;
  readonly inviterName: string;
  readonly acceptUrl: string;
  readonly expiresInDays: number;
}

export function invitationEmail(input: InvitationEmailInput): EmailMessage {
  return {
    to: input.to,
    subject: `Seu acesso ao Universo Kosmos está pronto`,
    text: [
      `Olá!`,
      ``,
      `${input.inviterName} convidou você para acessar o Universo Kosmos, a plataforma`,
      `de onboarding da Kosmos, em nome de ${input.tenantName}.`,
      ``,
      `Para criar sua senha e começar, acesse:`,
      ``,
      input.acceptUrl,
      ``,
      `Este convite é pessoal e vale por ${input.expiresInDays} dias.`,
      `Se você não esperava este e-mail, pode ignorá-lo com segurança.`,
      ``,
      `— Equipe Kosmos`,
    ].join('\n'),
  };
}

interface PasswordResetEmailInput {
  readonly to: string;
  readonly resetUrl: string;
  readonly expiresInMinutes: number;
}

export function passwordResetEmail(input: PasswordResetEmailInput): EmailMessage {
  return {
    to: input.to,
    subject: `Redefinição de senha — Universo Kosmos`,
    text: [
      `Recebemos um pedido para redefinir a senha da sua conta no Universo Kosmos.`,
      ``,
      `Para escolher uma nova senha, acesse:`,
      ``,
      input.resetUrl,
      ``,
      `O link vale por ${input.expiresInMinutes} minutos e só pode ser usado uma vez.`,
      ``,
      `Se você não pediu esta redefinição, ignore este e-mail. Sua senha atual`,
      `continua funcionando normalmente.`,
      ``,
      `— Equipe Kosmos`,
    ].join('\n'),
  };
}
