import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { SiteLayout } from './components/Layout.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { Loading } from './components/ui.jsx';
import Home from './pages/Home.jsx';
import Festivals from './pages/Festivals.jsx';
import FestivalDetail from './pages/FestivalDetail.jsx';
import { OralHistory, OralHistoryDetail } from './pages/OralHistory.jsx';
import { Wiki, WikiDetail } from './pages/Wiki.jsx';
import { Albums, AlbumDetail } from './pages/Gallery.jsx';
import Projects from './pages/Projects.jsx';
import ProjectDetail from './pages/ProjectDetail.jsx';
import { Notices, NoticeDetail } from './pages/Notices.jsx';
import Directory from './pages/Directory.jsx';
import Youth from './pages/Youth.jsx';
import { Fame, FameDetail } from './pages/Fame.jsx';
import Contribute from './pages/Contribute.jsx';
import About from './pages/About.jsx';
import Privacy from './pages/Privacy.jsx';
import NotFound from './pages/NotFound.jsx';

// Parts most visitors never open are downloaded only when needed: the map (Leaflet is large)
// and the admin area (visitors never see it at all).
const MapPage = lazy(() => import('./pages/MapPage.jsx'));
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));

const later = (node) => <Suspense fallback={<Loading />}>{node}</Suspense>;

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/admin/*" element={later(<AdminApp />)} />
        <Route element={<SiteLayout />}>
          <Route index element={<Home />} />
          <Route path="about" element={<About />} />
          <Route path="privacy" element={<Privacy />} />

          <Route path="sanskriti" element={<Navigate to="/sanskriti/festivals" replace />} />
          <Route path="sanskriti/festivals" element={<Festivals />} />
          <Route path="sanskriti/festivals/:id" element={<FestivalDetail />} />
          <Route path="sanskriti/oral-history" element={<OralHistory />} />
          <Route path="sanskriti/oral-history/:id" element={<OralHistoryDetail />} />
          <Route path="sanskriti/wiki" element={<Wiki />} />
          <Route path="sanskriti/wiki/:id" element={<WikiDetail />} />
          <Route path="sanskriti/gallery" element={<Albums />} />
          <Route path="sanskriti/gallery/:id" element={<AlbumDetail />} />

          <Route path="vikas" element={<Projects />} />
          <Route path="vikas/projects" element={<Navigate to="/vikas" replace />} />
          <Route path="vikas/projects/:id" element={<ProjectDetail />} />
          <Route path="vikas/map" element={later(<MapPage />)} />
          <Route path="vikas/notices" element={<Notices />} />
          <Route path="vikas/notices/:id" element={<NoticeDetail />} />

          <Route path="sampark" element={<Navigate to="/sampark/directory" replace />} />
          <Route path="sampark/directory" element={<Directory />} />
          <Route path="sampark/youth" element={<Youth />} />
          <Route path="sampark/fame" element={<Fame />} />
          <Route path="sampark/fame/:id" element={<FameDetail />} />
          <Route path="sampark/contribute" element={<Contribute />} />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
