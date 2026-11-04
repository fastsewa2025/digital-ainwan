import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { SiteLayout } from './components/Layout.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { Loading } from './components/ui.jsx';
import Home from './pages/Home.jsx';
import NotFound from './pages/NotFound.jsx';

// Only the home page is in the first download. Every other page is fetched when it is opened,
// so a phone on a slow network gets the first screen sooner.
const named = (load, name) => lazy(() => load().then((m) => ({ default: m[name] })));
const Festivals = lazy(() => import('./pages/Festivals.jsx'));
const FestivalDetail = lazy(() => import('./pages/FestivalDetail.jsx'));
const OralHistory = named(() => import('./pages/OralHistory.jsx'), 'OralHistory');
const OralHistoryDetail = named(() => import('./pages/OralHistory.jsx'), 'OralHistoryDetail');
const Wiki = named(() => import('./pages/Wiki.jsx'), 'Wiki');
const WikiDetail = named(() => import('./pages/Wiki.jsx'), 'WikiDetail');
const Albums = named(() => import('./pages/Gallery.jsx'), 'Albums');
const AlbumDetail = named(() => import('./pages/Gallery.jsx'), 'AlbumDetail');
const Projects = lazy(() => import('./pages/Projects.jsx'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail.jsx'));
const Notices = named(() => import('./pages/Notices.jsx'), 'Notices');
const NoticeDetail = named(() => import('./pages/Notices.jsx'), 'NoticeDetail');
const Directory = lazy(() => import('./pages/Directory.jsx'));
const Youth = lazy(() => import('./pages/Youth.jsx'));
const Fame = named(() => import('./pages/Fame.jsx'), 'Fame');
const FameDetail = named(() => import('./pages/Fame.jsx'), 'FameDetail');
const Contribute = lazy(() => import('./pages/Contribute.jsx'));
const About = lazy(() => import('./pages/About.jsx'));
const Privacy = lazy(() => import('./pages/Privacy.jsx'));
const Hub = lazy(() => import('./pages/Hub.jsx'));
const Search = lazy(() => import('./pages/Search.jsx'));
const Login = named(() => import('./pages/Auth.jsx'), 'Login');
const Register = named(() => import('./pages/Auth.jsx'), 'Register');
const MapPage = lazy(() => import('./pages/MapPage.jsx'));
const Account = lazy(() => import('./pages/Account.jsx'));
const Receipt = lazy(() => import('./pages/Receipt.jsx'));
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));

const later = (node) => <Suspense fallback={<Loading />}>{node}</Suspense>;

/* Every public page exists twice: Hindi at "/...", English at "/en/...". */
const pages = (
  <>
    <Route index element={<Home />} />
    <Route path="about" element={later(<About />)} />
    <Route path="privacy" element={later(<Privacy />)} />
    <Route path="search" element={later(<Search />)} />
    <Route path="login" element={later(<Login />)} />
    <Route path="register" element={later(<Register />)} />
    <Route path="account" element={later(<Account />)} />

    <Route path="sanskriti" element={later(<Hub module="sanskriti" />)} />
    <Route path="sanskriti/festivals" element={later(<Festivals />)} />
    <Route path="sanskriti/festivals/:id" element={later(<FestivalDetail />)} />
    <Route path="sanskriti/oral-history" element={later(<OralHistory />)} />
    <Route path="sanskriti/oral-history/:id" element={later(<OralHistoryDetail />)} />
    <Route path="sanskriti/wiki" element={later(<Wiki />)} />
    <Route path="sanskriti/wiki/:id" element={later(<WikiDetail />)} />
    <Route path="sanskriti/gallery" element={later(<Albums />)} />
    <Route path="sanskriti/gallery/:id" element={later(<AlbumDetail />)} />

    <Route path="vikas" element={later(<Projects />)} />
    <Route path="vikas/projects" element={<Navigate to=".." relative="path" replace />} />
    <Route path="vikas/projects/:id" element={later(<ProjectDetail />)} />
    <Route path="vikas/map" element={later(<MapPage />)} />
    <Route path="vikas/notices" element={later(<Notices />)} />
    <Route path="vikas/notices/:id" element={later(<NoticeDetail />)} />

    <Route path="sampark" element={later(<Hub module="sampark" />)} />
    <Route path="sampark/directory" element={later(<Directory />)} />
    <Route path="sampark/youth" element={later(<Youth />)} />
    <Route path="sampark/fame" element={later(<Fame />)} />
    <Route path="sampark/fame/:id" element={later(<FameDetail />)} />
    <Route path="sampark/contribute" element={later(<Contribute />)} />

    <Route path="*" element={<NotFound />} />
  </>
);

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/admin/*" element={later(<AdminApp />)} />
        <Route path="/receipt/:id" element={later(<Receipt />)} />
        <Route path="/en" element={<SiteLayout />}>
          {pages}
        </Route>
        <Route path="/" element={<SiteLayout />}>
          {pages}
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
