import { useFetch } from '../../lib/api.js';
import { Async, Pager } from '../../components/ui.jsx';
import { useListParams } from '../../components/filters.jsx';
import { useA } from '../useA.js';

export default function Audit() {
  const { a, dt, fmtNum } = useA();
  const p = useListParams();
  const res = useFetch('/admin/audit', { page: p.page });

  return (
    <div className="adm-page">
      <h1 className="adm-title">{a('nav.audit')}</h1>
      <p className="small muted">{a('audit.help')}</p>
      <Async res={res} empty={(d) => d.items.length === 0} emptyText={a('audit.empty')}>
        {(d) => (
          <>
            <p className="small muted">{a('audit.total', { n: fmtNum(d.total) })}</p>
            <ul className="adm-rows adm-log">
              {d.items.map((e) => (
                <li key={e._id} className="logrow">
                  <div className="logrow__what">
                    <p>
                      <code>{e.action}</code>
                      {e.resource && <span className="small muted">{e.resource}</span>}
                    </p>
                    {e.summary && <p className="small logrow__sum">{e.summary}</p>}
                  </div>
                  <p className="logrow__who small">
                    <span>{e.userName || '—'}</span>
                    {e.ip && <span className="muted">{e.ip}</span>}
                  </p>
                  <p className="logrow__when small muted">{dt(e.at)}</p>
                </li>
              ))}
            </ul>
            <Pager page={d.page} pages={d.pages} onPage={(page) => p.set({ page })} />
          </>
        )}
      </Async>
    </div>
  );
}
