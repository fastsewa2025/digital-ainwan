import { Link } from 'react-router';
import { useFetch } from '../../lib/api.js';
import { Async } from '../../components/ui.jsx';
import { useA } from '../useA.js';
import { useMeta } from '../meta.jsx';
import { useSession } from '../session.jsx';

export default function Dashboard() {
  const { a, pick, dt, fmtNum } = useA();
  const { user, isSuper } = useSession();
  const meta = useMeta();
  const res = useFetch('/admin/dashboard');

  return (
    <div className="adm-page">
      <h1 className="adm-title">{a('dash.hello', { name: user.name })}</h1>
      <Async res={res}>
        {(d) => (
          <>
            {isSuper && d.newMessages > 0 && (
              <p className="alert">
                <Link to="/admin/inbox">{d.newMessages === 1 ? a('dash.newMessage1') : a('dash.newMessages', { n: d.newMessages })}</Link>
              </p>
            )}

            <section className="adm-block">
              <h2>{a('dash.queue')}</h2>
              {d.queue.length === 0 ? (
                <p className="muted">{a('dash.queueEmpty')}</p>
              ) : (
                <ul className="adm-rows">
                  {d.queue.map((q) => (
                    <li key={`${q.resource}${q.id}`}>
                      <Link className="adm-row" to={`/admin/content/${q.resource}/${q.id}`}>
                        <span className="adm-row__main">
                          <strong>{q.title}</strong>
                          <span className="small muted">{pick(meta.resources[q.resource]?.singular)}</span>
                        </span>
                        <span className="small muted adm-row__side">
                          {q.by && <span>{q.by}</span>}
                          <span>{dt(q.updatedAt)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {!isSuper && d.queue.length > 0 && <p className="small muted">{a('dash.queueEditor')}</p>}
            </section>

            <section className="adm-block">
              <h2>{a('dash.content')}</h2>
              <div className="adm-tablewrap">
                <table className="adm-table adm-table--counts">
                  <thead>
                    <tr>
                      <th scope="col">{a('dash.type')}</th>
                      <th scope="col" className="num">
                        {a('status.published')}
                      </th>
                      <th scope="col" className="num">
                        {a('status.pending')}
                      </th>
                      <th scope="col" className="num">
                        {a('status.draft')}
                      </th>
                      <th scope="col">
                        <span className="vh">{a('common.actions')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.counts.map((c) => (
                      <tr key={c.key}>
                        <th scope="row">
                          <Link to={`/admin/content/${c.key}`}>{pick(meta.resources[c.key].label)}</Link>
                        </th>
                        <td className="num">{fmtNum(c.published)}</td>
                        <td className="num">{c.pending > 0 ? <strong>{fmtNum(c.pending)}</strong> : 0}</td>
                        <td className="num">{fmtNum(c.draft)}</td>
                        <td className="adm-table__act">
                          <Link className="btn btn--ghost btn--small" to={`/admin/content/${c.key}/new`}>
                            {a('common.new')}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </Async>
    </div>
  );
}
