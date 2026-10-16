import { env } from './env';

export interface EnvLike {
  NODE_ENV?: string;
  MONGO_URI?: string;
  JWT_SECRET?: string;
}

/**
 * Secrets that ship inside this repo as `.env.example` values (or test fixtures).
 * A production boot must never use one — copying `.env.example` verbatim is the
 * single most likely way a deploy leaks a forgeable JWT.
 */
const PLACEHOLDER_JWT_SECRETS = new Set([
  'dev-secret-change-in-production',
  'change-this-to-a-random-secret',
  'your-super-secret-key-change-in-production',
  'test-secret-for-testing-only',
  'secret',
  'changeme',
  'change-me',
]);

/** `openssl rand -hex 32` yields 64 chars; anything shorter is brute-forceable offline. */
export const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Validates the process environment. Accepts an explicit candidate so the rules can be
 * unit-tested without mutating `process.env` and re-importing the env module.
 */
export function validateEnv(candidate: EnvLike = env): void {
  const errors: string[] = [];
  const nodeEnv = candidate.NODE_ENV ?? '';
  const isProduction = nodeEnv === 'production';

  const jwtSecret = (candidate.JWT_SECRET ?? '').trim();
  if (!jwtSecret) {
    errors.push('JWT_SECRET must be non-empty');
  } else if (isProduction) {
    if (PLACEHOLDER_JWT_SECRETS.has(jwtSecret.toLowerCase())) {
      errors.push(
        'JWT_SECRET is still a placeholder value from .env.example — generate one with `openssl rand -hex 32`',
      );
    } else if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
      errors.push(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters in production`);
    }
  }

  if (!candidate.MONGO_URI) {
    errors.push('MONGO_URI must be non-empty');
  }

  const validEnvs = ['development', 'test', 'production'];
  if (!validEnvs.includes(nodeEnv)) {
    errors.push(`NODE_ENV must be one of: ${validEnvs.join(', ')}`);
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }
}
