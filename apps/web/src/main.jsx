import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles/ui.css';

/**
 * No <StrictMode> here, deliberately.
 *
 * Strict mode mounts every effect twice in development. The AR effect requests
 * the camera and boots A-Frame's renderer, and running that twice leaves an
 * orphaned MediaStream holding the camera — on iOS the second getUserMedia then
 * fails with NotReadableError. The AR lifecycle is imperative and single-owner
 * by nature, so the double-invoke check costs more than it catches here.
 */
createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
