import { useId } from 'react';
import { useA } from '../useA.js';

/** Label, hint and error around any input, with the ids that tie them together for screen readers. */
export function Row({ label, required, hint, error, children, id, legend = false }) {
  const { a, err } = useA();
  const Wrap = legend ? 'fieldset' : 'div';
  const Label = legend ? 'legend' : 'label';
  return (
    <Wrap className={`frow${legend ? ' frow--group' : ''}`}>
      <Label className="field__label" {...(legend ? {} : { htmlFor: id })}>
        {label}
        {required && (
          <>
            <span aria-hidden="true" className="frow__req">
              {' '}
              *
            </span>
            <span className="vh"> ({a('form.required')})</span>
          </>
        )}
      </Label>
      {children}
      {hint && (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={`${id}-err`} role="alert">
          {err(error)}
        </p>
      )}
    </Wrap>
  );
}

const describe = (id, hint, error) => [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ') || undefined;

export function TextInput({ desc, label, value, onChange, error, hint, required }) {
  const id = useId();
  const type = desc.kind === 'url' || desc.kind === 'embed' ? 'url' : desc.kind === 'phone' ? 'tel' : 'text';
  return (
    <Row id={id} label={label} required={required} hint={hint} error={error}>
      <input
        id={id}
        className="input"
        type={type}
        inputMode={type === 'url' ? 'url' : type === 'tel' ? 'tel' : undefined}
        maxLength={desc.max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describe(id, hint, error)}
        autoComplete="off"
      />
    </Row>
  );
}

export function NumberInput({ desc, label, value, onChange, error, hint, required }) {
  const id = useId();
  return (
    <Row id={id} label={label} required={required} hint={hint} error={error}>
      <input
        id={id}
        className="input input--short"
        type="number"
        inputMode={desc.int ? 'numeric' : 'decimal'}
        min={desc.min}
        max={desc.max}
        step={desc.int ? 1 : 'any'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describe(id, hint, error)}
      />
    </Row>
  );
}

export function DateInput({ label, value, onChange, error, hint, required }) {
  const id = useId();
  return (
    <Row id={id} label={label} required={required} hint={hint} error={error}>
      <input
        id={id}
        className="input input--short"
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describe(id, hint, error)}
      />
    </Row>
  );
}

export function SelectInput({ desc, label, value, onChange, error, hint, required }) {
  const id = useId();
  const { pick } = useA();
  return (
    <Row id={id} label={label} required={required} hint={hint} error={error}>
      <select
        id={id}
        className="input input--short"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describe(id, hint, error)}
      >
        {!required && <option value="" />}
        {desc.options.map((o) => (
          <option key={o.value} value={o.value}>
            {pick(o.label)}
          </option>
        ))}
      </select>
    </Row>
  );
}

export function BoolInput({ label, value, onChange, error, hint }) {
  const id = useId();
  const { err } = useA();
  return (
    <div className="frow">
      <label className="check" htmlFor={id}>
        <input id={id} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} aria-describedby={describe(id, hint, error)} />
        <span>{label}</span>
      </label>
      {hint && (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={`${id}-err`} role="alert">
          {err(error)}
        </p>
      )}
    </div>
  );
}

/** Hindi and English side by side. Only one of the two is required; the website falls back to the other. */
export function I18nInput({ desc, label, value, onChange, error, hint, required }) {
  const id = useId();
  const long = desc.kind === 'i18nLong';
  const set = (lang) => (e) => onChange({ ...value, [lang]: e.target.value });
  const common = (lang) => ({
    id: `${id}-${lang}`,
    className: 'input',
    lang,
    maxLength: desc.max,
    value: value[lang],
    onChange: set(lang),
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': describe(id, hint, error),
  });
  return (
    <Row id={id} label={label} required={required} hint={hint} error={error} legend>
      <div className="i18n">
        {[
          ['hi', 'हिन्दी'],
          ['en', 'English'],
        ].map(([lang, name]) => (
          <div key={lang} className="i18n__col">
            <label className="i18n__tag" htmlFor={`${id}-${lang}`}>
              {name}
            </label>
            {long ? <textarea {...common(lang)} rows={desc.rows ?? 4} /> : <input {...common(lang)} type="text" autoComplete="off" />}
          </div>
        ))}
      </div>
    </Row>
  );
}
