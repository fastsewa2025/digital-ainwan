import { Setting } from '../models/index.js';
import { SETTINGS_DEFAULTS, SETTINGS_FIELDS } from '../resources.js';

const isEmpty = (kind, v) => {
  if (v == null || v === '') return true;
  if (kind === 'i18n' || kind === 'i18nLong') return !v.hi && !v.en;
  if (kind === 'latlng') return v.lat == null || v.lng == null;
  if (kind === 'gallery') return !v.length;
  return false;
};

/** Site settings with defaults filled in for anything the Mukhiya has not set yet. */
export async function getSettings() {
  const doc = await Setting.findOne({ key: 'site' }).lean();
  const out = {};
  for (const [key, desc] of Object.entries(SETTINGS_FIELDS)) {
    const v = doc?.[key];
    out[key] = isEmpty(desc.kind, v) ? (SETTINGS_DEFAULTS[key] ?? (desc.kind === 'bool' ? false : undefined)) : v;
  }
  return out;
}
