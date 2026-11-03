import './env.js'; // must stay first: it fills process.env before anything reads it
import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { connectDb, disconnectDb } from './db.js';

const config = loadConfig();
const app = createApp(config);
const { log } = app.locals;

try {
  await connectDb(config.mongoUri, log);
} catch (err) {
  log.fatal({ err }, 'Could not connect to MongoDB');
  process.exit(1);
}

const server = app.listen(config.port, () => {
  log.info(`Digital Ainwan is running on port ${config.port} (${config.env})`);
});
server.keepAliveTimeout = 65_000; // longer than the reverse proxy's idle timeout
server.headersTimeout = 66_000;

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  log.info(`${signal} received, shutting down`);
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  server.close(async () => {
    await disconnectDb();
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => log.error({ err }, 'unhandled promise rejection'));
