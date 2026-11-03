import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models/index.js';
import {
  DUMMY_HASH, clearAuthCookie, comparePassword, hashPassword, newPasswordSchema,
  publicUser, requireAuth, setAuthCookie,
} from '../middleware/auth.js';
import { HttpError } from '../lib/errors.js';
import { audit } from '../lib/audit.js';

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(160)),
  password: z.string().min(1).max(128),
});

export function authRouter({ limiters }) {
  const router = Router();

  router.post('/login', limiters.auth, async (req, res) => {
    const { config } = req.app.locals;
    const { email, password } = loginSchema.parse(req.body);

    const user = await User.findOne({ email });
    // Always run a hash comparison so timing does not reveal whether the e-mail exists.
    const ok = await comparePassword(password, user?.passwordHash ?? DUMMY_HASH);

    if (user?.lockUntil && user.lockUntil > new Date()) {
      await audit(req, 'login_blocked', { summary: email });
      throw new HttpError(429, 'LOCKED', `Too many wrong attempts. Try again after ${LOCK_MINUTES} minutes.`);
    }

    if (!user || !user.active || !ok) {
      if (user) {
        const updated = await User.findByIdAndUpdate(user._id, { $inc: { failedLogins: 1 } }, { returnDocument: 'after' });
        if (updated.failedLogins >= MAX_FAILS) {
          await User.updateOne({ _id: user._id }, { $set: { lockUntil: new Date(Date.now() + LOCK_MINUTES * 60_000), failedLogins: 0 } });
        }
      }
      await audit(req, 'login_failed', { summary: email });
      throw new HttpError(401, 'BAD_CREDENTIALS', 'Invalid e-mail or password');
    }

    user.failedLogins = 0;
    user.lockUntil = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    setAuthCookie(res, config, user);
    req.user = user;
    await audit(req, 'login');
    res.json({ user: publicUser(user) });
  });

  router.post('/logout', (req, res) => {
    clearAuthCookie(res, req.app.locals.config);
    res.json({ ok: true });
  });

  router.get('/me', requireAuth, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ user: publicUser(req.user) });
  });

  router.post('/change-password', limiters.auth, requireAuth, async (req, res) => {
    const { config } = req.app.locals;
    const body = z
      .object({ currentPassword: z.string().min(1).max(128), newPassword: newPasswordSchema(req.user.email) })
      .parse(req.body);

    if (!(await comparePassword(body.currentPassword, req.user.passwordHash))) {
      throw new HttpError(400, 'WRONG_PASSWORD', 'Current password is not correct', [{ path: 'currentPassword', message: 'Not correct' }]);
    }
    if (body.newPassword === body.currentPassword) {
      throw new HttpError(400, 'SAME_PASSWORD', 'Choose a different password', [{ path: 'newPassword', message: 'Must be different from the current one' }]);
    }

    req.user.passwordHash = await hashPassword(body.newPassword);
    req.user.mustChangePassword = false;
    req.user.tokenVersion += 1; // signs out every other device
    await req.user.save();

    setAuthCookie(res, config, req.user);
    await audit(req, 'password_changed');
    res.json({ user: publicUser(req.user) });
  });

  return router;
}
