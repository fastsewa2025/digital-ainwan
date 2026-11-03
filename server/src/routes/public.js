import { Router } from 'express';
import { z } from 'zod';
import { RESOURCES } from '../resources.js';
import { buildZod, zodFor } from '../lib/fields.js';
import { Message, heavyFields, hiddenInPublic, modelFor } from '../models/index.js';
import { getSettings } from '../lib/settings.js';
import { notFound } from '../lib/errors.js';

const ID = /^[a-f0-9]{24}$/i;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exclusion = (names) => names.map((n) => `-${n}`).join(' ');
const detailSelect = (key) => exclusion(hiddenInPublic(key));
const listSelect = (key) => exclusion([...hiddenInPublic(key), ...heavyFields(key)]);
const blank = (v) => (v === '' || v == null ? undefined : v);

function resolve(key) {
  const def = RESOURCES[key];
  if (!def) throw notFound();
  return { key, def, Model: modelFor(key) };
}

function listQuery(def) {
  const shape = {
    page: z.coerce.number().int().min(1).max(500).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(12),
    q: z.string().trim().max(80).optional(),
    year: z.coerce.number().int().min(1800).max(2200).optional(),
  };
  for (const k of def.filters) shape[k] = z.enum(def.fields[k].options.map((o) => o.value)).optional();
  return z.object(shape);
}

function listFilter(def, q) {
  const filter = { status: 'published' };
  for (const k of def.filters) if (q[k]) filter[k] = q[k];
  if (q.year) {
    if (def.yearField) filter[def.yearField] = q.year;
    else if (def.dateField) {
      filter[def.dateField] = { $gte: new Date(Date.UTC(q.year, 0, 1)), $lt: new Date(Date.UTC(q.year + 1, 0, 1)) };
    }
  }
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = def.searchFields.map((p) => ({ [p]: rx }));
  }
  return filter;
}

/* ----------------------- messages from the public ------------------------ */

const contactFields = {
  phone: zodFor({ kind: 'phone' }),
  email: z.preprocess(blank, z.string().trim().toLowerCase().pipe(z.email().max(160)).optional()),
};
const base = {
  name: z.string().trim().max(100).optional(),
  place: z.string().trim().max(120).optional(),
  message: z.string().trim().min(5, 'Please write a few words').max(3000),
  website: z.string().max(200).optional(), // honeypot: real people never see or fill this
  ...contactFields,
};
const hasContact = (v) => Boolean(v.phone || v.email);
const needContact = { message: 'Give a phone number or e-mail so we can reach you', path: ['email'] };
const required = (max) => z.string().trim().min(1, 'Required').max(max);

const submitSchemas = {
  suggestion: z.object(base),
  contact: z.object({ ...base, name: required(100) }).refine(hasContact, needContact),
  diaspora: z
    .object({
      ...base,
      name: required(100),
      place: required(120),
      helpType: z.enum(['idea', 'time', 'skills', 'funds', 'other'], { error: 'Choose one' }),
    })
    .refine(hasContact, needContact),
};
const directorySubmit = buildZod(RESOURCES.directory.fields).extend({ website: z.string().max(200).optional() });

/* -------------------------------- router --------------------------------- */

export function publicRouter({ limiters }) {
  const router = Router();

  router.use((req, res, next) => {
    if (req.method === 'GET') res.set('Cache-Control', 'public, max-age=10');
    next();
  });

  router.get('/settings', async (_req, res) => res.json(await getSettings()));

  // Short list for the scrolling bar at the top of every page.
  router.get('/ticker', async (_req, res) => {
    const items = await modelFor('notices')
      .find({ status: 'published', important: true, $or: [{ expiresOn: null }, { expiresOn: { $gte: new Date() } }] })
      .sort({ date: -1 })
      .limit(8)
      .select('title date')
      .lean();
    res.json({ items });
  });

  router.get('/home', async (_req, res) => {
    const now = new Date();
    const pub = { status: 'published' };
    const P = modelFor('projects');
    const [ticker, inProgress, planned, completed, budgetRows, nInProgress, nPlanned, nCompleted, notices, festivals, fame, nFest, nOral, nDir, nAlbums] =
      await Promise.all([
        modelFor('notices')
          .find({ ...pub, important: true, $or: [{ expiresOn: null }, { expiresOn: { $gte: now } }] })
          .sort({ date: -1 }).limit(8).select('title date category').lean(),
        P.find({ ...pub, phase: 'in-progress' }).sort({ updatedAt: -1 }).limit(3).select(listSelect('projects')).lean(),
        P.find({ ...pub, phase: 'planned' }).sort({ updatedAt: -1 }).limit(3).select(listSelect('projects')).lean(),
        P.find({ ...pub, phase: 'completed' }).sort({ completedOn: -1, updatedAt: -1 }).limit(3).select(listSelect('projects')).lean(),
        P.find(pub).select('budgetAllocated budgetSpent').limit(5000).lean(),
        P.countDocuments({ ...pub, phase: 'in-progress' }),
        P.countDocuments({ ...pub, phase: 'planned' }),
        P.countDocuments({ ...pub, phase: 'completed' }),
        modelFor('notices').find(pub).sort({ date: -1, createdAt: -1 }).limit(5).select(listSelect('notices')).lean(),
        modelFor('festivals').find(pub).sort({ date: -1 }).limit(3).select(listSelect('festivals')).lean(),
        modelFor('fame').find(pub).sort({ year: -1, createdAt: -1 }).limit(6).select(listSelect('fame')).lean(),
        modelFor('festivals').countDocuments(pub),
        modelFor('oral-history').countDocuments(pub),
        modelFor('directory').countDocuments(pub),
        modelFor('albums').countDocuments(pub),
      ]);
    res.json({
      ticker,
      projects: { inProgress, planned, completed },
      notices,
      festivals,
      fame,
      stats: {
        projects: { planned: nPlanned, inProgress: nInProgress, completed: nCompleted },
        budget: {
          allocated: budgetRows.reduce((sum, r) => sum + (r.budgetAllocated ?? 0), 0),
          spent: budgetRows.reduce((sum, r) => sum + (r.budgetSpent ?? 0), 0),
        },
        festivals: nFest,
        oralHistory: nOral,
        directory: nDir,
        albums: nAlbums,
      },
    });
  });

  // Pins for the development map.
  router.get('/map', async (_req, res) => {
    const items = await modelFor('projects')
      .find({ status: 'published', 'location.lat': { $exists: true } })
      .select('title phase progress mohalla location cover')
      .limit(500)
      .lean();
    res.json({ items });
  });

  router.get('/content/:resource', async (req, res) => {
    const { key, def, Model } = resolve(req.params.resource);
    const q = listQuery(def).parse(req.query);
    const filter = listFilter(def, q);
    const [items, total] = await Promise.all([
      Model.find(filter).select(listSelect(key)).sort(def.sort).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
      Model.countDocuments(filter),
    ]);
    res.json({ items, total, page: q.page, pages: Math.max(1, Math.ceil(total / q.limit)), limit: q.limit });
  });

  router.get('/content/:resource/:id', async (req, res) => {
    const { key, Model } = resolve(req.params.resource);
    if (!ID.test(req.params.id)) throw notFound();
    const doc = await Model.findOne({ _id: req.params.id, status: 'published' }).select(detailSelect(key)).lean();
    if (!doc) throw notFound();
    res.json(doc);
  });

  // Phone numbers are not in list/detail responses: they are fetched one at a time,
  // rate limited, so the directory cannot be scraped in a single request.
  router.get('/content/:resource/:id/reveal', limiters.reveal, async (req, res) => {
    const { def, Model } = resolve(req.params.resource);
    if (!def.reveal || !ID.test(req.params.id)) throw notFound();
    const doc = await Model.findOne({ _id: req.params.id, status: 'published' }).select(def.reveal.join(' ')).lean();
    if (!doc) throw notFound();
    res.set('Cache-Control', 'no-store');
    res.json(Object.fromEntries(def.reveal.map((k) => [k, doc[k]])));
  });

  router.post('/submit/directory', limiters.submit, async (req, res) => {
    const { website, ...input } = directorySubmit.parse(req.body);
    if (website) return res.status(201).json({ ok: true }); // bot: pretend it worked
    await modelFor('directory').create({ ...input, status: 'pending', source: 'public' });
    res.status(201).json({ ok: true });
  });

  router.post('/submit/:type', limiters.submit, async (req, res) => {
    const schema = submitSchemas[req.params.type];
    if (!schema) throw notFound();
    const { website, ...input } = schema.parse(req.body);
    if (website) return res.status(201).json({ ok: true }); // bot: pretend it worked
    await Message.create({ type: req.params.type, ...input });
    res.status(201).json({ ok: true });
  });

  return router;
}
