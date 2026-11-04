import rateLimit from 'express-rate-limit';
import { HttpError } from '../lib/errors.js';

/**
 * CSRF defence for a same-origin SPA: the auth cookie is SameSite=Strict AND every
 * state-changing request must carry a custom header. A cross-site HTML form cannot
 * set custom headers, and a cross-site fetch would need a CORS preflight we never allow.
 */
export function csrfGuard(req, _res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  if (req.get('x-requested-by') !== 'ainwan-web') {
    throw new HttpError(403, 'CSRF', 'Blocked: request did not come from the website');
  }
  next();
}

/**
 * Limits are per IP. Many Indian mobile users share one IP (carrier NAT), so public
 * limits are deliberately generous; spam is mainly handled by moderation + honeypot.
 */
export function makeLimiters(config) {
  const make = (windowMs, limit) =>
    rateLimit({
      windowMs,
      limit: config.isTest ? 100_000 : limit,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'RATE_LIMITED', message: 'Too many requests. Please wait a little and try again.' },
    });
  return {
    global: make(5 * 60_000, 1000),
    auth: make(15 * 60_000, 20),
    submit: make(60 * 60_000, 20),
    reveal: make(60 * 60_000, 60),
    register: make(60 * 60_000, 10),
  };
}
