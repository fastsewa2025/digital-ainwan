import { useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { Link, useLangNavigate } from '../lib/nav.jsx';
import { api, useFetch } from '../lib/api.js';
import { useI18n } from '../lib/i18n.jsx';
import { useSession } from '../lib/session.jsx';
import { CheckField, SelectField, SubmitButton, TextField, useErrText } from '../components/forms.jsx';
import { Loading, Meta, PageHead, useNoIndex, useTitle } from '../components/ui.jsx';
import { Icon } from '../components/Icons.jsx';
import { PasswordField } from './Auth.jsx';

const DIR_CATS = ['electrician', 'plumber', 'mason', 'carpenter', 'painter', 'tailor', 'driver', 'teacher', 'tech', 'farm', 'health', 'shop', 'other'];

/** Sends JSON and keeps "sending / done / per-field problems" together. */
function useSend() {
  const [state, setState] = useState({ status: 'idle', issues: {}, problem: null });
  const { t } = useI18n();
  const send = async (fn) => {
    setState({ status: 'sending', issues: {}, problem: null });
    try {
      const out = await fn();
      setState({ status: 'done', issues: {}, problem: null });
      return out ?? true;
    } catch (error) {
      const issues = {};
      for (const i of error.issues ?? []) issues[i.path || '_'] ??= i.message;
      const key = `err.${error.code}`;
      const problem = error.code === 'VALIDATION' ? t('common.fixErrors') : t(key) !== key ? t(key) : error.message;
      setState({ status: 'error', issues, problem });
      return false;
    }
  };
  return { ...state, send, sending: state.status === 'sending', reset: () => setState({ status: 'idle', issues: {}, problem: null }) };
}

function Problem({ text }) {
  const err = useErrText();
  return text ? (
    <p className="alert alert--error" role="alert">
      {err(text)}
    </p>
  ) : null;
}

/* ------------------------------------------------------------- recording */
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const MAX_SECONDS = 15 * 60;

/** Record in the browser (phone microphone), or pick a file already on the phone. Uploads straight away. */
function AudioInput({ value, onChange, error }) {
  const { t } = useI18n();
  const [phase, setPhase] = useState('idle'); // idle | recording | uploading | error
  const [seconds, setSeconds] = useState(0);
  const [problem, setProblem] = useState(null);
  const rec = useRef(null);
  const timer = useRef(null);
  const canRecord = typeof window !== 'undefined' && 'MediaRecorder' in window && navigator.mediaDevices?.getUserMedia;

  useEffect(() => () => {
    clearInterval(timer.current);
    rec.current?.stream?.getTracks().forEach((tr) => tr.stop());
  }, []);

  const upload = async (file) => {
    setPhase('uploading');
    setProblem(null);
    try {
      const out = await api.upload('/me/upload/audio', file);
      onChange(out.url);
      setPhase('idle');
    } catch (e) {
      setProblem(e.message);
      setPhase('error');
    }
  };

  const start = async () => {
    setProblem(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported?.(m)) ?? '';
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        clearInterval(timer.current);
        const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' });
        const ext = blob.type.includes('mp4') ? 'm4a' : 'webm';
        upload(new File([blob], `story.${ext}`, { type: blob.type }));
      };
      r.start(1000);
      rec.current = r;
      setSeconds(0);
      setPhase('recording');
      timer.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) r.state === 'recording' && r.stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      setProblem(t('rec.noMic'));
      setPhase('error');
    }
  };

  return (
    <div className="field recorder">
      <p className="field__label">{t('acc.do.story')}</p>
      <p className="field__hint">{t('send.story.how')}</p>
      <div className="recorder__row">
        {phase === 'recording' ? (
          <button type="button" className="btn btn--danger" onClick={() => rec.current?.stop()}>
            <Icon name="stop" size={20} />
            {t('rec.stop')}
          </button>
        ) : (
          canRecord && (
            <button type="button" className="btn btn--mustard" onClick={start} disabled={phase === 'uploading'}>
              <Icon name="mic" size={20} />
              {value ? t('rec.again') : t('rec.start')}
            </button>
          )
        )}
        {phase === 'recording' && (
          <span className="recorder__live" role="status">
            <i aria-hidden="true" /> {t('rec.recording', { time: clock(seconds) })}
          </span>
        )}
        {phase === 'uploading' && <span role="status">{t('rec.uploading')}</span>}
      </div>
      <label className="recorder__file">
        <span>{t('rec.or')}</span>
        <input type="file" accept="audio/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} disabled={phase === 'recording' || phase === 'uploading'} />
      </label>
      {value && phase !== 'uploading' && (
        <div className="recorder__done">
          <p>
            <Icon name="check" size={18} /> {t('rec.ready')}
          </p>
          <audio controls src={value} preload="metadata" />
        </div>
      )}
      <Problem text={problem || error} />
    </div>
  );
}

function PhotoPicker({ max = 10, value, onChange, label, error }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const add = async (files) => {
    setBusy(true);
    setProblem(null);
    const next = [...value];
    for (const file of [...files].slice(0, max - value.length)) {
      try {
        next.push(await api.upload('/me/upload/image', file));
      } catch (e) {
        setProblem(e.message);
      }
    }
    onChange(next);
    setBusy(false);
  };
  return (
    <div className="field">
      <label className="field__label">
        {label}
        <input className="input" type="file" accept="image/jpeg,image/png,image/webp" multiple={max > 1} disabled={busy || value.length >= max} onChange={(e) => e.target.files && add(e.target.files)} />
      </label>
      {busy && <p role="status">{t('rec.uploading')}</p>}
      {value.length > 0 && (
        <ul className="thumbs">
          {value.map((p, i) => (
            <li key={p.url}>
              <img src={p.thumb || p.url} alt="" width="96" height="96" />
              <button type="button" className="linklike" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                {t('send.photos.remove')}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Problem text={problem || error} />
    </div>
  );
}

/* --------------------------------------------------------- what to send */
function StoryForm({ onDone }) {
  const { t, lang } = useI18n();
  const err = useErrText();
  const s = useSend();
  const [v, setV] = useState({ title: '', elderName: '', elderAge: '', language: 'magahi', summary: '', audio: '', photo: [], consent: false });
  const set = (k) => (e) => setV({ ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const ok = await s.send(() =>
      api.post('/me/submit/story', {
        title: { [lang]: v.title },
        elderName: { [lang]: v.elderName },
        elderAge: v.elderAge === '' ? undefined : Number(v.elderAge),
        language: v.language,
        summary: v.summary ? { [lang]: v.summary } : undefined,
        audio: v.audio || undefined,
        photo: v.photo[0],
        consent: v.consent,
      }),
    );
    if (ok) onDone(t('send.sent'));
  };
  const is = s.issues;
  return (
    <form className="form" onSubmit={submit} noValidate>
      <AudioInput value={v.audio} onChange={(audio) => setV((cur) => ({ ...cur, audio }))} error={is.audio} />
      <TextField label={t('send.story.storyTitle')} value={v.title} onChange={set('title')} error={err(is.title)} required maxLength={150} />
      <div className="form__row form__row--2">
        <TextField label={t('send.story.elder')} value={v.elderName} onChange={set('elderName')} error={err(is.elderName)} required maxLength={100} />
        <TextField label={t('send.story.age')} value={v.elderAge} onChange={set('elderAge')} error={err(is.elderAge)} type="number" inputMode="numeric" min="30" max="120" optional />
      </div>
      <SelectField
        label={t('send.story.lang')}
        value={v.language}
        onChange={set('language')}
        options={['magahi', 'hindi', 'bhojpuri', 'other'].map((k) => ({ value: k, label: t(`langname.${k}`) }))}
      />
      <TextField label={t('send.story.summary')} value={v.summary} onChange={set('summary')} error={err(is.summary)} multiline rows={3} optional maxLength={600} />
      <PhotoPicker max={1} label={t('send.story.photo')} value={v.photo} onChange={(photo) => setV((cur) => ({ ...cur, photo }))} />
      <CheckField checked={v.consent} onChange={set('consent')} error={err(is.consent)}>
        {t('send.story.consent')}
      </CheckField>
      <Problem text={s.problem} />
      <SubmitButton sending={s.sending}>{t('send.submit')}</SubmitButton>
    </form>
  );
}

function PhotosForm({ onDone }) {
  const { t, lang } = useI18n();
  const err = useErrText();
  const s = useSend();
  const [v, setV] = useState({ title: '', year: String(new Date().getFullYear()), photos: [], consent: false });
  const set = (k) => (e) => setV({ ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const ok = await s.send(() => api.post('/me/submit/photos', { title: { [lang]: v.title }, year: Number(v.year), photos: v.photos, consent: v.consent }));
    if (ok) onDone(t('send.sent'));
  };
  const is = s.issues;
  return (
    <form className="form" onSubmit={submit} noValidate>
      <TextField label={t('send.photos.what')} value={v.title} onChange={set('title')} error={err(is.title)} required maxLength={150} />
      <TextField label={t('send.photos.year')} value={v.year} onChange={set('year')} error={err(is.year)} type="number" inputMode="numeric" min="1900" max="2100" />
      <PhotoPicker max={10} label={t('send.photos.pick')} value={v.photos} onChange={(photos) => setV((cur) => ({ ...cur, photos }))} error={is.photos} />
      {v.photos.length > 0 && <p className="small muted">{t('send.photos.count', { n: v.photos.length })}</p>}
      <CheckField checked={v.consent} onChange={set('consent')} error={err(is.consent)}>
        {t('send.photos.consent')}
      </CheckField>
      <Problem text={s.problem} />
      <SubmitButton sending={s.sending}>{t('send.submit')}</SubmitButton>
    </form>
  );
}

function ListingForm({ onDone, user }) {
  const { t, lang } = useI18n();
  const err = useErrText();
  const s = useSend();
  const [v, setV] = useState({ name: user.name, category: 'other', skills: '', mohalla: user.tola || '', experience: '', phone: user.phone || '', consent: false });
  const set = (k) => (e) => setV({ ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const ok = await s.send(() =>
      api.post('/me/submit/listing', {
        name: v.name,
        category: v.category,
        skills: v.skills ? { [lang]: v.skills } : undefined,
        mohalla: v.mohalla || undefined,
        experience: v.experience === '' ? undefined : Number(v.experience),
        phone: v.phone,
        consent: v.consent,
      }),
    );
    if (ok) onDone(t('send.sent'));
  };
  const is = s.issues;
  return (
    <form className="form" onSubmit={submit} noValidate>
      <TextField label={t('auth.name')} value={v.name} onChange={set('name')} error={err(is.name)} required maxLength={100} />
      <SelectField label={t('send.listing.skill')} value={v.category} onChange={set('category')} options={DIR_CATS.map((k) => ({ value: k, label: t(`dir.cat.${k}`) }))} />
      <TextField label={t('send.listing.what')} value={v.skills} onChange={set('skills')} error={err(is.skills)} optional maxLength={150} />
      <div className="form__row form__row--2">
        <TextField label={t('auth.tola')} value={v.mohalla} onChange={set('mohalla')} optional maxLength={100} />
        <TextField label={t('send.listing.years')} value={v.experience} onChange={set('experience')} error={err(is.experience)} type="number" inputMode="numeric" min="0" max="70" optional />
      </div>
      <TextField label={t('send.listing.phone')} value={v.phone} onChange={set('phone')} error={err(is.phone)} type="tel" inputMode="tel" required maxLength={20} />
      <CheckField checked={v.consent} onChange={set('consent')} error={err(is.consent)}>
        {t('send.listing.consent')}
      </CheckField>
      <Problem text={s.problem} />
      <SubmitButton sending={s.sending}>{t('send.submit')}</SubmitButton>
    </form>
  );
}

function MessageForm({ onDone }) {
  const { t } = useI18n();
  const err = useErrText();
  const s = useSend();
  const [v, setV] = useState({ kind: 'suggestion', message: '' });
  const submit = async (e) => {
    e.preventDefault();
    const ok = await s.send(() => api.post('/me/submit/message', v));
    if (ok) onDone(t('send.msgSent'));
  };
  return (
    <form className="form" onSubmit={submit} noValidate>
      <fieldset className="field choice">
        <legend className="field__label">{t('send.msg.kind')}</legend>
        {['suggestion', 'grievance'].map((k) => (
          <label key={k} className="check">
            <input type="radio" name="kind" value={k} checked={v.kind === k} onChange={() => setV({ ...v, kind: k })} />
            <span>{t(`send.msg.${k}`)}</span>
          </label>
        ))}
      </fieldset>
      <TextField label={t('send.msg.text')} value={v.message} onChange={(e) => setV({ ...v, message: e.target.value })} error={err(s.issues.message)} multiline rows={5} required maxLength={3000} />
      <Problem text={s.problem} />
      <SubmitButton sending={s.sending}>{t('send.submit')}</SubmitButton>
    </form>
  );
}

const ACTIONS = [
  { key: 'story', icon: 'mic', Form: StoryForm },
  { key: 'photos', icon: 'photo', Form: PhotosForm },
  { key: 'listing', icon: 'users', Form: ListingForm },
  { key: 'message', icon: 'message', Form: MessageForm },
];

function SendPanel({ user, onSent }) {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const open = ACTIONS.find((a) => a.key === params.get('send'));
  const [note, setNote] = useState(null);
  const top = useRef(null);
  const choose = (key) => {
    setNote(null);
    setParams(key ? { send: key } : {}, { replace: false });
    requestAnimationFrame(() => top.current?.scrollIntoView({ block: 'start' }));
  };
  return (
    <section className="acc-sec" aria-labelledby="acc-send" ref={top}>
      <h2 id="acc-send">{open ? t(`acc.do.${open.key}`) : t('acc.do.title')}</h2>
      {note && (
        <p className="alert" role="status">
          {note}
        </p>
      )}
      {open ? (
        <>
          <button type="button" className="linklike acc-back" onClick={() => choose(null)}>
            ← {t('send.back')}
          </button>
          <open.Form
            user={user}
            onDone={(msg) => {
              choose(null);
              setNote(msg);
              onSent();
            }}
          />
        </>
      ) : (
        <ul className="acts">
          {ACTIONS.map((a) => (
            <li key={a.key}>
              <button type="button" className="act" onClick={() => choose(a.key)}>
                <Icon name={a.icon} />
                <span>
                  <b>{t(`acc.do.${a.key}`)}</b>
                  <small>{t(`acc.do.${a.key}Sub`)}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------ lists of my things */
function Submissions({ tick }) {
  const { t, fmtDate } = useI18n();
  const { data } = useFetch('/me/submissions', { tick });
  if (!data) return null;
  const rows = [
    ...data.items.map((i) => ({ ...i, kind: i.resource })),
    ...data.messages.map((m) => ({ id: m.id, kind: m.type, title: m.message, status: m.status, createdAt: m.createdAt })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return (
    <section className="acc-sec" aria-labelledby="acc-subs">
      <h2 id="acc-subs">{t('acc.subs.title')}</h2>
      {rows.length === 0 ? (
        <p className="muted">{t('acc.subs.empty')}</p>
      ) : (
        <ul className="subs">
          {rows.map((r) => (
            <li key={`${r.kind}-${r.id}`} className="sub">
              <p className="sub__title">{r.title}</p>
              <Meta items={[t(`acc.kind.${r.kind}`), fmtDate(r.createdAt)]} />
              <span className={`sub__status sub__status--${r.status}`}>{t(`acc.status.${r.status}`)}</span>
              {r.rejectReason && <p className="small">{t('acc.reason', { reason: r.rejectReason })}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Receipts() {
  const { t, fmtDate, fmtINR } = useI18n();
  const { data } = useFetch('/me/receipts');
  if (!data) return null;
  return (
    <section className="acc-sec" aria-labelledby="acc-rcpt">
      <h2 id="acc-rcpt">{t('acc.receipts.title')}</h2>
      {data.items.length === 0 ? (
        <p className="muted">{t('acc.receipts.empty')}</p>
      ) : (
        <ul className="subs">
          {data.items.map((r) => (
            <li key={r.id} className="sub">
              <p className="sub__title">
                {fmtINR(r.amount)} · {r.receiptNo}
              </p>
              <Meta items={[fmtDate(r.date)]} />
              <a className="btn btn--ghost btn--small" href={`/receipt/${r.id}?k=${r.key}`}>
                <Icon name="receipt" size={18} />
                {t('acc.receipt.open')}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* --------------------------------------------------------- my settings */
function Profile({ user }) {
  const { t } = useI18n();
  const err = useErrText();
  const { setUser } = useSession();
  const s = useSend();
  const [v, setV] = useState({ name: user.name, email: user.email ?? '', tola: user.tola ?? '', livesIn: user.livesIn ?? 'village', place: user.place ?? '' });
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const out = await s.send(() => api.patch('/me/profile', v));
    if (out?.user) setUser(out.user);
  };
  return (
    <section className="acc-sec" aria-labelledby="acc-profile">
      <h2 id="acc-profile">{t('acc.profile.title')}</h2>
      <form className="form" onSubmit={submit} noValidate>
        <TextField label={t('auth.name')} value={v.name} onChange={set('name')} error={err(s.issues.name)} required maxLength={100} />
        {user.phone && <TextField label={t('auth.phone')} value={user.phone} readOnly disabled />}
        <TextField label={t('auth.email')} value={v.email} onChange={set('email')} error={err(s.issues.email)} type="email" optional maxLength={160} />
        {user.role === 'villager' && (
          <>
            <SelectField
              label={t('auth.livesIn')}
              value={v.livesIn}
              onChange={set('livesIn')}
              options={['village', 'outside'].map((k) => ({ value: k, label: t(`auth.livesIn.${k}`) }))}
            />
            {v.livesIn === 'village' ? (
              <TextField label={t('auth.tola')} value={v.tola} onChange={set('tola')} optional maxLength={100} />
            ) : (
              <TextField label={t('auth.place')} value={v.place} onChange={set('place')} optional maxLength={100} />
            )}
          </>
        )}
        {s.status === 'done' && (
          <p className="alert" role="status">
            {t('acc.profile.saved')}
          </p>
        )}
        <Problem text={s.problem} />
        <SubmitButton sending={s.sending}>{t('acc.profile.save')}</SubmitButton>
      </form>
    </section>
  );
}

export function PasswordChange({ forced = false }) {
  const { t } = useI18n();
  const err = useErrText();
  const { setUser } = useSession();
  const s = useSend();
  const [v, setV] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [mismatch, setMismatch] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (v.newPassword !== v.confirm) return setMismatch(true);
    setMismatch(false);
    const out = await s.send(() => api.post('/auth/change-password', { currentPassword: v.currentPassword, newPassword: v.newPassword }));
    if (out?.user) {
      setV({ currentPassword: '', newPassword: '', confirm: '' });
      setUser(out.user);
    }
  };
  return (
    <section className="acc-sec" aria-labelledby="acc-pw">
      <h2 id="acc-pw">{t('acc.password.title')}</h2>
      {forced && <p className="alert alert--warn">{t('acc.password.forced')}</p>}
      <form className="form" onSubmit={submit} noValidate>
        <PasswordField label={t('acc.password.current')} autoComplete="current-password" value={v.currentPassword} onChange={set('currentPassword')} error={err(s.issues.currentPassword)} />
        <PasswordField label={t('acc.password.new')} hint={t('auth.passwordHint')} autoComplete="new-password" value={v.newPassword} onChange={set('newPassword')} error={err(s.issues.newPassword)} />
        <PasswordField label={t('acc.password.confirm')} autoComplete="new-password" value={v.confirm} onChange={set('confirm')} error={mismatch ? t('acc.password.mismatch') : null} />
        {s.status === 'done' && (
          <p className="alert" role="status">
            {t('acc.password.changed')}
          </p>
        )}
        <Problem text={s.problem} />
        <SubmitButton sending={s.sending}>{t('acc.password.title')}</SubmitButton>
      </form>
    </section>
  );
}

function DeleteAccount() {
  const { t } = useI18n();
  const err = useErrText();
  const s = useSend();
  const navigate = useLangNavigate();
  const [password, setPassword] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    const ok = await s.send(() => api.post('/me/delete', { password }));
    if (ok) {
      navigate('/?deleted=1', { replace: true });
      window.dispatchEvent(new Event('ainwan:signed-out'));
    }
  };
  return (
    <details className="acc-sec acc-danger">
      <summary>
        <h2>{t('acc.delete.title')}</h2>
      </summary>
      <p>{t('acc.delete.text')}</p>
      <form className="form" onSubmit={submit} noValidate>
        <PasswordField label={t('acc.delete.confirm')} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={err(s.issues.password)} />
        <Problem text={s.problem} />
        <button type="submit" className="btn btn--danger" disabled={s.sending || !password}>
          {t('acc.delete.go')}
        </button>
      </form>
    </details>
  );
}

/* --------------------------------------------------------------- page */
export default function Account() {
  const { t } = useI18n();
  const s = useSession();
  const navigate = useLangNavigate();
  const [tick, setTick] = useState(0);
  useTitle(t('acc.title'));
  useNoIndex();

  if (s.status === 'loading') return <Loading />;
  if (s.status === 'out') return <Navigate to={`/login?next=/account`} replace />;
  const u = s.user;
  const statusBox =
    u.role !== 'villager' ? (
      <div className="alert">
        <p>{t('acc.staff')}</p>
        <p style={{ marginTop: '.6rem' }}>
          <a className="btn btn--primary btn--small" href="/admin">
            {t('acc.openAdmin')}
          </a>
        </p>
      </div>
    ) : u.status === 'pending' ? (
      <p className="alert alert--warn">{t('acc.pending')}</p>
    ) : u.status === 'rejected' ? (
      <div className="alert alert--error">
        <p>{t('acc.rejected')}</p>
        {u.rejectReason && <p>{t('acc.reason', { reason: u.rejectReason })}</p>}
        <p>{t('acc.rejectedHelp')}</p>
      </div>
    ) : (
      <p className="alert">{t('acc.verified')}</p>
    );

  return (
    <>
      <PageHead title={t('acc.hello', { name: u.name })} intro={`${t(`acc.role.${u.role}`)}${u.phone ? ` · ${u.phone}` : ''}`} share={false} />
      <div className="page">
        <div className="wrap wrap--narrow acc">
          {u.mustChangePassword ? (
            <PasswordChange forced />
          ) : (
            <>
              {statusBox}
              {s.isVerified && <SendPanel user={u} onSent={() => setTick((n) => n + 1)} />}
              <Submissions tick={tick} />
              <Receipts />
              <Profile user={u} />
              <PasswordChange />
              {u.role === 'villager' && <DeleteAccount />}
            </>
          )}
          <p className="acc-out">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                // Leave the page first: otherwise "signed out" on this page sends you to the sign-in form.
                navigate('/', { replace: true });
                s.logout();
              }}
            >
              <Icon name="logout" size={20} />
              {t('auth.logout')}
            </button>
          </p>
        </div>
      </div>
    </>
  );
}
