import { useState } from 'react';
import { Link } from 'react-router';
import { useA } from '../useA.js';
import { useSession } from '../session.jsx';
import { CheckField, TextField } from '../../components/forms.jsx';
import { useSettings } from '../../lib/settings.jsx';
import { Leaf } from '../../components/Layout.jsx';

export default function Login() {
  const { a, L, lang, setLang } = useA();
  const { login } = useSession();
  const settings = useSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [state, setState] = useState({ busy: false, error: null });

  const onSubmit = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: null });
    try {
      await login(email, password);
    } catch (error) {
      setState({ busy: false, error });
    }
  };

  const code = state.error?.code;
  const message = !state.error
    ? null
    : code === 'BAD_CREDENTIALS'
      ? a('login.bad')
      : code === 'LOCKED'
        ? a('login.locked')
        : code === 'RATE_LIMITED'
          ? a('login.rate')
          : code === 'NETWORK'
            ? a('login.network')
            : a('login.failed');

  return (
    <div className="signin">
      <div className="signin__card">
        <div className="signin__brand">
          <Leaf className="signin__leaf" />
          <div>
            <p className="signin__name">{L(settings.villageName)}</p>
            <p className="small muted">{a('login.subtitle')}</p>
          </div>
        </div>
        <h1 className="signin__title">{a('login.title')}</h1>
        <form className="form" onSubmit={onSubmit} noValidate>
          <TextField label={a('login.email')} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          <TextField
            label={a('login.password')}
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <CheckField checked={show} onChange={(e) => setShow(e.target.checked)}>
            {a('login.show')}
          </CheckField>
          {message && (
            <p className="alert alert--error" role="alert">
              {message}
            </p>
          )}
          <button type="submit" className="btn btn--primary" disabled={state.busy || !email || !password}>
            {state.busy ? a('login.busy') : a('login.submit')}
          </button>
        </form>
        <p className="signin__foot small">
          <Link to="/">{a('login.backToSite')}</Link>
          <button type="button" className="linklike" onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')}>
            {lang === 'hi' ? 'English' : 'हिन्दी'}
          </button>
        </p>
        <p className="small muted">{a('login.forgot')}</p>
      </div>
    </div>
  );
}
