/**
 * WhatsApp / Facebook link previews read the FIRST html response and do not run JavaScript.
 * For a village site that is shared mostly on WhatsApp, a plain SPA would always show the same
 * generic preview. So for detail pages we fill in the <meta> tags on the server.
 */
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

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pick = (v) => (typeof v === 'string' ? v : v?.hi || v?.en || '');
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trim()}…` : s);

export async function pageMeta(pathname, config) {
  const settings = await getSettings();
  const site = pick(settings.villageName) || 'Ainwan';
  let title = `${site} · ${pick(settings.tagline)}`;
  let description = clip(pick(settings.about) || `${site} — संस्कृति, विकास और संपर्क, एक जगह। Culture, development and community in one place.`, 200);
  let image = settings.heroImages?.[0]?.url;

  for (const [re, key] of DETAIL_ROUTES) {
    const m = pathname.match(re);
    if (!m || !ID.test(m[1])) continue;
    const def = RESOURCES[key];
    const doc = await modelFor(key).findOne({ _id: m[1], status: 'published' }).lean();
    if (!doc) break;
    const t = doc[def.titleField];
    title = `${pick(t)} · ${site}`;
    const text = pick(doc.summary) || pick(doc.headline) || pick(doc.details) || pick(doc.body) || pick(doc.report) || pick(doc.transcript);
    if (text) description = clip(text.replace(/\s+/g, ' '), 200);
    image = doc.cover?.url || doc.photo?.url || image;
    break;
  }

  const abs = (u) => (u ? `${config.publicUrl}${u}` : '');
  const url = `${config.publicUrl}${pathname}`;
  const tags = [
    `<meta property="og:site_name" content="${esc(site)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    image ? `<meta property="og:image" content="${esc(abs(image))}" />` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="description" content="${esc(description)}" />`,
  ].filter(Boolean);
  return { title: esc(title), tags: tags.join('\n    ') };
}

export function renderIndex(html, meta) {
  return html.replace('<!--OG-->', meta.tags).replace(/<title>[^<]*<\/title>/, `<title>${meta.title}</title>`);
}

export async function sitemapXml(config) {
  const urls = ['/', '/about', '/sanskriti/festivals', '/sanskriti/oral-history', '/sanskriti/wiki', '/sanskriti/gallery',
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
  for (const [key, prefix] of dynamic) {
    const docs = await modelFor(key).find({ status: 'published' }).select('_id updatedAt').limit(1000).lean();
    for (const d of docs) urls.push(`${prefix}${d._id}`);
  }
  const body = urls.map((u) => `  <url><loc>${esc(config.publicUrl + u)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}
