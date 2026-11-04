import { useId, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { Link, useLangNavigate } from '../lib/nav.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useSession } from '../lib/session.jsx';
import { useSettings } from '../lib/settings.jsx';
import { CheckField, HoneyPot, SubmitButton, TextField, useErrText } from '../components/forms.jsx';
import { PageHead, useNoIndex, useTitle } from '../components/ui.jsx';
import { Icon } from '../components/Icons.jsx';

/** Password box with a "show" button: typing on a phone keyboard without seeing it causes mistakes. */
export function PasswordField({ label, hint, error, autoComplete, value, onChange, required = true }) {
  const { t } = useI18n();
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="pwbox">
        <input
          id={id}
          className="input"
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          required={required}
          maxLength={128}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={[hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ') || undefined}
        />
        <button type="button" className="pwbox__toggle" onClick={() => setShow(!show)} aria-pressed={show} aria-controls={id}>
          {show ? t('auth.hide') : t('auth.show')}
        </button>
      </div>
      {hint && (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={`${id}-err`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Where to go after signing in: staff to the admin panel, everyone else to their account. */
function home(user, next) {
  const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
  if (safe?.startsWith('/admin')) return user.role === 'villager' ? '/account' : safe;
  return safe ?? (user.role === 'villager' ? '/account' : '/admin');
}

function AuthCard({ children }) {
  return (
    <div className="page">
      <div className="wrap wrap--narrow">
        <div className="authcard">{children}</div>
      </div>
    </div>
  );
}

export function Login() {
  const { t } = useI18n();
  const s = useSession();
  const settings = useSettings();
  const navigate = useLangNavigate();
  const [params] = useSearchParams();
  const next = params.get('next');
  const [v, setV] = useState({ login: '', password: '' });
  const [state, setState] = useState({ sending: false, problem: null });
  useTitle(t('auth.login.title'));
  useNoIndex();

  if (s.status === 'in') return <Navigate to={home(s.user, next)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setState({ sending: true, problem: null });
    try {
      const user = await s.login(v.login.trim(), v.password);
      // Staff go to /admin (no "/en" there); villagers to their account in the current language.
      const to = home(user, next);
      if (to.startsWith('/admin')) window.location.assign(to);
      else navigate(to, { replace: true });
    } catch (err) {
      const key = err.code === 'LOCKED' ? 'auth.login.locked' : err.code === 'BAD_CREDENTIALS' ? 'auth.login.bad' : `err.${err.code}`;
      setState({ sending: false, problem: t(key) === key ? t('err.default') : t(key) });
    }
  };

  return (
    <>
      <PageHead title={t('auth.login.title')} intro={t('auth.login.intro')} share={false} />
      <AuthCard>
        <form className="form" onSubmit={submit} noValidate>
          <TextField
            label={t('auth.login.id')}
            value={v.login}
            onChange={(e) => setV({ ...v, login: e.target.value })}
            autoComplete="username"
            inputMode="email"
            required
            maxLength={160}
          />
          <PasswordField label={t('auth.password')} autoComplete="current-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
          {state.problem && (
            <p className="alert alert--error" role="alert">
              {state.problem}
            </p>
          )}
          <SubmitButton sending={state.sending}>{t('auth.login.submit')}</SubmitButton>
        </form>
        <details className="authcard__help">
          <summary>{t('auth.forgot')}</summary>
          <p>{t('auth.forgotText')}</p>
          {settings.whatsappNumber && (
            <p>
              <a href={`https://wa.me/91${settings.whatsappNumber}`} target="_blank" rel="noopener noreferrer">
                WhatsApp: {settings.whatsappNumber}
              </a>
            </p>
          )}
        </details>
        <p className="authcard__switch">
          {t('auth.noAccount')} <Link to="/register">{t('auth.registerLink')}</Link>
        </p>
      </AuthCard>
    </>
  );
}

export function Register() {
  const { t } = useI18n();
  const s = useSession();
  const err = useErrText();
  const navigate = useLangNavigate();
  const [v, setV] = useState({ name: '', phone: '', email: '', tola: '', livesIn: 'village', place: '', password: '', consent: false, website: '' });
  const [state, setState] = useState({ sending: false, issues: {}, problem: null });
  useTitle(t('auth.register.title'));
  useNoIndex();

  if (s.status === 'in') return <Navigate to={home(s.user)} replace />;

  const set = (k) => (e) => setV({ ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setState({ sending: true, issues: {}, problem: null });
    try {
      await s.register(v);
      navigate('/account', { replace: true });
    } catch (error) {
      const issues = {};
      for (const i of error.issues ?? []) issues[i.path] ??= i.message;
      const key = `err.${error.code}`;
      setState({ sending: false, issues, problem: error.code === 'VALIDATION' ? t('common.fixErrors') : t(key) === key ? t('err.default') : t(key) });
    }
  };
  const is = state.issues;
  return (
    <>
      <PageHead title={t('auth.register.title')} intro={t('auth.register.intro')} share={false} />
      <AuthCard>
        <form className="form" onSubmit={submit} noValidate>
          <TextField label={t('auth.name')} value={v.name} onChange={set('name')} error={err(is.name)} autoComplete="name" required maxLength={100} />
          <TextField
            label={t('auth.phone')}
            hint={t('auth.phoneHint')}
            value={v.phone}
            onChange={set('phone')}
            error={err(is.phone)}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            maxLength={20}
          />
          <fieldset className="field choice">
            <legend className="field__label">{t('auth.livesIn')}</legend>
            {['village', 'outside'].map((k) => (
              <label key={k} className="check">
                <input type="radio" name="livesIn" value={k} checked={v.livesIn === k} onChange={set('livesIn')} />
                <span>{t(`auth.livesIn.${k}`)}</span>
              </label>
            ))}
          </fieldset>
          {v.livesIn === 'village' ? (
            <TextField label={t('auth.tola')} value={v.tola} onChange={set('tola')} error={err(is.tola)} optional maxLength={100} />
          ) : (
            <TextField label={t('auth.place')} value={v.place} onChange={set('place')} error={err(is.place)} optional maxLength={100} />
          )}
          <TextField label={t('auth.email')} value={v.email} onChange={set('email')} error={err(is.email)} type="email" autoComplete="email" optional maxLength={160} />
          <PasswordField
            label={t('auth.newPassword')}
            hint={t('auth.passwordHint')}
            autoComplete="new-password"
            value={v.password}
            onChange={set('password')}
            error={err(is.password)}
          />
          <CheckField checked={v.consent} onChange={set('consent')} error={err(is.consent)}>
            {t('auth.consent')}{' '}
            <Link to="/privacy" target="_blank">
              {t('footer.privacy')}
            </Link>
          </CheckField>
          <HoneyPot value={v.website} onChange={(website) => setV({ ...v, website })} />
          {state.problem && (
            <p className="alert alert--error" role="alert">
              {state.problem}
            </p>
          )}
          <SubmitButton sending={state.sending}>
            <Icon name="user" size={20} />
            {t('auth.register.submit')}
          </SubmitButton>
        </form>
        <p className="authcard__switch">
          {t('auth.haveAccount')} <Link to="/login">{t('auth.login.submit')}</Link>
        </p>
      </AuthCard>
    </>
  );
}
