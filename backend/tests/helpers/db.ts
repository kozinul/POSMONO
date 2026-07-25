import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27027/posmono_test';

export async function setupTestDb(): Promise<string> {
  await mongoose.connect(MONGO_URI);
  return MONGO_URI;
}

export async function teardownTestDb(): Promise<void> {
  await mongoose.disconnect();
}

export async function clearCollections(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}
