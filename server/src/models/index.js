import mongoose from 'mongoose';
import { mongooseShape, namesWhere } from '../lib/fields.js';
import { RESOURCES, SETTINGS_FIELDS } from '../resources.js';

const { Schema } = mongoose;

export const STATUSES = ['draft', 'pending', 'published', 'rejected'];

const whoSchema = new Schema({ id: Schema.Types.ObjectId, name: String }, { _id: false });

/* ---------------------------- content models ---------------------------- */

const contentModels = {};

for (const [key, def] of Object.entries(RESOURCES)) {
  const schema = new Schema(
    {
      ...mongooseShape(def.fields),
      ...mongooseShape(def.extra ?? {}),
      status: { type: String, enum: STATUSES, default: 'draft', index: true },
      rejectReason: String,
      source: { type: String, enum: ['admin', 'public'], default: 'admin' },
      createdBy: whoSchema,
      updatedBy: whoSchema,
      publishedBy: whoSchema,
      publishedAt: Date,
    },
    { timestamps: true, collection: key.replace(/-/g, '_') },
  );
  schema.index({ status: 1, createdAt: -1 });
  contentModels[key] = mongoose.models[`C_${key}`] ?? mongoose.model(`C_${key}`, schema);
}

export const modelFor = (key) => contentModels[key];

/** Field names that must not be sent to the public website. */
export const hiddenInPublic = (key) => {
  const def = RESOURCES[key];
  return [
    'rejectReason', 'source', 'createdBy', 'updatedBy', 'publishedBy', '__v',
    ...namesWhere(def.fields, (d) => d.secret),
    ...namesWhere(def.extra ?? {}, (d) => d.secret),
  ];
};
export const heavyFields = (key) => namesWhere(RESOURCES[key].fields, (d) => d.heavy);

/* -------------------------------- users --------------------------------- */

// "" and null are stored as "missing", so the sparse unique indexes below ignore them.
const orMissing = (v) => (v === '' || v == null ? undefined : v);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    // Staff usually sign in with e-mail, villagers with their mobile number. Each account has at least one.
    email: { type: String, lowercase: true, trim: true, maxlength: 160, set: orMissing },
    phone: { type: String, trim: true, maxlength: 10, set: orMissing },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['villager', 'admin', 'superadmin'], default: 'villager' },
    // Villagers register themselves and stay "pending" until an admin has checked they belong to the village.
    status: { type: String, enum: ['pending', 'active', 'rejected'], default: 'active', index: true },
    rejectReason: { type: String, trim: true, maxlength: 300 },
    verifiedBy: whoSchema,
    verifiedAt: Date,
    tola: { type: String, trim: true, maxlength: 100 },
    livesIn: { type: String, enum: ['village', 'outside'] },
    place: { type: String, trim: true, maxlength: 100 },
    revealDay: String, // phone numbers looked up today (limits scraping of the directory)
    revealCount: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    failedLogins: { type: Number, default: 0 },
    lockUntil: Date,
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: Date,
  },
  { timestamps: true },
);
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ phone: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1, createdAt: -1 });
export const User = mongoose.models.User ?? mongoose.model('User', userSchema);

/* ------------------- running numbers (receipt numbers) ------------------- */

const counterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } }, { versionKey: false });
export const Counter = mongoose.models.Counter ?? mongoose.model('Counter', counterSchema);

export async function nextNumber(key) {
  const c = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' }).lean();
  return c.seq;
}

/* ------------------------------ audit trail ------------------------------ */

// Audit entries are deleted automatically after one year (MongoDB TTL index).
// DISABLE_TTL_INDEXES exists only for test databases that are MongoDB look-alikes without TTL support.
const auditTtl = process.env.DISABLE_TTL_INDEXES === 'true' ? true : { expireAfterSeconds: 60 * 60 * 24 * 365 };

const auditSchema = new Schema({
  at: { type: Date, default: Date.now, index: auditTtl },
  userId: Schema.Types.ObjectId,
  userName: String,
  role: String,
  action: { type: String, index: true },
  resource: String,
  docId: String,
  summary: String,
  ip: String,
});
export const AuditLog = mongoose.models.AuditLog ?? mongoose.model('AuditLog', auditSchema);

/* ------------------- messages from the public (inbox) -------------------- */

const messageSchema = new Schema(
  {
    type: { type: String, enum: ['suggestion', 'grievance', 'diaspora', 'contact'], required: true, index: true },
    userId: { type: Schema.Types.ObjectId, index: true }, // set when a signed-in villager sent it
    about: { kind: String, id: String, title: String }, // e.g. the directory entry someone wants to reach
    name: { type: String, trim: true, maxlength: 100 },
    phone: { type: String, trim: true, maxlength: 20 },
    email: { type: String, trim: true, lowercase: true, maxlength: 160 },
    place: { type: String, trim: true, maxlength: 120 },
    helpType: { type: String, enum: ['idea', 'time', 'skills', 'funds', 'other'] },
    message: { type: String, required: true, trim: true, maxlength: 3000 },
    status: { type: String, enum: ['new', 'read', 'archived'], default: 'new', index: true },
  },
  { timestamps: true },
);
export const Message = mongoose.models.Message ?? mongoose.model('Message', messageSchema);

/* -------------------------- site settings (single) ----------------------- */

const settingSchema = new Schema(
  { key: { type: String, unique: true, default: 'site' }, ...mongooseShape(SETTINGS_FIELDS), updatedBy: whoSchema },
  { timestamps: true },
);
export const Setting = mongoose.models.Setting ?? mongoose.model('Setting', settingSchema);
