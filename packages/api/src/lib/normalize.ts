/**
 * Emails are stored lowercase and trimmed so that "Owner@Client.com " and
 * "owner@client.com" cannot become two accounts that both think they are the
 * same person. A CHECK constraint in the database enforces the same rule, so
 * forgetting to call this here fails loudly rather than quietly.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
