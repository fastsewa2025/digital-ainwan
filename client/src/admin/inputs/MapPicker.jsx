import { useMemo } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useSettings } from '../../lib/settings.jsx';

const PIN = L.divIcon({ className: 'pin pin--in-progress', html: '<span></span>', iconSize: [28, 38], iconAnchor: [14, 38] });

function Clicks({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

/** Tap or click the map to place the pin; drag the pin to fine-tune. The number boxes under it do the same job by keyboard. */
export default function MapPicker({ value, onChange }) {
  const settings = useSettings();
  const has = value && value.lat !== '' && value.lng !== '' && !Number.isNaN(Number(value.lat)) && !Number.isNaN(Number(value.lng));
  const center = has ? [Number(value.lat), Number(value.lng)] : [settings.mapCenter?.lat ?? 25.0961, settings.mapCenter?.lng ?? 85.3131];
  // Round to 6 decimals (about 10 cm): more digits are only noise.
  const pick = (lat, lng) => onChange({ lat: lat.toFixed(6), lng: lng.toFixed(6) });
  const handlers = useMemo(
    () => ({
      dragend: (e) => {
        const p = e.target.getLatLng();
        pick(p.lat, p.lng);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return (
    <MapContainer center={center} zoom={has ? 17 : (settings.mapZoom ?? 13)} scrollWheelZoom={false} className="picker">
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
        maxZoom={19}
      />
      <Clicks onPick={pick} />
      {has && <Marker position={center} icon={PIN} draggable eventHandlers={handlers} />}
    </MapContainer>
  );
}
