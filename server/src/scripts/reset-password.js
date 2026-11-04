/**
 * Emergency password reset from the server console (e.g. the Mukhiya forgot the password
 * and no other super admin exists):
 *   npm run user:reset-password -- someone@example.com
 *   npm run user:reset-password -- 9876543210        (mobile number works too)
 */
import crypto from 'node:crypto';
import { loadConfig } from '../config.js';
import { connectDb, disconnectDb } from '../db.js';
import { User } from '../models/index.js';
import { hashPassword, normalizePhone } from '../middleware/auth.js';

const email = (process.argv[2] || '').trim().toLowerCase();
if (!email) {
  console.error('Usage: npm run user:reset-password -- user@example.com   (or a 10-digit mobile number)');
  process.exit(1);
}
const query = email.includes('@') ? { email } : { phone: normalizePhone(email) ?? '-' };

const config = loadConfig();
await connectDb(config.mongoUri);
try {
  const user = await User.findOne(query);
  if (!user) {
    console.error(`\n✖ No user with e-mail / mobile ${email}\n`);
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
