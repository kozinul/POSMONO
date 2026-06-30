import { MongoMemoryServer } from 'mongodb-memory-server';

async function main() {
  process.env.MONGOMS_VERSION = '7.3.4';
  process.env.MONGOMS_DOWNLOAD_URL = 'https://fastdl.mongodb.org/linux/mongodb-linux-aarch64-ubuntu2204-7.3.4.tgz';
  const mongod = await MongoMemoryServer.create({
    instance: { dbName: 'posmono', port: 27018 },
    binary: { version: '7.3.4' },
  });
  console.log(`MongoDB memory server started at ${mongod.getUri()}`);
  console.log(`Listening on port 27018`);
  process.on('SIGINT', async () => {
    await mongod.stop();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await mongod.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
