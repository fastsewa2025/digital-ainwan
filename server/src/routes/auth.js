import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models/index.js';
import {
  DUMMY_HASH, clearAuthCookie, comparePassword, hashPassword, newPasswordSchema, normalizePhone,
  passwordProblem, publicUser, requireAuth, setAuthCookie,
} from '../middleware/auth.js';
import { HttpError, validation } from '../lib/errors.js';
import { audit } from '../lib/audit.js';

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

const loginSchema = z
  .object({
    login: z.string().trim().max(160).optional(), // e-mail or mobile number
    email: z.string().trim().max(160).optional(), // older admin screens sent "email"
    password: z.string().min(1).max(128),
  })
  .refine((v) => v.login || v.email, { message: 'Required', path: ['login'] });

const blank = (v) => (v === '' || v == null ? undefined : v);
const mobile = z
  .string()
  .trim()
  .max(20)
  .transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid 10-digit mobile number' });
      return z.NEVER;
    }
    return p;
  });

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(100),
  phone: mobile,
  email: z.preprocess(blank, z.string().trim().toLowerCase().pipe(z.email('Enter a valid e-mail').max(160)).optional()),
  tola: z.string().trim().max(100).optional(),
  livesIn: z.enum(['village', 'outside'], { error: 'Choose one' }),
  place: z.string().trim().max(100).optional(),
  // Checked here too (not only after parsing), so every problem in the form is reported in one go.
  password: z
    .string()
    .max(128)
    .superRefine((pw, ctx) => {
      const problem = passwordProblem(pw, { role: 'villager' });
      if (problem) ctx.addIssue({ code: 'custom', message: problem });
    }),
  consent: z.literal(true, { error: 'Please tick this box to continue' }),
  website: z.string().max(200).optional(), // honeypot: real people never see or fill this
});

/** Finds an account by e-mail or by mobile number, whichever was typed. */
export function findByLogin(raw) {
  const id = String(raw).trim().toLowerCase();
  if (id.includes('@')) return User.findOne({ email: id });
  const phone = normalizePhone(id);
  return phone ? User.findOne({ phone }) : Promise.resolve(null);
}

export function authRouter({ limiters }) {
  const router = Router();

  router.post('/login', limiters.auth, async (req, res) => {
    const { config } = req.app.locals;
    const body = loginSchema.parse(req.body);
    const login = body.login || body.email;

    const user = await findByLogin(login);
    // Always run a hash comparison so timing does not reveal whether the account exists.
    const ok = await comparePassword(body.password, user?.passwordHash ?? DUMMY_HASH);

    if (user?.lockUntil && user.lockUntil > new Date()) {
      await audit(req, 'login_blocked', { summary: login });
      throw new HttpError(429, 'LOCKED', `Too many wrong attempts. Try again after ${LOCK_MINUTES} minutes.`);
    }

    if (!user || !user.active || !ok) {
      if (user) {
        const updated = await User.findByIdAndUpdate(user._id, { $inc: { failedLogins: 1 } }, { returnDocument: 'after' });
        if (updated.failedLogins >= MAX_FAILS) {
          await User.updateOne({ _id: user._id }, { $set: { lockUntil: new Date(Date.now() + LOCK_MINUTES * 60_000), failedLogins: 0 } });
        }
      }
      await audit(req, 'login_failed', { summary: login });
      throw new HttpError(401, 'BAD_CREDENTIALS', 'Wrong mobile number / e-mail or password');
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

  /** Villagers create their own account. It stays "pending" until an admin has verified it. */
  router.post('/register', limiters.register, async (req, res) => {
    const { config } = req.app.locals;
    const { website, password, consent: _consent, ...input } = registerSchema.parse(req.body);
    if (website) return res.status(201).json({ user: null }); // a bot filled the hidden field: pretend it worked

    const problems = [];
    const pwProblem = passwordProblem(password, { phone: input.phone, email: input.email, role: 'villager' });
    if (pwProblem) problems.push({ path: 'password', message: pwProblem });
    if (await User.exists({ phone: input.phone })) {
      problems.push({ path: 'phone', message: 'This mobile number is already registered. Sign in instead.' });
    }
    if (input.email && (await User.exists({ email: input.email }))) {
      problems.push({ path: 'email', message: 'This e-mail is already registered' });
    }
    if (problems.length) throw validation(problems);

    const user = await User.create({
      ...input,
      place: input.livesIn === 'outside' ? input.place : undefined,
      role: 'villager',
      status: 'pending',
      passwordHash: await hashPassword(password),
    });
    setAuthCookie(res, config, user);
    req.user = user;
    await audit(req, 'register', { docId: user._id, summary: `${user.name} (${user.tola || user.place || '—'})` });
    res.status(201).json({ user: publicUser(user) });
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
    const u = req.user;
    const body = z
      .object({
        currentPassword: z.string().min(1).max(128),
        newPassword: newPasswordSchema({ email: u.email, phone: u.phone, role: u.role }),
      })
      .parse(req.body);

    if (!(await comparePassword(body.currentPassword, u.passwordHash))) {
      throw new HttpError(400, 'WRONG_PASSWORD', 'Current password is not correct', [{ path: 'currentPassword', message: 'Not correct' }]);
    }
    if (body.newPassword === body.currentPassword) {
      throw new HttpError(400, 'SAME_PASSWORD', 'Choose a different password', [{ path: 'newPassword', message: 'Must be different from the current one' }]);
    }

    u.passwordHash = await hashPassword(body.newPassword);
    u.mustChangePassword = false;
    u.tokenVersion += 1; // signs out every other device
    await u.save();

    setAuthCookie(res, config, u);
    await audit(req, 'password_changed');
    res.json({ user: publicUser(u) });
  });

  return router;
}
