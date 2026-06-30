import { env } from './env';

export function validateEnv(): void {
  const errors: string[] = [];

  if (!env.JWT_SECRET) {
    errors.push('JWT_SECRET must be non-empty');
  } else if (env.NODE_ENV === 'production' && env.JWT_SECRET === 'dev-secret-change-in-production') {
    errors.push('JWT_SECRET must not be the default value in production');
  }

  if (!env.MONGO_URI) {
    errors.push('MONGO_URI must be non-empty');
  }

  const validEnvs = ['development', 'test', 'production'];
  if (!validEnvs.includes(env.NODE_ENV)) {
    errors.push(`NODE_ENV must be one of: ${validEnvs.join(', ')}`);
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }
}
