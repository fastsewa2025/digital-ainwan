import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { useI18n } from '../lib/i18n.jsx';
import { useSettings } from '../lib/settings.jsx';
import { useFetch } from '../lib/api.js';
import { MODULES } from './modules.js';

/** A peepal leaf: the tree every village meeting happens under. */
export function Leaf({ className }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <path d="M50 26C45 12 17 12 15 39c-2 23 20 34 35 56 15-22 37-33 35-56-2-27-30-27-35-13z" fill="#1f5c3b" />
      <path d="M50 26v62M50 48 33 38M50 48l17-10M50 64 36 56M50 64l14-8" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

function TopStrip() {
  const { lang, setLang, t, L } = useI18n();
  const s = useSettings();
  return (
    <div className="topstrip">
      <div className="wrap topstrip__in">
        <span className="topstrip__tag">{L(s.tagline)}</span>
        <button type="button" className="langbtn" lang={lang === 'hi' ? 'en' : 'hi'} aria-label={t('lang.label')} onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')}>
          {t('lang.switch')}
        </button>
      </div>
    </div>
  );
}

function Nav() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(null); // { key, path }
  const ref = useRef(null);
  const openKey = open?.path === pathname ? open.key : null; // closes by itself when the page changes

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
        <Link className="nav__link" to="/" aria-current={pathname === '/' ? 'page' : undefined}>
          {t('nav.home')}
        </Link>
      </div>
      {MODULES.map((m) => (
        <div className="nav__item" key={m.key}>
          <button
            type="button"
            className="nav__btn"
            data-menu={m.key}
            data-active={pathname.startsWith(m.base)}
            aria-expanded={openKey === m.key}
            aria-controls={`menu-${m.key}`}
            onClick={() => setOpen(openKey === m.key ? null : { key: m.key, path: pathname })}
          >
            {t(`nav.${m.key}`)}
          </button>
          {openKey === m.key && (
            <div className="nav__menu" id={`menu-${m.key}`}>
              {m.items.map((it) => (
                <Link key={it.to} to={it.to} aria-current={pathname === it.to ? 'page' : undefined}>
                  {t(it.label)}
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
      <div className="nav__item">
        <Link className="nav__link" to="/about" aria-current={pathname === '/about' ? 'page' : undefined}>
          {t('nav.about')}
        </Link>
      </div>
    </nav>
  );
}

function Drawer({ onNavigate }) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const cur = (to) => (pathname === to ? 'page' : undefined);
  return (
    <div className="drawer" id="drawer">
      <div className="wrap">
        <div className="drawer__group">
          <Link to="/" aria-current={cur('/')} onClick={onNavigate}>
            {t('nav.home')}
          </Link>
        </div>
        {MODULES.map((m) => (
          <div className="drawer__group" key={m.key}>
            <p className="drawer__title">{t(`nav.${m.key}`)}</p>
            {m.items.map((it) => (
              <Link key={it.to} to={it.to} aria-current={cur(it.to)} onClick={onNavigate}>
                {t(it.label)}
              </Link>
            ))}
          </div>
        ))}
        <div className="drawer__group">
          <Link to="/about" aria-current={cur('/about')} onClick={onNavigate}>
            {t('nav.about')}
          </Link>
        </div>
      </div>
    </div>
  );
}

function Header() {
  const { t, L } = useI18n();
  const s = useSettings();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(null); // path where the phone menu was opened
  const menuOpen = menu === pathname;
  return (
    <header className="header">
      <div className="wrap header__in">
        <Link to="/" className="brand">
          <Leaf className="brand__leaf" />
          <span>
            <span className="brand__name">{L(s.villageName)}</span>
            <span className="brand__sub">Digital {s.villageName?.en}</span>
          </span>
        </Link>
        <Nav />
        <button type="button" className="menu-btn" aria-expanded={menuOpen} aria-controls="drawer" onClick={() => setMenu(menuOpen ? null : pathname)}>
          {menuOpen ? t('nav.close') : t('nav.menu')}
        </button>
      </div>
      {menuOpen && <Drawer onNavigate={() => setMenu(null)} />}
    </header>
  );
}

function Ticker() {
  const { t, L } = useI18n();
  const { data } = useFetch('/public/ticker');
  const items = data?.items ?? [];
  if (!items.length) return null;
  const chars = items.reduce((n, i) => n + L(i.title).length + 6, 0);
  const set = (hidden) => (
    <span className={`ticker__set${hidden ? ' ticker__copy' : ''}`} aria-hidden={hidden || undefined}>
      {items.map((n) => (
        <Link key={n._id} className="ticker__item" to={`/vikas/notices/${n._id}`} tabIndex={hidden ? -1 : undefined}>
          {L(n.title)}
        </Link>
      ))}
    </span>
  );
  return (
    <div className="ticker" role="region" aria-label={t('ticker.label')}>
      <div className="wrap ticker__in">
        <span className="ticker__label">{t('ticker.label')}</span>
        <div className="ticker__view">
          <div className="ticker__track" style={{ '--dur': `${Math.max(24, chars * 0.32)}s` }}>
            {set(false)}
            {set(true)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Footer() {
  const { t, L } = useI18n();
  const s = useSettings();
  const links = [
    ['facebook', 'Facebook'],
    ['youtube', 'YouTube'],
    ['instagram', 'Instagram'],
    ['whatsapp', 'WhatsApp'],
  ].filter(([k]) => s[k]);
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer__grid">
          <div>
            <h3>{L(s.villageName)}</h3>
            <p>{L(s.tagline)}</p>
            {(s.officeAddress || s.officeHours || s.phone || s.email) && (
              <address style={{ fontStyle: 'normal', marginTop: '.9rem' }} className="footer__list">
                {s.officeAddress && <span>{L(s.officeAddress)}</span>}
                {s.officeHours && (
                  <span>
                    {t('about.hours')}: {L(s.officeHours)}
                  </span>
                )}
                {s.phone && <a href={`tel:${s.phone}`}>{s.phone}</a>}
                {s.email && <a href={`mailto:${s.email}`}>{s.email}</a>}
              </address>
            )}
          </div>
          <div>
            <h3>{t('footer.explore')}</h3>
            <ul className="footer__list">
              {MODULES.map((m) => (
                <li key={m.key}>
                  <Link to={m.items[0].to}>{t(`nav.${m.key}`)}</Link>
                </li>
              ))}
              <li>
                <Link to="/about">{t('nav.about')}</Link>
              </li>
              <li>
                <Link to="/privacy">{t('footer.privacy')}</Link>
              </li>
            </ul>
          </div>
          <div>
            {links.length > 0 && (
              <>
                <h3>{t('about.follow')}</h3>
                <ul className="footer__list">
                  {links.map(([k, label]) => (
                    <li key={k}>
                      <a href={s[k]} target="_blank" rel="noopener noreferrer">
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
        <p className="footer__fine">{t('footer.rights')}</p>
      </div>
    </footer>
  );
}

export function SiteLayout() {
  const { t } = useI18n();
  return (
    <>
      <ScrollToTop />
      <a className="skip" href="#main">
        {t('skip')}
      </a>
      <TopStrip />
      <Header />
      <Ticker />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
