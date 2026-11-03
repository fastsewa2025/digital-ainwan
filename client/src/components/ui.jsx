import { useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router';
import { useI18n } from '../lib/i18n.jsx';
import { useSettings } from '../lib/settings.jsx';
import { makePlots } from '../lib/patchwork.js';
import { MODULES } from './modules.js';

/* ------------------------------------------------------------- page title */
export function useTitle(title) {
  const settings = useSettings();
  const { L } = useI18n();
  useEffect(() => {
    const site = L(settings.villageName);
    document.title = title ? `${title} · ${site}` : `${site} · ${L(settings.tagline)}`;
  }, [title, settings, L]);
}

/* ------------------------------------------------- field-plot illustration */
export function Plots({ seed, count = 14, w = 120, h = 80, stroke = 0.7, animate = false, className }) {
  const plots = useMemo(() => makePlots(seed, w, h, count), [seed, w, h, count]);
  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect width={w} height={h} fill="#8b5e3c" />
      {plots.map((p) => (
        <polygon
          key={p.i}
          className={animate ? 'plot' : undefined}
          style={animate ? { '--i': p.i } : undefined}
          points={p.points}
          fill={p.fill}
          stroke="#fff"
          strokeWidth={stroke}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

/** A real photo if there is one; otherwise a one-of-a-kind field patchwork, never a grey box. */
export function Photo({ img, alt = '', seed, ratio = '4 / 3', full = false, className = '' }) {
  if (!img?.url) {
    return (
      <div className={`photo photo--ph ${className}`} style={{ aspectRatio: ratio }}>
        <Plots seed={seed ?? alt} />
      </div>
    );
  }
  return (
    <div className={`photo ${className}`} style={{ aspectRatio: ratio }}>
      <img src={full ? img.url : img.thumb || img.url} width={img.width} height={img.height} alt={alt} loading="lazy" decoding="async" />
    </div>
  );
}

/* ------------------------------------------------------------ small parts */
export function PhaseTag({ phase }) {
  const { t } = useI18n();
  return (
    <span className={`tag tag--${phase}`}>
      <span className="tag__sw" aria-hidden="true" />
      {t(`phase.${phase}`)}
    </span>
  );
}

export function Furrow({ value = 0, label, large = false }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={`furrow${large ? ' furrow--lg' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} aria-label={label}>
      <span className="furrow__crop" style={{ width: `${v}%` }} />
    </div>
  );
}

/** A line of small facts about something. Each fact is its own element, spaced apart, not strung together with dots. */
export function Meta({ items, className = '' }) {
  const shown = items.filter(Boolean);
  if (!shown.length) return null;
  return (
    <p className={`meta ${className}`}>
      {shown.map((x, i) => (
        <span key={i}>{x}</span>
      ))}
    </p>
  );
}

export function SecHead({ title, sub, to, more }) {
  return (
    <div className="sechead">
      <div>
        <h2>{title}</h2>
        {sub && <p className="sechead__sub">{sub}</p>}
      </div>
      {to && (
        <Link className="sechead__more" to={to}>
          {more}
        </Link>
      )}
    </div>
  );
}

/**
 * Colour-coded head for each of the three parts of the site, with tabs for the pages inside it.
 * Without a module (About, Privacy) it is a plain head. `as="p"` is for detail pages, where the
 * item's own title is the page's <h1>.
 */
export function PageHead({ module, title, intro, as: Tag = 'h1' }) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const mod = MODULES.find((m) => m.key === module);
  return (
    <header className={`pagehead pagehead--${mod ? module : 'plain'}`}>
      <div className="wrap">
        <Tag className="pagehead__title">{title}</Tag>
        {intro && <p className="pagehead__intro">{intro}</p>}
        {mod && (
          <nav className="subnav" aria-label={t(`nav.${module}`)}>
            {mod.items.map(({ to, label, also = [] }) => {
              // The module's own first page ("/vikas") must not light up for its sibling pages ("/vikas/map").
              const active =
                pathname === to ||
                (to !== mod.base && pathname.startsWith(`${to}/`)) ||
                also.some((p) => pathname === p || pathname.startsWith(`${p}/`));
              return (
                <Link key={to} to={to} aria-current={active ? 'page' : undefined}>
                  {t(label)}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}

/* -------------------------------------------------------------- page states */
export function Loading() {
  const { t } = useI18n();
  return (
    <div className="state" role="status">
      {t('common.loading')}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  const { t } = useI18n();
  // An old or removed link is not a fault: say so plainly. "Try again" would not help.
  if (error?.code === 'NOT_FOUND') {
    return (
      <div className="state" role="alert">
        <h1 className="state__title">{t('common.notFound.title')}</h1>
        <p className="muted">{t('common.notFound.text')}</p>
        <Link className="btn btn--primary btn--small" to="/">
          {t('common.goHome')}
        </Link>
      </div>
    );
  }
  const key = `err.${error?.code}`;
  const msg = t(key) === key ? t('err.default') : t(key);
  return (
    <div className="state" role="alert">
      <p className="state__title">{msg}</p>
      {onRetry && (
        <button type="button" className="btn btn--ghost btn--small" onClick={onRetry}>
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}

export function Empty({ text }) {
  const { t } = useI18n();
  return <p className="state">{text ?? t('common.nothing')}</p>;
}

/** Shows loading / error / empty / content in one place so every page behaves the same. */
export function Async({ res, empty, emptyText, children }) {
  if (res.loading) return <Loading />;
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />;
  if (empty && res.data && empty(res.data)) return <Empty text={emptyText} />;
  return children(res.data);
}

export function Pager({ page, pages, onPage }) {
  const { t } = useI18n();
  if (pages <= 1) return null;
  return (
    <nav className="pager" aria-label={t('common.page')}>
      <button type="button" className="btn btn--ghost btn--small" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        {t('common.prev')}
      </button>
      <span className="pager__now">
        {page} / {pages}
      </span>
      <button type="button" className="btn btn--ghost btn--small" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        {t('common.next')}
      </button>
    </nav>
  );
}

export function ShareButton({ title }) {
  const { t } = useI18n();
  const href = `https://wa.me/?text=${encodeURIComponent(`${title}\n${window.location.href}`)}`;
  return (
    <a className="btn btn--ghost btn--small" href={href} target="_blank" rel="noopener noreferrer">
      {t('common.share')}
    </a>
  );
}

export function BackLink({ to, children }) {
  return (
    <Link className="backlink" to={to}>
      {children}
    </Link>
  );
}
