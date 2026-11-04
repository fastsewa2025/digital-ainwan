import crypto from 'node:crypto';
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
  if (!def || def.publicApi === false) throw notFound();
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
  // "Contact this person" from the directory: the number stays private, the Panchayat passes the message on.
  contact: z
    .object({ ...base, name: required(100), about: z.object({ kind: z.literal('directory'), id: z.string().regex(ID) }).optional() })
    .refine(hasContact, needContact),
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

  // "Last updated" in the footer of every page: the newest change to anything public (worked out once a minute).
  let latest = { at: 0, value: null };
  const lastUpdated = async () => {
    if (Date.now() - latest.at > 60_000) {
      const docs = await Promise.all(
        Object.keys(RESOURCES).map((k) => modelFor(k).findOne({ status: 'published' }).sort({ updatedAt: -1 }).select('updatedAt').lean()),
      );
      latest = { at: Date.now(), value: docs.reduce((max, d) => (d?.updatedAt > max ? d.updatedAt : max), null) };
    }
    return latest.value;
  };

  router.get('/settings', async (_req, res) => res.json({ ...(await getSettings()), lastUpdated: await lastUpdated() }));

  // One search box for the whole site: up to 5 matches from each public kind of content.
  router.get('/search', async (req, res) => {
    const { q } = z.object({ q: z.string().trim().min(2).max(80) }).parse(req.query);
    const rx = new RegExp(escapeRegex(q), 'i');
    const groups = await Promise.all(
      Object.entries(RESOURCES)
        .filter(([, def]) => def.publicApi !== false)
        .map(async ([key, def]) => {
          const docs = await modelFor(key)
            .find({ status: 'published', $or: def.searchFields.map((p) => ({ [p]: rx })) })
            .sort(def.sort)
            .limit(5)
            .select(def.titleField)
            .lean();
          return { resource: key, items: docs.map((d) => ({ id: String(d._id), title: d[def.titleField] })) };
        }),
    );
    res.json({ q, groups: groups.filter((g) => g.items.length) });
  });

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
    const pub = { status: 'published' };
    const P = modelFor('projects');
    const cardFields = 'title phase progress mohalla budgetAllocated budgetSpent expectedEnd completedOn cover beforeCover afterCover';
    const [notices, inProgress, completed, budgetRows, nPlanned, nInProgress, nCompleted, story, nStories, festivals, nWiki, albumRows, fame, latest] =
      await Promise.all([
        modelFor('notices').find(pub).sort({ date: -1, createdAt: -1 }).limit(3).select('title category date important expiresOn publishedAt').lean(),
        P.find({ ...pub, phase: 'in-progress' }).sort({ updatedAt: -1 }).limit(3).select(cardFields).lean(),
        P.find({ ...pub, phase: 'completed' }).sort({ completedOn: -1, updatedAt: -1 }).limit(3).select(cardFields).lean(),
        P.find(pub).select('budgetAllocated budgetSpent').limit(5000).lean(),
        P.countDocuments({ ...pub, phase: 'planned' }),
        P.countDocuments({ ...pub, phase: 'in-progress' }),
        P.countDocuments({ ...pub, phase: 'completed' }),
        modelFor('oral-history').findOne({ ...pub, audio: { $exists: true } }).sort({ recordedOn: -1, createdAt: -1 }).select(listSelect('oral-history')).lean(),
        modelFor('oral-history').countDocuments(pub),
        modelFor('festivals').find(pub).sort({ date: -1 }).limit(3).select('title kind date cover').lean(),
        modelFor('wiki').countDocuments(pub),
        modelFor('albums').find(pub).select('photoCount cover').sort({ year: -1, createdAt: -1 }).limit(1000).lean(),
        modelFor('fame').find(pub).sort({ year: -1, createdAt: -1 }).limit(8).select('name field headline photo year').lean(),
        // "Last updated" in the footer: the newest change to anything public.
        Promise.all(
          Object.keys(RESOURCES).map((k) => modelFor(k).findOne(pub).sort({ updatedAt: -1 }).select('updatedAt').lean()),
        ),
      ]);
    const lastUpdated = latest.reduce((max, d) => (d?.updatedAt > max ? d.updatedAt : max), null);
    const now = Date.now();
    const DAY = 86_400_000;
    res.json({
      // "नया" for a week after publishing; "ज़रूरी" while marked important and not past its date
      notices: notices.map((n) => ({
        ...n,
        fresh: now - new Date(n.publishedAt || n.date).getTime() < 7 * DAY,
        urgent: Boolean(n.important) && (!n.expiresOn || new Date(n.expiresOn).getTime() >= now - DAY),
      })),
      projects: [...inProgress, ...completed].slice(0, 4),
      stats: {
        projects: { planned: nPlanned, inProgress: nInProgress, completed: nCompleted },
        budget: {
          allocated: budgetRows.reduce((sum, r) => sum + (r.budgetAllocated ?? 0), 0),
          spent: budgetRows.reduce((sum, r) => sum + (r.budgetSpent ?? 0), 0),
        },
        stories: nStories,
        wiki: nWiki,
        albums: albumRows.length,
        photos: albumRows.reduce((sum, a) => sum + (a.photoCount ?? 0), 0),
      },
      story,
      festivals,
      galleryCover: albumRows.find((a) => a.cover)?.cover ?? null,
      fame,
      lastUpdated,
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

  /* --------------------------- village fund ---------------------------- */

  // Every rupee in and out, as approved by the super admin. Donor names only with their consent.
  router.get('/hisab', async (_req, res) => {
    const pub = { status: 'published' };
    const D = modelFor('donations');
    const E = modelFor('expenses');
    const total = (M) => M.aggregate([{ $match: pub }, { $group: { _id: null, sum: { $sum: '$amount' }, n: { $sum: 1 } } }]);
    const [donations, expenses, [dt], [et]] = await Promise.all([
      D.find(pub).sort({ date: -1, createdAt: -1 }).limit(200).select('donorName showName place amount date mode purpose receiptNo').lean(),
      E.find(pub).sort({ date: -1, createdAt: -1 }).limit(200).select('purpose amount date paidTo bill billPhoto note').lean(),
      total(D),
      total(E),
    ]);
    res.json({
      totals: { received: dt?.sum ?? 0, donations: dt?.n ?? 0, spent: et?.sum ?? 0, expenses: et?.n ?? 0 },
      donations: donations.map((d) => ({
        _id: d._id,
        name: d.showName ? d.donorName : null,
        place: d.showName ? d.place : null,
        amount: d.amount,
        date: d.date,
        mode: d.mode,
        purpose: d.purpose,
        receiptNo: d.receiptNo,
      })),
      expenses,
    });
  });

  // A receipt opens only with its secret key (sent to the donor), never by guessing the id.
  router.get('/receipt/:id', limiters.reveal, async (req, res) => {
    if (!ID.test(req.params.id)) throw notFound();
    const key = String(req.query.k ?? '');
    const doc = await modelFor('donations').findOne({ _id: req.params.id, status: 'published' }).lean();
    const ok =
      doc?.receiptKey && doc.receiptNo && key.length === doc.receiptKey.length &&
      crypto.timingSafeEqual(Buffer.from(key), Buffer.from(doc.receiptKey));
    if (!ok) throw notFound();
    const s = await getSettings();
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex');
    res.json({
      receiptNo: doc.receiptNo,
      date: doc.date,
      donorName: doc.donorName,
      place: doc.place,
      amount: doc.amount,
      mode: doc.mode,
      purpose: doc.purpose,
      issuedAt: doc.publishedAt,
      villageName: s.villageName,
      panchayatName: s.panchayatName,
      teamName: s.teamName,
      officeAddress: s.officeAddress,
    });
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
    const { website, about, ...input } = schema.parse(req.body);
    if (website) return res.status(201).json({ ok: true }); // bot: pretend it worked
    let ref;
    if (about) {
      const entry = await modelFor('directory').findOne({ _id: about.id, status: 'published' }).select('name').lean();
      if (!entry) throw notFound();
      ref = { kind: 'directory', id: about.id, title: entry.name };
    }
    await Message.create({ type: req.params.type, ...input, about: ref });
    res.status(201).json({ ok: true });
  });

  return router;
}
