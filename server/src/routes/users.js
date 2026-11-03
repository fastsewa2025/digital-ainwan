import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models/index.js';
import { hashPassword } from '../middleware/auth.js';
import { audit } from '../lib/audit.js';
import { HttpError, notFound, validation } from '../lib/errors.js';

const ID = /^[a-f0-9]{24}$/i;
const tempPassword = () => crypto.randomBytes(9).toString('base64url'); // 12 chars, shown once

const safe = (u) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  role: u.role,
  active: u.active,
  mustChangePassword: u.mustChangePassword,
  lastLoginAt: u.lastLoginAt,
  createdAt: u.createdAt,
});

const createSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name').max(100),
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid e-mail').max(160)),
  role: z.enum(['editor', 'superadmin']).default('editor'),
});
const patchSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  role: z.enum(['editor', 'superadmin']).optional(),
  active: z.boolean().optional(),
});

/** Mounted under /api/admin/users, super admin only. */
export function usersRouter() {
  const router = Router();

  router.get('/', async (_req, res) => {
    const users = await User.find().sort({ createdAt: 1 }).lean();
    res.json({ items: users.map(safe) });
  });

  router.post('/', async (req, res) => {
    const input = createSchema.parse(req.body);
    if (await User.exists({ email: input.email })) {
      throw validation([{ path: 'email', message: 'A user with this e-mail already exists' }]);
    }
    const password = tempPassword();
    const user = await User.create({ ...input, passwordHash: await hashPassword(password), mustChangePassword: true });
    await audit(req, 'user_create', { docId: user._id, summary: `${user.email} (${user.role})` });
    res.status(201).json({ user: safe(user), tempPassword: password });
  });

  router.patch('/:id', async (req, res) => {
    if (!ID.test(req.params.id)) throw notFound();
    const patch = patchSchema.parse(req.body);
    const user = await User.findById(req.params.id);
    if (!user) throw notFound();

    if (String(user._id) === String(req.user._id) && (patch.role !== undefined || patch.active === false)) {
      throw new HttpError(400, 'SELF_LOCKOUT', 'You cannot change your own role or deactivate yourself');
    }
    if (patch.name !== undefined) user.name = patch.name;
    if (patch.role !== undefined) user.role = patch.role;
    if (patch.active !== undefined) {
      user.active = patch.active;
      if (!patch.active) user.tokenVersion += 1; // end their sessions immediately
    }
    if (patch.role !== undefined) user.tokenVersion += 1;
    await user.save();
    await audit(req, 'user_update', { docId: user._id, summary: `${user.email}: ${JSON.stringify(patch)}` });
    res.json({ user: safe(user) });
  });

  router.post('/:id/reset-password', async (req, res) => {
    if (!ID.test(req.params.id)) throw notFound();
    const user = await User.findById(req.params.id);
    if (!user) throw notFound();
    const password = tempPassword();
    user.passwordHash = await hashPassword(password);
    user.mustChangePassword = true;
    user.tokenVersion += 1;
    user.failedLogins = 0;
    user.lockUntil = undefined;
    await user.save();
    await audit(req, 'user_reset_password', { docId: user._id, summary: user.email });
    res.json({ user: safe(user), tempPassword: password });
  });

  return router;
}
