import { homedir } from 'os';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import type { MongoMemoryServer } from 'mongodb-memory-server';

let memoryServer: MongoMemoryServer | null = null;

export interface TestDbInfo {
  uri: string;
  inMemory: boolean;
}

function resolveSystemBinary(): string | undefined {
  const explicit = process.env.MONGO_SYSTEM_BINARY;
  if (explicit) return explicit || undefined;

  const cacheDir = path.join(homedir(), '.cache', 'mongodb-binaries');
  try {
    const files = fs.readdirSync(cacheDir);
    const candidate = files.filter((f) => f.startsWith('mongod-')).sort().pop();
    if (candidate) return path.join(cacheDir, candidate);
  } catch {
    // no cached binary — let mongodb-memory-server download its own
  }
  return undefined;
}

async function startMemoryServer(): Promise<void> {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const systemBinary = resolveSystemBinary();
  const binaryConfig = systemBinary
    ? { version: '7.3.4', systemBinary }
    : undefined;
  memoryServer = await MongoMemoryServer.create(binaryConfig ? { binary: binaryConfig } : {});
  await mongoose.connect(memoryServer.getUri());
}

export async function setupTestDb(): Promise<TestDbInfo> {
  const externalUri = process.env.MONGO_URI?.trim();
  if (externalUri) {
    await mongoose.connect(externalUri);
    return { uri: externalUri, inMemory: false };
  }
  await startMemoryServer();
  return { uri: memoryServer ? memoryServer.getUri() : '', inMemory: true };
}

export async function teardownTestDb(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

export async function clearCollections(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}