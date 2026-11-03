import { useState } from 'react';
import { api, useFetch } from '../../lib/api.js';
import { Async, Meta } from '../../components/ui.jsx';
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
        <strong>{info.user.name}</strong> ({info.user.email})
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
  const [v, setV] = useState({ name: '', email: '', role: 'editor' });
  const [state, setState] = useState({ busy: false, issues: {}, problem: null });
  const set = (k) => (e) => setV((o) => ({ ...o, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, issues: {}, problem: null });
    try {
      const result = await api.post('/admin/users', v);
      setV({ name: '', email: '', role: 'editor' });
      setState({ busy: false, issues: {}, problem: null });
      onCreated(result);
    } catch (error) {
      setState({ busy: false, issues: issueMap(error), problem: error.code === 'VALIDATION' ? null : error.message });
    }
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <h2>{a('users.add')}</h2>
      <TextField label={a('users.name')} value={v.name} onChange={set('name')} error={state.issues.name} maxLength={100} />
      <TextField label={a('users.email')} type="email" value={v.email} onChange={set('email')} error={state.issues.email} maxLength={160} />
      <SelectField
        label={a('users.role')}
        value={v.role}
        onChange={set('role')}
        options={[
          { value: 'editor', label: a('role.editor') },
          { value: 'superadmin', label: a('role.superadmin') },
        ]}
        hint={a('users.roleHelp')}
      />
      {state.problem && (
        <p className="alert alert--error" role="alert">
          {err(state.problem)}
        </p>
      )}
      <div>
        <button type="submit" className="btn btn--primary" disabled={state.busy}>
          {state.busy ? a('common.saving') : a('users.create')}
        </button>
      </div>
    </form>
  );
}

export default function Users() {
  const { a, dt, err } = useA();
  const { user: me } = useSession();
  const res = useFetch('/admin/users');
  const [temp, setTemp] = useState(null);
  const [problem, setProblem] = useState(null);
  const [asking, setAsking] = useState(null); // id of the user whose password reset is waiting for a "yes"

  const patch = async (u, body) => {
    setProblem(null);
    try {
      await api.patch(`/admin/users/${u.id}`, body);
      res.reload();
    } catch (error) {
      setProblem(error.message);
    }
  };
  const reset = async (u) => {
    setAsking(null);
    setProblem(null);
    try {
      setTemp(await api.post(`/admin/users/${u.id}/reset-password`));
      res.reload();
    } catch (error) {
      setProblem(error.message);
    }
  };

  return (
    <div className="adm-page">
      <h1 className="adm-title">{a('nav.users')}</h1>
      {temp && <TempPassword info={temp} onClose={() => setTemp(null)} />}
      {problem && (
        <p className="alert alert--error" role="alert">
          {err(problem)}
        </p>
      )}
      <Async res={res}>
        {(d) => (
          <ul className="adm-rows">
            {d.items.map((u) => {
              const self = u.id === me.id;
              return (
                <li key={u.id} className={`urow${u.active ? '' : ' is-off'}`}>
                  <div className="urow__main">
                    <p>
                      <strong>{u.name}</strong>
                      {!u.active && <span className="badge badge--rejected">{a('users.off')}</span>}
                    </p>
                    <p className="small muted urow__email" translate="no">
                      {u.email}
                    </p>
                    <Meta items={[a(`role.${u.role}`), `${a('users.lastLogin')}: ${u.lastLoginAt ? dt(u.lastLoginAt) : '—'}`]} />
                    {u.mustChangePassword && <p className="small muted">{a('users.mustChange')}</p>}
                  </div>
                  <div className="urow__act">
                    {self && <span className="small muted">{a('users.you')}</span>}
                    {!self && asking === u.id && (
                      <>
                        <p className="small urow__ask">{a('users.resetAsk', { name: u.name })}</p>
                        <button type="button" className="btn btn--danger btn--small" onClick={() => reset(u)}>
                          {a('users.resetYes')}
                        </button>
                        <button type="button" className="btn btn--ghost btn--small" onClick={() => setAsking(null)}>
                          {a('common.cancel')}
                        </button>
                      </>
                    )}
                    {!self && asking !== u.id && (
                      <>
                        <button type="button" className="btn btn--ghost btn--small" onClick={() => patch(u, { active: !u.active })}>
                          {u.active ? a('users.deactivate') : a('users.activate')}
                        </button>
                        <button type="button" className="btn btn--ghost btn--small" onClick={() => patch(u, { role: u.role === 'editor' ? 'superadmin' : 'editor' })}>
                          {u.role === 'editor' ? a('users.makeSuper') : a('users.makeEditor')}
                        </button>
                        <button type="button" className="btn btn--ghost btn--small" onClick={() => setAsking(u.id)}>
                          {a('users.reset')}
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Async>
      <section className="adm-block">
        <AddUser onCreated={(r) => { setTemp(r); res.reload(); }} />
      </section>
    </div>
  );
}
