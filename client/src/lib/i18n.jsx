import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { STRINGS } from './strings.js';
import { isEnglishPath, localise, stripLang } from './nav.jsx';

const I18nContext = createContext(null);
const KEY = 'ainwan-lang';

const savedLang = () => {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'hi' || saved === 'en') return saved;
  } catch {
    /* private mode */
  }
  return null;
};
const saveLang = (lang) => {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* ignore */
  }
};

/**
 * Public pages: the language is part of the address ("/en/..." = English), so every page has a
 * Hindi and an English URL that can be shared and found by Google. Hindi is the default.
 * The admin area has no "/en" URLs; there the last choice (saved in this browser) is used.
 */
export function I18nProvider({ children }) {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const admin = pathname.startsWith('/admin');
  const lang = admin ? (savedLang() ?? 'hi') : isEnglishPath(pathname) ? 'en' : 'hi';

  // Someone who chose English before and opens a Hindi link gets the English page (once, on arrival).
  const arrived = useRef(false);
  useEffect(() => {
    if (arrived.current) return;
    arrived.current = true;
    if (!admin && lang === 'hi' && savedLang() === 'en' && !pathname.startsWith('/receipt')) {
      navigate(`${localise(pathname, 'en')}${search}${hash}`, { replace: true });
    }
  }, [admin, lang, pathname, search, hash, navigate]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback(
    (next) => {
      saveLang(next);
      if (admin) {
        navigate(`${pathname}${search}`, { replace: true }); // re-render with the new choice
        return;
      }
      const base = stripLang(pathname);
      navigate(`${localise(base, next)}${search}${hash}`);
    },
    [admin, pathname, search, hash, navigate],
  );

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
