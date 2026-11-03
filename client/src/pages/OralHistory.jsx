import { Link, useParams } from 'react-router';
import { useI18n } from '../lib/i18n.jsx';
import { useFetch } from '../lib/api.js';
import { Async, BackLink, Meta, PageHead, Pager, Photo, ShareButton, useTitle } from '../components/ui.jsx';
import { SearchBox, useListParams } from '../components/filters.jsx';
import { Prose } from '../components/Prose.jsx';

function Player({ src, label }) {
  const { t } = useI18n();
  if (!src) return <p className="small muted">{t('oral.noAudio')}</p>;
  return <audio className="player" controls preload="none" src={src} aria-label={label} />;
}

function ElderLine({ s, withName = true }) {
  const { t, L, fmtDate } = useI18n();
  return (
    <Meta
      items={[
        withName && t('oral.by', { name: L(s.elderName) }),
        s.elderAge && t('oral.age', { n: s.elderAge }),
        s.recordedOn && t('oral.recorded', { date: fmtDate(s.recordedOn, { month: 'long', year: 'numeric' }) }),
      ]}
    />
  );
}

export function OralHistory() {
  const { t, L } = useI18n();
  useTitle(t('oral.title'));
  const p = useListParams();
  const res = useFetch('/public/content/oral-history', { q: p.get('q'), page: p.page, limit: 12 });

  return (
    <>
      <PageHead module="sanskriti" title={t('oral.title')} intro={t('oral.intro')} />
      <div className="page">
        <div className="wrap">
          <div className="toolbar">
            <SearchBox value={p.get('q')} onChange={(q) => p.set({ q })} placeholder={t('common.searchPh')} />
          </div>
          <Async res={res} empty={(d) => d.items.length === 0} emptyText={p.get('q') ? t('common.nothingFound') : undefined}>
            {(d) => (
              <>
                <ul className="orows">
                  {d.items.map((s) => (
                    <li key={s._id} className="orow">
                      <Photo img={s.photo} seed={s._id} alt="" ratio="1 / 1" className="orow__photo" />
                      <div className="orow__body">
                        <h2 className="orow__title">
                          <Link to={`/sanskriti/oral-history/${s._id}`}>{L(s.title)}</Link>
                        </h2>
                        <ElderLine s={s} />
                        {s.summary && <p className="orow__text">{L(s.summary)}</p>}
                        <Player src={s.audio} label={`${t('oral.listen')}: ${L(s.title)}`} />
                        <p className="small">
                          <Link to={`/sanskriti/oral-history/${s._id}`}>{t('oral.transcript')}</Link>
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <Pager page={d.page} pages={d.pages} onPage={(page) => p.set({ page })} />
              </>
            )}
          </Async>
        </div>
      </div>
    </>
  );
}

export function OralHistoryDetail() {
  const { id } = useParams();
  const { t, L } = useI18n();
  const res = useFetch(`/public/content/oral-history/${id}`);
  useTitle(res.data ? L(res.data.title) : null);

  return (
    <>
      <PageHead module="sanskriti" as="p" title={t('oral.title')} />
      <div className="page">
        <div className="wrap wrap--narrow">
          <BackLink to="/sanskriti/oral-history">{t('nav.oral')}</BackLink>
          <Async res={res}>
            {(d) => (
              <article>
                <h1 className="detail__title">{L(d.title)}</h1>
                <div className="elder">
                  <Photo img={d.photo} seed={d._id} alt={L(d.elderName)} ratio="1 / 1" full className="elder__photo" />
                  <div>
                    <p className="elder__name">{L(d.elderName)}</p>
                    <ElderLine s={d} withName={false} />
                  </div>
                </div>
                <Player src={d.audio} label={`${t('oral.listen')}: ${L(d.title)}`} />
                {d.summary && <p className="detail__lead">{L(d.summary)}</p>}
                {d.transcript && (
                  <section className="detail__block">
                    <h2>{t('oral.transcript')}</h2>
                    <Prose text={L(d.transcript)} />
                  </section>
                )}
                <p className="detail__actions">
                  <ShareButton title={L(d.title)} />
                </p>
              </article>
            )}
          </Async>
        </div>
      </div>
    </>
  );
}
