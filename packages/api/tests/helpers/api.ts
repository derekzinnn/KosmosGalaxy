import supertest from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { createApp } from '../../src/app.js';
import type { EmailMessage, EmailProvider } from '../../src/services/email/index.js';
import { setEmailProvider } from '../../src/services/email/index.js';
import { TEST_PASSWORD } from './factories.js';

export function api(): TestAgent {
  return supertest(createApp());
}

/**
 * Captures outgoing email instead of printing it, so tests can read the raw
 * invitation and reset links — which is the only place those tokens exist.
 */
export class CapturingEmailProvider implements EmailProvider {
  readonly name = 'capturing';
  readonly sent: EmailMessage[] = [];

  send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }

  lastLinkMatching(pattern: RegExp): string {
    for (let index = this.sent.length - 1; index >= 0; index -= 1) {
      const match = pattern.exec(this.sent[index]?.text ?? '');
      if (match?.[0]) return match[0];
    }
    throw new Error(`No sent email contained a link matching ${pattern.source}`);
  }
}

export function useCapturingEmails(): CapturingEmailProvider {
  const provider = new CapturingEmailProvider();
  setEmailProvider(provider);
  return provider;
}

export const INVITE_LINK = /http:\/\/[^\s]+\/invite\/[A-Za-z0-9_-]+/;
export const RESET_LINK = /http:\/\/[^\s]+\/reset-password\/[A-Za-z0-9_-]+/;

export function tokenFromLink(link: string): string {
  const token = link.split('/').pop();
  if (!token) throw new Error(`Could not extract a token from ${link}`);
  return token;
}

/** Log in through the real endpoint and return a usable access token. */
export async function loginAs(email: string, password = TEST_PASSWORD): Promise<string> {
  const response = await api().post('/auth/login').send({ email, password }).expect(200);

  return (response.body as { accessToken: string }).accessToken;
}

export function bearer(token: string): string {
  return `Bearer ${token}`;
}
