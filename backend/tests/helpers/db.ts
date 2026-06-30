import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod: MongoMemoryServer;

export async function setupTestDb(): Promise<string> {
  mongod = await MongoMemoryServer.create({
    instance: { dbName: 'test' },
  });
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  return uri;
}

export async function teardownTestDb(): Promise<void> {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

export async function clearCollections(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

export function getMongod(): MongoMemoryServer {
  return mongod!;
}
