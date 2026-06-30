import { beforeAll, afterAll } from 'vitest';
import { config } from 'dotenv';

config({ path: '.env.test' });

process.env.JWT_SECRET = 'test-secret-for-testing-only';
process.env.MONGO_URI = 'mongodb://localhost:27017/test';
process.env.NODE_ENV = 'test';
process.env.MONGOMS_VERSION = '7.3.4';
process.env.MONGOMS_DOWNLOAD_URL = 'https://fastdl.mongodb.org/linux/mongodb-linux-aarch64-ubuntu2204-7.3.4.tgz';
