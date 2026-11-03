import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { makeLogger } from './lib/logger.js';
import { dbReady } from './db.js';
import { csrfGuard, makeLimiters } from './middleware/security.js';
import { blockUntilPasswordChanged, requireAuth, requireRole } from './middleware/auth.js';
import { apiNotFound, errorHandler } from './middleware/errors.js';
import { authRouter } from './routes/auth.js';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin.js';
import { usersRouter } from './routes/users.js';
import { messagesRouter } from './routes/messages.js';
import { uploadRouter } from './routes/upload.js';
import { pageMeta, renderIndex, sitemapXml } from './lib/seo.js';

export function createApp(config) {
  const app = express();
  const log = makeLogger(config);
  app.locals.config = config;
  app.locals.log = log;

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy); // 1 = one reverse proxy (Caddy) in front of us

  app.use(
    pinoHttp({
      logger: log,
      autoLogging: { ignore: (req) => req.url === '/api/health' || req.url.startsWith('/assets/') },
    }),
  );

  // The plain-http trial run (see DEPLOYMENT.md) must not tell browsers to switch to https.
  const overHttps = config.isProd && config.publicUrl.startsWith('https://');
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // React/Leaflet set inline style attributes
          imgSrc: ["'self'", 'data:', 'blob:', 'https://tile.openstreetmap.org', 'https://*.tile.openstreetmap.org'],
          mediaSrc: ["'self'"],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          frameSrc: ['https://www.youtube-nocookie.com'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          ...(overHttps ? { upgradeInsecureRequests: [] } : {}),
        },
      },
      crossOriginEmbedderPolicy: false, // map tiles and YouTube embeds
      // OpenStreetMap's tile servers reject requests that carry no Referer at all.
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      // This host only (no includeSubDomains): other sub-domains of the Panchayat's domain may not have HTTPS.
      hsts: overHttps ? { maxAge: 15_552_000, includeSubDomains: false } : false,
    }),
  );
  app.use(compression());

  /* ------------------------------- health -------------------------------- */
  app.get('/api/health', (_req, res) => {
    const ok = dbReady();
    res.status(ok ? 200 : 503).set('Cache-Control', 'no-store').json({ ok, db: ok ? 'up' : 'down', uptime: Math.round(process.uptime()) });
  });

  /* --------------------------------- API --------------------------------- */
  const limiters = makeLimiters(config);
  app.use('/api', limiters.global, express.json({ limit: '200kb' }), cookieParser(), csrfGuard);

  app.use('/api/auth', authRouter({ limiters }));
  app.use('/api/public', publicRouter({ limiters }));

  const admin = express.Router();
  admin.use(requireAuth, blockUntilPasswordChanged);
  admin.use('/upload', uploadRouter({ uploadDir: config.uploadDir }));
  admin.use('/users', requireRole('superadmin'), usersRouter());
  admin.use('/messages', requireRole('superadmin'), messagesRouter());
  admin.use(adminRouter());
  app.use('/api/admin', admin);
  app.use('/api', apiNotFound);

  /* ------------------------------- uploads -------------------------------- */
  // File names are random and never reused, so they can be cached "forever".
  app.use(
    '/uploads',
    express.static(config.uploadDir, {
      index: false,
      dotfiles: 'deny',
      maxAge: '30d',
      immutable: true,
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}docs${path.sep}`)) res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      },
    }),
  );
  app.use('/uploads', (_req, res) => res.status(404).end());

  /* ------------------------- robots, sitemap, website ---------------------- */
  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nDisallow: /api/\nSitemap: ${config.publicUrl}/sitemap.xml\n`);
  });

  let sitemapCache = { at: 0, xml: '' };
  app.get('/sitemap.xml', async (_req, res) => {
    if (Date.now() - sitemapCache.at > 10 * 60_000) sitemapCache = { at: Date.now(), xml: await sitemapXml(config) };
    res.type('application/xml').send(sitemapCache.xml);
  });

  const indexPath = path.join(config.clientDist, 'index.html');
  if (fs.existsSync(indexPath)) {
    const indexHtml = fs.readFileSync(indexPath, 'utf8');
    app.use(
      express.static(config.clientDist, {
        index: false,
        maxAge: '1h',
        setHeaders(res, filePath) {
          // Vite puts a content hash in every file name under /assets, so they never change.
          if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        },
      }),
    );
    app.use(async (req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (/\.[a-z0-9]{2,5}$/i.test(req.path)) return next(); // a missing file is a real 404, not the app
      res.set('Cache-Control', 'no-cache').type('html');
      if (req.path.startsWith('/admin')) {
        res.set('X-Robots-Tag', 'noindex, nofollow');
        return res.send(indexHtml.replace('<!--OG-->', ''));
      }
      try {
        return res.send(renderIndex(indexHtml, await pageMeta(req.path, config)));
      } catch (err) {
        req.log.warn({ err }, 'could not build page meta; sending plain page');
        return res.send(indexHtml.replace('<!--OG-->', ''));
      }
    });
  }

  app.use((_req, res) => res.status(404).type('text').send('Not found'));
  app.use(errorHandler);
  return app;
}
