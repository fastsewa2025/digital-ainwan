/**
 * Emergency password reset from the server console (e.g. the Mukhiya forgot the password
 * and no other super admin exists):
 *   npm run user:reset-password -- someone@example.com
 */
import crypto from 'node:crypto';
import { loadConfig } from '../config.js';
import { connectDb, disconnectDb } from '../db.js';
import { User } from '../models/index.js';
import { hashPassword } from '../middleware/auth.js';

const email = (process.argv[2] || '').trim().toLowerCase();
if (!email) {
  console.error('Usage: npm run user:reset-password -- user@example.com');
  process.exit(1);
}

const config = loadConfig();
await connectDb(config.mongoUri);
try {
  const user = await User.findOne({ email });
  if (!user) {
    console.error(`\n✖ No user with e-mail ${email}\n`);
    process.exitCode = 1;
  } else {
    const password = crypto.randomBytes(12).toString('base64url');
    user.passwordHash = await hashPassword(password);
    user.mustChangePassword = true;
    user.active = true;
    user.failedLogins = 0;
    user.lockUntil = undefined;
    user.tokenVersion += 1;
    await user.save();
    console.log(`\n✔ Password reset for ${email}\n  Temporary password (shown only now): ${password}\n`);
  }
} finally {
  await disconnectDb();
}
