import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useSearchParams } from 'react-router';
import { Link, stripLang, useLangNavigate } from '../lib/nav.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useSettings } from '../lib/settings.jsx';
import { useSession } from '../lib/session.jsx';
import { MODULES } from './modules.js';
import { Icon, LeafHeart } from './Icons.jsx';

/** The site's mark (kept under the old name for the admin area). */
export function Leaf({ className }) {
  return <LeafHeart className={className} />;
}

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

/** On phones the bottom menu steps aside while someone is typing (the keyboard needs the room). */
function TypingWatcher() {
  useEffect(() => {
    const field = (el) => el?.matches?.('input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea, select');
    let timer;
    const on = (e) => {
      if (!field(e.target)) return;
      clearTimeout(timer);
      document.body.classList.add('typing');
    };
    // Show the menu again a moment later, so a tap on "Send" right after typing is not swallowed by it.
    const off = (e) => {
      if (!field(e.target)) return;
      clearTimeout(timer);
      timer = setTimeout(() => !field(document.activeElement) && document.body.classList.remove('typing'), 350);
    };
    document.addEventListener('focusin', on);
    document.addEventListener('focusout', off);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('focusin', on);
      document.removeEventListener('focusout', off);
      document.body.classList.remove('typing');
    };
  }, []);
  return null;
}

function OfflineBanner() {
  const { t } = useI18n();
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  if (!offline) return null;
  return (
    <p className="offline" role="status">
      {t('offline.banner')}
    </p>
  );
}

function useCurrent() {
  const path = stripLang(useLocation().pathname);
  return { path, is: (to) => path === to, under: (base) => path === base || path.startsWith(`${base}/`) };
}

function Nav() {
  const { t } = useI18n();
  const { path, is, under } = useCurrent();
  const [open, setOpen] = useState(null); // { key, path }
  const ref = useRef(null);
  const openKey = open?.path === path ? open.key : null; // closes by itself when the page changes

  useEffect(() => {
    const onPointer = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(null);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, []);

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && openKey) {
      setOpen(null);
      ref.current?.querySelector(`[data-menu="${openKey}"]`)?.focus();
    }
  };

  return (
    <nav className="nav" aria-label={t('nav.main')} ref={ref} onKeyDown={onKeyDown}>
      <div className="nav__item">
        <Link className="nav__link" to="/" aria-current={is('/') ? 'page' : undefined}>
          {t('nav.home')}
        </Link>
      </div>
      {MODULES.map((m) => (
        <div className="nav__item" key={m.key}>
          <button
            type="button"
            className="nav__btn"
            data-menu={m.key}
            data-active={under(m.base)}
            aria-expanded={openKey === m.key}
            aria-controls={`menu-${m.key}`}
            onClick={() => setOpen(openKey === m.key ? null : { key: m.key, path })}
          >
            {t(`nav.${m.key}`)}
          </button>
          {openKey === m.key && (
            <div className="nav__menu" id={`menu-${m.key}`}>
              {m.items.map((it) => (
                <Link key={it.to} to={it.to} aria-current={is(it.to) ? 'page' : undefined}>
                  {t(it.label)}
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
      <div className="nav__item">
        <Link className="nav__link" to="/about" aria-current={is('/about') ? 'page' : undefined}>
          {t('nav.about')}
        </Link>
      </div>
    </nav>
  );
}

function AccountButton() {
  const { t } = useI18n();
  const s = useSession();
  const signedIn = s.status === 'in';
  const label = signedIn ? t('nav.account') : t('nav.login');
  return (
    <Link className="iconbtn iconbtn--account" to={signedIn ? '/account' : '/login'} aria-label={label} title={label}>
      <Icon name="user" />
      <span className="iconbtn__label">{signedIn ? s.user.name.split(' ')[0] : label}</span>
    </Link>
  );
}

function Drawer({ onNavigate }) {
  const { t } = useI18n();
  const s = useSession();
  const { is } = useCurrent();
  const cur = (to) => (is(to) ? 'page' : undefined);
  const link = (to, label) => (
    <Link className="drawer__link" to={to} aria-current={cur(to)} onClick={onNavigate}>
      {label}
    </Link>
  );
  return (
    <div className="drawer" id="drawer">
      <div className="wrap">
        <div className="drawer__account">
          {s.status === 'in' ? (
            <>
              <p>{t('acc.hello', { name: s.user.name.split(' ')[0] })}</p>
              <Link className="btn btn--primary btn--small" to="/account" onClick={onNavigate}>
                {t('nav.account')}
              </Link>
            </>
          ) : (
            <>
              <p>{t('auth.login.intro')}</p>
              <Link className="btn btn--primary btn--small" to="/login" onClick={onNavigate}>
                {t('nav.login')}
              </Link>
            </>
          )}
        </div>
        <div className="drawer__group">
          {link('/', t('nav.home'))}
          {link('/about', t('nav.about'))}
        </div>
        {MODULES.map((m) => (
          <div className="drawer__group" key={m.key}>
            <p className="drawer__title">{t(`nav.${m.key}`)}</p>
            {m.items.map((it) => (
              <div key={it.to}>{link(it.to, t(it.label))}</div>
            ))}
          </div>
        ))}
        <div className="drawer__group">{link('/privacy', t('footer.privacy'))}</div>
      </div>
    </div>
  );
}

function SearchBar({ onDone }) {
  const { t } = useI18n();
  const navigate = useLangNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const submit = (e) => {
    e.preventDefault();
    navigate(`/search?q=${encodeURIComponent(q.trim())}`);
    onDone();
  };
  return (
    <div className="searchbar">
      <form className="wrap" role="search" onSubmit={submit}>
        <label className="vh" htmlFor="site-search">
          {t('search.title')}
        </label>
        <input id="site-search" className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search.placeholder')} autoFocus />
        <button type="submit" className="btn btn--primary">
          {t('search.go')}
        </button>
      </form>
    </div>
  );
}

function Header() {
  const { t, L, lang, setLang } = useI18n();
  const s = useSettings();
  const { path } = useCurrent();
  const [panel, setPanel] = useState(null); // { kind: 'menu' | 'search', path }
  const open = panel?.path === path ? panel.kind : null; // closes by itself on the next page

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setPanel(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const toggle = (kind) => {
    if (open !== kind) window.scrollTo(0, 0); // the header is not fixed on phones: open panels where they can be seen
    setPanel(open === kind ? null : { kind, path });
  };
  return (
    <>
      <header className="header">
        <div className="wrap header__in">
          <Link className="brand" to="/">
            <Leaf className="brand__leaf" />
            <span>
              <span className="brand__name">{L(s.villageName)}</span>
              <span className="brand__sub">DIGITAL AINWAN</span>
            </span>
          </Link>
          <Nav />
          <div className="header__tools">
            <button
              type="button"
              className="iconbtn iconbtn--lang"
              lang={lang === 'hi' ? 'en' : 'hi'}
              aria-label={`${t('lang.switch')}: ${t('lang.label')}`}
              title={t('lang.label')}
              onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')}
            >
              {t('lang.switch')}
            </button>
            <button type="button" className="iconbtn iconbtn--round" aria-label={t('nav.search')} aria-expanded={open === 'search'} onClick={() => toggle('search')}>
              <Icon name="search" />
            </button>
            <AccountButton />
            <button
              type="button"
              className="iconbtn iconbtn--round iconbtn--menu"
              aria-label={open === 'menu' ? t('nav.close') : t('nav.menu')}
              aria-expanded={open === 'menu'}
              aria-controls="drawer"
              onClick={() => toggle('menu')}
            >
              <Icon name={open === 'menu' ? 'close' : 'menu'} />
            </button>
          </div>
        </div>
      </header>
      {open === 'search' && <SearchBar onDone={() => setPanel(null)} />}
      {open === 'menu' && <Drawer onNavigate={() => setPanel(null)} />}
    </>
  );
}

/** Phones: the five places people go most, always at the bottom of the screen (from the brief). */
function BottomNav() {
  const { t } = useI18n();
  const { path, under } = useCurrent();
  const items = [
    { to: '/', icon: 'home', label: t('nav.home'), on: path === '/' },
    { to: '/sanskriti', icon: 'star', label: t('nav.sanskriti'), on: under('/sanskriti') },
    { to: '/vikas', icon: 'chart', label: t('nav.vikas'), on: path === '/vikas' || under('/vikas/projects') || under('/vikas/map') },
    { to: '/vikas/notices', icon: 'bell', label: t('nav.suchna'), on: under('/vikas/notices') },
    { to: '/sampark', icon: 'users', label: t('nav.sampark'), on: under('/sampark') },
  ];
  return (
    <nav className="bottomnav" aria-label={t('nav.quick')}>
      {items.map((it) => (
        <Link key={it.to} to={it.to} aria-current={it.on ? 'page' : undefined}>
          <Icon name={it.icon} />
          {it.label}
        </Link>
      ))}
    </nav>
  );
}

/** "Add to home screen": shown only where the browser offers it (Android Chrome and similar). */
function InstallButton() {
  const { t } = useI18n();
  const [prompt, setPrompt] = useState(null);
  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);
  if (!prompt) return null;
  return (
    <p className="footer__install">
      <button
        type="button"
        className="btn btn--outline-light btn--small"
        onClick={async () => {
          prompt.prompt();
          await prompt.userChoice.catch(() => null);
          setPrompt(null);
        }}
      >
        <Icon name="download" size={20} />
        {t('footer.install')}
      </button>
    </p>
  );
}

function Footer() {
  const { t, L, fmtDate } = useI18n();
  const s = useSettings();
  const links = [
    ['/about', 'nav.about'],
    ['/sanskriti', 'nav.sanskriti'],
    ['/vikas', 'nav.projects'],
    ['/sampark/directory', 'nav.directory'],
    ['/sampark/youth', 'nav.youth'],
    ['/privacy', 'footer.privacy'],
  ];
  const team = L(s.teamName) || L(s.panchayatName);
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer__grid">
          <div>
            <p className="footer__name">{L(s.villageName)}</p>
            <p className="footer__tag">{L(s.tagline)}</p>
            <InstallButton />
          </div>
          <div>
            <h2>{t('footer.contact')}</h2>
            <address className="footer__contact" style={{ fontStyle: 'normal' }}>
              {s.officeAddress && (
                <span>
                  {t('footer.office')}: {L(s.officeAddress)}
                </span>
              )}
              {s.officeHours && (
                <span>
                  {t('about.hours')}: {L(s.officeHours)}
                </span>
              )}
              {s.whatsappNumber && (
                <span>
                  WhatsApp: <a href={`https://wa.me/91${s.whatsappNumber}`}>{s.whatsappNumber}</a>
                </span>
              )}
              {s.phone && (
                <span>
                  {t('dir.call')}: <a href={`tel:${s.phone}`}>{s.phone}</a>
                </span>
              )}
              {s.email && (
                <span>
                  {t('footer.email')}: <a href={`mailto:${s.email}`}>{s.email}</a>
                </span>
              )}
            </address>
          </div>
          <nav aria-label={t('footer.explore')}>
            <ul className="footer__links">
              {links.map(([to, key]) => (
                <li key={to}>
                  <Link to={to}>{t(key)}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="footer__fine">
          <p>{t('footer.note')}</p>
          {(s.lastUpdated || team) && (
            <p>
              {s.lastUpdated && t('footer.updated', { date: fmtDate(s.lastUpdated) })}
              {s.lastUpdated && team && ' · '}
              {team && t('footer.runBy', { team })}
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}

export function SiteLayout() {
  const { t } = useI18n();
  return (
    <>
      <ScrollToTop />
      <TypingWatcher />
      <a className="skip" href="#main">
        {t('skip')}
      </a>
      <Header />
      <OfflineBanner />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
