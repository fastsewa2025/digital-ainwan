import { useId, useRef, useState } from 'react';
import { api } from '../../lib/api.js';
import { useA } from '../useA.js';
import { Row } from './basic.jsx';

/** Sends one file to the server. Returns the stored file's details, or null after showing why it failed. */
function useUpload(kind) {
  const [state, setState] = useState({ busy: false, error: null });
  const upload = async (file) => {
    setState({ busy: true, error: null });
    try {
      const result = await api.upload(`/admin/upload/${kind}`, file);
      setState({ busy: false, error: null });
      return result;
    } catch (error) {
      setState({ busy: false, error: error.message || 'Upload failed' });
      return null;
    }
  };
  return { ...state, upload };
}

function Problem({ text }) {
  const { err } = useA();
  return text ? (
    <p className="field__error" role="alert">
      {err(text)}
    </p>
  ) : null;
}

const IMAGE_TYPES = 'image/jpeg,image/png,image/webp';
const AUDIO_TYPES = 'audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,audio/wav,audio/aac,.mp3,.m4a,.ogg,.wav,.aac';

export function ImageInput({ label, value, onChange, error, hint, required }) {
  const { a } = useA();
  const id = useId();
  const ref = useRef(null);
  const up = useUpload('image');
  const choose = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const r = await up.upload(file);
    if (r) onChange({ url: r.url, thumb: r.thumb, width: r.width, height: r.height });
  };
  return (
    <Row id={id} label={label} required={required} hint={hint} error={error} legend>
      <div className="media">
        {value && <img className="media__thumb" src={value.thumb || value.url} alt="" />}
        <div className="media__btns">
          <input ref={ref} type="file" accept={IMAGE_TYPES} hidden onChange={choose} />
          <button type="button" className="btn btn--ghost btn--small" onClick={() => ref.current.click()} disabled={up.busy}>
            {up.busy ? a('media.uploading') : value ? a('media.replace') : a('media.chooseImage')}
          </button>
          {value && !up.busy && (
            <button type="button" className="btn btn--ghost btn--small" onClick={() => onChange(null)}>
              {a('media.remove')}
            </button>
          )}
        </div>
        <Problem text={up.error} />
      </div>
    </Row>
  );
}

export function GalleryInput({ desc, label, value, onChange, error, hint, required }) {
  const { a } = useA();
  const id = useId();
  const ref = useRef(null);
  const up = useUpload('image');
  const [progress, setProgress] = useState(null);

  const choose = async (e) => {
    const files = [...(e.target.files ?? [])].slice(0, Math.max(0, desc.max - value.length));
    e.target.value = '';
    let next = value;
    for (let i = 0; i < files.length; i++) {
      setProgress({ n: i + 1, of: files.length });
      const r = await up.upload(files[i]);
      if (!r) break;
      next = [...next, { url: r.url, thumb: r.thumb, width: r.width, height: r.height, caption: { hi: '', en: '' } }];
      onChange(next);
    }
    setProgress(null);
  };
  const move = (i, d) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  const setCaption = (i, lang, text) => onChange(value.map((p, k) => (k === i ? { ...p, caption: { ...p.caption, [lang]: text } } : p)));

  return (
    <Row id={id} label={label} required={required} hint={hint} error={error} legend>
      {value.length > 0 && (
        <ul className="gal-edit">
          {value.map((p, i) => (
            <li key={p.url} className="gal-edit__item">
              <img src={p.thumb || p.url} alt="" />
              <div className="gal-edit__btns">
                <button type="button" className="btn btn--ghost btn--small" disabled={i === 0} onClick={() => move(i, -1)} aria-label={a('media.moveEarlier')}>
                  ←
                </button>
                <button type="button" className="btn btn--ghost btn--small" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label={a('media.moveLater')}>
                  →
                </button>
                <button type="button" className="btn btn--ghost btn--small" onClick={() => onChange(value.filter((_, k) => k !== i))}>
                  {a('media.remove')}
                </button>
              </div>
              <details className="gal-edit__cap">
                <summary>{a('media.caption')}</summary>
                <input className="input" lang="hi" placeholder="हिन्दी" maxLength={200} value={p.caption?.hi ?? ''} onChange={(e) => setCaption(i, 'hi', e.target.value)} />
                <input className="input" lang="en" placeholder="English" maxLength={200} value={p.caption?.en ?? ''} onChange={(e) => setCaption(i, 'en', e.target.value)} />
              </details>
            </li>
          ))}
        </ul>
      )}
      <div className="media__btns">
        <input ref={ref} type="file" accept={IMAGE_TYPES} multiple hidden onChange={choose} />
        <button type="button" className="btn btn--ghost btn--small" onClick={() => ref.current.click()} disabled={up.busy || value.length >= desc.max}>
          {progress ? a('media.uploadingN', progress) : a('media.addPhotos')}
        </button>
        <span className="small muted">{a('media.count', { n: value.length, max: desc.max })}</span>
      </div>
      <Problem text={up.error} />
    </Row>
  );
}

export function AudioInput({ label, value, onChange, error, hint, required }) {
  const { a } = useA();
  const id = useId();
  const ref = useRef(null);
  const up = useUpload('audio');
  const choose = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const r = await up.upload(file);
    if (r) onChange(r.url);
  };
  return (
    <Row id={id} label={label} required={required} hint={hint} error={error} legend>
      <div className="media">
        {value && <audio controls preload="none" src={value} className="player" />}
        <div className="media__btns">
          <input ref={ref} type="file" accept={AUDIO_TYPES} hidden onChange={choose} />
          <button type="button" className="btn btn--ghost btn--small" onClick={() => ref.current.click()} disabled={up.busy}>
            {up.busy ? a('media.uploading') : value ? a('media.replace') : a('media.chooseAudio')}
          </button>
          {value && !up.busy && (
            <button type="button" className="btn btn--ghost btn--small" onClick={() => onChange('')}>
              {a('media.remove')}
            </button>
          )}
        </div>
        <Problem text={up.error} />
      </div>
    </Row>
  );
}

export function PdfInput({ label, value, onChange, error, hint, required }) {
  const { a } = useA();
  const id = useId();
  const ref = useRef(null);
  const up = useUpload('pdf');
  const choose = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const r = await up.upload(file);
    if (r) onChange(r.url);
  };
  return (
    <Row id={id} label={label} required={required} hint={hint} error={error} legend>
      <div className="media">
        {value && (
          <p>
            <a href={value} target="_blank" rel="noopener noreferrer">
              {a('media.openPdf')}
            </a>
          </p>
        )}
        <div className="media__btns">
          <input ref={ref} type="file" accept="application/pdf,.pdf" hidden onChange={choose} />
          <button type="button" className="btn btn--ghost btn--small" onClick={() => ref.current.click()} disabled={up.busy}>
            {up.busy ? a('media.uploading') : value ? a('media.replace') : a('media.choosePdf')}
          </button>
          {value && !up.busy && (
            <button type="button" className="btn btn--ghost btn--small" onClick={() => onChange('')}>
              {a('media.remove')}
            </button>
          )}
        </div>
        <Problem text={up.error} />
      </div>
    </Row>
  );
}
