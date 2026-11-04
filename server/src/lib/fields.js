/**
 * Field kit: one description of a field drives
 *   1. the MongoDB schema,
 *   2. the request validation (zod),
 *   3. the admin form (the descriptors are sent to the admin UI as JSON).
 * Labels are [english, hindi] pairs.
 */
import mongoose from 'mongoose';
import { z } from 'zod';

const { Schema } = mongoose;

/* ----------------------------- descriptors ----------------------------- */

export const f = {
  i18n: (label, o = {}) => ({ kind: 'i18n', label, max: 200, ...o }),
  i18nLong: (label, o = {}) => ({ kind: 'i18nLong', label, max: 20000, ...o }),
  text: (label, o = {}) => ({ kind: 'text', label, max: 200, ...o }),
  number: (label, o = {}) => ({ kind: 'number', label, ...o }),
  date: (label, o = {}) => ({ kind: 'date', label, ...o }),
  bool: (label, o = {}) => ({ kind: 'bool', label, ...o }),
  select: (label, options, o = {}) => ({
    kind: 'select',
    label,
    options: options.map(([value, en, hi]) => ({ value, label: [en, hi] })),
    ...o,
  }),
  url: (label, o = {}) => ({ kind: 'url', label, max: 500, ...o }),
  embed: (label, o = {}) => ({ kind: 'embed', label, ...o }),
  phone: (label, o = {}) => ({ kind: 'phone', label, ...o }),
  image: (label, o = {}) => ({ kind: 'image', label, ...o }),
  gallery: (label, o = {}) => ({ kind: 'gallery', label, max: 60, ...o }),
  audio: (label, o = {}) => ({ kind: 'audio', label, ...o }),
  pdf: (label, o = {}) => ({ kind: 'pdf', label, ...o }),
  latlng: (label, o = {}) => ({ kind: 'latlng', label, ...o }),
  list: (label, item, o = {}) => ({ kind: 'list', label, item, max: 100, ...o }),
};

/* ------------------------------ patterns ------------------------------- */

// Uploaded files always live under /uploads with a random hex name that WE generate.
export const IMG_RE = /^\/uploads\/images\/[a-f0-9]{24}(?:_t)?\.webp$/;
export const AUDIO_RE = /^\/uploads\/audio\/[a-f0-9]{24}\.(?:mp3|m4a|ogg|wav|aac|webm)$/;
export const PDF_RE = /^\/uploads\/docs\/[a-f0-9]{24}\.pdf$/;
const PHONE_RE = /^\+?[0-9][0-9 -]{6,15}$/;
const YT_RE =
  /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/)|youtu\.be\/|youtube-nocookie\.com\/embed\/)([A-Za-z0-9_-]{11})(?:[?&#].*)?$/;

const isHttpUrl = (s) => {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

/* ------------------------------ mongoose ------------------------------- */

const i18nMongoose = {
  hi: { type: String, trim: true },
  en: { type: String, trim: true },
};
const imageMongoose = { url: String, thumb: String, width: Number, height: Number };

export function mongooseType(desc) {
  switch (desc.kind) {
    case 'i18n':
    case 'i18nLong':
      return i18nMongoose;
    case 'number':
      return Number;
    case 'date':
      return Date;
    case 'bool':
      return { type: Boolean, default: desc.default ?? false };
    case 'select':
      return { type: String, enum: desc.options.map((o) => o.value), default: desc.default };
    case 'image':
      return imageMongoose;
    case 'gallery':
      return [new Schema({ ...imageMongoose, caption: i18nMongoose }, { _id: false })];
    case 'latlng':
      return { lat: Number, lng: Number };
    case 'list':
      return [new Schema(mongooseShape(desc.item), { _id: false })];
    default:
      return String; // text, url, embed, phone, audio, pdf
  }
}

export const mongooseShape = (fields) =>
  Object.fromEntries(Object.entries(fields).map(([key, desc]) => [key, mongooseType(desc)]));

/* -------------------------------- zod ---------------------------------- */

const blank = (v) => (v === '' || v === null || v === undefined ? undefined : v);
const optional = (schema) => z.preprocess(blank, schema.optional());

const i18nShape = (max) =>
  z.object({
    hi: z.string().trim().max(max, `Maximum ${max} characters`).default(''),
    en: z.string().trim().max(max, `Maximum ${max} characters`).default(''),
  });

const imageShape = z.object({
  url: z.string().regex(IMG_RE, 'Invalid image'),
  thumb: z.string().regex(IMG_RE, 'Invalid image'),
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
});

/**
 * NOTE: no `.default()` on top-level fields on purpose. Zod 4 applies defaults inside
 * optional wrappers, which would silently reset fields on partial updates.
 */
export function zodFor(desc) {
  const req = Boolean(desc.required);
  switch (desc.kind) {
    case 'i18n':
    case 'i18nLong': {
      const shape = i18nShape(desc.max);
      if (req) return shape.refine((v) => v.hi || v.en, { message: 'Enter at least one language (Hindi or English)' });
      return z.preprocess((v) => v ?? {}, shape);
    }
    case 'text': {
      let s = z.string().trim().max(desc.max, `Maximum ${desc.max} characters`);
      if (req) s = s.min(1, 'Required');
      return req ? s : optional(s);
    }
    case 'number': {
      let n = z.coerce.number({ error: 'Enter a valid number' });
      if (desc.min != null) n = n.min(desc.min, `Minimum ${desc.min}`);
      if (desc.max != null) n = n.max(desc.max, `Maximum ${desc.max}`);
      if (desc.int) n = n.int('Enter a whole number');
      return req ? z.preprocess(blank, n) : optional(n);
    }
    case 'date': {
      const dt = z.coerce
        .date({ error: 'Enter a valid date' })
        .refine((x) => x.getUTCFullYear() >= 1800 && x.getUTCFullYear() <= 2200, 'Date out of range');
      return req ? z.preprocess(blank, dt) : optional(dt);
    }
    case 'bool':
      return desc.mustBeTrue
        ? z.literal(true, { error: 'This confirmation is required' })
        : z.boolean().optional();
    case 'select': {
      const e = z.enum(desc.options.map((o) => o.value), { error: 'Choose one of the options' });
      return req ? e : optional(e);
    }
    case 'url': {
      const u = z.string().trim().max(desc.max).refine(isHttpUrl, 'Enter a full link starting with https://');
      return req ? u : optional(u);
    }
    case 'embed': {
      const e = z
        .string()
        .trim()
        .refine((s) => YT_RE.test(s), 'Only YouTube links are supported')
        .transform((s) => `https://www.youtube-nocookie.com/embed/${s.match(YT_RE)[1]}`);
      return req ? e : optional(e);
    }
    case 'phone': {
      const p = z
        .string()
        .trim()
        .regex(PHONE_RE, 'Enter a valid phone number')
        .transform((s) => s.replace(/[ -]/g, ''));
      return req ? p : optional(p);
    }
    case 'image':
      return req ? imageShape : optional(imageShape);
    case 'gallery': {
      let g = z.array(imageShape.extend({ caption: i18nShape(200).optional() })).max(desc.max, `At most ${desc.max} photos`);
      if (req) g = g.min(1, 'Add at least one photo');
      return req ? g : z.preprocess((v) => v ?? undefined, g.optional());
    }
    case 'audio': {
      const a = z.string().regex(AUDIO_RE, 'Invalid audio file');
      return req ? a : optional(a);
    }
    case 'pdf': {
      const p = z.string().regex(PDF_RE, 'Invalid PDF file');
      return req ? p : optional(p);
    }
    case 'latlng': {
      const ll = z.object({
        lat: z.coerce.number().min(-90).max(90),
        lng: z.coerce.number().min(-180).max(180),
      });
      return req ? ll : optional(ll);
    }
    case 'list': {
      const arr = z.array(buildZod(desc.item)).max(desc.max, `At most ${desc.max} entries`);
      return z.preprocess((v) => v ?? undefined, arr.optional());
    }
    default:
      throw new Error(`Unknown field kind: ${desc.kind}`);
  }
}

export const buildZod = (fields) =>
  z.object(Object.fromEntries(Object.entries(fields).map(([key, desc]) => [key, zodFor(desc)])));

/** Turns zod issues into [{path, message}] for the API. */
export const issuesOf = (zodError) =>
  zodError.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));

/** Names of fields to leave out of list responses / public responses. */
export const namesWhere = (fields, pred) =>
  Object.entries(fields)
    .filter(([, d]) => pred(d))
    .map(([k]) => k);
