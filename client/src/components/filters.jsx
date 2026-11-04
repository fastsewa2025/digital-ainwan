import { useEffect, useId, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useI18n } from '../lib/i18n.jsx';

/**
 * Filters and page number live in the address (?kind=mela&page=2), so a filtered list can be
 * bookmarked or sent on WhatsApp, and the back button works as people expect.
 */
export function useListParams() {
  const [sp, setSp] = useSearchParams();
  const get = (k) => sp.get(k) ?? '';
  const set = (patch) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v === '' || v == null) next.delete(k);
      else next.set(k, String(v));
    }
    if (!('page' in patch)) next.delete('page'); // a new filter starts again from page 1
    setSp(next, { replace: true });
  };
  return { get, set, page: Math.max(1, Math.min(500, Number(sp.get('page')) || 1)) };
}

/** Buttons that act like a radio group: one choice, or "All". */
export function Chips({ value, onChange, options, label }) {
  const { t } = useI18n();
  const all = [{ value: '', label: t('common.all') }, ...options];
  return (
    <div className="chips" role="group" aria-label={label}>
      {all.map((o) => (
        <button key={o.value} type="button" className="chip" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count != null && <span className="chip__n"> {o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/**
 * Search box that waits for a short pause in typing before it asks the server.
 * `draft` is what the visitor is typing right now; when they stop, it is sent up and cleared,
 * and the box shows the value held in the address again.
 */
export function SearchBox({ value, onChange, placeholder }) {
  const { t } = useI18n();
  const id = useId();
  const [draft, setDraft] = useState(null);
  const latest = useRef(onChange);

  useEffect(() => {
    latest.current = onChange;
  });
  useEffect(() => {
    if (draft === null) return undefined;
    const timer = setTimeout(() => {
      latest.current(draft.trim());
      setDraft(null);
    }, 350);
    return () => clearTimeout(timer);
  }, [draft]);

  return (
    <div className="field toolbar__grow">
      <label className="field__label" htmlFor={id}>
        {t('common.search')}
      </label>
      <input id={id} className="input" type="search" maxLength={80} value={draft ?? value} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} />
    </div>
  );
}
