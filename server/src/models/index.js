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
  return ['rejectReason', 'source', 'createdBy', 'updatedBy', 'publishedBy', '__v', ...namesWhere(def.fields, (d) => d.secret)];
};
export const heavyFields = (key) => namesWhere(RESOURCES[key].fields, (d) => d.heavy);

/* -------------------------------- users --------------------------------- */

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 160 },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['superadmin', 'editor'], default: 'editor' },
    active: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    failedLogins: { type: Number, default: 0 },
    lockUntil: Date,
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: Date,
  },
  { timestamps: true },
);
export const User = mongoose.models.User ?? mongoose.model('User', userSchema);

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
    type: { type: String, enum: ['suggestion', 'diaspora', 'contact'], required: true, index: true },
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
