import { Link } from '../lib/nav.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useSettings } from '../lib/settings.jsx';
import { useSession } from '../lib/session.jsx';
import { MODULES } from '../components/modules.js';
import { PageHead, useTitle } from '../components/ui.jsx';
import { Icon, WhatsAppIcon } from '../components/Icons.jsx';

/** /sanskriti and /sampark: one page that leads to everything inside (the phone's bottom menu opens these). */
export default function Hub({ module }) {
  const { t, L } = useI18n();
  const s = useSettings();
  const session = useSession();
  const mod = MODULES.find((m) => m.key === module);
  useTitle(t(`nav.${module}`));
  return (
    <>
      <PageHead module={module} title={t(`nav.${module}`)} />
      <div className="page">
        <div className="wrap">
          {module === 'sampark' && (s.officeAddress || s.whatsappNumber || s.email || s.phone) && (
            <section className="hubcontact" aria-labelledby="hub-contact">
              <h2 id="hub-contact">{t('footer.contact')}</h2>
              {s.officeAddress && (
                <p>
                  {t('footer.office')}: {L(s.officeAddress)}
                </p>
              )}
              <p className="hubcontact__btns">
                {s.whatsappNumber && (
                  <a className="btn btn--primary btn--small" href={`https://wa.me/91${s.whatsappNumber}`} target="_blank" rel="noopener noreferrer">
                    <WhatsAppIcon size={20} /> WhatsApp
                  </a>
                )}
                {s.phone && (
                  <a className="btn btn--ghost btn--small" href={`tel:${s.phone}`}>
                    <Icon name="phone" size={20} /> {t('dir.call')}
                  </a>
                )}
                {s.email && (
                  <a className="btn btn--ghost btn--small" href={`mailto:${s.email}`}>
                    {t('footer.email')}
                  </a>
                )}
              </p>
            </section>
          )}
          <ul className="hub">
            {mod.items.map((it) => (
              <li key={it.to}>
                <Link className="hub__card" to={it.to}>
                  <span>{t(it.label)}</span>
                  <Icon name="arrow" />
                </Link>
              </li>
            ))}
            {module === 'sampark' && (
              <li>
                <Link className="hub__card hub__card--account" to={session.status === 'in' ? '/account' : '/login'}>
                  <span>{session.status === 'in' ? t('nav.account') : t('nav.login')}</span>
                  <Icon name="user" />
                </Link>
              </li>
            )}
          </ul>
        </div>
      </div>
    </>
  );
}
