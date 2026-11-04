#!/usr/bin/env node
/**
 * Creates ".env" from ".env.example" and fills the secrets with strong random values.
 *
 *   node scripts/gen-secrets.mjs            create .env (it will not overwrite an existing one)
 *   node scripts/gen-secrets.mjs --print    only print new secrets, change nothing
 *
 * No Node on the server? Use Docker instead:
 *   docker run --rm -v "$PWD":/w -w /w node:22-alpine node scripts/gen-secrets.mjs
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Hex: only 0-9 and a-f. Safe inside a database address, in shell commands, and never starts with "-".
const secret = (bytes) => crypto.randomBytes(bytes).toString('hex');
const values = {
  JWT_SECRET: secret(48),
  MONGO_ROOT_PASSWORD: secret(24),
  APP_DB_PASSWORD: secret(24),
};

if (process.argv.includes('--print')) {
  for (const [key, value] of Object.entries(values)) console.log(`${key}=${value}`);
  process.exit(0);
}

const target = path.join(root, '.env');
if (fs.existsSync(target)) {
  console.error(
    '\n.env already exists, so nothing was changed.\n' +
      'Changing the database passwords in .env after the first start would lock the app out of its own database.\n' +
      'If you really need new secrets, run with --print and read DEPLOYMENT.md ("Changing a secret").\n',
  );
  process.exit(1);
}

let text = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
for (const [key, value] of Object.entries(values)) {
  text = text.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`);
}
fs.writeFileSync(target, text, { mode: 0o600 });

console.log(`
.env created with fresh random secrets.

Next:
  1. Open .env and set SITE_ADDRESS and PUBLIC_URL to your real domain.
  2. Start everything:   docker compose up -d --build
  3. Make the first admin account (see DEPLOYMENT.md, step 6).

Keep a copy of .env somewhere safe (not on GitHub). Without it a backup cannot be put back.
`);
