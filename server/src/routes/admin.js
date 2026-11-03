import { Router } from 'express';
import { z } from 'zod';
import { RESOURCES, SETTINGS_FIELDS } from '../resources.js';
import { buildZod } from '../lib/fields.js';
import { AuditLog, Message, STATUSES, Setting, heavyFields, modelFor } from '../models/index.js';
import { requireRole } from '../middleware/auth.js';
import { audit, who } from '../lib/audit.js';
import { forbidden, notFound, validation } from '../lib/errors.js';

const ID = /^[a-f0-9]{24}$/i;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Built once at start-up from the field descriptions.
const SCHEMAS = Object.fromEntries(
  Object.entries(RESOURCES).map(([key, def]) => {
    const full = buildZod(def.fields);
    return [key, { create: full, update: full.partial() }];
  }),
);
const settingsSchema = buildZod(SETTINGS_FIELDS).partial();

const bodyStatus = z.enum(['draft', 'pending', 'published']).optional();

const titleOf = (def, doc) => {
  const t = doc?.[def.titleField];
  return typeof t === 'string' ? t : t?.en || t?.hi || '(untitled)';
};
const toIssues = (pairs) => pairs.map(([path, message]) => ({ path, message }));

function ctx(req) {
  const key = req.params.resource;
  const def = RESOURCES[key];
  if (!def) throw notFound('Unknown content type');
  return { key, def, Model: modelFor(key) };
}
function idOf(req) {
  if (!ID.test(req.params.id)) throw notFound();
  return req.params.id;
}

/**
 * Who may put what in which state:
 *  - super admin (Mukhiya): anything
 *  - editor: only draft / pending. Editing a published item sends it back to pending.
 */
function statusOnCreate(user, requested) {
  if (user.role === 'superadmin') return requested ?? 'published';
  if (requested === 'published') throw forbidden('Only the Mukhiya (super admin) can publish');
  return requested === 'draft' ? 'draft' : 'pending';
}
function statusOnUpdate(user, doc, requested) {
  if (user.role === 'superadmin') return requested ?? doc.status;
  if (requested === 'published') throw forbidden('Only the Mukhiya (super admin) can publish');
  if (doc.status === 'published') return 'pending';
  return requested ?? (doc.status === 'rejected' ? 'draft' : doc.status);
}
function markPublished(doc, user) {
  if (doc.status === 'published') {
    doc.publishedBy = who(user);
    doc.publishedAt ??= new Date();
    doc.rejectReason = undefined;
  }
}

export function adminRouter() {
  const router = Router();

  /* ----------------------- what the admin UI needs ----------------------- */

  router.get('/meta', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
      statuses: STATUSES,
      resources: Object.fromEntries(
        Object.entries(RESOURCES).map(([key, d]) => [
          key,
          { section: d.section, label: d.label, singular: d.singular, titleField: d.titleField, filters: d.filters, fields: d.fields },
        ]),
      ),
      settingsFields: SETTINGS_FIELDS,
    });
  });

  router.get('/dashboard', async (_req, res) => {
    const entries = Object.entries(RESOURCES);
    const counts = await Promise.all(
      entries.map(async ([key]) => {
        const M = modelFor(key);
        const [pending, draft, published] = await Promise.all(
          ['pending', 'draft', 'published'].map((status) => M.countDocuments({ status })),
        );
        return { key, pending, draft, published };
      }),
    );
    const queue = (
      await Promise.all(
        entries.map(async ([key, def]) => {
          const items = await modelFor(key)
            .find({ status: 'pending' })
            .sort({ updatedAt: -1 })
            .limit(5)
            .select(`${def.titleField} updatedAt updatedBy source`)
            .lean();
          return items.map((i) => ({
            resource: key,
            id: i._id,
            title: titleOf(def, i),
            updatedAt: i.updatedAt,
            by: i.source === 'public' ? 'Public form' : i.updatedBy?.name,
          }));
        }),
      )
    )
      .flat()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 10);
    const newMessages = await Message.countDocuments({ status: 'new' });
    res.json({ counts, queue, newMessages });
  });

  /* ------------------------------- content ------------------------------- */

  router.get('/resources/:resource', async (req, res) => {
    const { key, def, Model } = ctx(req);
    const q = z
      .object({
        status: z.enum([...STATUSES, 'all']).default('all'),
        q: z.string().trim().max(80).optional(),
        page: z.coerce.number().int().min(1).max(1000).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(25),
      })
      .parse(req.query);

    const filter = {};
    if (q.status !== 'all') filter.status = q.status;
    if (q.q) {
      const rx = new RegExp(escapeRegex(q.q), 'i');
      filter.$or = def.searchFields.map((p) => ({ [p]: rx }));
    }
    const exclude = heavyFields(key).map((n) => `-${n}`).join(' ');
    const [items, total, grouped] = await Promise.all([
      Model.find(filter).select(exclude).sort({ updatedAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
      Model.countDocuments(filter),
      Model.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    ]);
    res.json({
      items,
      total,
      page: q.page,
      pages: Math.max(1, Math.ceil(total / q.limit)),
      counts: Object.fromEntries(grouped.map((g) => [g._id, g.n])),
    });
  });

  router.get('/resources/:resource/:id', async (req, res) => {
    const { Model } = ctx(req);
    const doc = await Model.findById(idOf(req)).lean();
    if (!doc) throw notFound();
    res.json(doc);
  });

  router.post('/resources/:resource', async (req, res) => {
    const { key, def, Model } = ctx(req);
    const input = SCHEMAS[key].create.parse(req.body);
    const problems = def.validate?.(input) ?? [];
    if (problems.length) throw validation(toIssues(problems));

    const status = statusOnCreate(req.user, bodyStatus.parse(req.body.status));
    const doc = new Model({
      ...input,
      ...(def.derive?.(input) ?? {}),
      status,
      createdBy: who(req.user),
      updatedBy: who(req.user),
    });
    markPublished(doc, req.user);
    await doc.save();
    await audit(req, 'create', { resource: key, docId: doc._id, summary: `${titleOf(def, doc)} → ${status}` });
    res.status(201).json(doc);
  });

  router.put('/resources/:resource/:id', async (req, res) => {
    const { key, def, Model } = ctx(req);
    const doc = await Model.findById(idOf(req));
    if (!doc) throw notFound();
    const input = SCHEMAS[key].update.parse(req.body);

    // Only touch fields the form actually sent; a blank value clears the field.
    const merged = doc.toObject();
    for (const k of Object.keys(def.fields)) {
      if (k in req.body) merged[k] = input[k];
    }
    const problems = def.validate?.(merged) ?? [];
    if (problems.length) throw validation(toIssues(problems));

    const wasPublished = doc.status === 'published';
    for (const k of Object.keys(def.fields)) {
      if (k in req.body) doc.set(k, input[k]);
    }
    for (const [k, v] of Object.entries(def.derive?.(merged) ?? {})) doc.set(k, v);
    doc.status = statusOnUpdate(req.user, doc, bodyStatus.parse(req.body.status));
    if (doc.status !== 'rejected') doc.rejectReason = undefined;
    doc.updatedBy = who(req.user);
    markPublished(doc, req.user);
    await doc.save();

    await audit(req, 'update', { resource: key, docId: doc._id, summary: `${titleOf(def, doc)} → ${doc.status}` });
    res.json({ ...doc.toObject(), unpublished: wasPublished && doc.status !== 'published' });
  });

  router.post('/resources/:resource/:id/status', async (req, res) => {
    const { key, def, Model } = ctx(req);
    const { status, reason } = z
      .object({ status: z.enum(STATUSES), reason: z.string().trim().max(300).optional() })
      .parse(req.body);
    const doc = await Model.findById(idOf(req));
    if (!doc) throw notFound();

    if (req.user.role === 'editor') {
      const allowed = (status === 'draft' || status === 'pending') && doc.status !== 'published';
      if (!allowed) throw forbidden('Only the Mukhiya (super admin) can publish, reject or unpublish');
    }
    if (status === 'rejected' && (!reason || reason.length < 3)) {
      throw validation([{ path: 'reason', message: 'Write a short reason so the editor knows what to fix' }]);
    }

    doc.status = status;
    doc.rejectReason = status === 'rejected' ? reason : undefined;
    doc.updatedBy = who(req.user);
    markPublished(doc, req.user);
    await doc.save();

    await audit(req, `status:${status}`, { resource: key, docId: doc._id, summary: `${titleOf(def, doc)}${reason ? ` — ${reason}` : ''}` });
    res.json(doc);
  });

  router.delete('/resources/:resource/:id', async (req, res) => {
    const { key, def, Model } = ctx(req);
    const doc = await Model.findById(idOf(req));
    if (!doc) throw notFound();
    if (req.user.role !== 'superadmin') {
      const own = String(doc.createdBy?.id) === String(req.user._id);
      if (!(own && (doc.status === 'draft' || doc.status === 'rejected'))) {
        throw forbidden('Editors can delete only their own drafts');
      }
    }
    await doc.deleteOne();
    await audit(req, 'delete', { resource: key, docId: doc._id, summary: titleOf(def, doc) });
    res.json({ ok: true });
  });

  /* ------------------------------- settings ------------------------------- */

  router.get('/settings', requireRole('superadmin'), async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json((await Setting.findOne({ key: 'site' }).lean()) ?? {});
  });

  router.put('/settings', requireRole('superadmin'), async (req, res) => {
    const input = settingsSchema.parse(req.body);

    const issues = [];
    if (input.email && !z.email().safeParse(input.email).success) issues.push({ path: 'email', message: 'Enter a valid e-mail address' });
    if (input.upiId && !/^[a-zA-Z0-9._-]{2,100}@[a-zA-Z][a-zA-Z0-9.-]{1,40}$/.test(input.upiId)) {
      issues.push({ path: 'upiId', message: 'A UPI ID looks like name@bank' });
    }
    if (issues.length) throw validation(issues);

    const $set = { updatedBy: who(req.user) };
    const $unset = {};
    for (const k of Object.keys(SETTINGS_FIELDS)) {
      if (!(k in req.body)) continue;
      if (input[k] === undefined) $unset[k] = '';
      else $set[k] = input[k];
    }
    const update = Object.keys($unset).length ? { $set, $unset } : { $set };
    const doc = await Setting.findOneAndUpdate({ key: 'site' }, update, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }).lean();
    await audit(req, 'settings', { summary: Object.keys(req.body).join(', ') });
    res.json(doc);
  });

  /* ------------------------------ audit trail ----------------------------- */

  router.get('/audit', requireRole('superadmin'), async (req, res) => {
    const { page } = z.object({ page: z.coerce.number().int().min(1).max(1000).default(1) }).parse(req.query);
    const [items, total] = await Promise.all([
      AuditLog.find().sort({ at: -1 }).skip((page - 1) * 50).limit(50).lean(),
      AuditLog.estimatedDocumentCount(),
    ]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / 50)) });
  });

  return router;
}
