import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { RESOURCES } from '../resources.js';
import { buildZod } from '../lib/fields.js';
import { Message, User, modelFor } from '../models/index.js';
import { clearAuthCookie, comparePassword, publicUser, requireVerified } from '../middleware/auth.js';
import { uploadRouter } from './upload.js';
import { audit, who } from '../lib/audit.js';
import { HttpError, notFound, validation } from '../lib/errors.js';

const ID = /^[a-f0-9]{24}$/i;
const blank = (v) => (v === '' || v == null ? undefined : v);
const REVEALS_PER_DAY = 25;
const MAX_OPEN_LISTINGS = 3;

// What a villager can send in. Everything lands as "pending" and is checked before it goes public.
const SUBMIT = {
  story: {
    resource: 'oral-history',
    schema: buildZod(RESOURCES['oral-history'].fields)
      .pick({ title: true, elderName: true, elderAge: true, language: true, photo: true, audio: true, summary: true, consent: true })
      .refine((v) => v.audio, { message: 'Add the recording', path: ['audio'] }),
  },
  listing: {
    resource: 'directory',
    schema: buildZod(RESOURCES.directory.fields),
  },
  photos: {
    resource: 'albums',
    schema: buildZod(RESOURCES.albums.fields)
      .pick({ title: true, year: true, event: true, photos: true, consent: true })
      .refine((v) => v.consent === true, { message: 'Please confirm this', path: ['consent'] }),
  },
};
const MINE = ['oral-history', 'directory', 'albums'];

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(100).optional(),
  email: z.preprocess(blank, z.string().trim().toLowerCase().pipe(z.email('Enter a valid e-mail').max(160)).nullish()),
  tola: z.string().trim().max(100).optional(),
  livesIn: z.enum(['village', 'outside']).optional(),
  place: z.string().trim().max(100).optional(),
});
const messageSchema = z.object({
  kind: z.enum(['suggestion', 'grievance']),
  message: z.string().trim().min(5, 'Please write a few words').max(3000),
});

const titleText = (v) => (typeof v === 'string' ? v : v?.hi || v?.en || '');

/** Everything a signed-in person does with their own account. Mounted at /api/me. */
export function meRouter({ uploadDir }) {
  const router = Router();
  // Per person, not per IP: a whole village can share one mobile-network IP address.
  const perUser = (windowMs, limit) =>
    rateLimit({
      windowMs,
      limit: process.env.NODE_ENV === 'test' ? 100_000 : limit,
      keyGenerator: (req) => String(req.user._id),
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'RATE_LIMITED', message: 'Too many requests. Please wait a little and try again.' },
    });

  router.get('/profile', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ user: publicUser(req.user) });
  });

  router.patch('/profile', async (req, res) => {
    const input = profileSchema.parse(req.body);
    const u = req.user;
    if (input.email && input.email !== u.email && (await User.exists({ email: input.email }))) {
      throw validation([{ path: 'email', message: 'This e-mail is already registered' }]);
    }
    for (const k of ['name', 'tola', 'livesIn', 'place']) if (input[k] !== undefined) u[k] = input[k];
    if ('email' in input) u.email = input.email ?? undefined;
    if (u.livesIn === 'village') u.place = undefined;
    await u.save();
    await audit(req, 'profile_update');
    res.json({ user: publicUser(u) });
  });

  /** The right to be forgotten: the account and the personal things it sent are deleted. */
  router.post('/delete', perUser(15 * 60_000, 10), async (req, res) => {
    const { password } = z.object({ password: z.string().min(1).max(128) }).parse(req.body);
    const u = req.user;
    if (u.role !== 'villager') throw new HttpError(400, 'STAFF_ACCOUNT', 'Staff accounts are removed by a super admin');
    if (!(await comparePassword(password, u.passwordHash))) {
      throw new HttpError(400, 'WRONG_PASSWORD', 'Password is not correct', [{ path: 'password', message: 'Not correct' }]);
    }
    for (const key of MINE) {
      const M = modelFor(key);
      // A directory listing is personal data, so it goes even when it is public.
      const gone = key === 'directory' ? {} : { status: { $ne: 'published' } };
      await M.deleteMany({ 'createdBy.id': u._id, ...gone });
      await M.updateMany({ 'createdBy.id': u._id }, { $set: { createdBy: { name: '—' }, updatedBy: { name: '—' } } });
    }
    await Message.deleteMany({ userId: u._id });
    await User.deleteOne({ _id: u._id });
    await audit(req, 'account_deleted', { summary: u.name });
    clearAuthCookie(res, req.app.locals.config);
    res.json({ ok: true });
  });

  router.get('/submissions', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const mine = { 'createdBy.id': req.user._id };
    const [content, messages] = await Promise.all([
      Promise.all(
        MINE.map(async (key) => {
          const def = RESOURCES[key];
          const docs = await modelFor(key)
            .find(mine)
            .sort({ createdAt: -1 })
            .limit(50)
            .select(`${def.titleField} status rejectReason createdAt`)
            .lean();
          return docs.map((d) => ({
            resource: key,
            id: String(d._id),
            title: titleText(d[def.titleField]),
            status: d.status,
            rejectReason: d.status === 'rejected' ? d.rejectReason : null,
            createdAt: d.createdAt,
          }));
        }),
      ),
      Message.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50).select('type message status createdAt').lean(),
    ]);
    res.json({
      items: content.flat().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      messages: messages.map((m) => ({ id: String(m._id), type: m.type, message: m.message.slice(0, 200), status: m.status, createdAt: m.createdAt })),
    });
  });

  /* ------------------- members-only: verified villagers and staff ------------------- */

  router.use('/upload', requireVerified, perUser(60 * 60_000, 40), uploadRouter({ uploadDir, kinds: ['image', 'audio'] }));

  router.post('/submit/message', requireVerified, perUser(60 * 60_000, 15), async (req, res) => {
    const { kind, message } = messageSchema.parse(req.body);
    const u = req.user;
    await Message.create({ type: kind, message, name: u.name, phone: u.phone, email: u.email, place: u.tola || u.place, userId: u._id });
    await audit(req, 'message_sent', { summary: kind });
    res.status(201).json({ ok: true });
  });

  router.post('/submit/:kind', requireVerified, perUser(60 * 60_000, 15), async (req, res) => {
    const spec = SUBMIT[req.params.kind];
    if (!spec) throw notFound();
    const u = req.user;
    const body = { ...req.body };
    if (spec.resource === 'directory') {
      body.phone ||= u.phone;
      const open = await modelFor('directory').countDocuments({ 'createdBy.id': u._id, status: { $in: ['pending', 'draft'] } });
      if (open >= MAX_OPEN_LISTINGS) throw new HttpError(429, 'TOO_MANY_OPEN', 'Wait until your earlier listings are checked');
    }
    const input = spec.schema.parse(body);
    const def = RESOURCES[spec.resource];
    const problems = def.validate?.(input) ?? [];
    if (problems.length) throw validation(problems.map(([path, message]) => ({ path, message })));

    const doc = await modelFor(spec.resource).create({
      ...input,
      ...(def.derive?.(input) ?? {}),
      status: 'pending',
      source: 'public',
      createdBy: who(u),
      updatedBy: who(u),
    });
    await audit(req, 'submit', { resource: spec.resource, docId: doc._id, summary: titleText(doc[def.titleField]) });
    res.status(201).json({ id: String(doc._id), status: doc.status });
  });

  /**
   * Directory phone numbers are shown only to signed-in, verified people, one at a time,
   * a limited number per day, and every look-up is written to the activity log.
   */
  router.get('/reveal/:id', requireVerified, async (req, res) => {
    if (!ID.test(req.params.id)) throw notFound();
    const doc = await modelFor('directory').findOne({ _id: req.params.id, status: 'published' }).select('name phone').lean();
    if (!doc) throw notFound();
    if (req.user.role === 'villager') {
      const today = new Date().toISOString().slice(0, 10);
      const _id = req.user._id;
      let r = await User.updateOne({ _id, revealDay: today, revealCount: { $lt: REVEALS_PER_DAY } }, { $inc: { revealCount: 1 } });
      if (!r.modifiedCount) r = await User.updateOne({ _id, revealDay: { $ne: today } }, { $set: { revealDay: today, revealCount: 1 } });
      if (!r.modifiedCount) throw new HttpError(429, 'REVEAL_LIMIT', 'You have looked up many numbers today. Please try again tomorrow.');
    }
    await audit(req, 'phone_reveal', { resource: 'directory', docId: doc._id, summary: doc.name });
    res.set('Cache-Control', 'no-store');
    res.json({ phone: doc.phone });
  });

  /** Receipts for money this person gave (matched by their mobile number). */
  router.get('/receipts', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!req.user.phone) return res.json({ items: [] });
    const docs = await modelFor('donations')
      .find({ donorPhone: req.user.phone, status: 'published', receiptNo: { $exists: true } })
      .sort({ date: -1 })
      .limit(100)
      .select('receiptNo receiptKey date amount purpose')
      .lean();
    res.json({ items: docs.map((d) => ({ id: String(d._id), receiptNo: d.receiptNo, key: d.receiptKey, date: d.date, amount: d.amount, purpose: d.purpose })) });
  });

  return router;
}
