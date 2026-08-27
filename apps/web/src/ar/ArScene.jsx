import { useEffect, useRef } from 'react';
import { MINDAR_SYSTEM } from './aframe.js';
import Overlay from './overlays/Overlay.jsx';

/** Serialise an object into A-Frame's `key: value; key: value` attribute syntax. */
const styleString = (props) =>
  Object.entries(props)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');

/** Video overlays need their source registered in <a-assets> up front. */
function Assets({ markers }) {
  const videos = markers.filter((m) => m.overlay?.type === 'video' && m.overlay.src);
  if (videos.length === 0) return null;
  return (
    <a-assets timeout="12000">
      {videos.map((m) => (
        <video
          key={m.id}
          id={`video-${m.id}`}
          src={m.overlay.src}
          preload="auto"
          loop
          muted
          playsInline
          webkit-playsinline="true"
          crossOrigin="anonymous"
        />
      ))}
    </a-assets>
  );
}

/**
 * The live MindAR scene.
 *
 * Mounting this component opens the camera; unmounting releases it. That is the
 * whole contract — the parent decides *whether* AR is running by rendering this
 * or not, and never reaches into the scene itself.
 *
 * Two things resist being expressed as React state and stay imperative here:
 * MindAR's start/stop live on an A-Frame *system* rather than on the DOM, and
 * `targetFound`/`targetLost` are DOM events on the target entities. Both are
 * wired up in effects against refs.
 */
export default function ArScene({
  experience,
  camera,
  paused = false,
  onFound,
  onLost,
  onReady,
  onError,
}) {
  const sceneRef = useRef(null);
  const targetRefs = useRef(new Map());
  const foundAt = useRef(new Map());
  const startedRef = useRef(false);

  // Handlers are read through a ref so a re-render with new callbacks never
  // tears down and restarts the camera.
  const handlers = useRef({ onFound, onLost, onReady, onError });
  handlers.current = { onFound, onLost, onReady, onError };

  const tracking = experience.tracking ?? {};
  const mindarAttr = styleString({
    imageTargetSrc: experience.targetUrl,
    autoStart: false,
    uiLoading: 'no',
    uiScanning: 'no',
    uiError: 'no',
    maxTrack: tracking.maxTrack ?? 1,
    filterMinCF: tracking.filterMinCF,
    filterBeta: tracking.filterBeta,
    missTolerance: tracking.missTolerance,
    warmupTolerance: tracking.warmupTolerance,
  });

  // --- target events -------------------------------------------------------
  useEffect(() => {
    const listeners = [];

    for (const marker of experience.markers) {
      const el = targetRefs.current.get(marker.id);
      if (!el) continue;

      const video = () =>
        marker.overlay?.type === 'video' ? document.getElementById(`video-${marker.id}`) : null;

      const onTargetFound = () => {
        foundAt.current.set(marker.id, performance.now());
        video()?.play?.().catch(() => {});
        handlers.current.onFound?.(marker);
      };
      const onTargetLost = () => {
        const startedAt = foundAt.current.get(marker.id);
        const dwellMs = startedAt ? performance.now() - startedAt : null;
        foundAt.current.delete(marker.id);
        video()?.pause?.();
        handlers.current.onLost?.(marker, dwellMs);
      };

      el.addEventListener('targetFound', onTargetFound);
      el.addEventListener('targetLost', onTargetLost);
      listeners.push([el, onTargetFound, onTargetLost]);
    }

    return () => {
      for (const [el, found, lost] of listeners) {
        el.removeEventListener('targetFound', found);
        el.removeEventListener('targetLost', lost);
      }
    };
  }, [experience]);

  // --- camera lifecycle ----------------------------------------------------
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return undefined;
    let cancelled = false;

    /**
     * A-Frame attaches systems and components on 'loaded'. MindAR's own
     * 'arReady' does not fire until tracking starts, so waiting for it here
     * would deadlock — that wait belongs after start().
     */
    const sceneLoaded = () =>
      scene.hasLoaded
        ? Promise.resolve()
        : new Promise((resolve) => scene.addEventListener('loaded', resolve, { once: true }));

    // MindAR opens the camera itself with fixed constraints. When a session is
    // supplied it has already opened the lens the user picked, so this hands
    // MindAR that stream instead of letting it request its own.
    const releaseIntercept = camera?.interceptNextRequest?.() ?? (() => {});

    (async () => {
      try {
        await sceneLoaded();
        if (cancelled) return;

        const system = scene.systems?.[MINDAR_SYSTEM];
        if (!system) throw new Error('MindAR system not attached to the scene');

        // Subscribe before starting so neither event can be missed.
        const ready = new Promise((resolve, reject) => {
          const onArReady = () => {
            scene.removeEventListener('arError', onArError);
            resolve();
          };
          const onArError = (event) => {
            scene.removeEventListener('arReady', onArReady);
            reject(new Error(event.detail?.error ?? 'MindAR failed to initialise'));
          };
          scene.addEventListener('arReady', onArReady, { once: true });
          scene.addEventListener('arError', onArError, { once: true });
        });

        await system.start();
        await ready;
        if (cancelled) return;

        startedRef.current = true;
        handlers.current.onReady?.();
      } catch (err) {
        if (!cancelled) handlers.current.onError?.(err);
      }
    })();

    return () => {
      cancelled = true;
      startedRef.current = false;
      releaseIntercept();
      // Stopping the system releases the camera track; React then removes the
      // <a-scene> itself, which tears down the renderer and the video element.
      try {
        scene.systems?.[MINDAR_SYSTEM]?.stop();
      } catch (err) {
        console.warn('MindAR stop failed', err);
      }
    };
  }, [experience, camera]);

  // --- pause / resume ------------------------------------------------------
  /**
   * MindAR keeps decoding frames while a tab is hidden, which costs battery for
   * nothing.
   *
   * `pause`/`unpause`, not `stop`/`start`: MindAR's `stop()` stops the media
   * tracks, removes its <video> and disposes the controller, and its `start()`
   * requests a *fresh* camera with its own constraints — which would silently
   * discard the lens, zoom and torch the user chose, and re-download the target.
   */
  useEffect(() => {
    const system = sceneRef.current?.systems?.[MINDAR_SYSTEM];
    if (!system || !startedRef.current) return;
    try {
      if (paused) system.pause();
      else system.unpause();
    } catch (err) {
      console.warn('MindAR pause/unpause failed', err);
    }
  }, [paused]);

  return (
    // MindAR measures this element — an <a-scene> whose parent has no height
    // produces a mis-sized video and a broken projection. See src/styles/ui.css.
    <div className="ar-scene-host">
      <a-scene
        ref={sceneRef}
        mindar-image={mindarAttr}
        embedded="true"
        color-space="sRGB"
        renderer="colorManagement: true, physicallyCorrectLights"
        vr-mode-ui="enabled: false"
        device-orientation-permission-ui="enabled: false"
      >
        <Assets markers={experience.markers} />
        <a-camera
          position="0 0 0"
          look-controls="enabled: false"
          cursor="fuse: false; rayOrigin: mouse"
        />
        {experience.markers.map((marker) => (
          <a-entity
            key={marker.id}
            ref={(el) => {
              if (el) targetRefs.current.set(marker.id, el);
              else targetRefs.current.delete(marker.id);
            }}
            id={`target-${marker.id}`}
            data-marker-id={marker.id}
            mindar-image-target={`targetIndex: ${marker.targetIndex}`}
          >
            <Overlay marker={marker} />
          </a-entity>
        ))}
      </a-scene>
    </div>
  );
}
