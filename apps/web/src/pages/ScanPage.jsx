import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import ArScene from '../ar/ArScene.jsx';
import { loadAframe } from '../ar/aframe.js';
import CameraControls from '../components/CameraControls.jsx';
import ErrorPanel from '../components/ErrorPanel.jsx';
import FoundReveal from '../components/FoundReveal.jsx';
import LoadingPanel from '../components/LoadingPanel.jsx';
import ScanHud from '../components/ScanHud.jsx';
import StationPanel from '../components/StationPanel.jsx';
import { useCamera } from '../hooks/useCamera.js';
import { useHunt } from '../hooks/useHunt.js';
import { usePageHidden } from '../hooks/usePageVisibility.js';
import { useWakeLock } from '../hooks/useWakeLock.js';
import { useStation } from '../hooks/useStation.js';
import { describeError } from '../lib/describeError.js';

/**
 * The camera, pointed at exactly one station: the one the team's current level
 * sends them to. Finding it is what unlocks the next level.
 */
export default function ScanPage() {
  const navigate = useNavigate();
  const { team, current, finished, complete, started } = useHunt();

  /**
   * The level this scan session is for, pinned at mount.
   *
   * `current` moves on its own now: a teammate finding this station while you
   * are standing in front of the marker advances the team, and following that
   * would swap the compiled target out from under a running tracker and point
   * the camera at a station this phone has not been sent to. So the scan holds
   * the level it started with, and `superseded` says when the team has moved
   * past it — which is a thing to tell somebody, not to silently act on.
   */
  const [pinned, setPinned] = useState(current);
  useEffect(() => {
    if (!pinned && current) setPinned(current);
  }, [current, pinned]);

  const superseded = pinned != null && (finished || current == null || current.n !== pinned.n);

  const { status: loadStatus, scene, error: loadError } = useStation(pinned);

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

  // Whether the cinematic reveal is on screen. Deliberately separate from
  // `state`: a find should hold on screen even if the marker later drops out
  // of frame (phone lowered to read it), which `state` does not — see
  // `handleLost` below.
  const [revealed, setRevealed] = useState(false);

  // The tab being hidden and the user pressing pause are the same thing to the
  // tracker, but only one of them should survive coming back to the tab.
  const paused = manualPause || hidden;

  // Only while actually scanning. Holding the lock through a manual pause would
  // defeat the point of the pause button, which exists to save battery.
  useWakeLock(arActive && !paused);

  // The AR callbacks fire from DOM listeners, so they read through refs rather
  // than closing over values a re-render could stale out.
  const levelRef = useRef(pinned);
  levelRef.current = pinned;
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
    setRevealed(false);
    setManualPause(false);
    camera.close();
    navigate('/');
  }, [camera, navigate]);

  /**
   * The reveal's own CTA. Not `stopAr`, because the destination is whatever
   * the station's content says (`cta.href`) rather than always the level
   * space — the same reveal has to work for a level's "Continue" today and
   * for whatever else a future station's manifest points at.
   */
  const handleContinue = useCallback(
    (href) => {
      const target = href || '/';
      const external = /^https?:\/\//.test(target);
      setArActive(false);
      setMarker(null);
      setRevealed(false);
      setManualPause(false);
      camera.close();
      if (external) window.open(target, '_blank', 'noopener');
      navigate(external ? '/' : target);
    },
    [camera, navigate],
  );

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
    setRevealed(true);
    navigator.vibrate?.(18);
    completeRef.current(level.n, level.station.id);
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

  // Nothing to scan for: no team on this device, or the trail was already run
  // out before this screen opened. Either way the level space is the only
  // sensible place to be. `pinned` guards the second half — a team finishing
  // mid-scan is `superseded`, handled below, not a redirect out of a reveal
  // somebody is still reading.
  // `started` guards the direct-URL route to the camera: the level space holds
  // a team on the waiting screen, but /scan is a link somebody can keep open.
  if (!team || !started || (finished && !pinned)) return <Navigate to="/" replace />;

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

      {revealed && <FoundReveal marker={marker} onContinue={handleContinue} onClose={stopAr} />}

      {/* Someone else got there first. Shown over everything except a reveal
          this phone has already earned, because the one thing worse than
          scanning a marker your team no longer needs is being told so while
          you are reading what you found. */}
      {superseded && !revealed && (
        <div className="fixed inset-x-0 top-[calc(12px+env(safe-area-inset-top))] z-30 mx-auto w-[min(420px,calc(100%-24px))] rounded-xl border border-ok/40 bg-ink/95 px-4 py-3.5">
          <p className="text-[13.5px] text-paper/90">
            A teammate found this station. Your team has already moved on.
          </p>
          <button
            type="button"
            onClick={stopAr}
            className="mt-2 cursor-pointer font-mono text-[13px] text-ok"
          >
            Go to the next level →
          </button>
        </div>
      )}

      <main
        data-state={state}
        className="group/ui fixed inset-0 z-10 grid grid-rows-[minmax(0,1fr)]"
      >
        <StationPanel level={pinned} onStart={() => startAr()} onBack={() => navigate('/')} />
        <LoadingPanel label={loadingLabel} />
        <ScanHud
          status={paused ? 'Paused' : state === 'found' ? 'Station found' : 'Scanning'}
          hint={paused ? 'Camera paused to save battery' : hint}
          paused={paused}
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
