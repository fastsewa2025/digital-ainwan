/**
 * WhatsApp / Facebook link previews read the FIRST html response and do not run JavaScript.
 * For a village site that is shared mostly on WhatsApp, a plain SPA would always show the same
 * generic preview. So the server fills in the title, description and preview photo for every page.
 * Hindi pages live at /..., English pages at /en/...
 */
import fs from 'node:fs';
import path from 'node:path';
import { RESOURCES } from '../resources.js';
import { modelFor } from '../models/index.js';
import { getSettings } from './settings.js';

const ID = /^[a-f0-9]{24}$/i;

// URL on the website -> content type it shows
const DETAIL_ROUTES = [
  [/^\/vikas\/projects\/([a-f0-9]{24})\/?$/i, 'projects'],
  [/^\/vikas\/notices\/([a-f0-9]{24})\/?$/i, 'notices'],
  [/^\/sanskriti\/festivals\/([a-f0-9]{24})\/?$/i, 'festivals'],
  [/^\/sanskriti\/wiki\/([a-f0-9]{24})\/?$/i, 'wiki'],
  [/^\/sanskriti\/gallery\/([a-f0-9]{24})\/?$/i, 'albums'],
  [/^\/sanskriti\/oral-history\/([a-f0-9]{24})\/?$/i, 'oral-history'],
  [/^\/sampark\/fame\/([a-f0-9]{24})\/?$/i, 'fame'],
];

// Titles of the fixed pages: [hindi, english]
const PAGE_TITLES = {
  '/about': ['गाँव के बारे में', 'About the village'],
  '/privacy': ['गोपनीयता', 'Privacy'],
  '/sanskriti/festivals': ['त्योहार और आयोजन', 'Festivals and events'],
  '/sanskriti/oral-history': ['बुजुर्गों की ज़ुबानी', 'Voices of our elders'],
  '/sanskriti/wiki': ['परंपरा कोश', 'Tradition wiki'],
  '/sanskriti/gallery': ['फोटो गैलरी', 'Photo gallery'],
  '/vikas': ['विकास कार्य और हिसाब', 'Development works and accounts'],
  '/vikas/map': ['गाँव का नक्शा', 'Village map'],
  '/vikas/notices': ['सूचना पट्ट', 'Notice board'],
  '/sampark/directory': ['ऐनवां निर्देशिका', 'Ainwan directory'],
  '/sampark/youth': ['युवा कोना', 'Youth corner'],
  '/sampark/fame': ['गौरव दीवार', 'Wall of pride'],
  '/sampark/contribute': ['सहयोग और हिसाब', 'Contribute and see the accounts'],
  '/login': ['लॉगिन', 'Sign in'],
  '/register': ['नया खाता', 'Create an account'],
  '/account': ['मेरा खाता', 'My account'],
};
// Pages about one person's account: never in search results.
export const PRIVATE_PATHS = /^\/(?:en\/)?(?:login|register|account|receipt)(?:\/|$)/;

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trim()}…` : s);

/** "/en/vikas" -> { lang: 'en', path: '/vikas' }; "/vikas" -> { lang: 'hi', path: '/vikas' } */
export function splitLang(pathname) {
  if (pathname === '/en' || pathname.startsWith('/en/')) return { lang: 'en', path: pathname.slice(3) || '/' };
  return { lang: 'hi', path: pathname };
}
const withLang = (lang, p) => (lang === 'en' ? `/en${p === '/' ? '' : p}` : p);

/** The 1200x630 JPEG made at upload time, if it exists (older uploads may not have one). */
function previewImage(img, config) {
  if (!img?.url) return null;
  const og = img.url.replace(/\.webp$/, '_og.jpg');
  if (og !== img.url && fs.existsSync(path.join(config.uploadDir, og.replace(/^\/uploads\//, '')))) {
    return { url: og, width: 1200, height: 630 };
  }
  return { url: img.url, width: img.width, height: img.height };
}

export async function pageMeta(pathname, config) {
  const settings = await getSettings();
  const { lang, path: p } = splitLang(pathname);
  const pick = (v) => (typeof v === 'string' ? v : v?.[lang] || v?.hi || v?.en || '');
  const site = pick(settings.villageName) || 'Ainwan';
  const fallbackText =
    lang === 'en'
      ? `${site}, ${pick(settings.district)}: culture, development work and community in one place.`
      : `${site}, ${pick(settings.district)} — संस्कृति, विकास कार्य और गाँव के लोग, एक जगह।`;

  let title = `${site} · ${pick(settings.tagline)}`;
  let description = clip(pick(settings.about).replace(/\s+/g, ' ') || fallbackText, 200);
  let image = previewImage(settings.heroImages?.[0], config);
  let type = 'website';

  const fixed = PAGE_TITLES[p.replace(/\/+$/, '')];
  if (fixed) title = `${fixed[lang === 'en' ? 1 : 0]} · ${site}`;

  for (const [re, key] of DETAIL_ROUTES) {
    const m = p.match(re);
    if (!m || !ID.test(m[1])) continue;
    const def = RESOURCES[key];
    const doc = await modelFor(key).findOne({ _id: m[1], status: 'published' }).lean();
    if (!doc) break;
    title = `${pick(doc[def.titleField])} · ${site}`;
    const text = pick(doc.summary) || pick(doc.headline) || pick(doc.details) || pick(doc.body) || pick(doc.report) || pick(doc.transcript);
    if (text) description = clip(text.replace(/\s+/g, ' '), 200);
    image = previewImage(doc.cover || doc.afterCover || doc.photo, config) || image;
    type = 'article';
    break;
  }

  const abs = (u) => (u ? `${config.publicUrl}${u}` : '');
  const url = `${config.publicUrl}${pathname}`;
  const tags = [
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<link rel="alternate" hreflang="hi" href="${esc(config.publicUrl + withLang('hi', p))}" />`,
    `<link rel="alternate" hreflang="en" href="${esc(config.publicUrl + withLang('en', p))}" />`,
    `<link rel="alternate" hreflang="x-default" href="${esc(config.publicUrl + withLang('hi', p))}" />`,
    `<meta property="og:site_name" content="${esc(site)}" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:locale" content="${lang === 'en' ? 'en_IN' : 'hi_IN'}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    ...(image
      ? [
          `<meta property="og:image" content="${esc(abs(image.url))}" />`,
          image.width ? `<meta property="og:image:width" content="${image.width}" />` : '',
          image.height ? `<meta property="og:image:height" content="${image.height}" />` : '',
          `<meta property="og:image:alt" content="${esc(title)}" />`,
          `<meta name="twitter:image" content="${esc(abs(image.url))}" />`,
        ]
      : []),
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    settings.googleVerification ? `<meta name="google-site-verification" content="${esc(settings.googleVerification)}" />` : '',
    PRIVATE_PATHS.test(pathname) ? '<meta name="robots" content="noindex" />' : '',
  ].filter(Boolean);
  // Home page: start downloading the big photo at once, before the JavaScript has even run.
  const hero = settings.heroImages?.[0];
  if (p === '/' && hero?.url) {
    const set = hero.thumb && hero.width > 480 ? ` imagesrcset="${esc(`${hero.thumb} 480w, ${hero.url} ${hero.width}w`)}" imagesizes="(min-width: 980px) 58vw, 100vw"` : '';
    tags.push(`<link rel="preload" as="image" href="${esc(hero.url)}"${set} fetchpriority="high" />`);
  }
  // The settings every page needs, handed over with the page (JSON, not code: allowed by the CSP).
  const json = JSON.stringify(settings).replace(/</g, '\\u003c');
  tags.push(`<script type="application/json" id="site-settings">${json}</script>`);
  return { title: esc(title), tags: tags.join('\n    '), lang, shell: PRIVATE_PATHS.test(pathname) ? '' : shellHtml(pathname, settings) };
}

/* ------------------------------------------------------------------------
 * First paint before JavaScript: the header (every page) and, on the home page, the big photo with
 * the village name. React replaces this with the identical live page once its code has loaded, so a
 * phone on a slow network sees the top of the page in about a second instead of three.
 * Keep the class names in step with components/Layout.jsx and pages/Home.jsx.
 * ---------------------------------------------------------------------- */
const SHELL_TEXT = {
  hi: { other: 'EN', otherLabel: 'Read in English', search: 'खोजें', login: 'लॉगिन', menu: 'मेन्यू', home: 'होम', sanskriti: 'संस्कृति', vikas: 'विकास', sampark: 'संपर्क', about: 'गाँव के बारे में', know: 'गाँव को जानें', works: 'विकास कार्य देखें' },
  en: { other: 'हिं', otherLabel: 'हिंदी में पढ़ें', search: 'Search', login: 'Sign in', menu: 'Menu', home: 'Home', sanskriti: 'Culture', vikas: 'Development', sampark: 'Community', about: 'About the village', know: 'Know the village', works: 'See development work' },
};
const ICON = (d) => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const LEAF = '<svg class="brand__leaf" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M24 42C14 34 5 27 5 17.5 5 11.6 9.6 7 15.3 7c3.8 0 6.8 2 8.7 5 1.9-3 4.9-5 8.7-5C38.4 7 43 11.6 43 17.5 43 27 34 34 24 42z"/><path d="M24 36V17M24 23l-6-5M24 23l6-5M24 30l-7-5.5M24 30l7-5.5" stroke-width="2.8"/></svg>';

export function shellHtml(pathname, settings) {
  const { lang, path } = splitLang(pathname);
  const T = SHELL_TEXT[lang];
  const pick = (v) => (typeof v === 'string' ? v : v?.[lang] || v?.hi || v?.en || '');
  const L = (to) => withLang(lang, to);
  const name = esc(pick(settings.villageName) || 'ऐनवां');
  const header = `<header class="header"><div class="wrap header__in"><a class="brand" href="${L('/')}">${LEAF}<span><span class="brand__name">${name}</span><span class="brand__sub">DIGITAL AINWAN</span></span></a>`
    + `<nav class="nav"><div class="nav__item"><a class="nav__link" href="${L('/')}">${T.home}</a></div>`
    + ['sanskriti', 'vikas', 'sampark'].map((k) => `<div class="nav__item"><a class="nav__btn" href="${L(`/${k}`)}">${T[k]}</a></div>`).join('')
    + `<div class="nav__item"><a class="nav__link" href="${L('/about')}">${T.about}</a></div></nav>`
    + `<div class="header__tools"><a class="iconbtn iconbtn--lang" href="${withLang(lang === 'hi' ? 'en' : 'hi', path)}" aria-label="${T.other}: ${T.otherLabel}">${T.other}</a>`
    + `<a class="iconbtn iconbtn--round" href="${L('/search')}" aria-label="${T.search}">${ICON('M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20')}</a>`
    + `<a class="iconbtn iconbtn--account" href="${L('/login')}" aria-label="${T.login}">${ICON('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c.8-3.8 3.8-6 7.5-6s6.7 2.2 7.5 6')}<span class="iconbtn__label">${T.login}</span></a>`
    + `<a class="iconbtn iconbtn--round iconbtn--menu" href="${L('/sampark')}" aria-label="${T.menu}">${ICON('M4 7h16M4 12h16M4 17h16')}</a></div></div></header>`;
  if (path !== '/') return `${header}<main id="main"></main>`;
  const hero = settings.heroImages?.[0];
  const img = hero?.url
    ? `<img class="hhero__img" src="${esc(hero.url)}"${hero.thumb && hero.width > 480 ? ` srcset="${esc(`${hero.thumb} 480w, ${hero.url} ${hero.width}w`)}" sizes="(min-width: 980px) 58vw, 100vw"` : ''} width="${hero.width}" height="${hero.height}" alt="${name}" fetchpriority="high" decoding="async">`
    : '<div class="blank hhero__blank"></div>';
  const place = settings.district ? `<p class="hhero__place">${ICON('M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z').replace('width="24" height="24"', 'width="18" height="18"')}${esc(pick(settings.district))}</p>` : '';
  const line2 = settings.heroText ? `<br>${esc(pick(settings.heroText))}` : '';
  return `${header}<main id="main"><div class="home"><section class="hhero"><div class="hhero__media">${img}</div><div class="hhero__panel"><div class="hhero__text">${place}`
    + `<h1 class="hhero__name">${name}</h1><p class="hhero__tag">${esc(pick(settings.tagline))}।${line2}</p>`
    + `<div class="hhero__cta"><a class="btn btn--mustard" href="${L('/about')}">${T.know}</a><a class="btn btn--outline-light" href="${L('/vikas')}">${T.works}</a></div></div></div></section></div></main>`;
}

export function renderIndex(html, meta) {
  return html
    .replace('<!--OG-->', meta.tags)
    .replace('<div id="root"></div>', `<div id="root">${meta.shell ?? ''}</div>`)
    .replace(/<html lang="[a-z]+"/, `<html lang="${meta.lang ?? 'hi'}"`)
    .replace(/<title>[^<]*<\/title>/, `<title>${meta.title}</title>`);
}

export async function sitemapXml(config) {
  const pages = ['/', '/about', '/sanskriti/festivals', '/sanskriti/oral-history', '/sanskriti/wiki', '/sanskriti/gallery',
    '/vikas', '/vikas/map', '/vikas/notices', '/sampark/directory', '/sampark/youth', '/sampark/fame', '/sampark/contribute'];
  const dynamic = [
    ['projects', '/vikas/projects/'],
    ['notices', '/vikas/notices/'],
    ['festivals', '/sanskriti/festivals/'],
    ['wiki', '/sanskriti/wiki/'],
    ['albums', '/sanskriti/gallery/'],
    ['oral-history', '/sanskriti/oral-history/'],
    ['fame', '/sampark/fame/'],
  ];
  const urls = pages.map((u) => ({ u }));
  for (const [key, prefix] of dynamic) {
    const docs = await modelFor(key).find({ status: 'published' }).select('_id updatedAt').limit(1000).lean();
    for (const d of docs) urls.push({ u: `${prefix}${d._id}`, at: d.updatedAt });
  }
  const entry = ({ u, at }) => {
    const hi = esc(config.publicUrl + withLang('hi', u));
    const en = esc(config.publicUrl + withLang('en', u));
    const alt = `<xhtml:link rel="alternate" hreflang="hi" href="${hi}"/><xhtml:link rel="alternate" hreflang="en" href="${en}"/>`;
    const mod = at ? `<lastmod>${new Date(at).toISOString().slice(0, 10)}</lastmod>` : '';
    return `  <url><loc>${hi}</loc>${mod}${alt}</url>\n  <url><loc>${en}</loc>${mod}${alt}</url>`;
  };
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    `${urls.map(entry).join('\n')}\n</urlset>\n`
  );
}
