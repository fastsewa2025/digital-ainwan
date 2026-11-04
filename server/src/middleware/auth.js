import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/index.js';
import { HttpError, forbidden, unauthorized } from '../lib/errors.js';

export const COOKIE = 'ainwan_token';
const ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;

/* ------------------------------ who is who ------------------------------- */

/**
 * Three kinds of account, each one can do everything the one below it can:
 *   villager   (ग्रामीण)     reads, sends stories/suggestions, sees directory numbers once verified
 *   admin      (एडमिन)       writes content (sent for approval), verifies villagers
 *   superadmin (मुख्य एडमिन) publishes, manages admins, settings, money records, activity log
 */
export const ROLES = ['villager', 'admin', 'superadmin'];
export const RANK = { villager: 1, admin: 2, superadmin: 3 };
export const rankOf = (u) => RANK[u?.role] ?? 0;
export const isStaff = (u) => rankOf(u) >= RANK.admin;

/** Indian mobile number -> 10 digits, or null. Accepts +91, 91, 0, spaces and dashes. */
export function normalizePhone(input) {
  const s = String(input ?? '').replace(/[\s().-]/g, '');
  const digits = s.replace(/^(?:\+91|0091|91(?=\d{10}$)|0(?=\d{10}$))/, '');
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/* -------------------------------- passwords ------------------------------ */

export const hashPassword = (pw) => bcrypt.hash(pw, ROUNDS);
export const comparePassword = (pw, hash) => bcrypt.compare(pw, hash);
// Compared against when the account is unknown, so "no such user" takes as long as "wrong password".
export const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', ROUNDS);

const COMMON = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234', '12345678', '123456789', '1234567890',
  '12345678910', '87654321', '11111111', '00000000', 'qwertyuiop', 'qwerty123', 'qwerty12345', 'abcd1234',
  'admin123', 'admin12345', 'admin123456', 'iloveyou', 'iloveyou123', 'welcome123', 'letmein1234',
  'ainwan123', 'ainwan1234', 'ainwan12345', 'ainwan123456', 'india123', 'india@123', 'bharat123', 'jaishriram',
]);

/** Staff accounts can change the website, so they need longer passwords. */
export const minPasswordLength = (role) => (role === 'villager' ? 8 : 10);

/** Length matters more than symbols. Returns a message, or null if the password is fine. */
export function passwordProblem(pw, { email = '', phone = '', role = 'admin' } = {}) {
  const min = minPasswordLength(role);
  if (pw.length < min) return `Use at least ${min} characters`;
  if (pw.length > 128) return 'Use at most 128 characters';
  const lower = pw.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(pw)) return 'That password is too common';
  if (/^\d+$/.test(pw) && pw.length < 12) return 'A password of only numbers is easy to guess. Add some letters.';
  if (phone && pw.includes(phone)) return 'Do not use your mobile number in the password';
  const local = email.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) return 'Do not include your e-mail name in the password';
  return null;
}

export const newPasswordSchema = (who) =>
  z.string().superRefine((pw, ctx) => {
    const problem = passwordProblem(pw, who);
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  });

/* --------------------------------- session -------------------------------- */

const cookieOpts = (config) => ({ httpOnly: true, secure: config.cookieSecure, sameSite: 'strict', path: '/' });

/** Staff sessions are short (they can change the website); villagers stay signed in on their own phone. */
export const sessionHours = (config, user) =>
  user.role === 'villager' ? config.villagerSessionDays * 24 : config.jwtExpiresHours;

export function setAuthCookie(res, config, user) {
  const hours = sessionHours(config, user);
  const token = jwt.sign({ tv: user.tokenVersion, role: user.role }, config.jwtSecret, {
    subject: String(user._id),
    expiresIn: `${hours}h`,
    algorithm: 'HS256',
  });
  res.cookie(COOKIE, token, { ...cookieOpts(config), maxAge: hours * 3_600_000 });
}

export const clearAuthCookie = (res, config) => res.clearCookie(COOKIE, cookieOpts(config));

/** What the signed-in person may know about their own account. */
export const publicUser = (u) => ({
  id: String(u._id),
  name: u.name,
  email: u.email ?? null,
  phone: u.phone ?? null,
  role: u.role,
  status: u.status ?? 'active',
  rejectReason: u.status === 'rejected' ? (u.rejectReason ?? null) : null,
  tola: u.tola ?? '',
  livesIn: u.livesIn ?? null,
  place: u.place ?? '',
  mustChangePassword: Boolean(u.mustChangePassword),
});

/** Reads the session cookie, loads the user, and checks the session is still valid. */
export async function requireAuth(req, _res, next) {
  const { config } = req.app.locals;
  const token = req.cookies?.[COOKIE];
  if (!token) throw unauthorized();
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    throw unauthorized('Session expired. Please sign in again.');
  }
  const user = await User.findById(payload.sub);
  // tokenVersion changes on password change / reset / role change / deactivation: old sessions die at once.
  if (!user || !user.active || user.tokenVersion !== payload.tv) throw unauthorized('Session expired. Please sign in again.');
  req.user = user;
  next();
}

/* ------------------------------ permissions ------------------------------ */

/** The signed-in person must be at least this role. Always checked on the server, never only in the UI. */
export const atLeast = (role) => (req, _res, next) => {
  if (rankOf(req.user) < RANK[role]) throw forbidden();
  next();
};

/** A villager can use the members-only parts only after the Panchayat has verified the account. */
export function requireVerified(req, _res, next) {
  if (req.user.role === 'villager' && req.user.status !== 'active') {
    throw new HttpError(403, 'NOT_VERIFIED', 'Your account is waiting for the Panchayat to verify it');
  }
  next();
}

/**
 * Who may change whose account: only someone ranked strictly higher. Super admins may also manage
 * other super admins (there can be more than one), but nobody can change their own role or switch themselves off.
 */
export function canManage(actor, target) {
  if (String(actor._id) === String(target._id)) return false;
  if (actor.role === 'superadmin') return true;
  return rankOf(actor) > rankOf(target);
}

export function blockUntilPasswordChanged(req, _res, next) {
  if (req.user.mustChangePassword) {
    throw new HttpError(403, 'PASSWORD_CHANGE_REQUIRED', 'Please set a new password first');
  }
  next();
}
