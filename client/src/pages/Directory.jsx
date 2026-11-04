import { useState } from 'react';
import { useLocation } from 'react-router';
import { Link } from '../lib/nav.jsx';
import { useSession } from '../lib/session.jsx';
import { Icon } from '../components/Icons.jsx';
import { api, useFetch } from '../lib/api.js';
import { useI18n } from '../lib/i18n.jsx';
import { Async, Meta, PageHead, Pager, useTitle } from '../components/ui.jsx';
import { SearchBox, useListParams } from '../components/filters.jsx';
import { CheckField, FormError, HoneyPot, SelectField, SubmitButton, TextField, useErrText, useSubmit } from '../components/forms.jsx';

const CATS = ['electrician', 'plumber', 'mason', 'carpenter', 'painter', 'tailor', 'driver', 'teacher', 'tech', 'farm', 'health', 'shop', 'other'];

/** WhatsApp wants the number with the country code and nothing else. */
function waNumber(phone) {
  const digits = phone.replace(/\D/g, '');
  if (phone.startsWith('+')) return digits;
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

/** A short message to someone in the directory: the Panchayat team passes it on, the number stays private. */
function MessageThem({ id, name, onClose }) {
  const { t } = useI18n();
  const err = useErrText();
  const sub = useSubmit('/public/submit/contact');
  const [v, setV] = useState({ name: '', phone: '', email: '', message: '', website: '' });
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  if (sub.status === 'done') {
    return (
      <p className="alert" role="status">
        {t('send.msgSent')}
      </p>
    );
  }
  return (
    <form
      className="form reveal__form"
      onSubmit={(e) => {
        e.preventDefault();
        sub.submit({ ...v, about: { kind: 'directory', id } });
      }}
      noValidate
    >
      <p className="small">{t('dir.messageHelp', { name })}</p>
      <TextField label={t('auth.name')} value={v.name} onChange={set('name')} error={err(sub.issues.name)} required maxLength={100} />
      <TextField label={t('auth.phone')} value={v.phone} onChange={set('phone')} error={err(sub.issues.phone || sub.issues.email)} type="tel" inputMode="tel" maxLength={20} />
      <TextField label={t('send.msg.text')} value={v.message} onChange={set('message')} error={err(sub.issues.message)} multiline rows={3} required maxLength={3000} />
      <HoneyPot value={v.website} onChange={(website) => setV({ ...v, website })} />
      <FormError state={sub} />
      <p className="reveal__btns">
        <SubmitButton sending={sub.status === 'sending'}>{t('send.submit')}</SubmitButton>
        <button type="button" className="btn btn--ghost btn--small" onClick={onClose}>
          {t('nav.close')}
        </button>
      </p>
    </form>
  );
}

/**
 * Numbers are never in the list. Only signed-in, verified members can see one, one person at a time
 * (and a few per day). Everyone else can send a message through the Panchayat instead.
 */
function Reveal({ id, name }) {
  const { t } = useI18n();
  const err = useErrText();
  const session = useSession();
  const { pathname } = useLocation();
  const [s, setS] = useState({ status: 'idle', phone: '' });
  const [writing, setWriting] = useState(false);
  const show = async () => {
    setS({ status: 'loading', phone: '' });
    try {
      const { phone } = await api.get(`/me/reveal/${id}`);
      setS({ status: 'done', phone });
    } catch (error) {
      setS({ status: 'error', phone: '', error });
    }
  };
  if (s.status === 'done') {
    return (
      <div className="reveal">
        <p className="reveal__num" translate="no">
          {s.phone}
        </p>
        <div className="reveal__btns">
          <a className="btn btn--primary btn--small" href={`tel:${s.phone}`} aria-label={`${t('directory.call')}: ${name}`}>
            {t('directory.call')}
          </a>
          <a className="btn btn--ghost btn--small" href={`https://wa.me/${waNumber(s.phone)}`} target="_blank" rel="noopener noreferrer" aria-label={`${t('directory.whatsapp')}: ${name}`}>
            {t('directory.whatsapp')}
          </a>
        </div>
      </div>
    );
  }
  const key = `err.${s.error?.code}`;
  return (
    <div className="reveal">
      <div className="reveal__btns">
        {session.isVerified ? (
          <button type="button" className="btn btn--ghost btn--small" onClick={show} disabled={s.status === 'loading'} aria-label={`${t('dir.showNumber')}: ${name}`}>
            <Icon name="phone" size={18} />
            {s.status === 'loading' ? t('common.loading') : t('dir.showNumber')}
          </button>
        ) : session.status === 'in' ? (
          <span className="small muted">{t('dir.waitVerify')}</span>
        ) : (
          <Link className="btn btn--ghost btn--small" to={`/login?next=${encodeURIComponent(pathname)}`}>
            <Icon name="lock" size={18} />
            {t('dir.loginToSee')}
          </Link>
        )}
        {!session.isVerified && !writing && (
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setWriting(true)} aria-label={`${t('dir.message')}: ${name}`}>
            <Icon name="message" size={18} />
            {t('dir.message')}
          </button>
        )}
      </div>
      {s.status === 'error' && (
        <p className="field__error" role="alert">
          {t(key) === key ? err(s.error?.message) || t('err.default') : t(key)}
        </p>
      )}
      {writing && <MessageThem id={id} name={name} onClose={() => setWriting(false)} />}
    </div>
  );
}

function AddYourself() {
  const { t, lang } = useI18n();
  const errText = useErrText();
  const sub = useSubmit('/public/submit/directory');
  const [v, setV] = useState({ name: '', category: '', skills: '', mohalla: '', experience: '', phone: '', consent: false, website: '' });
  const set = (k) => (e) => setV((o) => ({ ...o, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const err = (k) => (sub.issues[k] ? errText(sub.issues[k]) : undefined);

  if (sub.status === 'done') {
    return (
      <p className="alert" role="status">
        {t('directory.thanks')}
      </p>
    );
  }
  const onSubmit = (e) => {
    e.preventDefault();
    sub.submit({
      name: v.name,
      category: v.category,
      skills: { hi: lang === 'hi' ? v.skills : '', en: lang === 'en' ? v.skills : '' },
      mohalla: v.mohalla,
      experience: v.experience,
      phone: v.phone,
      consent: v.consent,
      website: v.website,
    });
  };
  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <p>{t('directory.addIntro')}</p>
      <TextField label={t('directory.name')} value={v.name} onChange={set('name')} error={err('name')} maxLength={100} autoComplete="name" />
      <SelectField
        label={t('directory.category')}
        value={v.category}
        onChange={set('category')}
        error={err('category')}
        placeholder={t('form.chooseOne')}
        options={CATS.map((c) => ({ value: c, label: t(`dir.cat.${c}`) }))}
      />
      <TextField label={t('directory.skills')} value={v.skills} onChange={set('skills')} error={err('skills.hi') || err('skills.en')} maxLength={150} optional />
      <div className="form__row form__row--2">
        <TextField label={t('directory.mohalla')} value={v.mohalla} onChange={set('mohalla')} error={err('mohalla')} maxLength={100} optional />
        <TextField label={t('directory.experience')} value={v.experience} onChange={set('experience')} error={err('experience')} inputMode="numeric" maxLength={2} optional />
      </div>
      <TextField
        label={t('directory.phone')}
        hint={t('directory.phoneNote')}
        value={v.phone}
        onChange={set('phone')}
        error={err('phone')}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        maxLength={20}
      />
      <CheckField checked={v.consent} onChange={set('consent')} error={err('consent')}>
        {t('directory.consent')}
      </CheckField>
      <HoneyPot value={v.website} onChange={(website) => setV((o) => ({ ...o, website }))} />
      <FormError state={sub} />
      <div>
        <SubmitButton sending={sub.status === 'sending'}>{t('common.send')}</SubmitButton>
      </div>
    </form>
  );
}

export default function Directory() {
  const { t, L, fmtNum } = useI18n();
  useTitle(t('directory.title'));
  const p = useListParams();
  const [adding, setAdding] = useState(false);
  const res = useFetch('/public/content/directory', { category: p.get('category'), q: p.get('q'), page: p.page, limit: 20 });

  return (
    <>
      <PageHead module="sampark" title={t('directory.title')} intro={t('directory.intro')} />
      <div className="page">
        <div className="wrap">
          <div className="toolbar">
            <SearchBox value={p.get('q')} onChange={(q) => p.set({ q })} placeholder={t('directory.searchPh')} />
            <SelectField
              label={t('common.category')}
              value={p.get('category')}
              onChange={(e) => p.set({ category: e.target.value })}
              options={[{ value: '', label: t('common.all') }, ...CATS.map((c) => ({ value: c, label: t(`dir.cat.${c}`) }))]}
            />
          </div>
          <Async res={res} empty={(d) => d.items.length === 0} emptyText={p.get('q') || p.get('category') ? t('common.nothingFound') : t('directory.empty')}>
            {(d) => (
              <>
                <p className="small muted listcount">{t('directory.count', { n: fmtNum(d.total) })}</p>
                <ul className="drows">
                  {d.items.map((person) => (
                    <li key={person._id} className="drow">
                      <div className="drow__body">
                        <h2 className="drow__name">{person.name}</h2>
                        <p className="drow__cat">{t(`dir.cat.${person.category}`)}</p>
                        {person.skills && <p className="drow__text">{L(person.skills)}</p>}
                        <Meta items={[person.mohalla, person.experience != null && t('directory.exp', { n: person.experience })]} />
                      </div>
                      <Reveal id={person._id} name={person.name} />
                    </li>
                  ))}
                </ul>
                <Pager page={d.page} pages={d.pages} onPage={(page) => p.set({ page })} />
              </>
            )}
          </Async>

          <section className="adder">
            <h2>{t('directory.add')}</h2>
            {adding ? (
              <AddYourself />
            ) : (
              <button type="button" className="btn btn--primary" onClick={() => setAdding(true)} aria-expanded="false">
                {t('directory.add')}
              </button>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
