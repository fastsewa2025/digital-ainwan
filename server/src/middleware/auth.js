import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/index.js';
import { HttpError, forbidden, unauthorized } from '../lib/errors.js';

export const COOKIE = 'ainwan_token';
const ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;

export const hashPassword = (pw) => bcrypt.hash(pw, ROUNDS);
export const comparePassword = (pw, hash) => bcrypt.compare(pw, hash);
// Compared against when the e-mail is unknown, so "no such user" takes as long as "wrong password".
export const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', ROUNDS);

const COMMON = new Set([
  'password12', 'password123', 'password1234', '1234567890', '12345678910', 'qwertyuiop', 'qwerty12345',
  'admin12345', 'admin123456', 'iloveyou123', 'welcome123', 'letmein1234', 'ainwan12345', 'ainwan123456',
]);

/** Password rule: length matters more than symbols. Returns a message, or null if fine. */
export function passwordProblem(pw, email = '') {
  if (pw.length < 10) return 'Use at least 10 characters';
  if (pw.length > 128) return 'Use at most 128 characters';
  if (COMMON.has(pw.toLowerCase())) return 'That password is too common';
  const local = email.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && pw.toLowerCase().includes(local)) return 'Do not include your e-mail name in the password';
  return null;
}

export const newPasswordSchema = (email) =>
  z.string().superRefine((pw, ctx) => {
    const problem = passwordProblem(pw, email);
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  });

const cookieOpts = (config) => ({ httpOnly: true, secure: config.cookieSecure, sameSite: 'strict', path: '/' });

export function setAuthCookie(res, config, user) {
  const token = jwt.sign({ tv: user.tokenVersion, role: user.role }, config.jwtSecret, {
    subject: String(user._id),
    expiresIn: `${config.jwtExpiresHours}h`,
    algorithm: 'HS256',
  });
  res.cookie(COOKIE, token, { ...cookieOpts(config), maxAge: config.jwtExpiresHours * 3_600_000 });
}

export const clearAuthCookie = (res, config) => res.clearCookie(COOKIE, cookieOpts(config));

export const publicUser = (u) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  role: u.role,
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
  // tokenVersion changes on password change / reset / deactivation, which kills old sessions at once.
  if (!user || !user.active || user.tokenVersion !== payload.tv) throw unauthorized('Session expired. Please sign in again.');
  req.user = user;
  next();
}

export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };

export function blockUntilPasswordChanged(req, _res, next) {
  if (req.user.mustChangePassword) {
    throw new HttpError(403, 'PASSWORD_CHANGE_REQUIRED', 'Please set a new password first');
  }
  next();
}
