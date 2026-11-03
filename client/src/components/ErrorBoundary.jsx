import { Component } from 'react';
import { STRINGS } from '../lib/strings.js';

/**
 * Last safety net: if a page crashes (or a lazy-loaded part fails to download on a weak network),
 * show a plain message and a reload button instead of a blank white screen.
 * It sits above the language provider's consumers, so it reads the saved language itself.
 */
export class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    // The server logs nothing about browser errors; the console is the only place to look.
    console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    let lang = 'hi';
    try {
      if (localStorage.getItem('ainwan-lang') === 'en') lang = 'en';
    } catch {
      /* private mode */
    }
    const s = STRINGS[lang];
    return (
      <div className="wrap wrap--narrow state state--center" role="alert">
        <p className="state__title">{s['err.default']}</p>
        <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
          {s['common.retry']}
        </button>
      </div>
    );
  }
}
