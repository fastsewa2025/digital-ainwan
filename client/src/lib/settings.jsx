import { createContext, useContext } from 'react';
import { useFetch } from './api.js';

const SettingsContext = createContext(null);

export const DEFAULT_SETTINGS = {
  villageName: { hi: 'ऐनवां', en: 'Ainwan' },
  tagline: { hi: 'परंपरा और प्रगति का संगम', en: 'A blend of Tradition and Progress' },
  mapCenter: { lat: 25.2133, lng: 84.9867 }, // Jehanabad town (Ainwan is ~4 km away): move the pin to the village in Settings
  mapZoom: 13,
};

// The server puts the settings into the page itself, so the first screen does not wait for a request.
function inlined() {
  try {
    const el = document.getElementById('site-settings');
    return el ? JSON.parse(el.textContent) : null;
  } catch {
    return null;
  }
}
const FIRST = inlined();

/** Loads the village settings once and shares them with every page. */
export function SettingsProvider({ children }) {
  const { data } = useFetch('/public/settings'); // refreshes, and adds "last updated"
  return <SettingsContext.Provider value={data ?? FIRST ?? DEFAULT_SETTINGS}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext) ?? DEFAULT_SETTINGS;
