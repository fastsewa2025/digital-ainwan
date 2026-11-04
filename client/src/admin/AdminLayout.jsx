import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { useA } from './useA.js';
import { useMeta, SECTIONS } from './meta.jsx';
import { useSession } from './session.jsx';
import { Leaf } from '../components/Layout.jsx';

// Names of the three parts of the website, shown as menu group titles.
const SECTION_NAMES = {
  sanskriti: { hi: 'संस्कृति', en: 'Culture' },
  vikas: { hi: 'विकास', en: 'Development' },
  sampark: { hi: 'संपर्क', en: 'Community' },
  kosh: { hi: 'ग्राम कोष (पैसा)', en: 'Village fund (money)' },
};

export default function AdminLayout() {
  const { a, pick, L, lang, setLang } = useA();
  const { user, logout, isSuper } = useSession();
  const meta = useMeta();
  const [open, setOpen] = useState(false);

  return (
    <div className="adm">
      <header className="adm-top">
        <Link className="adm-brand" to="/admin">
          <Leaf className="adm-brand__leaf" />
          <span>{a('app.name')}</span>
        </Link>
        <button type="button" className="adm-menubtn" aria-expanded={open} aria-controls="adm-nav" onClick={() => setOpen((o) => !o)}>
          {a('nav.menu')}
        </button>
      </header>

      <aside className={`adm-side${open ? ' is-open' : ''}`}>
        <nav id="adm-nav" className="adm-nav" aria-label={a('app.name')} onClick={() => setOpen(false)}>
          <NavLink to="/admin" end>
            {a('nav.dashboard')}
          </NavLink>
          {SECTIONS.map((section) => (
            <div key={section} className="adm-nav__group">
              <p className="adm-nav__title">{L(SECTION_NAMES[section])}</p>
              {Object.entries(meta.resources)
                .filter(([, d]) => d.section === section)
                .map(([key, d]) => (
                  <NavLink key={key} to={`/admin/content/${key}`}>
                    {pick(d.label)}
                  </NavLink>
                ))}
            </div>
          ))}
          <div className="adm-nav__group">
            <p className="adm-nav__title">{a('nav.manage')}</p>
            {/* Admins verify villagers; only the super admin sees staff, inbox, settings and the log. */}
            <NavLink to="/admin/users">{isSuper ? a('nav.users') : a('nav.villagers')}</NavLink>
            {isSuper && <NavLink to="/admin/inbox">{a('nav.inbox')}</NavLink>}
            {isSuper && <NavLink to="/admin/settings">{a('nav.settings')}</NavLink>}
            {isSuper && <NavLink to="/admin/audit">{a('nav.audit')}</NavLink>}
          </div>
        </nav>

        <div className="adm-user">
          <p className="adm-user__name">{user.name}</p>
          <p className="small muted">{a(`role.${user.role}`)}</p>
          <div className="adm-user__links">
            <NavLink to="/admin/password">{a('nav.password')}</NavLink>
            <button type="button" className="linklike" onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')}>
              {lang === 'hi' ? 'English' : 'हिन्दी'}
            </button>
            <a href="/" target="_blank" rel="noopener noreferrer">
              {a('nav.viewSite')}
            </a>
            <button type="button" className="linklike" onClick={logout}>
              {a('nav.logout')}
            </button>
          </div>
        </div>
      </aside>

      <main id="main" className="adm-main">
        <Outlet />
      </main>
    </div>
  );
}
