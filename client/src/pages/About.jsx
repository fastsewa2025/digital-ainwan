import { useI18n } from '../lib/i18n.jsx';
import { useSettings } from '../lib/settings.jsx';
import { PageHead, useTitle } from '../components/ui.jsx';
import { Prose } from '../components/Prose.jsx';

const VISION = [
  { key: 'v1', module: 'sanskriti' },
  { key: 'v2', module: 'vikas' },
  { key: 'v3', module: 'sampark' },
];

export function ContactBlock() {
  const { t, L } = useI18n();
  const s = useSettings();
  const address = L(s.officeAddress);
  const hours = L(s.officeHours);
  if (!address && !hours && !s.phone && !s.email) return null;
  return (
    <section className="detail__block">
      <h2>{t('about.office')}</h2>
      <dl className="facts">
        {address && (
          <div className="facts__row">
            <dt>{t('about.office')}</dt>
            <dd>{address}</dd>
          </div>
        )}
        {hours && (
          <div className="facts__row">
            <dt>{t('about.hours')}</dt>
            <dd>{hours}</dd>
          </div>
        )}
        {s.phone && (
          <div className="facts__row">
            <dt>{t('footer.contact')}</dt>
            <dd translate="no">
              <a href={`tel:${s.phone}`}>{s.phone}</a>
            </dd>
          </div>
        )}
        {s.email && (
          <div className="facts__row">
            <dt>Email</dt>
            <dd translate="no">
              <a href={`mailto:${s.email}`}>{s.email}</a>
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

export default function About() {
  const { t, L } = useI18n();
  const s = useSettings();
  useTitle(t('about.title'));
  const about = L(s.about);
  return (
    <>
      <PageHead title={t('about.title')} />
      <div className="page">
        <div className="wrap wrap--narrow">
          <section>
            <Prose text={about || t('about.default')} />
          </section>

          <section className="detail__block">
            <h2>{t('about.vision')}</h2>
            <ul className="vision">
              {VISION.map((v) => (
                <li key={v.key} className={`vision__item vision__item--${v.module}`}>
                  <h3>{t(`about.${v.key}.t`)}</h3>
                  <p>{t(`about.${v.key}.d`)}</p>
                </li>
              ))}
            </ul>
          </section>

          <ContactBlock />
        </div>
      </div>
    </>
  );
}
