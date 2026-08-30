import { config } from 'dotenv';

config({ path: '.env.test', override: true });

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-testing-only';
process.env.NODE_ENV = 'test';