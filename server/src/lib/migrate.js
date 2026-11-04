/**
 * Small, idempotent data fixes that run at every start-up, before the indexes are built.
 * Each step is safe to run again and again.
 */
export async function migrate(conn, log) {
  const users = conn.db.collection('users');

  // v2: "editor" became "admin" when villagers got their own accounts.
  const renamed = await users.updateMany({ role: 'editor' }, { $set: { role: 'admin' } });
  if (renamed.modifiedCount) log?.info(`migrated ${renamed.modifiedCount} editor account(s) to admin`);

  // v2: e-mail became optional (villagers sign in with a mobile number). The old unique index
  // treated "no e-mail" as a value, so it must be rebuilt as a sparse one.
  try {
    const old = (await users.indexes()).find((i) => i.name === 'email_1');
    if (old && !old.sparse) {
      await users.dropIndex('email_1');
      log?.info('rebuilt the e-mail index for optional e-mails');
    }
  } catch (err) {
    if (err?.code !== 26 && err?.codeName !== 'NamespaceNotFound') throw err; // 26: no users yet
  }

  // v2: project cards show the first "before" and "now" photo; fill them in for older projects.
  const projects = conn.db.collection('projects');
  const cover = (p) => (p ? { url: p.url, thumb: p.thumb, width: p.width, height: p.height } : undefined);
  for await (const p of projects.find({ beforeCover: { $exists: false } }, { projection: { beforePhotos: 1, afterPhotos: 1, photos: 1 } })) {
    const $set = { beforeCover: cover(p.beforePhotos?.[0]) ?? null, afterCover: cover(p.afterPhotos?.[0] ?? p.photos?.[0]) ?? null };
    await projects.updateOne({ _id: p._id }, { $set });
  }

  // Accounts from v1 are all staff, so they are verified.
  await users.updateMany({ status: { $exists: false } }, { $set: { status: 'active' } });
}
