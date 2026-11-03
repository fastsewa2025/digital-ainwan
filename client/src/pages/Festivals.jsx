import { Link } from 'react-router';
import { useI18n } from '../lib/i18n.jsx';
import { useFetch } from '../lib/api.js';
import { Async, PageHead, Pager, Photo, useTitle } from '../components/ui.jsx';
import { Chips, SearchBox, useListParams } from '../components/filters.jsx';

const KINDS = ['festival', 'mela', 'event', 'other'];

const yearOf = (d) => new Date(d).getUTCFullYear();

/** Splits the (newest first) list into one block per year, so it reads as a timeline. */
function byYear(items) {
  const groups = [];
  for (const item of items) {
    const y = yearOf(item.date);
    const last = groups[groups.length - 1];
    if (last?.year === y) last.items.push(item);
    else groups.push({ year: y, items: [item] });
  }
  return groups;
}

function Row({ f }) {
  const { t, L, fmtDate } = useI18n();
  return (
    <li>
      <Link className="trow" to={`/sanskriti/festivals/${f._id}`}>
        <div className="trow__when">
          <time dateTime={f.date}>{fmtDate(f.date, { day: 'numeric', month: 'long' })}</time>
          <span className="muted small">{t(`festivals.kind.${f.kind}`)}</span>
        </div>
        <div className="trow__body">
          <h3 className="trow__title">{L(f.title)}</h3>
          {f.location && <p className="muted small">{L(f.location)}</p>}
          {f.summary && <p className="trow__text">{L(f.summary)}</p>}
          {f.photoCount > 0 && (
            <p className="small muted">
              {f.photoCount} {t('common.photos')}
            </p>
          )}
        </div>
        <Photo img={f.cover} seed={f._id} alt="" ratio="4 / 3" className="trow__photo" />
      </Link>
    </li>
  );
}

export default function Festivals() {
  const { t } = useI18n();
  useTitle(t('festivals.title'));
  const p = useListParams();
  const res = useFetch('/public/content/festivals', { kind: p.get('kind'), q: p.get('q'), page: p.page, limit: 20 });

  return (
    <>
      <PageHead module="sanskriti" title={t('festivals.title')} intro={t('festivals.intro')} />
      <div className="page">
        <div className="wrap">
          <div className="toolbar">
            <SearchBox value={p.get('q')} onChange={(q) => p.set({ q })} placeholder={t('common.searchPh')} />
          </div>
          <Chips
            label={t('common.type')}
            value={p.get('kind')}
            onChange={(kind) => p.set({ kind })}
            options={KINDS.map((k) => ({ value: k, label: t(`festivals.kind.${k}`) }))}
          />
          <Async res={res} empty={(d) => d.items.length === 0} emptyText={t('common.nothingFound')}>
            {(d) => (
              <>
                {byYear(d.items).map((g) => (
                  <section key={g.year} className="year" aria-labelledby={`y${g.year}`}>
                    <h2 id={`y${g.year}`} className="year__label">
                      {g.year}
                    </h2>
                    <ul className="trows">
                      {g.items.map((f) => (
                        <Row key={f._id} f={f} />
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
