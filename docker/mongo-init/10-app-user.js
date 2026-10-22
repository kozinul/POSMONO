// Runs once, on the first boot of an empty `mongodb_data` volume (official image initdb).
// During initdb the entrypoint starts mongod WITHOUT `--auth`, so this script can create
// users without credentials. The goal is to keep the application off the root account:
// the app gets `readWrite` on its own database only, while root stays for admin/backup.
const appDatabase = process.env.MONGO_DATABASE || process.env.MONGO_INITDB_DATABASE || 'posmono';
const username = process.env.MONGO_APP_USERNAME;
const password = process.env.MONGO_APP_PASSWORD;

if (!username || !password) {
  throw new Error('MONGO_APP_USERNAME and MONGO_APP_PASSWORD must be set in docker/.env');
}
if (username === process.env.MONGO_INITDB_ROOT_USERNAME) {
  throw new Error('MONGO_APP_USERNAME must differ from MONGO_INITDB_ROOT_USERNAME');
}

const admin = db.getSiblingDB('admin');
if (admin.getUser(username)) {
  print(`app user "${username}" already exists — leaving it untouched`);
} else {
  admin.createUser({
    user: username,
    pwd: password,
    roles: [{ role: 'readWrite', db: appDatabase }],
  });
  print(`created app user "${username}" with readWrite on "${appDatabase}"`);
}
