import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useI18n } from '../lib/i18n.jsx';
import { useSettings } from '../lib/settings.jsx';
import { Plots } from './ui.jsx';

/** Rotates the Panchayat's real photos behind the panel; without photos, shows the field-plot picture. */
function PhotoBackdrop({ photos }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (photos.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = setInterval(() => setI((n) => (n + 1) % photos.length), 6500);
    return () => clearInterval(id);
  }, [photos.length]);
  return photos.map((p, k) => (
    <img key={p.url} className="hero__photo" data-on={k === i} src={p.url} width={p.width} height={p.height} alt="" loading={k === 0 ? 'eager' : 'lazy'} decoding="async" />
  ));
}

export function Hero() {
  const { t, L } = useI18n();
  const s = useSettings();
  const photos = s.heroImages ?? [];
  return (
    <section className="hero" aria-labelledby="hero-title">
      {photos.length ? <PhotoBackdrop photos={photos} /> : <Plots className="hero__art" seed="ainwan-hero" count={30} w={1200} h={560} stroke={3.2} animate />}
      <div className="wrap hero__in">
        <div className="hero__panel">
          <h1 id="hero-title" className="hero__word">
            {L(s.villageName)}
          </h1>
          <p className="hero__sub">Digital {s.villageName?.en}</p>
          <p className="hero__tag">{L(s.tagline)}</p>
          <Link className="btn btn--primary hero__cta" to="/about">
            {t('home.heroCta')}
          </Link>
        </div>
      </div>
    </section>
  );
}
