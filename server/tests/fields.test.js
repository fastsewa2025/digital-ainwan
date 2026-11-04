import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { f, buildZod, zodFor } from '../src/lib/fields.js';
import { RESOURCES } from '../src/resources.js';
import { loadConfig } from '../src/config.js';
import { passwordProblem } from '../src/middleware/auth.js';

const ok = (schema, v) => schema.safeParse(v);

describe('field validation', () => {
  it('turns any YouTube link into a privacy-friendly embed URL', () => {
    const s = zodFor(f.embed('v'));
    for (const url of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ', 'youtube.com/embed/dQw4w9WgXcQ']) {
      assert.equal(ok(s, url).data, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    }
  });

  it('rejects links that are not YouTube', () => {
    const s = zodFor(f.embed('v'));
    assert.equal(ok(s, 'https://evil.example/video').success, false);
    assert.equal(ok(s, 'javascript:alert(1)').success, false);
  });

  it('only accepts files that we stored ourselves (no outside URLs, no path tricks)', () => {
    const img = zodFor(f.image('i'));
    const good = { url: `/uploads/images/${'a'.repeat(24)}.webp`, thumb: `/uploads/images/${'a'.repeat(24)}_t.webp` };
    assert.equal(ok(img, good).success, true);
    assert.equal(ok(img, { ...good, url: 'https://evil.example/x.webp' }).success, false);
    assert.equal(ok(img, { ...good, url: '/uploads/images/../../etc/passwd' }).success, false);
    assert.equal(ok(zodFor(f.pdf('p')), '/uploads/docs/zzzz.pdf').success, false);
    assert.equal(ok(zodFor(f.audio('a')), `/uploads/audio/${'b'.repeat(24)}.mp3`).success, true);
  });

  it('needs at least one language in a required bilingual field', () => {
    const s = zodFor(f.i18n('t', { required: true }));
    assert.equal(ok(s, { hi: '', en: '' }).success, false);
    assert.equal(ok(s, { hi: 'नमस्ते' }).success, true);
    assert.equal(ok(s, { en: 'Hello' }).success, true);
  });

  it('treats blank optional values as "not set", and rejects junk numbers', () => {
    assert.equal(ok(zodFor(f.number('n', { min: 0 })), '').success, true);
    assert.equal(ok(zodFor(f.number('n', { min: 0 })), 'abc').success, false);
    assert.equal(ok(zodFor(f.number('n', { min: 0 })), -5).success, false);
    assert.equal(ok(zodFor(f.phone('p')), '12ab').success, false);
    assert.equal(ok(zodFor(f.phone('p')), '+91 98765-43210').data, '+919876543210');
  });

  it('does not reset untouched fields on a partial update', () => {
    const partial = buildZod(RESOURCES.projects.fields).partial();
    const out = partial.parse({ phase: 'completed' });
    assert.deepEqual(Object.keys(out), ['phase']);
  });

  it('requires consent where people are shown', () => {
    const dir = buildZod(RESOURCES.directory.fields);
    const base = { name: 'A', category: 'tailor', phone: '9876543210' };
    assert.equal(dir.safeParse({ ...base, consent: false }).success, false);
    assert.equal(dir.safeParse({ ...base, consent: true }).success, true);
  });

  it('keeps project numbers consistent', () => {
    const { validate, derive } = RESOURCES.projects;
    assert.equal(validate({ phase: 'in-progress' }).length, 1);
    assert.equal(validate({ phase: 'in-progress', progress: 30 }).length, 0);
    assert.equal(validate({ phase: 'planned', startDate: '2026-05-01', expectedEnd: '2026-04-01' }).length, 1);
    assert.equal(derive({ phase: 'completed', progress: 10 }).progress, 100);
    assert.equal(derive({ phase: 'planned', progress: 50 }).progress, 0);
  });

  it('requires a topper\'s consent before their name or photo goes public', () => {
    assert.equal(RESOURCES.youth.validate({ kind: 'topper', consent: false }).length, 1);
    assert.equal(RESOURCES.youth.validate({ kind: 'topper', consent: true }).length, 0);
    assert.equal(RESOURCES.youth.validate({ kind: 'scholarship' }).length, 0);
  });
});

describe('configuration', () => {
  const prod = { NODE_ENV: 'production', PUBLIC_URL: 'https://ainwan.example' };
  it('refuses to start in production without a real secret', () => {
    assert.throws(() => loadConfig(prod), /JWT_SECRET is required/);
    assert.throws(() => loadConfig({ ...prod, JWT_SECRET: 'short' }), /at least 32/);
    assert.throws(() => loadConfig({ ...prod, JWT_SECRET: 'change-me-change-me-change-me-change-me' }), /placeholder/);
    assert.equal(loadConfig({ ...prod, JWT_SECRET: 'x'.repeat(48) }).cookieSecure, true);
  });
  it('treats empty variables (what docker compose passes for unset ones) as not set', () => {
    const cfg = loadConfig({ ...prod, JWT_SECRET: 'x'.repeat(48), COOKIE_SECURE: '', LOG_LEVEL: '', PORT: '', TRUST_PROXY: '' });
    assert.equal(cfg.cookieSecure, true);
    assert.equal(cfg.port, 5000);
    assert.throws(() => loadConfig({ ...prod, JWT_SECRET: '' }), /JWT_SECRET is required/);
  });
  it('refuses secure cookies on a plain-http address', () => {
    assert.throws(() => loadConfig({ ...prod, PUBLIC_URL: 'http://1.2.3.4', JWT_SECRET: 'x'.repeat(48) }), /https/);
    assert.equal(loadConfig({ ...prod, PUBLIC_URL: 'http://1.2.3.4', JWT_SECRET: 'x'.repeat(48), COOKIE_SECURE: 'false' }).cookieSecure, false);
  });
});

describe('password rule', () => {
  it('asks for length, not symbols', () => {
    assert.match(passwordProblem('short'), /10/);
    assert.match(passwordProblem('password123'), /common/);
    assert.match(passwordProblem('mukhiya-is-great', { email: 'mukhiya@example.org' }), /e-mail/);
    assert.equal(passwordProblem('green fields of ainwan'), null);
  });

  it('is gentler for villagers (8 characters) but still refuses easy guesses', () => {
    assert.equal(passwordProblem('mangotree', { role: 'villager' }), null);
    assert.match(passwordProblem('mango12', { role: 'villager' }), /8/);
    assert.match(passwordProblem('mangotree', { role: 'admin' }), /10/); // staff need 10
    assert.match(passwordProblem('12345678', { role: 'villager' }), /common/);
    assert.match(passwordProblem('20261104', { role: 'villager' }), /only numbers/);
    assert.match(passwordProblem('me9876543210', { role: 'villager', phone: '9876543210' }), /mobile/);
  });
});
