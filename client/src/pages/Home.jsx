import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '../lib/nav.jsx';
import { useFetch } from '../lib/api.js';
import { useI18n } from '../lib/i18n.jsx';
import { useSettings } from '../lib/settings.jsx';
import { useSession } from '../lib/session.jsx';
import { Furrow, useTitle } from '../components/ui.jsx';
import { Icon, PlayIcon, WhatsAppIcon } from '../components/Icons.jsx';

/* Home page, section by section, in the order of the developer brief (§4). */

const srcSet = (img) => (img?.thumb && img.width > 480 ? `${img.thumb} 480w, ${img.url} ${img.width}w` : undefined);

function Img({ img, alt = '', sizes = '100vw', eager = false, className }) {
  return (
    <img
      className={className}
      src={img.url}
      srcSet={srcSet(img)}
      sizes={sizes}
      width={img.width}
      height={img.height}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : undefined}
      decoding="async"
    />
  );
}

/** Striped placeholder used where a real photo is still missing (the design's "[ ]" boxes). */
function Blank({ label, className = '' }) {
  return (
    <div className={`blank ${className}`}>
      {label && <span className="blank__label">{label}</span>}
    </div>
  );
}

/* 1-2. Hero: big real photo, place, name, two buttons */
function Hero() {
  const { t, L } = useI18n();
  const s = useSettings();
  const { isStaff } = useSession();
  const photo = s.heroImages?.[0];
  return (
    <section className="hhero" aria-labelledby="hhero-name">
      <div className="hhero__media">
        {photo?.url ? (
          <Img img={photo} alt={L(s.villageName)} eager className="hhero__img" sizes="(min-width: 980px) 58vw, 100vw" />
        ) : (
          <Blank className="hhero__blank" label={isStaff ? t('home.hero.placeholder') : null} />
        )}
      </div>
      <div className="hhero__panel">
        <div className="hhero__text">
          {s.district && (
            <p className="hhero__place">
              <Icon name="pin" size={18} />
              {L(s.district)}
            </p>
          )}
          <h1 id="hhero-name" className="hhero__name">
            {L(s.villageName)}
          </h1>
          <p className="hhero__tag">
            {L(s.tagline)}।
            {s.heroText && (
              <>
                <br />
                {L(s.heroText)}
              </>
            )}
          </p>
          <div className="hhero__cta">
            <Link className="btn btn--mustard" to="/about">
              {t('home.hero.know')}
            </Link>
            <Link className="btn btn--outline-light" to="/vikas">
              {t('home.hero.works')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* 3. The village in numbers (filled in by the Panchayat in settings) */
function Stats() {
  const { t, L, fmtNum } = useI18n();
  const s = useSettings();
  const cards = [
    s.population && [fmtNum(s.population), t('home.stats.people')],
    s.families && [fmtNum(s.families), t('home.stats.families')],
    s.distanceKm != null && s.distanceKm !== '' && [t('home.stats.km', { n: fmtNum(s.distanceKm) }), t('home.stats.distance', { place: L(s.distanceFrom) })],
    s.pinCode && [s.pinCode, s.panchayatName ? t('home.stats.panchayat', { name: L(s.panchayatName) }) : t('home.stats.pin')],
  ].filter(Boolean);
  if (!cards.length) return null;
  return (
    <section className="wrap hsec" aria-label={t('home.stats.title')}>
      <ul className="stats">
        {cards.map(([big, small]) => (
          <li key={small} className="stat">
            <span className="stat__big">{big}</span>
            <span className="stat__small">{small}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionHead({ id, title, sub, to, more, eyebrow, light = false }) {
  return (
    <div className={`hhead${light ? ' hhead--light' : ''}`}>
      <div>
        {eyebrow && <p className="hhead__eyebrow">{eyebrow}</p>}
        <h2 id={id}>{title}</h2>
        {sub && <p className="hhead__sub">{sub}</p>}
      </div>
      {to && (
        <Link className="hhead__more" to={to}>
          {more} <Icon name="arrow" size={18} />
        </Link>
      )}
    </div>
  );
}

/* 4. Notice board: latest three, newest first, "new" and "important" marked */
function NoticeBoard({ items }) {
  const { t, L, fmtDate } = useI18n();
  const tone = { meeting: 'green', scheme: 'mustard', festival: 'brown', order: 'ink', general: 'green' };
  return (
    <section className="wrap hsec" aria-labelledby="h-notices">
      <SectionHead id="h-notices" title={t('home.notices.title')} to="/vikas/notices" more={t('home.seeAll')} />
      {items.length === 0 ? (
        <p className="muted">{t('home.notices.empty')}</p>
      ) : (
        <ul className="notes">
          {items.map((n) => {
            const flags = [n.fresh && t('home.notice.new'), n.urgent && t('home.notice.urgent')].filter(Boolean);
            return (
              <li key={n._id}>
                <Link className="note" to={`/vikas/notices/${n._id}`}>
                  <span className={`note__date note__date--${tone[n.category] ?? 'green'}`} aria-hidden="true">
                    <b>{fmtDate(n.date, { day: 'numeric' })}</b>
                    <span>{fmtDate(n.date, { month: 'short' })}</span>
                  </span>
                  <span className="note__body">
                    <span className={`note__cat${flags.length ? ' note__cat--flag' : ''}`}>
                      {flags.length ? flags.join(' · ') : t(`notices.cat.${n.category}`)}
                    </span>
                    <span className="note__title">{L(n.title)}</span>
                    <span className="vh">{fmtDate(n.date)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* 5. Development work: before / now photos, status, progress, money, date */
function WorkCard({ p }) {
  const { t, L, fmtDate, fmtINR } = useI18n();
  const done = p.phase === 'completed';
  const pct = done ? 100 : p.progress ?? 0;
  const status = { planned: 'phase.planned', 'in-progress': 'phase.in-progress', completed: 'home.works.done' }[p.phase];
  return (
    <li>
      <Link className="work" to={`/vikas/projects/${p._id}`}>
        <span className="work__ba">
          {[
            [p.beforeCover, t('home.works.before'), 'before'],
            [p.afterCover, t('home.works.now'), 'now'],
          ].map(([img, label, k]) => (
            <span key={k} className="work__half">
              {img?.url ? <Img img={img} alt="" sizes="(min-width: 820px) 280px, 50vw" /> : <Blank label={t('home.works.noPhoto')} />}
              <span className={`work__label work__label--${k}`}>{label}</span>
            </span>
          ))}
        </span>
        <span className="work__body">
          <span className="work__top">
            <span className="work__title">{L(p.title)}</span>
            <span className={`pill pill--${p.phase}`}>{t(status)}</span>
          </span>
          <Furrow value={pct} label={`${pct}%`} />
          <span className="work__facts">
            <span>
              <b>{pct}%</b>
              <small>{t('home.works.done')}</small>
            </span>
            <span>
              <b>{p.budgetSpent != null ? fmtINR(p.budgetSpent) : '—'}</b>
              <small>{t('home.works.spent')}</small>
            </span>
            <span>
              <b>{done ? fmtDate(p.completedOn, { month: 'short', year: 'numeric' }) || '—' : fmtDate(p.expectedEnd, { month: 'short', year: 'numeric' }) || '—'}</b>
              <small>{done ? t('home.works.finished') : t('home.works.due')}</small>
            </span>
          </span>
        </span>
      </Link>
    </li>
  );
}

function Works({ items }) {
  const { t } = useI18n();
  return (
    <section className="hworks" aria-labelledby="h-works">
      <div className="wrap">
        <SectionHead id="h-works" title={t('home.works.title')} sub={t('home.works.sub')} light />
        {items.length === 0 ? (
          <p className="hworks__empty">{t('home.works.empty')}</p>
        ) : (
          <ul className="works">
            {items.map((p) => (
              <WorkCard key={p._id} p={p} />
            ))}
          </ul>
        )}
        <Link className="btn btn--outline-light btn--block hworks__all" to="/vikas">
          {t('home.works.all')}
        </Link>
      </div>
    </section>
  );
}

/* 6. Elders' voices: an audio player that shows its progress on a waveform */
const clock = (sec) => {
  if (!Number.isFinite(sec) || sec < 0) return '–:––';
  const m = Math.floor(sec / 60);
  return `${m}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
};

function bars(seed, n = 34) {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return Array.from({ length: n }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    return 30 + ((h >>> 8) % 70) * (0.55 + 0.45 * Math.sin(i / 2.3) ** 2);
  });
}

function AudioCard({ story }) {
  const { t, L } = useI18n();
  const audio = useRef(null);
  const [state, setState] = useState({ playing: false, time: 0, duration: NaN });
  const heights = useMemo(() => bars(story._id), [story._id]);

  useEffect(() => {
    const a = audio.current;
    if (!a) return undefined;
    const sync = () => setState({ playing: !a.paused, time: a.currentTime, duration: a.duration });
    const events = ['play', 'pause', 'timeupdate', 'loadedmetadata', 'ended', 'durationchange'];
    events.forEach((e) => a.addEventListener(e, sync));
    return () => events.forEach((e) => a.removeEventListener(e, sync));
  }, []);

  const title = L(story.title);
  const progress = state.duration > 0 ? state.time / state.duration : 0;
  const toggle = () => {
    const a = audio.current;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };
  const langName = t(`langname.${story.language ?? 'other'}`);
  return (
    <div className="voice">
      <div className="voice__who">
        {story.photo?.url ? (
          <img className="voice__face" src={story.photo.thumb || story.photo.url} alt="" width="72" height="72" loading="lazy" />
        ) : (
          <span className="voice__face voice__face--blank" aria-hidden="true">
            {L(story.elderName).slice(0, 1)}
          </span>
        )}
        <div>
          <p className="voice__name">
            {L(story.elderName)}
            {story.elderAge ? `, ${t('home.voice.years', { n: story.elderAge })}` : ''}
          </p>
          <p className="voice__title">
            “{title}” · {t('home.voice.in', { lang: langName })}
          </p>
        </div>
      </div>
      <div className="voice__player">
        <button
          type="button"
          className="voice__play"
          onClick={toggle}
          aria-label={state.playing ? t('home.voice.pause') : t('home.voice.play', { title })}
        >
          <PlayIcon playing={state.playing} />
        </button>
        <div className="wave">
          <div className="wave__bars" aria-hidden="true">
            {heights.map((h, i) => (
              <span key={i} style={{ height: `${h}%` }} data-on={i / heights.length < progress} />
            ))}
          </div>
          <input
            className="wave__seek"
            type="range"
            min="0"
            max={Number.isFinite(state.duration) ? Math.floor(state.duration) : 0}
            step="1"
            value={Math.floor(state.time)}
            onChange={(e) => {
              audio.current.currentTime = Number(e.target.value);
            }}
            aria-label={title}
            aria-valuetext={`${clock(state.time)} / ${clock(state.duration)}`}
          />
        </div>
      </div>
      <p className="voice__time" aria-live="off">
        {state.playing
          ? `${t('home.voice.playing')} ${clock(state.time)} / ${clock(state.duration)}`
          : state.time > 0
            ? `${t('home.voice.paused')} · ${clock(state.time)} / ${clock(state.duration)}`
            : `${t('home.voice.tap')} · ${clock(state.duration)}`}
      </p>
      {/* "metadata" downloads only the first few kilobytes, enough to know the length. */}
      <audio ref={audio} src={story.audio} preload="metadata" />
    </div>
  );
}

function Voices({ story }) {
  const { t } = useI18n();
  return (
    <section className="wrap hsec" aria-labelledby="h-voice">
      <SectionHead id="h-voice" eyebrow={t('home.voice.eyebrow')} title={t('home.voice.title')} />
      {story ? <AudioCard story={story} /> : <p className="muted">{t('home.voice.empty')}</p>}
      <p className="voice__links">
        <Link to="/sanskriti/oral-history">{t('home.voice.more')}</Link>
        <span aria-hidden="true"> · </span>
        <Link to="/account?send=story">
          {t('home.voice.record')} <Icon name="arrow" size={16} />
        </Link>
      </p>
    </section>
  );
}

/* 7. Culture: bento grid of festivals, the tradition wiki and the photo gallery */
function Culture({ festivals, stats, galleryCover }) {
  const { t, L, fmtNum } = useI18n();
  const tiles = festivals.slice(0, 3);
  return (
    <section className="wrap hsec" aria-labelledby="h-culture">
      <SectionHead id="h-culture" title={t('home.culture.title')} to="/sanskriti" more={t('home.seeAll')} />
      <div className="bento">
        {tiles.map((f, i) => (
          <Link key={f._id} className={`tile tile--photo${i === 0 ? ' tile--big' : ''}`} to={`/sanskriti/festivals/${f._id}`}>
            {f.cover?.url ? <Img img={f.cover} alt="" sizes={i === 0 ? '(min-width: 980px) 760px, 100vw' : '(min-width: 980px) 380px, 50vw'} /> : <Blank />}
            <span className="tile__label">{L(f.title)}</span>
          </Link>
        ))}
        {tiles.length < 3 && (
          <Link className={`tile tile--photo${tiles.length === 0 ? ' tile--big' : ''}`} to="/sanskriti/festivals">
            <Blank />
            <span className="tile__label">{t('home.culture.allFestivals')}</span>
          </Link>
        )}
        <Link className="tile tile--kosh" to="/sanskriti/wiki">
          <span className="tile__name">{t('home.culture.kosh')}</span>
          <span className="tile__foot">
            {t('home.culture.koshSub')} <Icon name="arrow" size={18} />
          </span>
        </Link>
        <Link className="tile tile--gallery" to="/sanskriti/gallery">
          {galleryCover?.url && <Img img={galleryCover} alt="" className="tile__bg" sizes="(min-width: 980px) 380px, 50vw" />}
          <span className="tile__name">{t('home.culture.gallery')}</span>
          <span className="tile__foot">
            {t('home.culture.photos', { n: fmtNum(stats.photos ?? 0) })} <Icon name="arrow" size={18} />
          </span>
        </Link>
      </div>
    </section>
  );
}

/* 8. Village map: Google My Maps, loaded only when asked (it is heavy on a slow phone network) */
function VillageMap() {
  const { t, L } = useI18n();
  const s = useSettings();
  const [open, setOpen] = useState(false);
  return (
    <section className="wrap hsec" aria-labelledby="h-map">
      <SectionHead id="h-map" title={t('home.map.title')} sub={t('home.map.note')} />
      <div className="vmap">
        {open && s.mapEmbed ? (
          <iframe className="vmap__frame" src={s.mapEmbed} title={`${t('home.map.title')}: ${L(s.villageName)}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
        ) : (
          <div className="vmap__facade">
            <div className="vmap__art" aria-hidden="true">
              <span className="vmap__road vmap__road--h" />
              <span className="vmap__road vmap__road--v" />
              <span className="vmap__pond" />
              {[
                ['temple', 'मंदिर', 'Temple'],
                ['school', 'स्कूल', 'School'],
                ['office', 'पंचायत भवन', 'Panchayat'],
                ['pond', 'तालाब', 'Pond'],
              ].map(([k, hi, en]) => (
                <span key={k} className={`vmap__pin vmap__pin--${k}`}>
                  <i />
                  {L({ hi, en })}
                </span>
              ))}
            </div>
            <div className="vmap__cta">
              {s.mapEmbed && (
                <button type="button" className="btn btn--primary" onClick={() => setOpen(true)}>
                  <Icon name="map" size={20} />
                  {t('home.map.open')}
                </button>
              )}
              <Link className="btn btn--outline-dark" to="/vikas/map">
                {t('home.map.works')}
              </Link>
              {s.mapEmbed && <p className="small muted">{t('home.map.data')}</p>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* 9. Wall of pride: cards that scroll sideways */
function FameWall({ items }) {
  const { t, L } = useI18n();
  if (!items.length) return null;
  return (
    <section className="hsec" aria-labelledby="h-fame">
      <div className="wrap">
        <SectionHead id="h-fame" title={t('home.fame.title')} sub={t('home.fame.sub')} to="/sampark/fame" more={t('home.fame.all')} />
      </div>
      <ul className="fame-row" tabIndex={0} aria-label={t('home.fame.title')}>
        {items.map((p) => (
          <li key={p._id}>
            <Link className="fcard" to={`/sampark/fame/${p._id}`}>
              {p.photo?.url ? <Img img={p.photo} alt="" sizes="240px" className="fcard__img" /> : <Blank className="fcard__img" />}
              <span className="fcard__body">
                <span className="fcard__name">{L(p.name)}</span>
                <span className="fcard__field">{t(`fame.field.${p.field}`)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* 10. For people living away from the village */
function Bridge() {
  const { t } = useI18n();
  const s = useSettings();
  return (
    <section className="wrap hsec">
      <div className="bridge2">
        <h2>{t('home.bridge.title')}</h2>
        <p>{t('home.bridge.text')}</p>
        <div className="bridge2__cta">
          {s.whatsapp && (
            <a className="btn btn--primary btn--block" href={s.whatsapp} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon />
              {t('home.bridge.whatsapp')}
            </a>
          )}
          <Link className="btn btn--outline-dark btn--block" to="/sampark/contribute">
            {t('home.bridge.give')}
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  useTitle(null);
  const { data } = useFetch('/public/home');
  const d = data ?? { notices: [], projects: [], festivals: [], fame: [], stats: {}, story: null };
  return (
    <div className="home">
      <Hero />
      <Stats />
      <NoticeBoard items={d.notices} />
      <Works items={d.projects} />
      <Voices story={d.story} />
      <Culture festivals={d.festivals} stats={d.stats} galleryCover={d.galleryCover} />
      <VillageMap />
      <FameWall items={d.fame} />
      <Bridge />
    </div>
  );
}
