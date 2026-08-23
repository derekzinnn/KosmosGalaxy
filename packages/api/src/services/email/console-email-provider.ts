import { logger } from '../../lib/logger.js';
import type { EmailMessage, EmailProvider } from './email-provider.js';

/**
 * Development provider: prints the message instead of sending it.
 *
 * The raw invitation and reset links only ever exist in the email body, so
 * during development this console output is how you get them. It writes with
 * `process.stdout` rather than the logger because the logger redacts tokens,
 * which would defeat the entire purpose.
 */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console';

  send(message: EmailMessage): Promise<void> {
    const divider = '─'.repeat(72);
    process.stdout.write(
      [
        '',
        divider,
        `📧  EMAIL (not actually sent — EMAIL_PROVIDER=console)`,
        `    To:      ${message.to}`,
        `    Subject: ${message.subject}`,
        divider,
        message.text,
        divider,
        '',
      ].join('\n'),
    );
    logger.debug({ to: message.to, subject: message.subject }, 'Email dispatched to console');
    return Promise.resolve();
  }
}
