import { Link, useParams } from 'react-router';
import { useI18n } from '../lib/i18n.jsx';
import { useFetch } from '../lib/api.js';
import { Async, BackLink, PageHead, Pager, Photo, ShareButton, useTitle } from '../components/ui.jsx';
import { Chips, SearchBox, useListParams } from '../components/filters.jsx';
import { Gallery } from '../components/Lightbox.jsx';
import { Prose } from '../components/Prose.jsx';

const CATS = ['customs', 'attire', 'food', 'art', 'other'];

export function Wiki() {
  const { t, L } = useI18n();
  useTitle(t('wiki.title'));
  const p = useListParams();
  const res = useFetch('/public/content/wiki', { category: p.get('category'), q: p.get('q'), page: p.page, limit: 12 });

  return (
    <>
      <PageHead module="sanskriti" title={t('wiki.title')} intro={t('wiki.intro')} />
      <div className="page">
        <div className="wrap">
          <div className="toolbar">
            <SearchBox value={p.get('q')} onChange={(q) => p.set({ q })} placeholder={t('common.searchPh')} />
          </div>
          <Chips
            label={t('common.category')}
            value={p.get('category')}
            onChange={(category) => p.set({ category })}
            options={CATS.map((c) => ({ value: c, label: t(`wiki.cat.${c}`) }))}
          />
          <Async res={res} empty={(d) => d.items.length === 0} emptyText={t('common.nothingFound')}>
            {(d) => (
              <>
                <ul className="arows">
                  {d.items.map((a) => (
                    <li key={a._id}>
                      <Link className="arow" to={`/sanskriti/wiki/${a._id}`}>
                        <Photo img={a.cover} seed={a._id} alt="" ratio="4 / 3" className="arow__photo" />
                        <div>
                          <p className="small muted">{t(`wiki.cat.${a.category}`)}</p>
                          <h2 className="arow__title">{L(a.title)}</h2>
                          {a.summary && <p className="arow__text">{L(a.summary)}</p>}
                        </div>
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

export function WikiDetail() {
  const { id } = useParams();
  const { t, L } = useI18n();
  const res = useFetch(`/public/content/wiki/${id}`);
  useTitle(res.data ? L(res.data.title) : null);

  return (
    <>
      <PageHead module="sanskriti" as="p" title={t('wiki.title')} />
      <div className="page">
        <div className="wrap wrap--narrow">
          <BackLink to="/sanskriti/wiki">{t('nav.wiki')}</BackLink>
          <Async res={res}>
            {(d) => (
              <article>
                <h1 className="detail__title">{L(d.title)}</h1>
                <p className="detail__meta">
                  <span>{t(`wiki.cat.${d.category}`)}</span>
                </p>
                {d.summary && <p className="detail__lead">{L(d.summary)}</p>}
                {d.body && (
                  <section className="detail__block">
                    <Prose text={L(d.body)} />
                  </section>
                )}
                {d.photos?.length > 0 && (
                  <section className="detail__block">
                    <h2>{t('common.photos')}</h2>
                    <Gallery photos={d.photos} title={L(d.title)} />
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
