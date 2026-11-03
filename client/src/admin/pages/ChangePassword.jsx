import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../../lib/api.js';
import { useA } from '../useA.js';
import { useSession } from '../session.jsx';
import { CheckField, TextField } from '../../components/forms.jsx';

export default function ChangePassword({ forced = false }) {
  const { a } = useA();
  const { user, setUser } = useSession();
  const navigate = useNavigate();
  const [v, setV] = useState({ currentPassword: '', newPassword: '', again: '' });
  const [show, setShow] = useState(false);
  const [state, setState] = useState({ busy: false, issues: {}, error: null, done: false });
  const set = (k) => (e) => setV((o) => ({ ...o, [k]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (v.newPassword !== v.again) {
      setState({ busy: false, issues: { again: a('pw.mismatch') }, error: null, done: false });
      return;
    }
    setState({ busy: true, issues: {}, error: null, done: false });
    try {
      const { user: updated } = await api.post('/auth/change-password', { currentPassword: v.currentPassword, newPassword: v.newPassword });
      setUser(updated);
      setState({ busy: false, issues: {}, error: null, done: true });
      if (forced) navigate('/admin', { replace: true });
    } catch (error) {
      const issues = {};
      for (const i of error.issues ?? []) issues[i.path] ??= i.message;
      setState({ busy: false, issues, error, done: false });
    }
  };

  const type = show ? 'text' : 'password';
  return (
    <div className={forced ? 'signin' : 'adm-page'}>
      <div className={forced ? 'signin__card' : ''}>
        <h1 className={forced ? 'signin__title' : 'adm-title'}>{a('pw.title')}</h1>
        {forced && <p className="alert alert--warn">{a('pw.forced', { name: user?.name ?? '' })}</p>}
        <p className="small muted pw__rules">{a('pw.rules')}</p>
        {state.done && (
          <p className="alert" role="status">
            {a('pw.done')}
          </p>
        )}
        <form className="form" onSubmit={onSubmit} noValidate>
          <TextField label={a('pw.current')} type={type} autoComplete="current-password" value={v.currentPassword} onChange={set('currentPassword')} error={state.issues.currentPassword} />
          <TextField label={a('pw.new')} type={type} autoComplete="new-password" value={v.newPassword} onChange={set('newPassword')} error={state.issues.newPassword} />
          <TextField label={a('pw.again')} type={type} autoComplete="new-password" value={v.again} onChange={set('again')} error={state.issues.again} />
          <CheckField checked={show} onChange={(e) => setShow(e.target.checked)}>
            {a('login.show')}
          </CheckField>
          {state.error && !Object.keys(state.issues).length && (
            <p className="alert alert--error" role="alert">
              {a('pw.failed')}
            </p>
          )}
          <div>
            <button type="submit" className="btn btn--primary" disabled={state.busy || !v.currentPassword || !v.newPassword}>
              {state.busy ? a('common.saving') : a('pw.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
