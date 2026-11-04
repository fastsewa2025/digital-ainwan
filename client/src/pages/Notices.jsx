import { useParams } from 'react-router';
import { Link } from '../lib/nav.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useFetch } from '../lib/api.js';
import { Async, BackLink, PageHead, Pager, ShareButton, useTitle } from '../components/ui.jsx';
import { Chips, SearchBox, useListParams } from '../components/filters.jsx';
import { Prose } from '../components/Prose.jsx';

const CATS = ['order', 'scheme', 'meeting', 'general'];

export function Notices() {
  const { t, L, fmtDate } = useI18n();
  useTitle(t('notices.title'));
  const p = useListParams();
  const res = useFetch('/public/content/notices', { category: p.get('category'), q: p.get('q'), page: p.page, limit: 20 });

  return (
    <>
      <PageHead module="vikas" title={t('notices.title')} intro={t('notices.intro')} />
      <div className="page">
        <div className="wrap">
          <div className="toolbar">
            <SearchBox value={p.get('q')} onChange={(q) => p.set({ q })} placeholder={t('common.searchPh')} />
          </div>
          <Chips
            label={t('common.category')}
            value={p.get('category')}
            onChange={(category) => p.set({ category })}
            options={CATS.map((c) => ({ value: c, label: t(`notices.cat.${c}`) }))}
          />
          <Async res={res} empty={(d) => d.items.length === 0} emptyText={p.get('q') || p.get('category') ? t('common.nothingFound') : t('notices.empty')}>
            {(d) => (
              <>
                <ul className="nrows">
                  {d.items.map((n) => (
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
                <Pager page={d.page} pages={d.pages} onPage={(page) => p.set({ page })} />
              </>
            )}
          </Async>
        </div>
      </div>
    </>
  );
}

export function NoticeDetail() {
  const { id } = useParams();
  const { t, L, fmtDate } = useI18n();
  const res = useFetch(`/public/content/notices/${id}`);
  useTitle(res.data ? L(res.data.title) : null);

  return (
    <>
      <PageHead module="vikas" as="p" title={t('notices.title')} />
      <div className="page">
        <div className="wrap wrap--narrow">
          <BackLink to="/vikas/notices">{t('nav.notices')}</BackLink>
          <Async res={res}>
            {(d) => (
              <article>
                <h1 className="detail__title">{L(d.title)}</h1>
                <p className="detail__meta">
                  <time dateTime={d.date}>{fmtDate(d.date)}</time>
                  <span>{t(`notices.cat.${d.category}`)}</span>
                </p>
                {d.body && (
                  <section className="detail__block">
                    <Prose text={L(d.body)} />
                  </section>
                )}
                <p className="detail__actions">
                  {d.attachment && (
                    <a className="btn btn--primary btn--small" href={d.attachment} target="_blank" rel="noopener noreferrer">
                      {t('common.pdf')}
                    </a>
                  )}
                  {d.link && (
                    <a className="btn btn--ghost btn--small" href={d.link} target="_blank" rel="noopener noreferrer">
                      {t('common.link')}
                    </a>
                  )}
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
