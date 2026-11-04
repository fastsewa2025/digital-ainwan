import { useSearchParams } from 'react-router';
import { Link } from '../lib/nav.jsx';
import { useFetch } from '../lib/api.js';
import { useI18n } from '../lib/i18n.jsx';
import { Async, PageHead, useTitle } from '../components/ui.jsx';

// Where each kind of content lives on the website, and what to call it.
const ROUTES = {
  festivals: ['/sanskriti/festivals/', 'nav.festivals'],
  'oral-history': ['/sanskriti/oral-history/', 'nav.oral'],
  wiki: ['/sanskriti/wiki/', 'nav.wiki'],
  albums: ['/sanskriti/gallery/', 'nav.gallery'],
  projects: ['/vikas/projects/', 'nav.projects'],
  notices: ['/vikas/notices/', 'nav.notices'],
  fame: ['/sampark/fame/', 'nav.fame'],
  directory: ['/sampark/directory?q=', 'nav.directory'],
  youth: ['/sampark/youth?q=', 'nav.youth'],
};

export default function Search() {
  const { t, L } = useI18n();
  const [params] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const res = useFetch(q.length >= 2 ? '/public/search' : null, { q });
  useTitle(q ? t('search.results', { q }) : t('search.title'));
  return (
    <>
      <PageHead title={q ? t('search.results', { q }) : t('search.title')} share={false} />
      <div className="page">
        <div className="wrap wrap--narrow">
          {q.length < 2 ? (
            <p className="muted">{t('search.hint')}</p>
          ) : (
            <Async res={res} empty={(d) => d.groups.length === 0} emptyText={t('search.none', { q })}>
              {(d) => d.groups.map((g) => {
                const [base, label] = ROUTES[g.resource] ?? [];
                if (!base) return null;
                return (
                  <section key={g.resource} className="sgroup">
                    <h2>{t(label)}</h2>
                    <ul>
                      {g.items.map((i) => (
                        <li key={i.id}>
                          <Link to={base.endsWith('=') ? `${base}${encodeURIComponent(q)}` : `${base}${i.id}`}>{L(i.title)}</Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </Async>
          )}
        </div>
      </div>
    </>
  );
}
