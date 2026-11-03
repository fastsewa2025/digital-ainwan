import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import supertest from 'supertest';
import { PASSWORD, client, loggedIn, makeUser, sample, startTestApp } from './helpers.js';

let ctx;
before(async () => {
  ctx = await startTestApp();
});
after(async () => {
  await ctx.close();
});

const project = (over = {}) => ({
  title: { en: 'Water tank', hi: 'पानी की टंकी' },
  phase: 'in-progress',
  progress: 40,
  summary: { en: 'A short summary' },
  details: { en: 'Long details that must stay out of lists' },
  budgetAllocated: 500000,
  budgetSpent: 200000,
  ...over,
});

describe('security basics', () => {
  it('blocks state-changing requests that lack the website header (CSRF)', async () => {
    const res = await supertest(ctx.app).post('/api/auth/login').send({ email: 'a@b.co', password: 'x' });
    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'CSRF');
  });

  it('keeps admin routes closed without a session', async () => {
    for (const url of ['/api/admin/meta', '/api/admin/resources/projects', '/api/admin/users']) {
      assert.equal((await supertest(ctx.app).get(url)).status, 401, url);
    }
  });

  it('never lets query strings turn into database operators', async () => {
    const plain = await supertest(ctx.app).get('/api/public/content/projects');
    const tricky = await supertest(ctx.app).get('/api/public/content/projects?q[$ne]=x&phase[$ne]=planned');
    assert.equal(tricky.status, 200);
    assert.equal(tricky.body.total, plain.body.total); // the operator was ignored, not applied
    assert.equal((await supertest(ctx.app).get('/api/public/content/projects?q=a&q=b')).status, 400);
  });

  it('survives regex characters in search', async () => {
    const res = await supertest(ctx.app).get('/api/public/content/projects').query({ q: '(.*)+$[' });
    assert.equal(res.status, 200);
  });

  it('sets hardening headers', async () => {
    const res = await supertest(ctx.app).get('/api/health');
    assert.match(res.headers['content-security-policy'], /default-src 'self'/);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-powered-by'], undefined);
  });
});

describe('sign-in', () => {
  it('gives the same answer for a wrong password and an unknown e-mail', async () => {
    const user = await makeUser();
    const a = await client(ctx.app).login(user.email, 'wrong-password-1');
    const b = await client(ctx.app).login('nobody@example.org', 'wrong-password-1');
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.equal(a.body.message, b.body.message);
  });

  it('locks the account after 5 wrong attempts, even for the right password', async () => {
    const user = await makeUser();
    for (let i = 0; i < 5; i++) await client(ctx.app).login(user.email, 'wrong-password-1');
    const res = await client(ctx.app).login(user.email, PASSWORD);
    assert.equal(res.status, 429);
    assert.equal(res.body.error, 'LOCKED');
  });

  it('cookie is httpOnly + SameSite=Strict, and logout clears it', async () => {
    const user = await makeUser();
    const c = client(ctx.app);
    const res = await c.login(user.email);
    const cookie = res.headers['set-cookie'].join(';');
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Strict/i);
    assert.equal((await c.get('/api/auth/me')).status, 200);
    await c.post('/api/auth/logout').send({});
    assert.equal((await c.get('/api/auth/me')).status, 401);
  });

  it('forces a new password at first sign-in, and kills old sessions when it changes', async () => {
    const { c } = await loggedIn(ctx.app, { mustChangePassword: true });
    const blocked = await c.get('/api/admin/meta');
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error, 'PASSWORD_CHANGE_REQUIRED');

    const weak = await c.post('/api/auth/change-password').send({ currentPassword: PASSWORD, newPassword: 'short' });
    assert.equal(weak.status, 400);

    const done = await c.post('/api/auth/change-password').send({ currentPassword: PASSWORD, newPassword: 'a much better password' });
    assert.equal(done.status, 200);
    assert.equal((await c.get('/api/admin/meta')).status, 200);
  });
});

describe('approval workflow', () => {
  let boss;
  let editor;
  let projectId;

  before(async () => {
    boss = (await loggedIn(ctx.app, { role: 'superadmin', name: 'Mukhiya' })).c;
    editor = (await loggedIn(ctx.app, { role: 'editor', name: 'Volunteer' })).c;
  });

  it('an editor\'s new entry waits for approval and is invisible to the public', async () => {
    const res = await editor.post('/api/admin/resources/projects').send(project());
    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'pending');
    projectId = res.body._id;
    const pub = await supertest(ctx.app).get('/api/public/content/projects');
    assert.equal(pub.body.total, 0);
    assert.equal((await supertest(ctx.app).get(`/api/public/content/projects/${projectId}`)).status, 404);
  });

  it('an editor cannot publish, not even by asking nicely', async () => {
    assert.equal((await editor.post(`/api/admin/resources/projects/${projectId}/status`).send({ status: 'published' })).status, 403);
    assert.equal((await editor.post('/api/admin/resources/projects').send({ ...project(), status: 'published' })).status, 403);
  });

  it('the Mukhiya publishes it and it appears, without heavy or private fields in lists', async () => {
    const res = await boss.post(`/api/admin/resources/projects/${projectId}/status`).send({ status: 'published' });
    assert.equal(res.status, 200);
    const list = await supertest(ctx.app).get('/api/public/content/projects');
    assert.equal(list.body.total, 1);
    const item = list.body.items[0];
    assert.equal(item.details, undefined);
    assert.equal(item.createdBy, undefined);
    assert.equal(item.budgetAllocated, 500000);
    const detail = await supertest(ctx.app).get(`/api/public/content/projects/${projectId}`);
    assert.equal(detail.body.details.en, 'Long details that must stay out of lists');
  });

  it('filters the public list', async () => {
    assert.equal((await supertest(ctx.app).get('/api/public/content/projects?phase=completed')).body.total, 0);
    assert.equal((await supertest(ctx.app).get('/api/public/content/projects?phase=in-progress')).body.total, 1);
    assert.equal((await supertest(ctx.app).get('/api/public/content/projects?phase=nonsense')).status, 400);
  });

  it('an editor\'s edit to a live item takes it down until it is approved again', async () => {
    const res = await editor.put(`/api/admin/resources/projects/${projectId}`).send({ progress: 60 });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'pending');
    assert.equal(res.body.unpublished, true);
    assert.equal((await supertest(ctx.app).get('/api/public/content/projects')).body.total, 0);
    await boss.post(`/api/admin/resources/projects/${projectId}/status`).send({ status: 'published' });
    const detail = await supertest(ctx.app).get(`/api/public/content/projects/${projectId}`);
    assert.equal(detail.body.progress, 60);
    assert.equal(detail.body.details.en, 'Long details that must stay out of lists'); // untouched field survived
  });

  it('completed projects are forced to 100%, planned to 0%', async () => {
    const res = await boss.put(`/api/admin/resources/projects/${projectId}`).send({ phase: 'completed' });
    assert.equal(res.body.progress, 100);
  });

  it('rejection needs a reason, and the editor sees it', async () => {
    const draft = await editor.post('/api/admin/resources/notices').send({ title: { en: 'Draft notice' }, category: 'general', date: '2026-10-01', status: 'pending' });
    const id = draft.body._id;
    assert.equal((await boss.post(`/api/admin/resources/notices/${id}/status`).send({ status: 'rejected' })).status, 400);
    await boss.post(`/api/admin/resources/notices/${id}/status`).send({ status: 'rejected', reason: 'Date is wrong' });
    const seen = await editor.get(`/api/admin/resources/notices/${id}`);
    assert.equal(seen.body.status, 'rejected');
    assert.equal(seen.body.rejectReason, 'Date is wrong');
  });

  it('editors may delete only their own drafts; the Mukhiya may delete anything', async () => {
    const mine = await editor.post('/api/admin/resources/notices').send({ title: { en: 'Mine' }, category: 'general', date: '2026-10-01', status: 'draft' });
    assert.equal((await editor.delete(`/api/admin/resources/notices/${mine.body._id}`)).status, 200);
    assert.equal((await editor.delete(`/api/admin/resources/projects/${projectId}`)).status, 403);
    assert.equal((await boss.delete(`/api/admin/resources/projects/${projectId}`)).status, 200);
  });

  it('validation errors point at the field', async () => {
    const res = await boss.post('/api/admin/resources/projects').send({ title: { hi: '', en: '' }, phase: 'in-progress' });
    assert.equal(res.status, 400);
    assert.ok(res.body.issues.some((i) => i.path === 'title'));
  });

  it('unknown content types and bad ids are plain 404s', async () => {
    assert.equal((await boss.get('/api/admin/resources/nothing')).status, 404);
    assert.equal((await boss.get('/api/admin/resources/projects/not-an-id')).status, 404);
  });
});

describe('roles', () => {
  it('editors cannot reach users, inbox, settings or the audit log', async () => {
    const { c } = await loggedIn(ctx.app, { role: 'editor' });
    for (const url of ['/api/admin/users', '/api/admin/messages', '/api/admin/settings', '/api/admin/audit']) {
      assert.equal((await c.get(url)).status, 403, url);
    }
    assert.equal((await c.put('/api/admin/settings').send({ tagline: { en: 'x' } })).status, 403);
  });

  it('the Mukhiya creates an editor; deactivating them ends their session at once', async () => {
    const { c: boss } = await loggedIn(ctx.app, { role: 'superadmin' });
    const created = await boss.post('/api/admin/users').send({ name: 'New Volunteer', email: 'vol@example.org' });
    assert.equal(created.status, 201);
    assert.ok(created.body.tempPassword.length >= 12);
    assert.equal(created.body.user.mustChangePassword, true);

    const vol = client(ctx.app);
    assert.equal((await vol.login('vol@example.org', created.body.tempPassword)).status, 200);
    assert.equal((await vol.get('/api/auth/me')).status, 200);

    await boss.patch(`/api/admin/users/${created.body.user.id}`).send({ active: false });
    assert.equal((await vol.get('/api/auth/me')).status, 401);
  });

  it('nobody can lock themselves out', async () => {
    const { user, c } = await loggedIn(ctx.app, { role: 'superadmin' });
    assert.equal((await c.patch(`/api/admin/users/${user._id}`).send({ active: false })).status, 400);
    assert.equal((await c.patch(`/api/admin/users/${user._id}`).send({ role: 'editor' })).status, 400);
  });
});

describe('public forms and privacy', () => {
  let boss;
  before(async () => {
    boss = (await loggedIn(ctx.app, { role: 'superadmin' })).c;
  });
  const entry = { name: 'Ramesh', category: 'electrician', phone: '98765 43210', mohalla: 'North', consent: true };

  it('a directory sign-up needs consent and lands as pending', async () => {
    const pub = supertest(ctx.app);
    const noConsent = await pub.post('/api/public/submit/directory').set('X-Requested-By', 'ainwan-web').send({ ...entry, consent: false });
    assert.equal(noConsent.status, 400);
    const res = await pub.post('/api/public/submit/directory').set('X-Requested-By', 'ainwan-web').send(entry);
    assert.equal(res.status, 201);
    const list = await boss.get('/api/admin/resources/directory?status=pending');
    assert.equal(list.body.total, 1);
    assert.equal(list.body.items[0].source, 'public');
    assert.equal((await pub.get('/api/public/content/directory')).body.total, 0);
  });

  it('phone numbers never appear in public lists or details; they are fetched one by one', async () => {
    const pending = (await boss.get('/api/admin/resources/directory?status=pending')).body.items[0];
    const id = pending._id;
    assert.equal((await supertest(ctx.app).get(`/api/public/content/directory/${id}/reveal`)).status, 404); // not published yet
    await boss.post(`/api/admin/resources/directory/${id}/status`).send({ status: 'published' });

    const pub = supertest(ctx.app);
    const list = await pub.get('/api/public/content/directory');
    assert.equal(list.body.total, 1);
    assert.equal(JSON.stringify(list.body).includes('98765'), false);
    assert.equal(list.body.items[0].consent, undefined);
    assert.equal(JSON.stringify((await pub.get(`/api/public/content/directory/${id}`)).body).includes('98765'), false);

    const reveal = await pub.get(`/api/public/content/directory/${id}/reveal`);
    assert.equal(reveal.body.phone, '9876543210'); // spaces are removed when saving
  });

  it('a filled-in honeypot is silently ignored', async () => {
    const before = (await boss.get('/api/admin/resources/directory')).body.total;
    const res = await supertest(ctx.app).post('/api/public/submit/directory').set('X-Requested-By', 'ainwan-web').send({ ...entry, name: 'Bot', website: 'http://spam.example' });
    assert.equal(res.status, 201);
    assert.equal((await boss.get('/api/admin/resources/directory')).body.total, before);
  });

  it('diaspora messages need a way to reply, and go to the Mukhiya\'s inbox', async () => {
    const pub = supertest(ctx.app);
    const body = { name: 'Asha', place: 'Dubai', helpType: 'idea', message: 'Let us fund a library' };
    assert.equal((await pub.post('/api/public/submit/diaspora').set('X-Requested-By', 'ainwan-web').send(body)).status, 400);
    assert.equal((await pub.post('/api/public/submit/diaspora').set('X-Requested-By', 'ainwan-web').send({ ...body, email: 'asha@example.org' })).status, 201);
    const inbox = await boss.get('/api/admin/messages?status=new');
    assert.equal(inbox.body.items.length, 1);
    assert.equal(inbox.body.items[0].type, 'diaspora');
    const id = inbox.body.items[0]._id;
    assert.equal((await boss.patch(`/api/admin/messages/${id}`).send({ status: 'read' })).body.status, 'read');
  });

  it('oral-history and wiki need consent / content rules too', async () => {
    const res = await boss.post('/api/admin/resources/oral-history').send({ title: { en: 'Story' }, elderName: { en: 'Elder' }, consent: false });
    assert.equal(res.status, 400);
  });
});

describe('uploads', () => {
  let boss;
  before(async () => {
    boss = (await loggedIn(ctx.app, { role: 'superadmin' })).c;
  });

  it('re-encodes photos to WebP, makes a thumbnail, and serves them', async () => {
    const png = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: '#3f7d4e' } }).png().toBuffer();
    const res = await boss.post('/api/admin/upload/image').attach('file', png, 'big.png');
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.match(res.body.url, /^\/uploads\/images\/[a-f0-9]{24}\.webp$/);
    assert.equal(res.body.width, 1600);
    const served = await supertest(ctx.app).get(res.body.url);
    assert.equal(served.status, 200);
    assert.equal(served.headers['content-type'], 'image/webp');
    assert.equal((await supertest(ctx.app).get(res.body.thumb)).status, 200);
    assert.ok((await fs.stat(path.join(ctx.uploadDir, res.body.url.replace('/uploads/', '')))).size > 0);
  });

  it('decides file type from the bytes, not the file name', async () => {
    const fake = await boss.post('/api/admin/upload/image').attach('file', Buffer.from('<?php echo 1; ?>'), 'photo.jpg');
    assert.equal(fake.status, 415);
    const svg = await boss.post('/api/admin/upload/image').attach('file', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'x.svg');
    assert.equal(svg.status, 415);
    const fakeAudio = await boss.post('/api/admin/upload/audio').attach('file', Buffer.from('not audio at all'), 'song.mp3');
    assert.equal(fakeAudio.status, 415);
  });

  it('accepts audio and PDF, and serves PDFs sandboxed', async () => {
    const wav = await boss.post('/api/admin/upload/audio').attach('file', sample.wav, 'story.wav');
    assert.equal(wav.status, 201, JSON.stringify(wav.body));
    assert.match(wav.body.url, /\.wav$/);
    const pdf = await boss.post('/api/admin/upload/pdf').attach('file', sample.pdf, 'order.pdf');
    assert.equal(pdf.status, 201, JSON.stringify(pdf.body));
    const served = await supertest(ctx.app).get(pdf.body.url);
    assert.equal(served.status, 200);
    assert.match(served.headers['content-security-policy'], /sandbox/);
  });

  it('uploads need a session, and a missing file is a clean error', async () => {
    const anon = await supertest(ctx.app).post('/api/admin/upload/image').set('X-Requested-By', 'ainwan-web').attach('file', sample.pdf, 'x.pdf');
    assert.equal(anon.status, 401);
    assert.equal((await boss.post('/api/admin/upload/image').send({})).status, 400);
  });

  it('refuses to serve anything outside the uploads folder', async () => {
    assert.equal((await supertest(ctx.app).get('/uploads/../package.json')).status, 404);
    assert.equal((await supertest(ctx.app).get('/uploads/images/nothing.webp')).status, 404);
  });
});

describe('settings, home page data and sitemap', () => {
  it('validates the UPI id and shows saved settings publicly', async () => {
    const { c } = await loggedIn(ctx.app, { role: 'superadmin' });
    assert.equal((await c.put('/api/admin/settings').send({ upiId: 'not a upi id' })).status, 400);
    const ok = await c.put('/api/admin/settings').send({ upiId: 'ainwan@sbi', donationEnabled: true, tagline: { hi: 'नया', en: 'New tagline' } });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const pub = (await supertest(ctx.app).get('/api/public/settings')).body;
    assert.equal(pub.upiId, 'ainwan@sbi');
    assert.equal(pub.tagline.en, 'New tagline');
    assert.deepEqual(pub.villageName, { hi: 'ऐनवां', en: 'Ainwan' }); // default kept for what was not set
  });

  it('builds the home page data from published content only', async () => {
    const { c } = await loggedIn(ctx.app, { role: 'superadmin' });
    await c.post('/api/admin/resources/notices').send({ title: { en: 'Ticker notice' }, category: 'general', date: '2026-10-01', important: true });
    await c.post('/api/admin/resources/notices').send({ title: { en: 'Hidden draft' }, category: 'general', date: '2026-10-01', important: true, status: 'draft' });
    await c.post('/api/admin/resources/projects').send(project({ title: { en: 'Tank' }, budgetAllocated: 1000, budgetSpent: 400 }));
    const home = (await supertest(ctx.app).get('/api/public/home')).body;
    assert.deepEqual(home.ticker.map((n) => n.title.en), ['Ticker notice']);
    assert.equal(home.stats.projects.inProgress, 1);
    assert.equal(home.stats.budget.spent, 400);
  });

  it('serves robots.txt and a sitemap that lists published pages', async () => {
    const robots = await supertest(ctx.app).get('/robots.txt');
    assert.match(robots.text, /Disallow: \/admin/);
    const sitemap = await supertest(ctx.app).get('/sitemap.xml');
    assert.match(sitemap.text, /<loc>http:\/\/localhost:5000\/vikas\/projects\/[a-f0-9]{24}<\/loc>/);
    assert.equal(sitemap.text.includes('Hidden draft'), false);
  });

  it('keeps an audit trail of who did what', async () => {
    const { c } = await loggedIn(ctx.app, { role: 'superadmin' });
    const trail = await c.get('/api/admin/audit');
    assert.equal(trail.status, 200);
    const actions = trail.body.items.map((i) => i.action);
    assert.ok(actions.includes('create'));
    assert.ok(actions.includes('login_failed'));
  });
});
