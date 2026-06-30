import jwt from 'jsonwebtoken';

const TEST_SECRET = 'test-secret-for-testing-only';

interface TokenPayload {
  sub: string;
  tenant: string;
  role: string;
  [key: string]: unknown;
}

export function generateTestToken(overrides?: Partial<TokenPayload>): string {
  const payload: TokenPayload = {
    sub: overrides?.sub || 'user-test-1',
    tenant: overrides?.tenant || 'tenant-test-1',
    role: overrides?.role || 'owner',
    ...overrides,
  };

  return jwt.sign(payload, TEST_SECRET, { expiresIn: '1h' });
}

export function generateExpiredToken(): string {
  const payload: TokenPayload = {
    sub: 'user-test-1',
    tenant: 'tenant-test-1',
    role: 'owner',
  };

  return jwt.sign(payload, TEST_SECRET, { expiresIn: '0s' });
}

export { TEST_SECRET };
