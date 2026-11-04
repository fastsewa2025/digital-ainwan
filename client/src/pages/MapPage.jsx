import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { Link } from '../lib/nav.jsx';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useI18n } from '../lib/i18n.jsx';
import { useSettings } from '../lib/settings.jsx';
import { useFetch } from '../lib/api.js';
import { Async, PageHead, PhaseTag, useTitle } from '../components/ui.jsx';

/** Pins are drawn in CSS (a teardrop in the status colour), so no image files are needed. */
const icon = (phase) =>
  L.divIcon({ className: `pin pin--${phase}`, html: '<span></span>', iconSize: [28, 38], iconAnchor: [14, 38], popupAnchor: [0, -34] });
const ICONS = { planned: icon('planned'), 'in-progress': icon('in-progress'), completed: icon('completed') };

/** Zooms the map to fit every pin (or the one pin that was asked for) once the pins are known. */
function Fit({ items, focus }) {
  const map = useMap();
  useEffect(() => {
    const target = items.find((i) => i._id === focus);
    if (target) {
      map.setView([target.location.lat, target.location.lng], 17);
      return;
    }
    if (items.length === 1) map.setView([items[0].location.lat, items[0].location.lng], 16);
    else if (items.length > 1) map.fitBounds(items.map((i) => [i.location.lat, i.location.lng]), { padding: [40, 40], maxZoom: 17 });
  }, [map, items, focus]);
  return null;
}

function Pin({ item, open }) {
  const { t, L: pick } = useI18n();
  const ref = useRef(null);
  useEffect(() => {
    if (open && ref.current) ref.current.openPopup();
  }, [open]);
  return (
    <Marker ref={ref} position={[item.location.lat, item.location.lng]} icon={ICONS[item.phase]} title={pick(item.title)} alt={pick(item.title)}>
      <Popup>
        <p className="mappop__title">{pick(item.title)}</p>
        {item.mohalla && <p className="mappop__line">{pick(item.mohalla)}</p>}
        <p className="mappop__line">
          <strong>{t(`phase.${item.phase}`)}</strong> &nbsp; {item.progress ?? 0}%
        </p>
        <Link to={`/vikas/projects/${item._id}`}>{t('map.open')}</Link>
      </Popup>
    </Marker>
  );
}

export default function MapPage() {
  const { t, L: pick } = useI18n();
  useTitle(t('map.title'));
  const settings = useSettings();
  const [sp] = useSearchParams();
  const focus = sp.get('focus');
  const res = useFetch('/public/map');
  const center = settings.mapCenter ?? { lat: 25.0961, lng: 85.3131 };

  return (
    <>
      <PageHead module="vikas" title={t('map.title')} intro={t('map.intro')} />
      <div className="page">
        <div className="wrap">
          <Async res={res}>
            {(d) => (
              <>
                <ul className="legend">
                  {['completed', 'in-progress', 'planned'].map((ph) => (
                    <li key={ph}>
                      <PhaseTag phase={ph} />
                    </li>
                  ))}
                </ul>
                <div className="map" role="region" aria-label={t('map.title')}>
                  <MapContainer center={[center.lat, center.lng]} zoom={settings.mapZoom ?? 13} scrollWheelZoom={false} className="map__canvas">
                    <TileLayer
                      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
                      maxZoom={19}
                    />
                    <Fit items={d.items} focus={focus} />
                    {d.items.map((i) => (
                      <Pin key={i._id} item={i} open={i._id === focus} />
                    ))}
                  </MapContainer>
                </div>
                {d.items.length === 0 && <p className="alert note">{t('map.none')}</p>}
                {d.items.length > 0 && (
                  <section className="detail__block">
                    <h2>{t('map.list')}</h2>
                    <ul className="maplist">
                      {d.items.map((i) => (
                        <li key={i._id} className="maplist__row">
                          <Link to={`/vikas/projects/${i._id}`}>{pick(i.title)}</Link>
                          <PhaseTag phase={i.phase} />
                          {i.mohalla && <span className="small muted">{pick(i.mohalla)}</span>}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </Async>
        </div>
      </div>
    </>
  );
}
