import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models/index.js';
import { canManage, hashPassword, normalizePhone } from '../middleware/auth.js';
import { audit, who } from '../lib/audit.js';
import { HttpError, forbidden, notFound, validation } from '../lib/errors.js';

const ID = /^[a-f0-9]{24}$/i;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const tempPassword = () => crypto.randomBytes(9).toString('base64url'); // 12 chars, shown once
const blank = (v) => (v === '' || v == null ? undefined : v);

// What staff see about an account. Never the password hash or lock counters.
const safe = (u) => ({
  id: String(u._id),
  name: u.name,
  email: u.email ?? null,
  phone: u.phone ?? null,
  role: u.role,
  status: u.status ?? 'active',
  rejectReason: u.rejectReason ?? null,
  tola: u.tola ?? '',
  livesIn: u.livesIn ?? null,
  place: u.place ?? '',
  active: u.active,
  mustChangePassword: u.mustChangePassword,
  verifiedBy: u.verifiedBy?.name ?? null,
  verifiedAt: u.verifiedAt ?? null,
  lastLoginAt: u.lastLoginAt ?? null,
  createdAt: u.createdAt,
});

const phoneField = z.preprocess(
  blank,
  z
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
    })
    .optional(),
);
const emailField = z.preprocess(blank, z.string().trim().toLowerCase().pipe(z.email('Enter a valid e-mail').max(160)).optional());

const createSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter a name').max(100),
    email: emailField,
    phone: phoneField,
    role: z.enum(['villager', 'admin', 'superadmin']).default('villager'),
    tola: z.string().trim().max(100).optional(),
  })
  .refine((v) => v.email || v.phone, { message: 'Give an e-mail or a mobile number', path: ['phone'] });

const patchSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  role: z.enum(['villager', 'admin', 'superadmin']).optional(),
  active: z.boolean().optional(),
  tola: z.string().trim().max(100).optional(),
});

const listSchema = z.object({
  kind: z.enum(['villagers', 'staff']).default('villagers'),
  status: z.enum(['pending', 'active', 'rejected', 'all']).default('all'),
  q: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

/** There must always be at least one active super admin, or nobody could manage the website. */
async function keepOneSuper(target, patch) {
  const losesSuper =
    target.role === 'superadmin' && ((patch.role && patch.role !== 'superadmin') || patch.active === false);
  if (!losesSuper) return;
  const others = await User.countDocuments({ _id: { $ne: target._id }, role: 'superadmin', active: true });
  if (others === 0) throw new HttpError(400, 'LAST_SUPERADMIN', 'At least one active super admin must remain');
}

async function loadManageable(req) {
  if (!ID.test(req.params.id)) throw notFound();
  const target = await User.findById(req.params.id);
  if (!target) throw notFound();
  if (String(target._id) === String(req.user._id)) {
    throw new HttpError(400, 'SELF_LOCKOUT', 'You cannot change your own role or deactivate yourself');
  }
  if (!canManage(req.user, target)) throw forbidden('You can manage only accounts below your own level');
  return target;
}

/**
 * Mounted under /api/admin/users for admins and super admins.
 *   admin:      sees and manages villagers only (verify, switch off, reset password, add)
 *   superadmin: everyone, including roles
 */
export function usersRouter() {
  const router = Router();
  const isSuper = (req) => req.user.role === 'superadmin';

  router.get('/', async (req, res) => {
    const q = listSchema.parse(req.query);
    if (q.kind === 'staff' && !isSuper(req)) throw forbidden();
    const filter = q.kind === 'staff' ? { role: { $in: ['admin', 'superadmin'] } } : { role: 'villager' };
    if (q.status !== 'all') filter.status = q.status;
    if (q.q) {
      const rx = new RegExp(escapeRegex(q.q), 'i');
      filter.$or = [{ name: rx }, { phone: rx }, { email: rx }, { tola: rx }, { place: rx }];
    }
    const [items, total, pending] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * 50).limit(50).lean(),
      User.countDocuments(filter),
      User.countDocuments({ role: 'villager', status: 'pending', active: true }),
    ]);
    res.json({ items: items.map(safe), total, page: q.page, pages: Math.max(1, Math.ceil(total / 50)), pending });
  });

  router.post('/', async (req, res) => {
    const input = createSchema.parse(req.body);
    if (input.role !== 'villager' && !isSuper(req)) throw forbidden('Only a super admin can add admins');
    const issues = [];
    if (input.email && (await User.exists({ email: input.email }))) issues.push({ path: 'email', message: 'A user with this e-mail already exists' });
    if (input.phone && (await User.exists({ phone: input.phone }))) issues.push({ path: 'phone', message: 'A user with this mobile number already exists' });
    if (issues.length) throw validation(issues);

    const password = tempPassword();
    const user = await User.create({
      ...input,
      status: 'active', // added by staff, so already checked
      verifiedBy: who(req.user),
      verifiedAt: new Date(),
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
    });
    await audit(req, 'user_create', { docId: user._id, summary: `${user.name} (${user.role})` });
    res.status(201).json({ user: safe(user), tempPassword: password });
  });

  router.patch('/:id', async (req, res) => {
    const patch = patchSchema.parse(req.body);
    const user = await loadManageable(req);
    if (patch.role !== undefined && !isSuper(req)) throw forbidden('Only a super admin can change roles');
    await keepOneSuper(user, patch);

    if (patch.name !== undefined) user.name = patch.name;
    if (patch.tola !== undefined) user.tola = patch.tola;
    if (patch.role !== undefined && patch.role !== user.role) {
      user.role = patch.role;
      if (patch.role !== 'villager') user.status = 'active';
      user.tokenVersion += 1; // the new rights apply from the next sign-in
    }
    if (patch.active !== undefined) {
      user.active = patch.active;
      if (!patch.active) user.tokenVersion += 1; // end their sessions immediately
    }
    await user.save();
    await audit(req, 'user_update', { docId: user._id, summary: `${user.name}: ${JSON.stringify(patch)}` });
    res.json({ user: safe(user) });
  });

  /** Admins check that a new villager really belongs to the village (for example with a phone call). */
  router.post('/:id/verify', async (req, res) => {
    const { decision, reason } = z
      .object({ decision: z.enum(['approve', 'reject']), reason: z.string().trim().max(300).optional() })
      .parse(req.body);
    const user = await loadManageable(req);
    if (user.role !== 'villager') throw new HttpError(400, 'NOT_A_VILLAGER', 'Only villager accounts need verification');
    if (decision === 'reject' && (!reason || reason.length < 3)) {
      throw validation([{ path: 'reason', message: 'Write a short reason so the person knows what to do' }]);
    }
    user.status = decision === 'approve' ? 'active' : 'rejected';
    user.rejectReason = decision === 'reject' ? reason : undefined;
    user.verifiedBy = who(req.user);
    user.verifiedAt = new Date();
    await user.save();
    await audit(req, `user_${decision}`, { docId: user._id, summary: `${user.name}${reason ? ` — ${reason}` : ''}` });
    res.json({ user: safe(user) });
  });

  router.post('/:id/reset-password', async (req, res) => {
    const user = await loadManageable(req);
    const password = tempPassword();
    user.passwordHash = await hashPassword(password);
    user.mustChangePassword = true;
    user.tokenVersion += 1;
    user.failedLogins = 0;
    user.lockUntil = undefined;
    await user.save();
    await audit(req, 'user_reset_password', { docId: user._id, summary: user.name });
    res.json({ user: safe(user), tempPassword: password });
  });

  return router;
}
