import { useState } from 'react';
import { api, useFetch } from '../../lib/api.js';
import { Async, Meta, Pager } from '../../components/ui.jsx';
import { CopyButton, SelectField, TextField } from '../../components/forms.jsx';
import { useA } from '../useA.js';
import { useSession } from '../session.jsx';
import { issueMap } from '../formModel.js';

/** The temporary password is shown exactly once: the server does not keep it in readable form. */
function TempPassword({ info, onClose }) {
  const { a } = useA();
  return (
    <div className="alert alert--warn" role="status">
      <p>
        <strong>{info.user.name}</strong> ({info.user.phone || info.user.email})
      </p>
      <p>{a('users.tempShown')}</p>
      <p className="temp" translate="no">
        {info.tempPassword}
      </p>
      <p className="small">{a('users.tempHelp')}</p>
      <div className="adm-actions">
        <CopyButton text={info.tempPassword} />
        <button type="button" className="btn btn--ghost btn--small" onClick={onClose}>
          {a('common.close')}
        </button>
      </div>
    </div>
  );
}

function AddUser({ onCreated }) {
  const { a, err } = useA();
  const { isSuper } = useSession();
  const [v, setV] = useState({ name: '', phone: '', email: '', role: 'villager', tola: '' });
  const [state, setState] = useState({ sending: false, issues: {}, problem: null });
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setState({ sending: true, issues: {}, problem: null });
    try {
      const res = await api.post('/admin/users', isSuper ? v : { ...v, role: 'villager' });
      setV({ name: '', phone: '', email: '', role: 'villager', tola: '' });
      setState({ sending: false, issues: {}, problem: null });
      onCreated(res);
    } catch (error) {
      setState({ sending: false, issues: issueMap(error.issues), problem: error.message });
    }
  };
  return (
    <form className="adm-card form" onSubmit={submit} noValidate>
      <h2>{a('users.add')}</h2>
      <TextField label={a('users.name')} value={v.name} onChange={set('name')} error={state.issues.name} required maxLength={100} />
      <div className="form__row form__row--2">
        <TextField label={a('users.phone')} hint={a('users.idHelp')} value={v.phone} onChange={set('phone')} error={state.issues.phone} type="tel" inputMode="tel" maxLength={20} />
        <TextField label={a('users.email')} value={v.email} onChange={set('email')} error={state.issues.email} type="email" maxLength={160} />
      </div>
      {isSuper && (
        <SelectField
          label={a('users.role')}
          value={v.role}
          onChange={set('role')}
          options={['villager', 'admin', 'superadmin'].map((r) => ({ value: r, label: a(`role.${r}`) }))}
          hint={a('users.roleHelp')}
        />
      )}
      {v.role === 'villager' && <TextField label={a('users.tola')} value={v.tola} onChange={set('tola')} maxLength={100} />}
      {state.problem && (
        <p className="alert alert--error" role="alert">
          {err(state.problem)}
        </p>
      )}
      <button type="submit" className="btn btn--primary" disabled={state.sending}>
        {a('users.create')}
      </button>
    </form>
  );
}

/** Approve or reject a new villager. Rejecting needs a reason the person will read. */
function Verify({ u, onDone }) {
  const { a, err } = useA();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState(null);
  const send = async (decision) => {
    setProblem(null);
    try {
      await api.post(`/admin/users/${u.id}/verify`, { decision, reason: decision === 'reject' ? reason : undefined });
      onDone();
    } catch (e) {
      setProblem(e.issues?.[0]?.message || e.message);
    }
  };
  if (rejecting) {
    return (
      <div className="urow__reject">
        <TextField label={a('users.rejectReason')} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} autoFocus />
        <div className="adm-actions">
          <button type="button" className="btn btn--danger btn--small" onClick={() => send('reject')}>
            {a('users.reject')}
          </button>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setRejecting(false)}>
            {a('common.cancel')}
          </button>
        </div>
        {problem && <p className="field__error">{err(problem)}</p>}
      </div>
    );
  }
  return (
    <>
      <button type="button" className="btn btn--primary btn--small" onClick={() => send('approve')}>
        {a('users.approve')}
      </button>
      <button type="button" className="btn btn--ghost btn--small" onClick={() => setRejecting(true)}>
        {a('users.reject')}
      </button>
      {problem && <p className="field__error">{err(problem)}</p>}
    </>
  );
}

function UserRow({ u, me, isSuper, onChanged, onTemp }) {
  const { a, dt, err } = useA();
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState(null);
  const self = u.id === me.id;
  const patch = async (body) => {
    setProblem(null);
    try {
      await api.patch(`/admin/users/${u.id}`, body);
      onChanged();
    } catch (e) {
      setProblem(e.message);
    }
  };
  const reset = async () => {
    setAsking(false);
    try {
      onTemp(await api.post(`/admin/users/${u.id}/reset-password`));
      onChanged();
    } catch (e) {
      setProblem(e.message);
    }
  };
  const roleTargets = ['villager', 'admin', 'superadmin'].filter((r) => r !== u.role);
  const roleLabel = { villager: 'users.makeVillager', admin: 'users.makeAdmin', superadmin: 'users.makeSuper' };
  return (
    <li className="urow">
      <div className="urow__who">
        <p className="urow__name">
          {u.name} {self && <span className="badge">{a('users.you')}</span>}
          {!u.active && <span className="badge badge--rejected">{a('users.off')}</span>}
          {u.role === 'villager' && <span className={`badge badge--${u.status === 'active' ? 'published' : u.status}`}>{a(`users.status.${u.status}`)}</span>}
        </p>
        <p className="small" translate="no">
          {[u.phone, u.email].filter(Boolean).join(' · ')}
        </p>
        <Meta
          items={[
            a(`role.${u.role}`),
            u.tola && `${a('users.tola')}: ${u.tola}`,
            u.livesIn === 'outside' && u.place && a('users.outside', { place: u.place }),
            a('users.registered', { date: dt(u.createdAt) }),
            u.verifiedBy && a('users.verifiedBy', { name: u.verifiedBy }),
            `${a('users.lastLogin')}: ${u.lastLoginAt ? dt(u.lastLoginAt) : '—'}`,
          ]}
        />
        {u.status === 'rejected' && u.rejectReason && <p className="small">{u.rejectReason}</p>}
        {u.mustChangePassword && <p className="small muted">{a('users.mustChange')}</p>}
      </div>
      {!self && (
        <div className="urow__actions adm-actions">
          {u.role === 'villager' && u.status !== 'active' && <Verify u={u} onDone={onChanged} />}
          <button type="button" className="btn btn--ghost btn--small" onClick={() => patch({ active: !u.active })}>
            {u.active ? a('users.deactivate') : a('users.activate')}
          </button>
          {isSuper &&
            roleTargets.map((r) => (
              <button key={r} type="button" className="btn btn--ghost btn--small" onClick={() => patch({ role: r })}>
                {a(roleLabel[r])}
              </button>
            ))}
          {asking ? (
            <span className="adm-actions">
              <span className="small">{a('users.resetAsk', { name: u.name })}</span>
              <button type="button" className="btn btn--danger btn--small" onClick={reset}>
                {a('users.resetYes')}
              </button>
              <button type="button" className="btn btn--ghost btn--small" onClick={() => setAsking(false)}>
                {a('common.cancel')}
              </button>
            </span>
          ) : (
            <button type="button" className="btn btn--ghost btn--small" onClick={() => setAsking(true)}>
              {a('users.reset')}
            </button>
          )}
          {problem && <p className="field__error">{err(problem)}</p>}
        </div>
      )}
    </li>
  );
}

export default function Users() {
  const { a } = useA();
  const { user: me, isSuper } = useSession();
  const [kind, setKind] = useState('villagers');
  const [status, setStatus] = useState('pending');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const [temp, setTemp] = useState(null);
  const res = useFetch('/admin/users', { kind, status: kind === 'staff' ? 'all' : status, q: q.trim() || undefined, page, tick });
  const reload = () => setTick((n) => n + 1);

  return (
    <div className="adm-page">
      <h1>{isSuper ? a('nav.users') : a('nav.villagers')}</h1>
      {res.data?.pending > 0 && (
        <p className="alert alert--warn" role="status">
          {a('users.pendingCount', { n: res.data.pending })}
        </p>
      )}
      {temp && <TempPassword info={temp} onClose={() => setTemp(null)} />}

      {isSuper && (
        <div className="chips" role="group" aria-label={a('nav.users')}>
          {['villagers', 'staff'].map((k) => (
            <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => { setKind(k); setPage(1); }}>
              {a(`users.tab.${k}`)}
            </button>
          ))}
        </div>
      )}
      {kind === 'villagers' && (
        <>
          <p className="small muted">{a('users.verifyHelp')}</p>
          <div className="chips" role="group" aria-label={a('list.status')}>
            {['pending', 'active', 'rejected', 'all'].map((k) => (
              <button key={k} type="button" className="chip" aria-pressed={status === k} onClick={() => { setStatus(k); setPage(1); }}>
                {a(`users.status.${k}`)}
              </button>
            ))}
          </div>
        </>
      )}
      <label className="vh" htmlFor="user-q">
        {a('users.search')}
      </label>
      <input id="user-q" className="input" type="search" placeholder={a('users.search')} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />

      <Async res={res} empty={(d) => d.items.length === 0} emptyText={a('users.none')}>
        {(d) => (
          <>
            <ul className="adm-rows">
              {d.items.map((u) => (
                <UserRow key={u.id} u={u} me={me} isSuper={isSuper} onChanged={reload} onTemp={setTemp} />
              ))}
            </ul>
            <Pager page={d.page} pages={d.pages} onPage={setPage} />
          </>
        )}
      </Async>

      <AddUser
        onCreated={(r) => {
          setTemp(r);
          reload();
        }}
      />
    </div>
  );
}
