import { useParams } from 'react-router';
import { useI18n } from '../lib/i18n.jsx';
import { useFetch } from '../lib/api.js';
import { Async, BackLink, PageHead, ShareButton, useTitle } from '../components/ui.jsx';
import { Gallery } from '../components/Lightbox.jsx';
import { Prose } from '../components/Prose.jsx';

export default function FestivalDetail() {
  const { id } = useParams();
  const { t, L, fmtDate } = useI18n();
  const res = useFetch(`/public/content/festivals/${id}`);
  useTitle(res.data ? L(res.data.title) : null);

  return (
    <>
      <PageHead module="sanskriti" as="p" title={t('festivals.title')} />
      <div className="page">
        <div className="wrap wrap--narrow">
          <BackLink to="/sanskriti/festivals">{t('nav.festivals')}</BackLink>
          <Async res={res}>
            {(d) => (
              <article>
                <h1 className="detail__title">{L(d.title)}</h1>
                <p className="detail__meta">
                  <time dateTime={d.date}>{fmtDate(d.date)}</time>
                  <span>{t(`festivals.kind.${d.kind}`)}</span>
                  {d.location && <span>{L(d.location)}</span>}
                </p>
                {d.summary && <p className="detail__lead">{L(d.summary)}</p>}
                {d.report && (
                  <section className="detail__block">
                    <h2>{t('festivals.report')}</h2>
                    <Prose text={L(d.report)} />
                  </section>
                )}
                {d.photos?.length > 0 && (
                  <section className="detail__block">
                    <h2>{t('common.photos')}</h2>
                    <Gallery photos={d.photos} title={L(d.title)} />
                  </section>
                )}
                {d.videoUrl && (
                  <section className="detail__block">
                    <h2>{t('festivals.video')}</h2>
                    <div className="video">
                      <iframe src={d.videoUrl} title={`${t('festivals.video')}: ${L(d.title)}`} loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
                    </div>
                  </section>
                )}
                <p className="detail__actions">
                  <ShareButton title={L(d.title)} />
                </p>
              </article>
            )}
          </Async>
        </div>
      </div>
    </>
  );
}
