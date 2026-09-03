import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import ArScene from '../ar/ArScene.jsx';
import { loadAframe } from '../ar/aframe.js';
import CameraControls from '../components/CameraControls.jsx';
import ErrorPanel from '../components/ErrorPanel.jsx';
import IntroPanel from '../components/IntroPanel.jsx';
import LoadingPanel from '../components/LoadingPanel.jsx';
import ScanHud from '../components/ScanHud.jsx';
import { useCamera } from '../hooks/useCamera.js';
import { useExperience } from '../hooks/useExperience.js';
import { usePageHidden } from '../hooks/usePageVisibility.js';
import { DEFAULT_EXPERIENCE_ID } from '../lib/clues.js';
import { describeError } from '../lib/describeError.js';

export default function ScanPage() {
  // ?e=<id> lets one deployment serve several hunts; defaults to the demo.
  const [params] = useSearchParams();
  const experienceId = params.get('e') ?? DEFAULT_EXPERIENCE_ID;

  const { status: loadStatus, experience, error: loadError } = useExperience(experienceId);
  const hidden = usePageHidden();
  const camera = useCamera();

  // 'intro' | 'loading' | 'scanning' | 'found' | 'error'
  const [state, setState] = useState('loading');
  const [loadingLabel, setLoadingLabel] = useState('Fetching experience…');
  const [error, setError] = useState(null);
  const [arActive, setArActive] = useState(false);
  const [marker, setMarker] = useState(null);
  const [hint, setHint] = useState('Frame a marker');
  const [found, setFound] = useState(() => new Set());
  const [manualPause, setManualPause] = useState(false);

  // The tab being hidden and the user pressing pause are the same thing to the
  // tracker, but only one of them should survive coming back to the tab.
  const paused = manualPause || hidden;

  const total = experience?.markers?.length ?? 0;
  // The AR callbacks fire from DOM listeners, so they read the id off a ref
  // rather than closing over a value that a re-render could stale out.
  const experienceRef = useRef(experience);
  experienceRef.current = experience;

  useEffect(() => {
    if (loadStatus === 'ready') {
      setState('intro');
      document.title = `${experience.name} — Treasure AR`;
    } else if (loadStatus === 'error') {
      setError(loadError);
      setState('error');
    }
  }, [loadStatus, experience, loadError]);

  const stopAr = useCallback(() => {
    setArActive(false);
    setMarker(null);
    setManualPause(false);
    camera.close();
    setState('intro');
  }, [camera]);

  /**
   * Manual pause. The frame-by-frame feature detection is the expensive part of
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
   * at start — so the scene is torn down and rebuilt. Keying <ArScene> on the
   * device id would do the same thing, but doing it explicitly keeps the
   * loading copy honest about what is happening.
   */
  const switchCamera = useCallback(async () => {
    const next = camera.nextDeviceId();
    if (!next) return;

    const previous = camera.deviceId;
    setArActive(false);
    setMarker(null);

    // A lens can refuse to open — busy, or gone since it was enumerated. Losing
    // the camera entirely is a much worse outcome than a switch that does
    // nothing, so fall back to the one that was already working.
    const ok = await startAr(next);
    if (!ok && previous) await startAr(previous);
  }, [camera, startAr]);

  // Track state follows `paused` from either source, so backgrounding the tab
  // saves the same power as pressing the button.
  useEffect(() => {
    if (arActive) camera.setEnabled(!paused);
  }, [arActive, paused, camera]);

  const handleReady = useCallback(() => {
    setHint('Frame a marker');
    setState('scanning');
  }, []);

  const handleError = useCallback((err) => {
    console.error(err);
    setArActive(false);
    setError(describeError(err));
    setState('error');
  }, []);

  const handleFound = useCallback((hit) => {
    setMarker(hit);
    setFound((prev) => new Set(prev).add(hit.id));
    setState('found');
    navigator.vibrate?.(18);
    api.reportScan({
      experienceId: experienceRef.current.id,
      markerId: hit.id,
      targetIndex: hit.targetIndex,
    });
  }, []);

  const handleLost = useCallback((hit, dwellMs) => {
    setHint('Look for the next marker');
    setState((prev) => (prev === 'found' ? 'scanning' : prev));
    if (dwellMs == null) return;
    api.reportScan({
      experienceId: experienceRef.current.id,
      markerId: hit.id,
      targetIndex: hit.targetIndex,
      dwellMs,
    });
  }, []);

  const retry = () => {
    setError(null);
    if (experience) startAr(camera.deviceId);
    else window.location.reload();
  };

  return (
    <div className="ar-route">
      {/* Mounting the scene opens the camera; unmounting releases it. */}
      {arActive && experience && (
        <ArScene
          key={camera.deviceId ?? 'default'}
          experience={experience}
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
        style={marker?.accent ? { '--color-accent': marker.accent } : undefined}
        className="group/ui fixed inset-0 z-10 grid"
      >
        <IntroPanel experience={experience} onStart={() => startAr()} />
        <LoadingPanel label={loadingLabel} />
        <ScanHud
          status={paused ? 'Paused' : state === 'found' ? 'Marker locked' : 'Scanning'}
          hint={paused ? 'Camera paused to save battery' : hint}
          paused={paused}
          marker={marker}
          total={total}
          foundCount={found.size}
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
