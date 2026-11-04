import { useI18n } from '../lib/i18n.jsx';
import { useFetch } from '../lib/api.js';
import { Async, Meta, PageHead, Pager, Photo, useTitle } from '../components/ui.jsx';
import { useListParams } from '../components/filters.jsx';

/** Today's calendar date as the visitor sees it, expressed as UTC midnight (deadlines are stored that way). */
const todayUtc = () => {
  const n = new Date();
  return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
};
const daysLeft = (deadline) => Math.round((new Date(deadline).getTime() - todayUtc()) / 86_400_000);

/** Open deadlines first (soonest on top), then ones with no date, and expired ones at the bottom. */
function byDeadline(items) {
  const rank = (i) => {
    if (!i.deadline) return 1;
    return daysLeft(i.deadline) >= 0 ? 0 : 2;
  };
  return [...items].sort((a, b) => rank(a) - rank(b) || (a.deadline && b.deadline ? new Date(a.deadline) - new Date(b.deadline) : 0));
}

function Deadline({ date }) {
  const { t, fmtDate } = useI18n();
  const left = daysLeft(date);
  const status = left < 0 ? t('youth.closed') : left === 0 ? t('youth.today') : t('youth.daysLeft', { n: left });
  return (
    <p className={`deadline${left < 0 ? ' deadline--closed' : left <= 7 ? ' deadline--soon' : ''}`}>
      <span>{t('youth.deadline', { date: fmtDate(date) })}</span>
      <strong>{status}</strong>
    </p>
  );
}

function Opportunity({ item }) {
  const { t, L } = useI18n();
  return (
    <li className="opp">
      <h3 className="opp__title">{L(item.title)}</h3>
      {item.subtitle && <p className="small muted">{L(item.subtitle)}</p>}
      {item.summary && <p className="opp__text">{L(item.summary)}</p>}
      {item.deadline && <Deadline date={item.deadline} />}
      {item.link && (
        <p>
          <a className="btn btn--ghost btn--small" href={item.link} target="_blank" rel="noopener noreferrer">
            {t('common.link')}
          </a>
        </p>
      )}
    </li>
  );
}

function Toppers({ items }) {
  const { L } = useI18n();
  return (
    <ul className="faces">
      {items.map((p) => (
        <li key={p._id} className="face">
          <Photo img={p.photo} seed={p._id} alt={L(p.title)} ratio="1 / 1" className="face__photo" />
          <h3 className="face__name">{L(p.title)}</h3>
          <Meta className="face__meta" items={[p.subtitle && L(p.subtitle), p.year]} />
          {p.summary && <p className="face__line">{L(p.summary)}</p>}
        </li>
      ))}
    </ul>
  );
}

export default function Youth() {
  const { t } = useI18n();
  useTitle(t('youth.title'));
  const p = useListParams();
  const res = useFetch('/public/content/youth', { page: p.page, limit: 100 });

  return (
    <>
      <PageHead module="sampark" title={t('youth.title')} intro={t('youth.intro')} />
      <div className="page">
        <div className="wrap">
          <Async res={res} empty={(d) => d.items.length === 0} emptyText={t('youth.empty')}>
            {(d) => {
              const of = (kind) => d.items.filter((i) => i.kind === kind);
              return (
                <>
                  {['scholarship', 'exam'].map((kind) => {
                    const items = byDeadline(of(kind));
                    return (
                      items.length > 0 && (
                        <section key={kind} className="detail__block">
                          <h2>{t(`youth.kind.${kind}`)}</h2>
                          <ul className="opps">
                            {items.map((i) => (
                              <Opportunity key={i._id} item={i} />
                            ))}
                          </ul>
                        </section>
                      )
                    );
                  })}
                  {of('resource').length > 0 && (
                    <section className="detail__block">
                      <h2>{t('youth.kind.resource')}</h2>
                      <ul className="opps">
                        {of('resource').map((i) => (
                          <Opportunity key={i._id} item={i} />
                        ))}
                      </ul>
                    </section>
                  )}
                  {of('topper').length > 0 && (
                    <section className="detail__block">
                      <h2>{t('youth.kind.topper')}</h2>
                      <Toppers items={of('topper')} />
                    </section>
                  )}
                  <Pager page={d.page} pages={d.pages} onPage={(page) => p.set({ page })} />
                </>
              );
            }}
          </Async>
        </div>
      </div>
    </>
  );
}
