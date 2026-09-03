import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import ArScene from '../ar/ArScene.jsx';
import { loadAframe } from '../ar/aframe.js';
import CameraControls from '../components/CameraControls.jsx';
import ErrorPanel from '../components/ErrorPanel.jsx';
import LoadingPanel from '../components/LoadingPanel.jsx';
import ScanHud from '../components/ScanHud.jsx';
import StationPanel from '../components/StationPanel.jsx';
import { useCamera } from '../hooks/useCamera.js';
import { useHunt } from '../hooks/useHunt.js';
import { usePageHidden } from '../hooks/usePageVisibility.js';
import { useStation } from '../hooks/useStation.js';
import { describeError } from '../lib/describeError.js';

/**
 * The camera, pointed at exactly one station: the one the team's current level
 * sends them to. Finding it is what unlocks the next level.
 */
export default function ScanPage() {
  const navigate = useNavigate();
  const { team, current, finished, complete } = useHunt();
  const { status: loadStatus, scene, error: loadError } = useStation(current);

  const hidden = usePageHidden();
  const camera = useCamera();

  // 'intro' | 'loading' | 'scanning' | 'found' | 'error'
  const [state, setState] = useState('loading');
  const [loadingLabel, setLoadingLabel] = useState('Preparing station…');
  const [error, setError] = useState(null);
  const [arActive, setArActive] = useState(false);
  const [marker, setMarker] = useState(null);
  const [hint, setHint] = useState('Frame the marker');
  const [manualPause, setManualPause] = useState(false);

  // The tab being hidden and the user pressing pause are the same thing to the
  // tracker, but only one of them should survive coming back to the tab.
  const paused = manualPause || hidden;

  // The AR callbacks fire from DOM listeners, so they read through refs rather
  // than closing over values a re-render could stale out.
  const levelRef = useRef(current);
  levelRef.current = current;
  const completeRef = useRef(complete);
  completeRef.current = complete;

  useEffect(() => {
    if (loadStatus === 'ready') setState('intro');
    else if (loadStatus === 'error') {
      setError(loadError);
      setState('error');
    }
  }, [loadStatus, loadError]);

  const stopAr = useCallback(() => {
    setArActive(false);
    setMarker(null);
    setManualPause(false);
    camera.close();
    navigate('/');
  }, [camera, navigate]);

  /**
   * Manual pause. Frame-by-frame feature detection is the expensive part of
   * running AR, so stopping it is most of the battery saving; disabling the
   * track stops the sensor delivering frames on top of that, and the torch is
   * killed outright because leaving a light on during a pause is indefensible.
   *
   * The camera itself stays open so resuming is instant and needs no new
   * permission gesture.
   */
  const togglePause = useCallback(() => {
    if (!manualPause && camera.torch) camera.setTorch(false);
    setManualPause((wasPaused) => !wasPaused);
  }, [camera, manualPause]);

  const startAr = useCallback(
    async (deviceId) => {
      setLoadingLabel('Loading tracker…');
      setState('loading');
      try {
        // A-Frame and MindAR are ~1.5 MB and only fetched at this point, so the
        // await is a real network wait on a cold load, not a formality.
        await loadAframe();
        setManualPause(false);
        setLoadingLabel('Starting camera…');
        // Open the lens here rather than letting MindAR do it: this is still
        // inside the user gesture, and it is the only way to learn what the
        // camera supports before tracking owns the stream.
        await camera.open(deviceId);
        setArActive(true);
        return true;
      } catch (err) {
        console.error(err);
        camera.close();
        setError(describeError(err));
        setState('error');
        return false;
      }
    },
    [camera],
  );

  /**
   * Switching lenses means a new MediaStream, and MindAR reads its stream once
   * at start — so the scene is torn down and rebuilt.
   */
  const switchCamera = useCallback(async () => {
    const next = camera.nextDeviceId();
    if (!next) return;

    const previous = camera.deviceId;
    setArActive(false);
    setMarker(null);

    // A lens can refuse to open — busy, or gone since it was enumerated. Losing
    // the camera entirely is worse than a switch that does nothing, so fall back
    // to the one that was already working.
    const ok = await startAr(next);
    if (!ok && previous) await startAr(previous);
  }, [camera, startAr]);

  // Track state follows `paused` from either source, so backgrounding the tab
  // saves the same power as pressing the button.
  useEffect(() => {
    if (arActive) camera.setEnabled(!paused);
  }, [arActive, paused, camera]);

  const handleReady = useCallback(() => {
    setHint('Frame the marker');
    setState('scanning');
  }, []);

  const handleError = useCallback((err) => {
    console.error(err);
    setArActive(false);
    setError(describeError(err));
    setState('error');
  }, []);

  /**
   * The unlock. Detection is the whole gate — there is nothing to type, because
   * the only way this fires is the tracker matching the one image in the bundle.
   *
   * `complete` is idempotent and monotonic, which matters: a marker fires
   * targetFound every time it re-enters frame, and a team holding a phone
   * unsteadily will fire it repeatedly.
   */
  const handleFound = useCallback((hit) => {
    const level = levelRef.current;
    setMarker(hit);
    setState('found');
    navigator.vibrate?.(18);
    completeRef.current(level.n);
    api.reportScan({ experienceId: 'breadcrumb', markerId: hit.id, targetIndex: level.n });
  }, []);

  const handleLost = useCallback((hit, dwellMs) => {
    setHint('Hold the marker in frame');
    setState((prev) => (prev === 'found' ? 'scanning' : prev));
    if (dwellMs == null) return;
    api.reportScan({
      experienceId: 'breadcrumb',
      markerId: hit.id,
      targetIndex: levelRef.current?.n,
      dwellMs,
    });
  }, []);

  const retry = () => {
    setError(null);
    if (scene) startAr(camera.deviceId);
    else navigate('/');
  };

  // Nothing to scan for: no team on this device, or the trail is already run
  // out. Either way the level space is the only sensible place to be.
  if (!team || finished) return <Navigate to="/" replace />;

  return (
    <div className="ar-route">
      {/* Mounting the scene opens the camera; unmounting releases it. */}
      {arActive && scene && (
        <ArScene
          key={camera.deviceId ?? 'default'}
          experience={scene}
          camera={camera.session}
          paused={paused}
          onReady={handleReady}
          onFound={handleFound}
          onLost={handleLost}
          onError={handleError}
        />
      )}

      <main
        data-state={state}
        className="group/ui fixed inset-0 z-10 grid"
      >
        <StationPanel level={current} onStart={() => startAr()} onBack={() => navigate('/')} />
        <LoadingPanel label={loadingLabel} />
        <ScanHud
          status={paused ? 'Paused' : state === 'found' ? 'Station found' : 'Scanning'}
          hint={paused ? 'Camera paused to save battery' : hint}
          paused={paused}
          marker={marker}
          total={1}
          foundCount={0}
          onClose={stopAr}
          controls={
            <CameraControls
              zoomRange={camera.capabilities.zoom}
              zoom={camera.zoom}
              onZoom={camera.setZoom}
              torchSupported={camera.capabilities.torch}
              torch={camera.torch}
              onToggleTorch={camera.toggleTorch}
              canSwitch={camera.canSwitch}
              onSwitch={switchCamera}
              paused={paused}
              onTogglePause={togglePause}
              hidden={state === 'found'}
            />
          }
        />
        <ErrorPanel title={error?.title ?? ''} body={error?.body ?? ''} onRetry={retry} />
      </main>
    </div>
  );
}
