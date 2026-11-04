import { useId, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useI18n } from '../lib/i18n.jsx';
import { translateError } from '../lib/errorText.js';

/* Messages come from the server in English; on Hindi pages they are shown in Hindi (lib/errorText.js). */
export function useErrText() {
  const { lang } = useI18n();
  return (message) => translateError(message, lang);
}

/** Sends a form to the server and keeps track of "sending / done / error", including per-field messages. */
export function useSubmit(url) {
  const [state, setState] = useState({ status: 'idle', error: null, issues: {} });
  const submit = async (body) => {
    setState({ status: 'sending', error: null, issues: {} });
    try {
      await api.post(url, body);
      setState({ status: 'done', error: null, issues: {} });
      return true;
    } catch (error) {
      const issues = {};
      for (const i of error.issues ?? []) issues[i.path || '_'] ??= i.message;
      setState({ status: 'error', error, issues });
      return false;
    }
  };
  const reset = () => setState({ status: 'idle', error: null, issues: {} });
  return { ...state, submit, reset };
}

export function Field({ id, label, hint, error, optional, children }) {
  const { t } = useI18n();
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {optional && <span className="muted"> ({t('common.optional')})</span>}
      </label>
      {children}
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

const describedBy = (id, hint, error) => [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ') || undefined;

export function TextField({ label, hint, error, optional, multiline = false, ...rest }) {
  const id = useId();
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <Field id={id} label={label} hint={hint} error={error} optional={optional}>
      <Tag id={id} className="input" aria-invalid={error ? 'true' : undefined} aria-describedby={describedBy(id, hint, error)} {...rest} />
    </Field>
  );
}

export function SelectField({ label, hint, error, optional, options, placeholder, ...rest }) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} error={error} optional={optional}>
      <select id={id} className="input" aria-invalid={error ? 'true' : undefined} aria-describedby={describedBy(id, hint, error)} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function CheckField({ children, error, ...rest }) {
  const id = useId();
  return (
    <div className="field">
      <label className="check" htmlFor={id}>
        <input id={id} type="checkbox" aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${id}-err` : undefined} {...rest} />
        <span>{children}</span>
      </label>
      {error && (
        <p className="field__error" id={`${id}-err`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** A box that real visitors never see. Bots fill it in, and the server then quietly drops the message. */
export function HoneyPot({ value, onChange }) {
  return (
    <div className="hp" aria-hidden="true">
      <label>
        Website
        <input name="website" tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}

export function FormError({ state }) {
  const { t } = useI18n();
  if (state.status !== 'error') return null;
  const code = state.error?.code;
  if (code === 'VALIDATION') {
    return (
      <p className="alert alert--error" role="alert">
        {t('common.fixErrors')}
      </p>
    );
  }
  const key = `err.${code}`;
  return (
    <p className="alert alert--error" role="alert">
      {t(key) === key ? t('form.sendFailed') : t(key)}
    </p>
  );
}

export function SubmitButton({ sending, children }) {
  const { t } = useI18n();
  return (
    <button type="submit" className="btn btn--primary" disabled={sending}>
      {sending ? t('common.sending') : children}
    </button>
  );
}

export function CopyButton({ text, label }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  const timer = useRef(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Old or locked-down browsers: fall back to selecting a hidden field.
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand('copy');
      } catch {
        /* nothing more we can do */
      }
      el.remove();
    }
    setDone(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDone(false), 2200);
  };
  return (
    <button type="button" className="btn btn--ghost btn--small" onClick={copy} aria-label={label ? `${t('common.copy')}: ${label}` : undefined}>
      {done ? t('common.copied') : t('common.copy')}
    </button>
  );
}
