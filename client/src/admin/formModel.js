/**
 * Moves content between the shape the server stores and the shape the form edits.
 * Form values are always plain strings / booleans / small objects, so every input can be a controlled one.
 */

export function emptyValue(desc) {
  switch (desc.kind) {
    case 'i18n':
    case 'i18nLong':
      return { hi: '', en: '' };
    case 'bool':
      return false;
    case 'select':
      return desc.default ?? '';
    case 'image':
    case 'latlng':
      return null;
    case 'gallery':
    case 'list':
      return [];
    default:
      return ''; // text, url, embed, phone, number, date, audio, pdf
  }
}

export const emptyForm = (fields) => Object.fromEntries(Object.entries(fields).map(([k, d]) => [k, emptyValue(d)]));

const image = (p) => ({ url: p.url, thumb: p.thumb, width: p.width, height: p.height });

function fromValue(desc, v) {
  if (v == null) return emptyValue(desc);
  switch (desc.kind) {
    case 'i18n':
    case 'i18nLong':
      return { hi: v.hi ?? '', en: v.en ?? '' };
    case 'date':
      return String(v).slice(0, 10);
    case 'number':
      return String(v);
    case 'image':
      return image(v);
    case 'gallery':
      return v.map((p) => ({ ...image(p), caption: { hi: p.caption?.hi ?? '', en: p.caption?.en ?? '' } }));
    case 'latlng':
      return { lat: String(v.lat), lng: String(v.lng) };
    case 'list':
      return v.map((item) => formFromDoc(desc.item, item));
    default:
      return v;
  }
}

export const formFromDoc = (fields, doc) => Object.fromEntries(Object.entries(fields).map(([k, d]) => [k, fromValue(d, doc?.[k])]));

function toValue(desc, v) {
  switch (desc.kind) {
    case 'text':
    case 'url':
    case 'embed':
    case 'phone':
    case 'number':
      return typeof v === 'string' ? v.trim() : v;
    case 'latlng':
      return v && (v.lat !== '' || v.lng !== '') ? v : null;
    case 'list':
      return v.map((item) => toPayload(desc.item, item));
    default:
      return v;
  }
}

/** Every field is sent on every save; an empty value tells the server to clear it. */
export const toPayload = (fields, values) => Object.fromEntries(Object.entries(fields).map(([k, d]) => [k, toValue(d, values[k])]));

/** Server messages are keyed by path, e.g. "title" or "updates.0.note". */
export function issueMap(error) {
  const out = {};
  for (const i of error?.issues ?? []) out[i.path || '_'] ??= i.message;
  return out;
}
