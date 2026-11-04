import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../lib/i18n.jsx';

/**
 * Photo grid that opens a full-size viewer. Uses the browser's own <dialog>, which already
 * handles Esc, focus trapping and returning focus, so keyboard and screen-reader users are covered.
 */
export function Gallery({ photos = [], title = '' }) {
  const { t, L } = useI18n();
  const [open, setOpen] = useState(null);
  if (!photos.length) return null;
  return (
    <>
      <ul className="gal">
        {photos.map((p, i) => (
          <li key={p.url}>
            <button type="button" className="gal__btn" onClick={() => setOpen(i)} aria-label={`${t('gallery.open')}: ${L(p.caption) || title} ${i + 1}`}>
              <img src={p.thumb || p.url} width={p.width} height={p.height} alt={L(p.caption)} loading="lazy" decoding="async" />
            </button>
          </li>
        ))}
      </ul>
      {open !== null && <Viewer photos={photos} start={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function Viewer({ photos, start, onClose }) {
  const { t, L } = useI18n();
  const ref = useRef(null);
  const [i, setI] = useState(start);
  const many = photos.length > 1;
  const go = useCallback((d) => setI((n) => (n + d + photos.length) % photos.length), [photos.length]);

  useEffect(() => {
    const dlg = ref.current;
    dlg.showModal();
    return () => dlg.close();
  }, []);

  const onKey = (e) => {
    if (!many) return;
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
  };

  const p = photos[i];
  return (
    <dialog ref={ref} className="viewer" onClose={onClose} onKeyDown={onKey} onClick={(e) => e.target === ref.current && onClose()} aria-label={L(p.caption) || t('common.photo')}>
      <div className="viewer__in">
        <button type="button" className="viewer__close" onClick={onClose} autoFocus>
          {t('common.close')}
        </button>
        <img className="viewer__img" src={p.url} width={p.width} height={p.height} alt={L(p.caption)} />
        <div className="viewer__bar">
          <p className="viewer__cap">{L(p.caption)}</p>
          {many && (
            <div className="viewer__nav">
              <button type="button" className="btn btn--light btn--small" onClick={() => go(-1)}>
                {t('gallery.prev')}
              </button>
              <span>
                {i + 1} / {photos.length}
              </span>
              <button type="button" className="btn btn--light btn--small" onClick={() => go(1)}>
                {t('gallery.next')}
              </button>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
