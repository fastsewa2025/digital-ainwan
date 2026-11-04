import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
// Fonts from the brief: Rozha One for headings (the brand look), Mukta for text. Bundled: no third-party requests.
// Speed trade-off for slow phone networks: Mukta's Hindi files weigh ~200 KB, so Hindi body text uses the
// phone's own Devanagari font (Noto Sans Devanagari on Android). To use Mukta for Hindi too, add back:
//   import '@fontsource/mukta/devanagari-400.css'; import '@fontsource/mukta/devanagari-700.css';
import '@fontsource/mukta/latin-400.css';
import '@fontsource/mukta/latin-700.css';
import '@fontsource/rozha-one/latin-400.css';
import '@fontsource/rozha-one/devanagari-400.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/content.css';
import './styles/pages.css';
import './styles/home.css';
import { I18nProvider } from './lib/i18n.jsx';
import { SettingsProvider } from './lib/settings.jsx';
import { SessionProvider } from './lib/session.jsx';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <SettingsProvider>
          <SessionProvider>
            <App />
          </SessionProvider>
        </SettingsProvider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>,
);

// Works offline and can be added to the home screen like an app (production builds only).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* the site works without it */
    });
  });
}
