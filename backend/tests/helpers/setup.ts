import { config } from 'dotenv';

config({ path: '.env.test', override: true });

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-testing-only';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27027/posmono_test';
process.env.NODE_ENV = 'test';
