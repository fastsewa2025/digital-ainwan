import { Link, useParams } from 'react-router';
import { useI18n } from '../lib/i18n.jsx';
import { useFetch } from '../lib/api.js';
import { Async, BackLink, Meta, PageHead, Pager, Photo, ShareButton, useTitle } from '../components/ui.jsx';
import { Chips, useListParams } from '../components/filters.jsx';
import { Prose } from '../components/Prose.jsx';

const FIELDS = ['sports', 'education', 'social', 'service', 'arts', 'science', 'business', 'other'];

export function Fame() {
  const { t, L } = useI18n();
  useTitle(t('fame.title'));
  const p = useListParams();
  const res = useFetch('/public/content/fame', { field: p.get('field'), page: p.page, limit: 24 });

  return (
    <>
      <PageHead module="sampark" title={t('fame.title')} intro={t('fame.intro')} />
      <div className="page">
        <div className="wrap">
          <Chips
            label={t('common.field')}
            value={p.get('field')}
            onChange={(field) => p.set({ field })}
            options={FIELDS.map((f) => ({ value: f, label: t(`fame.field.${f}`) }))}
          />
          <Async res={res} empty={(d) => d.items.length === 0} emptyText={p.get('field') ? t('common.nothingFound') : t('fame.empty')}>
            {(d) => (
              <>
                <ul className="faces faces--wall">
                  {d.items.map((person) => (
                    <li key={person._id}>
                      <Link className="face" to={`/sampark/fame/${person._id}`}>
                        <Photo img={person.photo} seed={person._id} alt="" ratio="1 / 1" className="face__photo" />
                        <h2 className="face__name">{L(person.name)}</h2>
                        <p className="face__line">{L(person.headline)}</p>
                        <Meta className="face__meta" items={[t(`fame.field.${person.field}`), person.year]} />
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

export function FameDetail() {
  const { id } = useParams();
  const { t, L } = useI18n();
  const res = useFetch(`/public/content/fame/${id}`);
  useTitle(res.data ? L(res.data.name) : null);

  return (
    <>
      <PageHead module="sampark" as="p" title={t('fame.title')} />
      <div className="page">
        <div className="wrap wrap--narrow">
          <BackLink to="/sampark/fame">{t('nav.fame')}</BackLink>
          <Async res={res}>
            {(d) => (
              <article className="person">
                <Photo img={d.photo} seed={d._id} alt={L(d.name)} ratio="1 / 1" full className="person__photo" />
                <div>
                  <h1 className="detail__title">{L(d.name)}</h1>
                  <p className="detail__meta">
                    <span>{t(`fame.field.${d.field}`)}</span>
                    {d.year && <span>{d.year}</span>}
                  </p>
                  <p className="detail__lead">{L(d.headline)}</p>
                </div>
                {d.bio && (
                  <section className="detail__block person__bio">
                    <h2>{t('fame.story')}</h2>
                    <Prose text={L(d.bio)} />
                  </section>
                )}
                <p className="detail__actions person__bio">
                  <ShareButton title={L(d.name)} />
                </p>
              </article>
            )}
          </Async>
        </div>
      </div>
    </>
  );
}
