import { useParams } from 'react-router';
import { Link } from '../lib/nav.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useFetch } from '../lib/api.js';
import { Async, BackLink, Meta, PageHead, Pager, Photo, ShareButton, useTitle } from '../components/ui.jsx';
import { SearchBox, useListParams } from '../components/filters.jsx';
import { Gallery as PhotoGrid } from '../components/Lightbox.jsx';

/** One heading per year; albums are already sorted newest first by the server. */
function byYear(items) {
  const groups = [];
  for (const a of items) {
    const last = groups[groups.length - 1];
    if (last?.year === a.year) last.items.push(a);
    else groups.push({ year: a.year, items: [a] });
  }
  return groups;
}

export function Albums() {
  const { t, L, fmtNum } = useI18n();
  useTitle(t('gallery.title'));
  const p = useListParams();
  const res = useFetch('/public/content/albums', { q: p.get('q'), page: p.page, limit: 24 });

  return (
    <>
      <PageHead module="sanskriti" title={t('gallery.title')} intro={t('gallery.intro')} />
      <div className="page">
        <div className="wrap">
          <div className="toolbar">
            <SearchBox value={p.get('q')} onChange={(q) => p.set({ q })} placeholder={t('common.searchPh')} />
          </div>
          <Async res={res} empty={(d) => d.items.length === 0} emptyText={p.get('q') ? t('common.nothingFound') : undefined}>
            {(d) => (
              <>
                {byYear(d.items).map((g) => (
                  <section key={g.year} className="year" aria-labelledby={`a${g.year}`}>
                    <h2 id={`a${g.year}`} className="year__label">
                      {g.year}
                    </h2>
                    <ul className="albums">
                      {g.items.map((a) => (
                        <li key={a._id}>
                          <Link className="album" to={`/sanskriti/gallery/${a._id}`}>
                            <Photo img={a.cover} seed={a._id} alt="" ratio="4 / 3" />
                            <h3 className="album__title">{L(a.title)}</h3>
                            <Meta items={[a.event && L(a.event), t('gallery.count', { n: fmtNum(a.photoCount ?? 0) })]} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
                <Pager page={d.page} pages={d.pages} onPage={(page) => p.set({ page })} />
              </>
            )}
          </Async>
        </div>
      </div>
    </>
  );
}

export function AlbumDetail() {
  const { id } = useParams();
  const { t, L, fmtNum } = useI18n();
  const res = useFetch(`/public/content/albums/${id}`);
  useTitle(res.data ? L(res.data.title) : null);

  return (
    <>
      <PageHead module="sanskriti" as="p" title={t('gallery.title')} />
      <div className="page">
        <div className="wrap">
          <BackLink to="/sanskriti/gallery">{t('nav.gallery')}</BackLink>
          <Async res={res}>
            {(d) => (
              <article>
                <h1 className="detail__title">{L(d.title)}</h1>
                <p className="detail__meta">
                  <span>{d.year}</span>
                  {d.event && <span>{L(d.event)}</span>}
                  <span>{t('gallery.count', { n: fmtNum(d.photos?.length ?? 0) })}</span>
                </p>
                <PhotoGrid photos={d.photos ?? []} title={L(d.title)} />
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
