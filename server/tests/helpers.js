import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import supertest from 'supertest';

export const PASSWORD = 'correct-horse-battery';
const HEADER = ['X-Requested-By', 'ainwan-web'];

const TEST_DB_URI = process.env.TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27017/ainwan_test';

/** The tests delete everything in their database, so refuse any database that is not clearly a test one. */
function assertThrowAway(uri) {
  const dbName = uri.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/)?.[1] ?? '';
  if (!/test/i.test(dbName)) {
    throw new Error(
      `Refusing to run: the tests DELETE everything in their database, and "${dbName || '(no name)'}" does not look like a test database. ` +
        'Put the word "test" in the database name, for example mongodb://127.0.0.1:27017/ainwan_test',
    );
  }
}

/** Boots the real app against a throw-away database (TEST_MONGO_URI or local MongoDB). */
export async function startTestApp() {
  assertThrowAway(TEST_DB_URI);
  const uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ainwan-test-'));
  const { loadConfig } = await import('../src/config.js');
  const config = loadConfig({
    NODE_ENV: 'test',
    MONGO_URI: TEST_DB_URI,
    UPLOAD_DIR: uploadDir,
    CLIENT_DIST: path.join(uploadDir, 'no-client'),
    PUBLIC_URL: 'http://localhost:5000',
  });
  const { connectDb, disconnectDb } = await import('../src/db.js');
  await connectDb(config.mongoUri);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  const { createApp } = await import('../src/app.js');
  const app = createApp(config);
  return {
    app,
    uploadDir,
    async close() {
      await mongoose.connection.dropDatabase();
      await disconnectDb();
      await fs.rm(uploadDir, { recursive: true, force: true });
    },
  };
}

export async function makeUser(overrides = {}) {
  const { User } = await import('../src/models/index.js');
  const { hashPassword } = await import('../src/middleware/auth.js');
  return User.create({
    name: 'Test User',
    email: `user${Math.random().toString(36).slice(2, 8)}@example.org`,
    passwordHash: await hashPassword(PASSWORD),
    role: 'editor',
    ...overrides,
  });
}

/** A browser-like client that remembers the session cookie and sends the CSRF header. */
export function client(app) {
  const agent = supertest.agent(app);
  const wrap = (method) => (url) => agent[method](url).set(...HEADER);
  return {
    get: (url) => agent.get(url),
    post: wrap('post'),
    put: wrap('put'),
    patch: wrap('patch'),
    delete: wrap('delete'),
    raw: agent,
    async login(email, password = PASSWORD) {
      const res = await agent.post('/api/auth/login').set(...HEADER).send({ email, password });
      return res;
    },
  };
}

export async function loggedIn(app, overrides) {
  const user = await makeUser(overrides);
  const c = client(app);
  const res = await c.login(user.email);
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { user, c };
}

/** Smallest valid bits of each file type we accept. */
export const sample = {
  pdf: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'),
  wav: (() => {
    const data = Buffer.alloc(800);
    const h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVEfmt ', 8);
    h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
    h.writeUInt32LE(8000, 24); h.writeUInt32LE(8000, 28); h.writeUInt16LE(1, 32); h.writeUInt16LE(8, 34);
    h.write('data', 36); h.writeUInt32LE(data.length, 40);
    return Buffer.concat([h, data]);
  })(),
};
