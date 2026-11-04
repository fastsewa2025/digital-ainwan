import path from 'node:path';
import { z } from 'zod';

const PLACEHOLDERS = ['change-me', 'changeme', 'replace-me', 'your-secret', 'password', 'secret123'];

const boolish = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  MONGO_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/ainwan'),
  JWT_SECRET: z.string().optional(),
  JWT_EXPIRES_HOURS: z.coerce.number().positive().max(72).default(8),
  VILLAGER_SESSION_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  PUBLIC_URL: z.string().default('http://localhost:5000'),
  UPLOAD_DIR: z.string().default('./uploads'),
  CLIENT_DIST: z.string().default('../client/dist'),
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(1),
  COOKIE_SECURE: boolish.optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
});

/** Validates environment variables once, at startup. Fails loudly instead of running half-configured. */
export function loadConfig(env = process.env) {
  // docker compose hands unset variables over as empty strings; "" must mean "not set", not "invalid".
  const clean = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ''));
  const parsed = schema.safeParse(clean);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid configuration:\n${lines.join('\n')}`);
  }
  const c = parsed.data;
  const isProd = c.NODE_ENV === 'production';
  const isTest = c.NODE_ENV === 'test';

  let secret = c.JWT_SECRET;
  if (!secret) {
    if (isProd) throw new Error('JWT_SECRET is required in production. Generate one with: node scripts/gen-secrets.mjs');
    secret = 'dev-only-secret-dev-only-secret-dev-only-1234';
  }
  if (secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters long.');
  if (isProd && PLACEHOLDERS.some((p) => secret.toLowerCase().includes(p))) {
    throw new Error('JWT_SECRET still looks like a placeholder. Generate a real one with: node scripts/gen-secrets.mjs');
  }

  const publicUrl = c.PUBLIC_URL.replace(/\/+$/, '');
  const cookieSecure = c.COOKIE_SECURE ?? isProd;
  if (isProd && cookieSecure && !publicUrl.startsWith('https://')) {
    throw new Error('PUBLIC_URL must start with https:// in production (or set COOKIE_SECURE=false for a plain-HTTP trial run).');
  }

  return Object.freeze({
    env: c.NODE_ENV,
    isProd,
    isTest,
    port: c.PORT,
    mongoUri: c.MONGO_URI,
    jwtSecret: secret,
    jwtExpiresHours: c.JWT_EXPIRES_HOURS,
    villagerSessionDays: c.VILLAGER_SESSION_DAYS,
    publicUrl,
    uploadDir: path.resolve(c.UPLOAD_DIR),
    clientDist: path.resolve(c.CLIENT_DIST),
    trustProxy: c.TRUST_PROXY,
    cookieSecure,
    logLevel: c.LOG_LEVEL ?? (isTest ? 'silent' : isProd ? 'info' : 'debug'),
  });
}
