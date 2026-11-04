import fs from 'node:fs';

// Reads the optional ".env" file in the project folder (the one next to docker-compose.yml).
// Variables that are already set, for example by Docker, are never overwritten.
// This is done in code and not with "node --env-file", because "node --watch" crashes
// when the file named there does not exist.
const file = new URL('../../.env', import.meta.url);
if (fs.existsSync(file)) process.loadEnvFile(file);
