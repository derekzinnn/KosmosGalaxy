import { env } from '../../config/env.js';
import { ConsoleEmailProvider } from './console-email-provider.js';
import type { EmailProvider } from './email-provider.js';

let provider: EmailProvider | undefined;

/**
 * Phase 0 ships one implementation on purpose. The transactional email vendor
 * is an open product decision, and the interface means it can be answered
 * later without touching a single service.
 */
export function emailProvider(): EmailProvider {
  provider ??= (() => {
    switch (env.EMAIL_PROVIDER) {
      case 'console':
        return new ConsoleEmailProvider();
    }
  })();
  return provider;
}

/** Test seam: lets integration tests capture what would have been sent. */
export function setEmailProvider(next: EmailProvider): void {
  provider = next;
}

export type { EmailMessage, EmailProvider } from './email-provider.js';
