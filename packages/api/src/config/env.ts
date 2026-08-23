import 'dotenv/config';
import { z } from 'zod';

/**
 * Every environment variable this service reads, validated once at startup.
 *
 * The service refuses to boot on invalid configuration rather than failing
 * later on a request. A missing JWT_SECRET should be a crash on line one,
 * not a 500 at 3am.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3333),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DATABASE_URL_TEST: z.string().min(1).optional(),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

    ACCESS_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(60 * 15),
    REFRESH_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(60 * 60 * 24 * 30),
    INVITATION_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(60 * 60 * 24 * 7),
    PASSWORD_RESET_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(60 * 60),

    WEB_APP_URL: z.url('WEB_APP_URL must be a full URL, e.g. https://app.kosmosgalaxy.com.br'),
    COOKIE_DOMAIN: z.string().optional(),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),

    EMAIL_PROVIDER: z.enum(['console']).default('console'),
    EMAIL_FROM: z.string().min(1).default('Kosmos Galaxy <nao-responda@kosmosgalaxy.com.br>'),

    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === 'production' && value.JWT_SECRET.includes('change-me')) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET still holds the example value from .env.example',
      });
    }
    if (value.NODE_ENV === 'test' && !value.DATABASE_URL_TEST) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL_TEST'],
        message: 'DATABASE_URL_TEST is required when NODE_ENV=test',
      });
    }
  });

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }

  const value = parsed.data;
  const isTest = value.NODE_ENV === 'test';

  return {
    ...value,
    /**
     * Tests never touch the development database. Resolving the URL here
     * rather than at each call site means no test file can get this wrong.
     */
    databaseUrl: isTest ? (value.DATABASE_URL_TEST ?? value.DATABASE_URL) : value.DATABASE_URL,
    isProduction: value.NODE_ENV === 'production',
    isDevelopment: value.NODE_ENV === 'development',
    isTest,
  };
}

export const env = loadEnv();
export type Env = typeof env;
