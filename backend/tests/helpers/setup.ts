import { beforeAll, afterAll } from 'vitest';
import { config } from 'dotenv';

config({ path: '.env.test' });

process.env.JWT_SECRET = 'test-secret-for-testing-only';
process.env.MONGO_URI = 'mongodb://localhost:27017/test';
process.env.NODE_ENV = 'test';
