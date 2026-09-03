import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import HuntPage from './pages/HuntPage.jsx';

// The scan route pulls in A-Frame and MindAR (~1.5 MB), and the operator routes
// pull in the compiler and the marker art. Neither belongs in the bundle a phone
// loads to read its current level, which is the screen teams open most.
const ScanPage = lazy(() => import('./pages/ScanPage.jsx'));
const MarkersPage = lazy(() => import('./pages/MarkersPage.jsx'));
const StudioPage = lazy(() => import('./pages/StudioPage.jsx'));
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));
const TrackingTestPage = lazy(() => import('./pages/TrackingTestPage.jsx'));

export default function App() {
  return (
    <Suspense fallback={<div className="route-fallback">Loading…</div>}>
      <Routes>
        <Route path="/" element={<HuntPage />} />
        <Route path="/scan" element={<ScanPage />} />
        <Route path="/markers" element={<MarkersPage />} />
        <Route path="/studio" element={<StudioPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/dev/tracking-test" element={<TrackingTestPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
