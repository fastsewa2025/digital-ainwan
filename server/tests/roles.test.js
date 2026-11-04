import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import supertest from 'supertest';
import { PASSWORD, client, loggedIn, makeUser, startTestApp } from './helpers.js';

let ctx;
before(async () => {
  ctx = await startTestApp();
});
after(async () => {
  await ctx.close();
});

const villagerForm = (over = {}) => ({
  name: 'Ramdeo Yadav',
  phone: '+91 98765 11111',
  tola: 'Purab tola',
  livesIn: 'village',
  password: 'neem ka ped',
  consent: true,
  ...over,
});
const story = (audio) => ({
  title: { hi: 'पुराना मेला' },
  elderName: { hi: 'रामेश्वर बाबा' },
  elderAge: 82,
  language: 'magahi',
  audio,
  consent: true,
});

describe('villager registration and sign-in', () => {
  it('a villager registers with a mobile number and waits for verification', async () => {
    const v = client(ctx.app);
    const res = await v.post('/api/auth/register').send(villagerForm());
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.user.role, 'villager');
    assert.equal(res.body.user.status, 'pending');
    assert.equal(res.body.user.phone, '9876511111'); // +91 and spaces removed
    const me = await v.get('/api/auth/me');
    assert.equal(me.body.user.status, 'pending');
  });

  it('refuses a second account for the same number, weak passwords and missing consent', async () => {
    const v = client(ctx.app);
    const dup = await v.post('/api/auth/register').send(villagerForm({ phone: '09876511111' }));
    assert.equal(dup.status, 400);
    assert.ok(dup.body.issues.some((i) => i.path === 'phone'));

    const weak = await v.post('/api/auth/register').send(villagerForm({ phone: '9876522222', password: '9876522222' }));
    assert.equal(weak.status, 400);
    assert.ok(weak.body.issues.some((i) => i.path === 'password'));

    const noConsent = await v.post('/api/auth/register').send(villagerForm({ phone: '9876533333', consent: false }));
    assert.equal(noConsent.status, 400);
    assert.ok(noConsent.body.issues.some((i) => i.path === 'consent'));

    const badPhone = await v.post('/api/auth/register').send(villagerForm({ phone: '12345' }));
    assert.equal(badPhone.status, 400);
  });

  it('a filled-in honeypot creates nothing', async () => {
    const { User } = await import('../src/models/index.js');
    const before = await User.countDocuments();
    const res = await client(ctx.app).post('/api/auth/register').send(villagerForm({ phone: '9876544444', website: 'http://spam' }));
    assert.equal(res.status, 201);
    assert.equal(await User.countDocuments(), before);
  });

  it('signs in with the mobile number written any common way', async () => {
    for (const login of ['9876511111', '+91 98765-11111', '09876511111']) {
      const res = await client(ctx.app).raw.post('/api/auth/login').set('X-Requested-By', 'ainwan-web').send({ login, password: 'neem ka ped' });
      assert.equal(res.status, 200, login);
    }
  });

  it('villagers stay signed in for 30 days, staff only for 8 hours', async () => {
    const v = await client(ctx.app).raw.post('/api/auth/login').set('X-Requested-By', 'ainwan-web').send({ login: '9876511111', password: 'neem ka ped' });
    assert.match(v.headers['set-cookie'][0], /Max-Age=2592000/);
    const staff = await makeUser({ role: 'admin' });
    const s = await client(ctx.app).login(staff.email);
    assert.match(s.headers['set-cookie'][0], /Max-Age=28800/);
  });
});

describe('the hierarchy: villager < admin < super admin', () => {
  let boss;
  let admin;
  let adminUser;
  before(async () => {
    boss = (await loggedIn(ctx.app, { role: 'superadmin', name: 'Mukhiya' })).c;
    ({ c: admin, user: adminUser } = await loggedIn(ctx.app, { role: 'admin', name: 'Sunita' }));
  });

  it('villagers cannot open a single admin route, verified or not', async () => {
    const { c } = await loggedIn(ctx.app, { role: 'villager', email: undefined, phone: '9000000001', status: 'active' });
    for (const url of ['/api/admin/meta', '/api/admin/dashboard', '/api/admin/resources/notices', '/api/admin/users', '/api/admin/settings', '/api/admin/audit']) {
      assert.equal((await c.get(url)).status, 403, url);
    }
    assert.equal((await c.post('/api/admin/resources/notices').send({ title: { en: 'x' }, category: 'general', date: '2026-11-01' })).status, 403);
    assert.equal((await c.post('/api/admin/upload/image')).status, 403);
  });

  it('admins see villagers only, and cannot add admins or change roles', async () => {
    const list = await admin.get('/api/admin/users');
    assert.equal(list.status, 200);
    assert.ok(list.body.items.every((u) => u.role === 'villager'));
    assert.ok(list.body.pending >= 1);
    assert.equal((await admin.get('/api/admin/users?kind=staff')).status, 403);
    assert.equal((await admin.post('/api/admin/users').send({ name: 'Sneaky', email: 'sneak@example.org', role: 'admin' })).status, 403);

    const villager = await admin.post('/api/admin/users').send({ name: 'Added By Admin', phone: '9000000002' });
    assert.equal(villager.status, 201);
    assert.equal(villager.body.user.status, 'active'); // added by staff = already checked
    assert.equal((await admin.patch(`/api/admin/users/${villager.body.user.id}`).send({ role: 'admin' })).status, 403);
  });

  it('admins cannot touch another admin or a super admin', async () => {
    const other = await makeUser({ role: 'admin' });
    const sup = await makeUser({ role: 'superadmin' });
    for (const target of [other, sup]) {
      assert.equal((await admin.patch(`/api/admin/users/${target._id}`).send({ active: false })).status, 403);
      assert.equal((await admin.post(`/api/admin/users/${target._id}/reset-password`)).status, 403);
    }
  });

  it('an admin verifies a villager; rejecting needs a reason the villager can read', async () => {
    const { User } = await import('../src/models/index.js');
    const pending = await User.findOne({ phone: '9876511111' });
    assert.equal((await admin.post(`/api/admin/users/${pending._id}/verify`).send({ decision: 'approve' })).status, 200);
    assert.equal((await User.findById(pending._id)).status, 'active');

    const r = await client(ctx.app).post('/api/auth/register').send(villagerForm({ name: 'Unknown', phone: '9876555555' }));
    const id = r.body.user.id;
    assert.equal((await admin.post(`/api/admin/users/${id}/verify`).send({ decision: 'reject' })).status, 400);
    assert.equal((await admin.post(`/api/admin/users/${id}/verify`).send({ decision: 'reject', reason: 'Not from Ainwan' })).status, 200);
    const back = client(ctx.app);
    await back.raw.post('/api/auth/login').set('X-Requested-By', 'ainwan-web').send({ login: '9876555555', password: 'neem ka ped' });
    const me = await back.get('/api/auth/me');
    assert.equal(me.body.user.status, 'rejected');
    assert.equal(me.body.user.rejectReason, 'Not from Ainwan');
  });

  it('a super admin promotes a villager, but can never demote or switch off themselves', async () => {
    const { c: b1, user: u1 } = await loggedIn(ctx.app, { role: 'superadmin' });
    const v = await makeUser({ role: 'villager', email: undefined, phone: '9000000003' });
    const promoted = await b1.patch(`/api/admin/users/${v._id}`).send({ role: 'admin' });
    assert.equal(promoted.status, 200);
    assert.equal(promoted.body.user.role, 'admin');
    assert.equal((await b1.patch(`/api/admin/users/${u1._id}`).send({ role: 'admin' })).status, 400);
    assert.equal((await b1.patch(`/api/admin/users/${u1._id}`).send({ active: false })).status, 400);
    // super admins may manage each other (there can be more than one Mukhiya-level account)
    const other = await makeUser({ role: 'superadmin' });
    assert.equal((await b1.post(`/api/admin/users/${other._id}/reset-password`)).status, 200);
  });

  it('a role change ends the old session at once', async () => {
    const target = await makeUser({ role: 'admin' });
    const tc = client(ctx.app);
    await tc.login(target.email);
    assert.equal((await tc.get('/api/admin/dashboard')).status, 200);
    await boss.patch(`/api/admin/users/${target._id}`).send({ role: 'villager' });
    assert.equal((await tc.get('/api/admin/dashboard')).status, 401);
  });

  it('an admin resets a villager password; the villager must choose a new one', async () => {
    const v = await makeUser({ role: 'villager', email: undefined, phone: '9000000004' });
    const res = await admin.post(`/api/admin/users/${v._id}/reset-password`);
    assert.equal(res.status, 200);
    const vc = client(ctx.app);
    assert.equal((await vc.login('9000000004', res.body.tempPassword)).status, 200);
    assert.equal((await vc.get('/api/me/submissions')).status, 403); // PASSWORD_CHANGE_REQUIRED
    void adminUser;
  });
});

describe('what a verified villager can do', () => {
  let boss;
  let v;
  let entryId;
  before(async () => {
    boss = (await loggedIn(ctx.app, { role: 'superadmin' })).c;
    const listing = await boss.post('/api/admin/resources/directory').send({ name: 'Mohan Mistri', category: 'mason', phone: '9811122233', consent: true });
    entryId = listing.body._id;
  });

  it('a pending villager is told to wait before members-only things', async () => {
    const r = client(ctx.app);
    await r.post('/api/auth/register').send(villagerForm({ name: 'Waiting', phone: '9876566666' }));
    const reveal = await r.get(`/api/me/reveal/${entryId}`);
    assert.equal(reveal.status, 403);
    assert.equal(reveal.body.error, 'NOT_VERIFIED');
    assert.equal((await r.post('/api/me/submit/message').send({ kind: 'suggestion', message: 'Fix the road please' })).status, 403);
  });

  it('sees directory numbers one at a time, logged, and limited per day', async () => {
    ({ c: v } = await loggedIn(ctx.app, { role: 'villager', email: undefined, phone: '9000000010', status: 'active' }));
    const res = await v.get(`/api/me/reveal/${entryId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.phone, '9811122233');
    const trail = (await boss.get('/api/admin/audit')).body.items;
    assert.ok(trail.some((i) => i.action === 'phone_reveal' && i.summary === 'Mohan Mistri'));

    const { User } = await import('../src/models/index.js');
    await User.updateOne({ phone: '9000000010' }, { $set: { revealDay: new Date().toISOString().slice(0, 10), revealCount: 25 } });
    assert.equal((await v.get(`/api/me/reveal/${entryId}`)).status, 429);
  });

  it('sends a story with a recording: it waits for approval and shows in "my submissions"', async () => {
    const wav = (await import('./helpers.js')).sample.wav;
    const up = await v.raw.post('/api/me/upload/audio').set('X-Requested-By', 'ainwan-web').attach('file', wav, 'story.wav');
    assert.equal(up.status, 201, JSON.stringify(up.body));
    assert.equal((await v.raw.post('/api/me/upload/pdf').set('X-Requested-By', 'ainwan-web').attach('file', Buffer.from('%PDF-1.4\n'), 'x.pdf')).status, 404);

    const sent = await v.post('/api/me/submit/story').send(story(up.body.url));
    assert.equal(sent.status, 201, JSON.stringify(sent.body));
    assert.equal(sent.body.status, 'pending');
    assert.equal((await supertest(ctx.app).get('/api/public/content/oral-history')).body.total, 0);

    const mine = (await v.get('/api/me/submissions')).body.items;
    assert.equal(mine[0].resource, 'oral-history');
    assert.equal(mine[0].status, 'pending');

    const queue = (await boss.get('/api/admin/resources/oral-history?status=pending')).body.items;
    assert.equal(queue[0].source, 'public');
    assert.equal((await v.post('/api/me/submit/story').send({ ...story(up.body.url), consent: false })).status, 400);
  });

  it('suggestions and grievances reach the inbox with who sent them', async () => {
    assert.equal((await v.post('/api/me/submit/message').send({ kind: 'grievance', message: 'Hand pump in Purab tola is broken' })).status, 201);
    const inbox = (await boss.get('/api/admin/messages')).body.items;
    assert.ok(inbox.some((m) => m.type === 'grievance' && m.phone === '9000000010'));
  });

  it('deleting the account removes the person and their unpublished things', async () => {
    assert.equal((await v.post('/api/me/delete').send({ password: 'wrong one' })).status, 400);
    const ok = await v.post('/api/me/delete').send({ password: PASSWORD });
    assert.equal(ok.status, 200);
    assert.equal((await v.get('/api/auth/me')).status, 401);
    assert.equal((await boss.get('/api/admin/resources/oral-history?status=pending')).body.total, 0);
    assert.equal((await client(ctx.app).login('9000000010')).status, 401);
  });
});

describe('village fund: receipts and the public account', () => {
  it('admin records, super admin approves, receipt number appears, public sees amounts but names only with consent', async () => {
    const { c: admin } = await loggedIn(ctx.app, { role: 'admin' });
    const { c: boss } = await loggedIn(ctx.app, { role: 'superadmin' });
    const rec = await admin.post('/api/admin/resources/donations').send({
      donorName: 'Ajay Kumar', showName: false, donorPhone: '9000000020', amount: 5100, date: '2026-11-02', mode: 'upi', reference: 'UTR123',
    });
    assert.equal(rec.status, 201, JSON.stringify(rec.body));
    assert.equal(rec.body.status, 'pending');
    assert.equal(rec.body.receiptNo, undefined);

    const approved = await boss.post(`/api/admin/resources/donations/${rec.body._id}/status`).send({ status: 'published' });
    assert.match(approved.body.receiptNo, /^AIN\/2026-27\/0001$/);
    const key = approved.body.receiptKey;

    const hisab = (await supertest(ctx.app).get('/api/public/hisab')).body;
    assert.equal(hisab.totals.received, 5100);
    assert.equal(hisab.donations[0].name, null); // no consent: no name
    assert.equal(JSON.stringify(hisab).includes('UTR123'), false);
    assert.equal(JSON.stringify(hisab).includes('9000000020'), false);
    assert.equal((await supertest(ctx.app).get('/api/public/content/donations')).status, 404);

    assert.equal((await supertest(ctx.app).get(`/api/public/receipt/${rec.body._id}?k=wrong`)).status, 404);
    const receipt = await supertest(ctx.app).get(`/api/public/receipt/${rec.body._id}?k=${key}`);
    assert.equal(receipt.status, 200);
    assert.equal(receipt.body.donorName, 'Ajay Kumar');

    const { c: donor } = await loggedIn(ctx.app, { role: 'villager', email: undefined, phone: '9000000020', status: 'active' });
    const mine = (await donor.get('/api/me/receipts')).body.items;
    assert.equal(mine.length, 1);
    assert.equal(mine[0].receiptNo, 'AIN/2026-27/0001');
  });
});

describe('settings and pages for the new home page', () => {
  it('accepts the Google My Maps embed code, keeps only the link, refuses other sites', async () => {
    const { c } = await loggedIn(ctx.app, { role: 'superadmin' });
    const code = '<iframe src="https://www.google.com/maps/d/embed?mid=1AbCdEf&amp;ehbc=2E312F" width="640" height="480"></iframe>';
    const ok = await c.put('/api/admin/settings').send({ mapEmbed: code, pinCode: '804408' });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.mapEmbed, 'https://www.google.com/maps/d/embed?mid=1AbCdEf&ehbc=2E312F');
    assert.equal((await c.put('/api/admin/settings').send({ mapEmbed: 'https://evil.example.com/maps/d/embed?mid=1' })).status, 400);
    assert.equal((await c.put('/api/admin/settings').send({ pinCode: '12' })).status, 400);
  });

  it('English pages live under /en with the right language and links to both versions', async () => {
    const { pageMeta, renderIndex } = await import('../src/lib/seo.js');
    const { loadConfig } = await import('../src/config.js');
    const config = loadConfig({ NODE_ENV: 'test', PUBLIC_URL: 'https://ainwan.example.in', UPLOAD_DIR: ctx.uploadDir });
    const meta = await pageMeta('/en/vikas', config);
    const html = renderIndex('<html lang="hi"><head><title>x</title><!--OG--></head></html>', meta);
    assert.match(html, /<html lang="en"/);
    assert.match(html, /<title>Development works and accounts · Ainwan<\/title>/);
    assert.match(html, /hreflang="hi" href="https:\/\/ainwan.example.in\/vikas"/);
    assert.match(html, /hreflang="en" href="https:\/\/ainwan.example.in\/en\/vikas"/);
    assert.match(html, /property="og:locale" content="en_IN"/);
    const hi = await pageMeta('/account', config);
    assert.match(hi.tags, /name="robots" content="noindex"/);
  });
});

describe('upgrading an existing site', () => {
  it('turns old "editor" accounts into admins', async () => {
    const { migrate } = await import('../src/lib/migrate.js');
    const users = mongoose.connection.db.collection('users');
    await users.insertOne({ name: 'Old Editor', email: 'old@example.org', role: 'editor', passwordHash: 'x', tokenVersion: 0 });
    await migrate(mongoose.connection);
    const doc = await users.findOne({ email: 'old@example.org' });
    assert.equal(doc.role, 'admin');
    assert.equal(doc.status, 'active');
  });
});
