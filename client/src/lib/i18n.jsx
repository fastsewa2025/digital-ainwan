import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { STRINGS } from './strings.js';

const I18nContext = createContext(null);
const KEY = 'ainwan-lang';

const readLang = () => {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'hi' || saved === 'en') return saved;
  } catch {
    /* private mode: fall through */
  }
  return 'hi'; // the village reads Hindi first
};

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(readLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next) => {
    setLangState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => {
    const other = lang === 'hi' ? 'en' : 'hi';
    const dict = STRINGS[lang];
    const t = (key, vars) => {
      let s = dict[key] ?? STRINGS[other][key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
      return s;
    };
    /** Picks the text for the current language from a {hi, en} value, falling back to the other one. */
    const L = (v) => (typeof v === 'string' ? v : v?.[lang] || v?.[other] || '');
    const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
    // Dates are stored at UTC midnight, so they are always shown in UTC to avoid off-by-one days.
    const fmtDate = (d, opts = { day: 'numeric', month: 'long', year: 'numeric' }) =>
      d ? new Intl.DateTimeFormat(locale, { ...opts, timeZone: 'UTC' }).format(new Date(d)) : '';
    const fmtINR = (n) =>
      new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n ?? 0);
    const fmtNum = (n) => new Intl.NumberFormat('en-IN').format(n ?? 0);
    return { lang, setLang, t, L, fmtDate, fmtINR, fmtNum, locale };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
