import { Link } from 'react-router';
import { useI18n } from '../lib/i18n.jsx';
import { useFetch } from '../lib/api.js';
import { Hero } from '../components/Hero.jsx';
import { Async, Photo, SecHead, useTitle } from '../components/ui.jsx';
import { ProjectRow, VillageBar } from '../components/project.jsx';

function Pillars({ stats }) {
  const { t, fmtNum } = useI18n();
  // A count of 0 on launch day says "nothing here". Show a count only once there is something to count.
  const count = (n, label) => (n > 0 ? `${fmtNum(n)} ${label}` : null);
  const items = [
    { key: 'sanskriti', to: '/sanskriti/festivals', meta: stats && count(stats.festivals, t('home.counts.festivals')) },
    { key: 'vikas', to: '/vikas', meta: stats && count(stats.projects.completed + stats.projects.inProgress + stats.projects.planned, t('nav.projects')) },
    { key: 'sampark', to: '/sampark/directory', meta: stats && count(stats.directory, t('home.counts.directory')) },
  ];
  return (
    <section className="pillars" aria-label={t('nav.main')}>
      <div className="wrap">
        <div className="pillars__grid">
          {items.map((p) => (
            <Link key={p.key} to={p.to} className={`pillar pillar--${p.key}`}>
              <h2 className="pillar__title">{t(`nav.${p.key}`)}</h2>
              <p className="pillar__text">{t(`pillar.${p.key}`)}</p>
              {p.meta && <p className="pillar__meta">{p.meta}</p>}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function NoticeRows({ items }) {
  const { t, L, fmtDate } = useI18n();
  return (
    <ul className="nrows">
      {items.map((n) => (
        <li key={n._id}>
          <Link className="nrow" to={`/vikas/notices/${n._id}`}>
            <time className="nrow__date" dateTime={n.date}>
              {fmtDate(n.date, { day: 'numeric', month: 'short', year: 'numeric' })}
            </time>
            <span className="nrow__title">{L(n.title)}</span>
            <span className="nrow__cat">{t(`notices.cat.${n.category}`)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function FestivalTiles({ items }) {
  const { t, L, fmtDate } = useI18n();
  return (
    <ul className="ftiles">
      {items.map((f) => (
        <li key={f._id}>
          <Link className="ftile" to={`/sanskriti/festivals/${f._id}`}>
            <Photo img={f.cover} seed={f._id} alt="" ratio="4 / 3" className="ftile__photo" />
            <p className="ftile__date">{fmtDate(f.date, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <h3 className="ftile__title">{L(f.title)}</h3>
            <span className="vh">{t(`festivals.kind.${f.kind}`)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function FameRow({ items }) {
  const { t, L } = useI18n();
  return (
    <ul className="faces">
      {items.map((p) => (
        <li key={p._id}>
          <Link className="face" to={`/sampark/fame/${p._id}`}>
            <Photo img={p.photo} seed={p._id} alt="" ratio="1 / 1" className="face__photo" />
            <h3 className="face__name">{L(p.name)}</h3>
            <p className="face__line">{L(p.headline)}</p>
            <span className="vh">{t(`fame.field.${p.field}`)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  const { t } = useI18n();
  useTitle(null);
  const res = useFetch('/public/home');
  const stats = res.data?.stats;
  const { projects = {}, notices = [], festivals = [], fame = [] } = res.data ?? {};
  const featured = [...(projects.inProgress ?? []), ...(projects.completed ?? []).slice(0, 2), ...(projects.planned ?? []).slice(0, 1)].slice(0, 4);

  return (
    <>
      <Hero />
      <Pillars stats={stats} />
      <Async res={res}>
        {() => (
          <>
            {stats && stats.projects.planned + stats.projects.inProgress + stats.projects.completed > 0 && (
              <section className="band">
                <div className="wrap">
                  <SecHead title={t('home.vikas.title')} sub={t('home.vikas.sub')} to="/vikas" more={t('common.viewAll')} />
                  <VillageBar stats={stats} />
                  <ul className="prows">{featured.map((p) => <ProjectRow key={p._id} p={p} />)}</ul>
                </div>
              </section>
            )}

            {notices.length > 0 && (
              <section className="band band--tint">
                <div className="wrap">
                  <SecHead title={t('home.notices.title')} to="/vikas/notices" more={t('common.viewAll')} />
                  <NoticeRows items={notices} />
                </div>
              </section>
            )}

            {festivals.length > 0 && (
              <section className="band">
                <div className="wrap">
                  <SecHead title={t('home.festivals.title')} to="/sanskriti/festivals" more={t('common.viewAll')} />
                  <FestivalTiles items={festivals} />
                </div>
              </section>
            )}

            {fame.length > 0 && (
              <section className="band band--tint">
                <div className="wrap">
                  <SecHead title={t('home.fame.title')} to="/sampark/fame" more={t('common.viewAll')} />
                  <FameRow items={fame} />
                </div>
              </section>
            )}

            <section className="band band--mitti">
              <div className="wrap bridge">
                <div>
                  <h2>{t('home.bridge.title')}</h2>
                  <p className="bridge__text">{t('home.bridge.text')}</p>
                </div>
                <Link className="btn btn--light" to="/sampark/contribute">
                  {t('home.bridge.cta')}
                </Link>
              </div>
            </section>
          </>
        )}
      </Async>
    </>
  );
}
