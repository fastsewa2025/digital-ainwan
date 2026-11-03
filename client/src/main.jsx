import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import '@fontsource/mukta/latin-400.css';
import '@fontsource/mukta/latin-600.css';
import '@fontsource/mukta/latin-700.css';
import '@fontsource/mukta/devanagari-400.css';
import '@fontsource/mukta/devanagari-600.css';
import '@fontsource/mukta/devanagari-700.css';
import '@fontsource/yatra-one/latin-400.css';
import '@fontsource/yatra-one/devanagari-400.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/content.css';
import './styles/pages.css';
import { I18nProvider } from './lib/i18n.jsx';
import { SettingsProvider } from './lib/settings.jsx';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <SettingsProvider>
          <App />
        </SettingsProvider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>,
);
