import { Link } from '../lib/nav.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useTitle } from '../components/ui.jsx';

export default function NotFound() {
  const { t } = useI18n();
  useTitle(t('common.notFound.title'));
  return (
    <div className="page">
      <div className="wrap wrap--narrow state--center">
        <h1>{t('common.notFound.title')}</h1>
        <p className="muted notfound__text">{t('common.notFound.text')}</p>
        <Link className="btn btn--primary" to="/">
          {t('common.goHome')}
        </Link>
      </div>
    </div>
  );
}
