import { createContext, useContext } from 'react';
import { useFetch } from './api.js';

const SettingsContext = createContext(null);

export const DEFAULT_SETTINGS = {
  villageName: { hi: 'ऐनवां', en: 'Ainwan' },
  tagline: { hi: 'परंपरा और प्रगति का संगम', en: 'A blend of Tradition and Progress' },
  mapCenter: { lat: 25.0961, lng: 85.3131 },
  mapZoom: 13,
};

/** Loads the village settings once and shares them with every page. */
export function SettingsProvider({ children }) {
  const { data } = useFetch('/public/settings');
  return <SettingsContext.Provider value={data ?? DEFAULT_SETTINGS}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext) ?? DEFAULT_SETTINGS;
