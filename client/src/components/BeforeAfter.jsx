import { useId, useState } from 'react';
import { useI18n } from '../lib/i18n.jsx';

/** Drag (or use the arrow keys on) the handle to compare the "before" and "after" photo of the same place. */
export function BeforeAfter({ before, after }) {
  const { t, L } = useI18n();
  const id = useId();
  const [pos, setPos] = useState(50);
  const ratio = `${after.width || 4} / ${after.height || 3}`;
  return (
    <figure className="ba">
      <div className="ba__stage" style={{ aspectRatio: ratio }}>
        <img className="ba__img" src={after.url} width={after.width} height={after.height} alt={L(after.caption) || t('vikas.after')} loading="lazy" decoding="async" />
        <img
          className="ba__img ba__img--top"
          src={before.url}
          width={before.width}
          height={before.height}
          alt={L(before.caption) || t('vikas.before')}
          loading="lazy"
          decoding="async"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        />
        <span className="ba__tag ba__tag--l">{t('vikas.before')}</span>
        <span className="ba__tag ba__tag--r">{t('vikas.after')}</span>
        <span className="ba__line" style={{ left: `${pos}%` }} aria-hidden="true" />
      </div>
      <label htmlFor={id} className="vh">
        {t('vikas.slider')}
      </label>
      <input id={id} className="ba__range" type="range" min="0" max="100" value={pos} onChange={(e) => setPos(Number(e.target.value))} />
    </figure>
  );
}
