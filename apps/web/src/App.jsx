import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ScanPage from './pages/ScanPage.jsx';

// The operator pages pull in the MindAR compiler and the marker art; keeping
// them out of the scan bundle matters because the scan page is the one a phone
// on a cellular connection actually loads.
const MarkersPage = lazy(() => import('./pages/MarkersPage.jsx'));
const StudioPage = lazy(() => import('./pages/StudioPage.jsx'));
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));
const TrackingTestPage = lazy(() => import('./pages/TrackingTestPage.jsx'));

export default function App() {
  return (
    <Suspense fallback={<div className="route-fallback">Loading…</div>}>
      <Routes>
        <Route path="/" element={<ScanPage />} />
        <Route path="/markers" element={<MarkersPage />} />
        <Route path="/studio" element={<StudioPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/dev/tracking-test" element={<TrackingTestPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
