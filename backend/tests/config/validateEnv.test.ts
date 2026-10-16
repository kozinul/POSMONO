import { describe, it, expect } from 'vitest';
import { validateEnv, MIN_JWT_SECRET_LENGTH } from '../../src/@shared/config/validateEnv';

const STRONG_SECRET = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const BASE = { NODE_ENV: 'production', MONGO_URI: 'mongodb://mongodb:27017/posmono' };

describe('validateEnv — JWT_SECRET', () => {
  it('rejects every placeholder value that ships in .env.example', () => {
    const placeholders = [
      'dev-secret-change-in-production',
      'change-this-to-a-random-secret',
      'your-super-secret-key-change-in-production',
      'change-me',
    ];

    for (const placeholder of placeholders) {
      expect(() => validateEnv({ ...BASE, JWT_SECRET: placeholder })).toThrow(/JWT_SECRET/);
    }
  });

  it('rejects a placeholder regardless of case or surrounding whitespace', () => {
    expect(() => validateEnv({ ...BASE, JWT_SECRET: '  CHANGE-ME  ' })).toThrow(/JWT_SECRET/);
  });

  it('rejects a short secret but accepts one at exactly the minimum length', () => {
    expect(() =>
      validateEnv({ ...BASE, JWT_SECRET: 'a'.repeat(MIN_JWT_SECRET_LENGTH - 1) }),
    ).toThrow(/at least/);

    expect(() =>
      validateEnv({ ...BASE, JWT_SECRET: 'a'.repeat(MIN_JWT_SECRET_LENGTH) }),
    ).not.toThrow();
  });

  it('accepts a strong production secret', () => {
    expect(() => validateEnv({ ...BASE, JWT_SECRET: STRONG_SECRET })).not.toThrow();
  });

  it('rejects an empty secret in every environment', () => {
    expect(() => validateEnv({ ...BASE, JWT_SECRET: '   ' })).toThrow(/non-empty/);
    expect(() =>
      validateEnv({ NODE_ENV: 'development', MONGO_URI: BASE.MONGO_URI, JWT_SECRET: '' }),
    ).toThrow(/non-empty/);
  });

  it('keeps development permissive so local boots do not need a generated secret', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        MONGO_URI: BASE.MONGO_URI,
        JWT_SECRET: 'dev-secret-change-in-production',
      }),
    ).not.toThrow();
  });
});

describe('validateEnv — other variables', () => {
  it('rejects an empty MONGO_URI', () => {
    expect(() => validateEnv({ ...BASE, MONGO_URI: '', JWT_SECRET: STRONG_SECRET })).toThrow(
      /MONGO_URI/,
    );
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() =>
      validateEnv({ NODE_ENV: 'staging', MONGO_URI: BASE.MONGO_URI, JWT_SECRET: STRONG_SECRET }),
    ).toThrow(/NODE_ENV/);
  });

  it('reports every problem at once instead of failing one at a time', () => {
    let message = '';
    try {
      validateEnv({ NODE_ENV: 'staging', MONGO_URI: '', JWT_SECRET: '' });
    } catch (err) {
      message = (err as Error).message;
    }

    expect(message).toMatch(/JWT_SECRET/);
    expect(message).toMatch(/MONGO_URI/);
    expect(message).toMatch(/NODE_ENV/);
  });
});
