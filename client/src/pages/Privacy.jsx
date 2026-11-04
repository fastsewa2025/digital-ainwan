import { useI18n } from '../lib/i18n.jsx';
import { useSettings } from '../lib/settings.jsx';
import { PageHead, useTitle } from '../components/ui.jsx';

const SECTIONS = ['s1', 's2', 's3', 's4', 's5', 's6'];

export default function Privacy() {
  const { t, L } = useI18n();
  const s = useSettings();
  useTitle(t('privacy.title'));
  const address = L(s.officeAddress);
  return (
    <>
      <PageHead title={t('privacy.title')} intro={t('privacy.updated')} />
      <div className="page">
        <div className="wrap wrap--narrow">
          <div className="prose">
            {SECTIONS.map((k) => (
              <section key={k}>
                <h2 className="prose__h">{t(`privacy.${k}.t`)}</h2>
                <p>{t(`privacy.${k}.d`)}</p>
              </section>
            ))}
            {(s.email || s.phone || address) && (
              <section>
                <h2 className="prose__h">{t('privacy.contact')}</h2>
                {s.email && (
                  <p translate="no">
                    <a href={`mailto:${s.email}`}>{s.email}</a>
                  </p>
                )}
                {s.phone && (
                  <p translate="no">
                    <a href={`tel:${s.phone}`}>{s.phone}</a>
                  </p>
                )}
                {address && <p>{address}</p>}
              </section>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
