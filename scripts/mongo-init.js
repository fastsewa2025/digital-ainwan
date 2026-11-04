// Runs ONCE, the first time the database starts with an empty data volume.
// Creates a user that can only read and write the website's own database.
// The website never uses the all-powerful "root" account.
const dbName = process.env.APP_DB_NAME;
const user = process.env.APP_DB_USER;
const pwd = process.env.APP_DB_PASSWORD;

if (!dbName || !user || !pwd) {
  throw new Error('APP_DB_NAME, APP_DB_USER and APP_DB_PASSWORD must be set in .env');
}

db.getSiblingDB(dbName).createUser({
  user,
  pwd,
  roles: [{ role: 'readWrite', db: dbName }],
});
print(`Created database user "${user}" for database "${dbName}".`);
