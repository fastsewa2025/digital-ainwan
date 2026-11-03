/**
 * Creates the first super admin (the Mukhiya's account).
 *   ADMIN_EMAIL=mukhiya@example.com ADMIN_NAME="Name" npm run seed:admin
 * If ADMIN_PASSWORD is not set, a random one is generated and printed ONCE.
 * Either way the account must choose a new password at first sign-in.
 */
import crypto from 'node:crypto';
import { loadConfig } from '../config.js';
import { connectDb, disconnectDb } from '../db.js';
import { User } from '../models/index.js';
import { hashPassword, passwordProblem } from '../middleware/auth.js';

const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

const config = loadConfig();
const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const name = (process.env.ADMIN_NAME || 'Mukhiya').trim();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('Set ADMIN_EMAIL to a valid e-mail address (and optionally ADMIN_NAME, ADMIN_PASSWORD).');

await connectDb(config.mongoUri);
try {
  const existing = await User.findOne({ role: 'superadmin' });
  if (existing && !process.argv.includes('--force')) {
    console.log(`A super admin already exists (${existing.email}). Nothing changed. Use --force to add another one.`);
  } else {
    if (await User.exists({ email })) fail(`A user with ${email} already exists.`);
    let password = process.env.ADMIN_PASSWORD;
    const generated = !password;
    if (generated) password = crypto.randomBytes(12).toString('base64url');
    else if (passwordProblem(password, email)) fail(`ADMIN_PASSWORD: ${passwordProblem(password, email)}`);

    await User.create({ name, email, role: 'superadmin', passwordHash: await hashPassword(password), mustChangePassword: true });
    console.log(`\n✔ Super admin created: ${email}`);
    if (generated) console.log(`  Temporary password (shown only now): ${password}`);
    console.log('  You will be asked to choose a new password at first sign-in.\n');
  }
} finally {
  await disconnectDb();
}
