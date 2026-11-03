import { Router } from 'express';
import { z } from 'zod';
import { Message } from '../models/index.js';
import { audit } from '../lib/audit.js';
import { notFound } from '../lib/errors.js';

const ID = /^[a-f0-9]{24}$/i;

/** Mounted under /api/admin/messages, super admin only (it holds phone numbers and e-mails). */
export function messagesRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    const q = z
      .object({
        status: z.enum(['new', 'read', 'archived', 'all']).default('all'),
        type: z.enum(['suggestion', 'diaspora', 'contact', 'all']).default('all'),
        page: z.coerce.number().int().min(1).max(1000).default(1),
      })
      .parse(req.query);
    const filter = {};
    if (q.status !== 'all') filter.status = q.status;
    if (q.type !== 'all') filter.type = q.type;
    const [items, total, newCount] = await Promise.all([
      Message.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * 30).limit(30).lean(),
      Message.countDocuments(filter),
      Message.countDocuments({ status: 'new' }),
    ]);
    res.json({ items, total, page: q.page, pages: Math.max(1, Math.ceil(total / 30)), newCount });
  });

  router.patch('/:id', async (req, res) => {
    if (!ID.test(req.params.id)) throw notFound();
    const { status } = z.object({ status: z.enum(['new', 'read', 'archived']) }).parse(req.body);
    const msg = await Message.findByIdAndUpdate(req.params.id, { status }, { returnDocument: 'after' }).lean();
    if (!msg) throw notFound();
    res.json(msg);
  });

  router.delete('/:id', async (req, res) => {
    if (!ID.test(req.params.id)) throw notFound();
    const msg = await Message.findByIdAndDelete(req.params.id);
    if (!msg) throw notFound();
    await audit(req, 'message_delete', { docId: msg._id, summary: msg.type });
    res.json({ ok: true });
  });

  return router;
}
