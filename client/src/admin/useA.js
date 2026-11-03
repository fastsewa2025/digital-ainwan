import { useI18n } from '../lib/i18n.jsx';
import { ASTRINGS } from './adminStrings.js';
import { translateError } from './adminErrors.js';

/**
 * Words for the admin area. Kept apart from the public site's dictionary so visitors never
 * download them. `pick` chooses between the [english, hindi] pairs the server sends for field names.
 */
export function useA() {
  const i18n = useI18n();
  const { lang } = i18n;
  const other = lang === 'hi' ? 'en' : 'hi';
  const a = (key, vars) => {
    let s = ASTRINGS[lang][key] ?? ASTRINGS[other][key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
  const pick = (pair) => (Array.isArray(pair) ? (lang === 'hi' ? pair[1] || pair[0] : pair[0]) : (pair ?? ''));
  // Moments in time (not calendar dates) are shown in the admin's own time zone.
  const dt = (d) => (d ? new Intl.DateTimeFormat(i18n.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d)) : '');
  // Server messages are English; in the Hindi screen they are translated (see adminErrors.js).
  const err = (message) => translateError(message, lang);
  return { ...i18n, a, pick, dt, err };
}
