import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { api, useFetch } from '../../lib/api.js';
import { Async, Pager } from '../../components/ui.jsx';
import { SearchBox, useListParams } from '../../components/filters.jsx';
import { useA } from '../useA.js';
import { useMeta } from '../meta.jsx';
import { useSession } from '../session.jsx';
import { StatusBadge } from '../StatusBadge.jsx';

const STATUS_TABS = ['all', 'pending', 'draft', 'published', 'rejected'];

/** Short text that identifies a row, whatever the content type is. */
function titleOf(def, item, L) {
  const v = item[def.titleField];
  return typeof v === 'string' ? v : L(v) || '—';
}

/** A short line under the title: the type/phase and the date, taken from the field descriptions. */
function summaryOf(def, item, pick, fmtDate) {
  const parts = [];
  const select = Object.entries(def.fields).find(([, d]) => d.kind === 'select');
  if (select) {
    const [key, d] = select;
    const opt = d.options.find((o) => o.value === item[key]);
    if (opt) parts.push(pick(opt.label));
  }
  if (item.phase === 'in-progress' && item.progress != null) parts.push(`${item.progress}%`);
  const date = Object.keys(def.fields).find((k) => def.fields[k].kind === 'date' && item[k]);
  if (date) parts.push(fmtDate(item[date]));
  return parts;
}

export default function ResourceList() {
  const { resource } = useParams();
  const { a, pick, L, dt, fmtDate, err } = useA();
  const { isSuper } = useSession();
  const meta = useMeta();
  const def = meta.resources[resource];
  const p = useListParams();
  const [busy, setBusy] = useState(null);
  const [problem, setProblem] = useState(null);
  const status = p.get('status') || 'all';
  const res = useFetch(def ? `/admin/resources/${resource}` : null, { status, q: p.get('q'), page: p.page, limit: 25 });

  if (!def) return <p className="adm-page alert alert--error">404</p>;

  const publish = async (item) => {
    setBusy(item._id);
    setProblem(null);
    try {
      await api.post(`/admin/resources/${resource}/${item._id}/status`, { status: 'published' });
      res.reload();
    } catch (error) {
      setProblem(error.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="adm-page">
      <div className="adm-head">
        <h1 className="adm-title">{pick(def.label)}</h1>
        <Link className="btn btn--primary" to={`/admin/content/${resource}/new`}>
          {a('common.new')}
        </Link>
      </div>

      <div className="toolbar">
        <SearchBox value={p.get('q')} onChange={(q) => p.set({ q })} placeholder={a('list.searchPh')} />
      </div>
      <div className="chips" role="group" aria-label={a('list.status')}>
        {STATUS_TABS.map((s) => (
          <button key={s} type="button" className="chip" aria-pressed={status === s} onClick={() => p.set({ status: s === 'all' ? '' : s })}>
            {a(`status.${s}`)}
            {res.data?.counts && s !== 'all' && <span className="chip__n"> {res.data.counts[s] ?? 0}</span>}
          </button>
        ))}
      </div>
      {problem && (
        <p className="alert alert--error" role="alert">
          {err(problem)}
        </p>
      )}

      <Async res={res} empty={(d) => d.items.length === 0} emptyText={a('list.empty')}>
        {(d) => (
          <>
            <ul className="adm-rows">
              {d.items.map((item) => (
                <li key={item._id} className="adm-item">
                  <Link className="adm-row" to={`/admin/content/${resource}/${item._id}`}>
                    <span className="adm-row__main">
                      <strong>{titleOf(def, item, L)}</strong>
                      <span className="meta">
                        {summaryOf(def, item, pick, fmtDate).map((x) => (
                          <span key={x}>{x}</span>
                        ))}
                      </span>
                    </span>
                    <span className="adm-row__side">
                      <StatusBadge status={item.status} />
                      {item.source === 'public' && <span className="small muted">{a('list.fromPublic')}</span>}
                      <span className="small muted">{dt(item.updatedAt)}</span>
                    </span>
                  </Link>
                  {isSuper && (item.status === 'pending' || item.status === 'draft') && (
                    <div className="adm-item__act">
                      <button type="button" className="btn btn--primary btn--small" disabled={busy === item._id} onClick={() => publish(item)}>
                        {a('form.publish')}
                      </button>
                    </div>
                  )}
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
