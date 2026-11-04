import mongoose from 'mongoose';
import './models/index.js'; // registers every model
import { migrate } from './lib/migrate.js';

export async function connectDb(uri, log) {
  mongoose.set('strictQuery', true);
  mongoose.connection.on('disconnected', () => log?.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => log?.info('MongoDB reconnected'));
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, maxPoolSize: 10 });
  await migrate(mongoose.connection, log);
  // Make sure indexes exist (unique email/phone, TTLs, ...) before taking traffic.
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  return mongoose.connection;
}

export const disconnectDb = () => mongoose.disconnect();
export const dbReady = () => mongoose.connection.readyState === 1;
