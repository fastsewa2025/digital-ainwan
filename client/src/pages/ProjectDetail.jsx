import { useParams } from 'react-router';
import { Link } from '../lib/nav.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useFetch } from '../lib/api.js';
import { Async, BackLink, Furrow, Meta, PageHead, PhaseTag, ShareButton, useTitle } from '../components/ui.jsx';
import { BeforeAfter } from '../components/BeforeAfter.jsx';
import { Gallery } from '../components/Lightbox.jsx';
import { Prose } from '../components/Prose.jsx';

function Fact({ label, children }) {
  if (!children && children !== 0) return null; // no value (false / undefined / empty): do not draw an empty row
  return (
    <div className="facts__row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Money({ p }) {
  const { t, fmtINR } = useI18n();
  const { budgetAllocated: planned, budgetSpent: spent } = p;
  if (planned == null && spent == null) return null;
  const pct = planned > 0 && spent != null ? Math.round((spent / planned) * 100) : null;
  return (
    <>
      <Fact label={t('vikas.sanctioned')}>{planned != null && <strong>{fmtINR(planned)}</strong>}</Fact>
      <Fact label={t('vikas.spent')}>
        {spent != null && (
          <>
            <strong>{fmtINR(spent)}</strong>
            {pct != null && <span className="muted"> ({t('vikas.spentPct', { n: pct })})</span>}
            {planned != null && spent > planned && <span className="facts__warn">{t('vikas.over')}</span>}
          </>
        )}
      </Fact>
    </>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const { t, L, fmtDate } = useI18n();
  const res = useFetch(`/public/content/projects/${id}`);
  useTitle(res.data ? L(res.data.title) : null);

  return (
    <>
      <PageHead module="vikas" as="p" title={t('vikas.title')} />
      <div className="page">
        <div className="wrap wrap--mid">
          <BackLink to="/vikas">{t('nav.projects')}</BackLink>
          <Async res={res}>
            {(d) => {
              const before = d.beforePhotos ?? [];
              const after = d.afterPhotos ?? [];
              const pairs = Math.min(before.length, after.length);
              // Photos that have no partner for a slider still get shown, in the ordinary gallery.
              const gallery = [...(d.photos ?? []), ...before.slice(pairs), ...after.slice(pairs)];
              const updates = [...(d.updates ?? [])].sort((a, b) => new Date(b.date) - new Date(a.date));
              const date = (v) => v && <time dateTime={v}>{fmtDate(v)}</time>;
              return (
                <article>
                  <h1 className="detail__title">{L(d.title)}</h1>
                  <p className="detail__meta">
                    <PhaseTag phase={d.phase} />
                    {d.mohalla && <span>{L(d.mohalla)}</span>}
                  </p>
                  {d.summary && <p className="detail__lead">{L(d.summary)}</p>}

                  <div className="progress">
                    <p className="progress__num">
                      {t('vikas.progress')}: <strong>{d.progress ?? 0}%</strong>
                    </p>
                    <Furrow value={d.progress} large label={`${t('vikas.progress')}: ${d.progress ?? 0}%`} />
                  </div>

                  <dl className="facts">
                    <Money p={d} />
                    <Fact label={t('vikas.source')}>{d.fundingSource && L(d.fundingSource)}</Fact>
                    <Fact label={t('vikas.agency')}>{d.agency && L(d.agency)}</Fact>
                    <Fact label={t('vikas.start')}>{date(d.startDate)}</Fact>
                    <Fact label={t('vikas.expected')}>{d.phase !== 'completed' && date(d.expectedEnd)}</Fact>
                    <Fact label={t('vikas.done')}>{date(d.completedOn)}</Fact>
                  </dl>
                  <p className="small muted note">{(d.budgetAllocated != null || d.budgetSpent != null) && t('vikas.budgetNote')}</p>

                  <p className="detail__actions">
                    {d.sanctionDoc && (
                      <a className="btn btn--ghost btn--small" href={d.sanctionDoc} target="_blank" rel="noopener noreferrer">
                        {t('vikas.sanctionDoc')}
                      </a>
                    )}
                    {d.location?.lat != null && (
                      <Link className="btn btn--ghost btn--small" to={`/vikas/map?focus=${d._id}`}>
                        {t('vikas.viewOnMap')}
                      </Link>
                    )}
                    <ShareButton title={L(d.title)} />
                  </p>

                  {d.details && (
                    <section className="detail__block">
                      <Prose text={L(d.details)} />
                    </section>
                  )}

                  {pairs > 0 && (
                    <section className="detail__block">
                      <h2>
                        {t('vikas.before')} / {t('vikas.after')}
                      </h2>
                      {Array.from({ length: pairs }, (_, i) => (
                        <BeforeAfter key={before[i].url} before={before[i]} after={after[i]} />
                      ))}
                    </section>
                  )}

                  {updates.length > 0 && (
                    <section className="detail__block">
                      <h2>{t('vikas.updates')}</h2>
                      <ol className="updates">
                        {updates.map((u) => (
                          <li key={u._id ?? `${u.date}${u.progress}`} className="updates__item">
                            <Meta className="updates__when" items={[date(u.date), u.progress != null && <strong key="p">{u.progress}%</strong>]} />
                            <p>{L(u.note)}</p>
                          </li>
                        ))}
                      </ol>
                    </section>
                  )}

                  {gallery.length > 0 && (
                    <section className="detail__block">
                      <h2>{t('vikas.photos')}</h2>
                      <Gallery photos={gallery} title={L(d.title)} />
                    </section>
                  )}
                </article>
              );
            }}
          </Async>
        </div>
      </div>
    </>
  );
}
