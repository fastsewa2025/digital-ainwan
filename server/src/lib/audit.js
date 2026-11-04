import { AuditLog } from '../models/index.js';

/** Writes one line to the audit trail. A failure here must never break the request itself. */
export async function audit(req, action, { resource, docId, summary } = {}) {
  try {
    await AuditLog.create({
      userId: req.user?._id,
      userName: req.user?.name,
      role: req.user?.role,
      action,
      resource,
      docId: docId ? String(docId) : undefined,
      summary: summary?.slice(0, 300),
      ip: req.ip,
    });
  } catch (err) {
    req.log?.error({ err }, 'audit write failed');
  }
}

export const who = (user) => ({ id: user._id, name: user.name });
