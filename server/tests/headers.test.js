import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { loadConfig } from '../src/config.js';
import { createApp } from '../src/app.js';

const SECRET = 'a'.repeat(40);
const headersFor = async (env) => {
  const config = loadConfig({ NODE_ENV: 'production', JWT_SECRET: SECRET, LOG_LEVEL: 'silent', ...env });
  const res = await supertest(createApp(config)).get('/robots.txt');
  return res.headers;
};

describe('security headers', () => {
  it('on a real https site: upgrades insecure requests and turns on HSTS for this host only', async () => {
    const h = await headersFor({ PUBLIC_URL: 'https://ainwan.example.in' });
    assert.match(h['content-security-policy'], /upgrade-insecure-requests/);
    assert.match(h['strict-transport-security'], /max-age=\d+/);
    assert.doesNotMatch(h['strict-transport-security'], /includeSubDomains/i);
  });

  it('in the plain-http trial run: does not push browsers to https (the page would break)', async () => {
    const h = await headersFor({ PUBLIC_URL: 'http://203.0.113.7', COOKIE_SECURE: 'false' });
    assert.doesNotMatch(h['content-security-policy'], /upgrade-insecure-requests/);
    assert.equal(h['strict-transport-security'], undefined);
  });

  it('always blocks scripts from other sites and framing of the website', async () => {
    const h = await headersFor({ PUBLIC_URL: 'https://ainwan.example.in' });
    assert.match(h['content-security-policy'], /script-src 'self'/);
    assert.match(h['content-security-policy'], /frame-ancestors 'none'/);
    assert.equal(h['x-content-type-options'], 'nosniff');
  });
});
