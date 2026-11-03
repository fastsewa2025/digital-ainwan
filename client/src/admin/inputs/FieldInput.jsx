import { lazy, Suspense } from 'react';
import { useA } from '../useA.js';
import { emptyForm } from '../formModel.js';
import { BoolInput, DateInput, I18nInput, NumberInput, Row, SelectInput, TextInput } from './basic.jsx';
import { AudioInput, GalleryInput, ImageInput, PdfInput } from './media.jsx';

// Leaflet is large; it is downloaded only when a form has a map field.
const MapPicker = lazy(() => import('./MapPicker.jsx'));

/** Finds the message for a field. Nested problems look like "title.hi" or "updates.0.note". */
const errorFor = (issues, name) => {
  if (issues[name]) return issues[name];
  const key = Object.keys(issues).find((k) => k.startsWith(`${name}.`));
  return key ? issues[key] : undefined;
};

function LatLngInput({ label, value, onChange, error, hint, required }) {
  const { a } = useA();
  const v = value ?? { lat: '', lng: '' };
  const set = (k) => (e) => onChange({ ...v, [k]: e.target.value });
  return (
    <Row id={label} label={label} required={required} hint={hint} error={error} legend>
      <p className="small muted">{a('map.help')}</p>
      <Suspense fallback={<p className="state">{a('common.loading')}</p>}>
        <MapPicker value={value} onChange={onChange} />
      </Suspense>
      <div className="latlng">
        <label className="latlng__f">
          <span className="small">{a('map.lat')}</span>
          <input className="input" inputMode="decimal" value={v.lat} onChange={set('lat')} />
        </label>
        <label className="latlng__f">
          <span className="small">{a('map.lng')}</span>
          <input className="input" inputMode="decimal" value={v.lng} onChange={set('lng')} />
        </label>
        {value && (
          <button type="button" className="btn btn--ghost btn--small" onClick={() => onChange(null)}>
            {a('map.clear')}
          </button>
        )}
      </div>
    </Row>
  );
}

/** A repeating group (for example the progress updates of a project). */
function ListInput({ desc, label, value, onChange, issues, name, hint }) {
  const { a, pick } = useA();
  const set = (i, key, v) => onChange(value.map((item, k) => (k === i ? { ...item, [key]: v } : item)));
  return (
    <Row id={name} label={label} hint={hint} error={issues[name]} legend>
      {value.map((item, i) => (
        <fieldset key={i} className="listitem">
          <legend className="small">
            {pick(desc.label)} {i + 1}
          </legend>
          {Object.entries(desc.item).map(([key, d]) => (
            <FieldInput key={key} name={`${name}.${i}.${key}`} desc={d} value={item[key]} onChange={(v) => set(i, key, v)} issues={issues} />
          ))}
          <button type="button" className="btn btn--ghost btn--small" onClick={() => onChange(value.filter((_, k) => k !== i))}>
            {a('media.remove')}
          </button>
        </fieldset>
      ))}
      {value.length < desc.max && (
        <div>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => onChange([...value, emptyForm(desc.item)])}>
            {a('list.add')}
          </button>
        </div>
      )}
    </Row>
  );
}

/** One input for any kind of field. The kind comes from the server's description of the content type. */
export function FieldInput({ name, desc, value, onChange, issues }) {
  const { pick } = useA();
  const label = pick(desc.label);
  const hint = desc.help ? pick(desc.help) : undefined;
  const error = errorFor(issues, name);
  const common = { label, hint, error, required: Boolean(desc.required), value, onChange };

  switch (desc.kind) {
    case 'i18n':
    case 'i18nLong':
      return <I18nInput desc={desc} {...common} />;
    case 'text':
    case 'url':
    case 'embed':
    case 'phone':
      return <TextInput desc={desc} {...common} />;
    case 'number':
      return <NumberInput desc={desc} {...common} />;
    case 'date':
      return <DateInput {...common} />;
    case 'bool':
      return <BoolInput {...common} />;
    case 'select':
      return <SelectInput desc={desc} {...common} />;
    case 'image':
      return <ImageInput {...common} />;
    case 'gallery':
      return <GalleryInput desc={desc} {...common} />;
    case 'audio':
      return <AudioInput {...common} />;
    case 'pdf':
      return <PdfInput {...common} />;
    case 'latlng':
      return <LatLngInput {...common} />;
    case 'list':
      return <ListInput desc={desc} name={name} label={label} hint={hint} value={value} onChange={onChange} issues={issues} />;
    default:
      return null;
  }
}
