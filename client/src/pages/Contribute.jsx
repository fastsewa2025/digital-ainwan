import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useI18n } from '../lib/i18n.jsx';
import { useSettings } from '../lib/settings.jsx';
import { PageHead, useTitle } from '../components/ui.jsx';
import { Prose } from '../components/Prose.jsx';
import { CopyButton, FormError, HoneyPot, SelectField, SubmitButton, TextField, useErrText, useSubmit } from '../components/forms.jsx';

const HELP = ['idea', 'time', 'skills', 'funds', 'other'];
// Only build a UPI link from something that really looks like a UPI ID.
const UPI_RE = /^[\w.-]{2,}@[A-Za-z][A-Za-z0-9]{1,}$/;

function Funds() {
  const { t, L } = useI18n();
  const s = useSettings();
  const bank = L(s.bankDetails);
  const upi = (s.upiId ?? '').trim();
  if (!s.donationEnabled || (!upi && !bank)) return null;
  const upiLink = UPI_RE.test(upi) ? `upi://pay?pa=${upi}${s.upiName ? `&pn=${encodeURIComponent(s.upiName)}` : ''}&cu=INR` : null;
  return (
    <section className="funds" aria-labelledby="funds-title">
      <h2 id="funds-title">{t('contribute.fundsTitle')}</h2>
      {s.donationNote && <Prose text={L(s.donationNote)} />}
      <p className="alert alert--warn">{t('contribute.fundsWarn')}</p>
      {upi && (
        <div className="funds__box">
          <p className="funds__label">{t('contribute.upi')}</p>
          <p className="funds__value" translate="no">
            {upi}
          </p>
          {s.upiName && (
            <p className="small muted">
              {t('contribute.upiName')}: {s.upiName}
            </p>
          )}
          <div className="funds__btns">
            <CopyButton text={upi} label={t('contribute.upi')} />
            {upiLink && (
              <a className="btn btn--primary btn--small" href={upiLink}>
                {t('contribute.upiPay')}
              </a>
            )}
          </div>
        </div>
      )}
      {bank && (
        <div className="funds__box">
          <p className="funds__label">{t('contribute.bank')}</p>
          <p className="funds__value funds__value--pre" translate="no">
            {bank}
          </p>
          <div className="funds__btns">
            <CopyButton text={bank} label={t('contribute.bank')} />
          </div>
        </div>
      )}
      <p className="small muted">{t('contribute.afterPay')}</p>
    </section>
  );
}

/** Used by both tabs: they only differ in which fields are asked for. */
function MessageForm({ type, extended }) {
  const { t } = useI18n();
  const errText = useErrText();
  const sub = useSubmit(`/public/submit/${type}`);
  const [v, setV] = useState({ name: '', place: '', helpType: '', message: '', phone: '', email: '', website: '' });
  const set = (k) => (e) => setV((o) => ({ ...o, [k]: e.target.value }));
  const err = (k) => (sub.issues[k] ? errText(sub.issues[k]) : undefined);

  if (sub.status === 'done') {
    return (
      <p className="alert" role="status">
        {t('contribute.thanks')}
      </p>
    );
  }
  const onSubmit = (e) => {
    e.preventDefault();
    sub.submit(extended ? v : { name: v.name, message: v.message, phone: v.phone, email: v.email, website: v.website });
  };
  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <TextField label={extended ? t('contribute.name') : t('contribute.nameOpt')} value={v.name} onChange={set('name')} error={err('name')} maxLength={100} autoComplete="name" />
      {extended && (
        <>
          <TextField label={t('contribute.place')} value={v.place} onChange={set('place')} error={err('place')} maxLength={120} />
          <SelectField
            label={t('contribute.help')}
            value={v.helpType}
            onChange={set('helpType')}
            error={err('helpType')}
            placeholder={t('form.chooseOne')}
            options={HELP.map((h) => ({ value: h, label: t(`contribute.help.${h}`) }))}
          />
        </>
      )}
      <TextField label={t('contribute.message')} value={v.message} onChange={set('message')} error={err('message')} multiline maxLength={3000} rows={6} />
      <p className="small muted">{extended ? t('contribute.contactNote') : t('contribute.suggestIntro')}</p>
      <div className="form__row form__row--2">
        <TextField label={t('contribute.phone')} value={v.phone} onChange={set('phone')} error={err('phone')} type="tel" inputMode="tel" autoComplete="tel" maxLength={20} />
        <TextField label={t('contribute.email')} value={v.email} onChange={set('email')} error={err('email')} type="email" autoComplete="email" maxLength={160} />
      </div>
      <HoneyPot value={v.website} onChange={(website) => setV((o) => ({ ...o, website }))} />
      <FormError state={sub} />
      <p className="small">
        <Link to="/privacy">{t('form.privacy')}</Link>
      </p>
      <div>
        <SubmitButton sending={sub.status === 'sending'}>{t('common.send')}</SubmitButton>
      </div>
    </form>
  );
}

export default function Contribute() {
  const { t } = useI18n();
  useTitle(t('contribute.title'));
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') === 'suggest' ? 'suggest' : 'away';
  const pick = (next) => setSp(next === 'away' ? {} : { tab: next }, { replace: true });

  return (
    <>
      <PageHead module="sampark" title={t('contribute.title')} intro={t('contribute.intro')} />
      <div className="page">
        <div className="wrap wrap--narrow">
          <div className="chips" role="group" aria-label={t('contribute.title')}>
            {['away', 'suggest'].map((k) => (
              <button key={k} type="button" className="chip" aria-pressed={tab === k} onClick={() => pick(k)}>
                {t(`contribute.tab.${k}`)}
              </button>
            ))}
          </div>
          {tab === 'away' ? (
            <>
              <Funds />
              <section className="detail__block">
                <h2>{t('contribute.awayTitle')}</h2>
                <MessageForm key="away" type="diaspora" extended />
              </section>
            </>
          ) : (
            <section>
              <h2>{t('contribute.suggestTitle')}</h2>
              <MessageForm key="suggest" type="suggestion" />
            </section>
          )}
        </div>
      </div>
    </>
  );
}
