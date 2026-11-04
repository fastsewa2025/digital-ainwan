import { Link as RouterLink, NavLink as RouterNavLink, useLocation, useNavigate } from 'react-router';

/**
 * Hindi pages live at "/...", English pages at "/en/...". These wrappers add the "/en" for
 * English readers, so the rest of the site can always link to the Hindi path.
 */
const NOT_LOCALISED = /^\/(?:admin|api|uploads|receipt)(?:\/|$)/;

export const isEnglishPath = (pathname) => pathname === '/en' || pathname.startsWith('/en/');
export const stripLang = (pathname) => (isEnglishPath(pathname) ? pathname.slice(3) || '/' : pathname);

export function localise(to, lang) {
  if (lang !== 'en' || typeof to !== 'string' || !to.startsWith('/') || NOT_LOCALISED.test(to) || isEnglishPath(to)) return to;
  return to === '/' ? '/en' : `/en${to}`;
}

/** The current language, read from the address (public pages) */
export function usePathLang() {
  return isEnglishPath(useLocation().pathname) ? 'en' : 'hi';
}

export function useLp() {
  const lang = usePathLang();
  return (to) => localise(to, lang);
}

export function Link({ to, ...rest }) {
  const lp = useLp();
  return <RouterLink to={lp(to)} {...rest} />;
}

export function NavLink({ to, ...rest }) {
  const lp = useLp();
  return <RouterNavLink to={lp(to)} {...rest} />;
}

export function useLangNavigate() {
  const navigate = useNavigate();
  const lp = useLp();
  return (to, opts) => navigate(typeof to === 'string' ? lp(to) : to, opts);
}
