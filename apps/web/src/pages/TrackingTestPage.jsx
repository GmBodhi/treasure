import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ArScene from '../ar/ArScene.jsx';
import { loadAframe } from '../ar/aframe.js';
import { getExperience } from '../lib/demoExperience.js';
import { MARKERS, markerImage } from '../lib/markers.js';

/**
 * Synthetic-camera tracking test.
 *
 * Replaces getUserMedia with a canvas stream that shows each marker in turn,
 * then runs the real tracking pipeline and checks that every target in the
 * manifest fires `targetFound`. No camera, no printed marker, no human — this
 * is the test that proves a compiled `.mind` actually matches the artwork.
 */
export default function TrackingTestPage() {
  const [params] = useSearchParams();
  const secondsPerMarker = Number(params.get('seconds') ?? 14);
  const hold = params.has('hold');
  // ?only=chest pins the feed to one marker and never ends — handy for
  // eyeballing a single overlay while it tracks.
  const only = params.get('only');
  const stage = params.has('stage');

  const canvasRef = useRef(null);
  const imagesRef = useRef([]);
  const currentRef = useRef(0);
  const turnStartedAt = useRef(0);
  const eventsRef = useRef([]);

  const [experience, setExperience] = useState(null);
  const [arReady, setArReady] = useState(false);
  const [current, setCurrent] = useState(0);
  const [found, setFound] = useState(() => new Map());
  const [verdict, setVerdict] = useState({ tone: 'pending', text: 'Starting…' });

  // --- fake camera + feed --------------------------------------------------
  useEffect(() => {
    let raf = 0;
    let cancelled = false;

    (async () => {
      try {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Must be installed before MindAR ever asks for a camera, which is why
        // <ArScene> is not rendered until this effect has finished.
        const stream = canvas.captureStream(30);
        if (!navigator.mediaDevices) navigator.mediaDevices = {};
        navigator.mediaDevices.getUserMedia = async () => stream;
        navigator.getUserMedia = (_constraints, ok) => ok(stream);

        imagesRef.current = await Promise.all(MARKERS.map((m) => markerImage(m)));
        if (cancelled) return;

        const draw = (t) => {
          const img = imagesRef.current[currentRef.current];
          ctx.fillStyle = '#6b6f75';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          if (img) {
            const drift = Math.sin(t / 700) * 6;
            const scale = 0.86 + Math.sin(t / 1100) * 0.02;
            const w = canvas.width * scale;
            const h = (w / img.naturalWidth) * img.naturalHeight;
            ctx.save();
            ctx.translate(canvas.width / 2 + drift, canvas.height / 2 + drift * 0.4);
            ctx.rotate(Math.sin(t / 1600) * 0.012);
            // Oblique view: a marker is almost never photographed dead-on, and
            // a fronto-parallel feed is the one case pose estimation cannot get
            // wrong.
            ctx.transform(1, 0.05 * Math.sin(t / 1300), -0.2 + 0.05 * Math.cos(t / 900), 0.84, 0, 0);
            ctx.drawImage(img, -w / 2, -h / 2, w, h);
            ctx.restore();
          }
          raf = requestAnimationFrame(draw);
        };
        raf = requestAnimationFrame(draw);

        await loadAframe();
        const loaded = getExperience('demo');
        if (cancelled) return;

        if (loaded.markers.length !== MARKERS.length) {
          setVerdict({
            tone: 'fail',
            text: `Manifest has ${loaded.markers.length} markers but the art module has ${MARKERS.length}. Recompile in the studio.`,
          });
        }
        setExperience(loaded);
      } catch (err) {
        window.__testResult = { passed: false, error: err.message };
        setVerdict({ tone: 'fail', text: `Error: ${err.message}` });
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  const handleFound = useCallback((marker) => {
    // Every hit, not just the first, so a target matching the wrong image shows
    // up as a mismatch instead of hiding behind the de-duplication.
    eventsRef.current.push({
      showing: MARKERS[currentRef.current]?.id ?? 'none',
      fired: marker.id,
    });
    setFound((prev) => {
      if (prev.has(marker.id)) return prev;
      const next = new Map(prev);
      next.set(marker.id, performance.now() - turnStartedAt.current);
      return next;
    });
  }, []);

  // --- turn sequencer ------------------------------------------------------
  const foundRef = useRef(found);
  foundRef.current = found;

  useEffect(() => {
    if (!arReady) return undefined;
    let cancelled = false;

    (async () => {
      /**
       * A canvas-backed MediaStream does not autoplay without user activation
       * the way a real camera track does, so the harness starts playback
       * itself. Nothing on the device path needs this.
       */
      const video = document.querySelector('video');
      if (video) {
        video.muted = true;
        video.playsInline = true;
        await video.play().catch(() => {});
      }

      if (only) {
        const index = Math.max(0, MARKERS.findIndex((m) => m.id === only));
        currentRef.current = index;
        turnStartedAt.current = performance.now();
        setCurrent(index);
        return;
      }

      for (let i = 0; i < MARKERS.length; i++) {
        if (cancelled) return;
        currentRef.current = i;
        turnStartedAt.current = performance.now();
        setCurrent(i);

        const deadline = performance.now() + secondsPerMarker * 1000;
        // Move on as soon as this marker is found; wait out the clock otherwise.
        while (
          !cancelled &&
          performance.now() < deadline &&
          (hold || !foundRef.current.has(MARKERS[i].id))
        ) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
      if (cancelled) return;

      currentRef.current = MARKERS.length;
      setCurrent(MARKERS.length);

      const missing = MARKERS.filter((m) => !foundRef.current.has(m.id)).map((m) => m.id);
      window.__testResult = {
        passed: missing.length === 0,
        found: [...foundRef.current.keys()],
        events: eventsRef.current,
        missing,
      };
      setVerdict(
        missing.length === 0
          ? { tone: 'pass', text: `All ${MARKERS.length} targets tracked.` }
          : { tone: 'fail', text: `Not tracked: ${missing.join(', ')}` },
      );
      setArReady(false); // unmounts <ArScene>, releasing the (fake) camera
    })();

    return () => {
      cancelled = true;
    };
  }, [arReady, hold, only, secondsPerMarker]);

  const verdictColor =
    verdict.tone === 'pass' ? 'text-ok' : verdict.tone === 'fail' ? 'text-warn' : 'text-muted';

  return (
    <div className="ar-route">
      {experience && (
        <ArScene
          experience={experience}
          onReady={() => setArReady(true)}
          onFound={handleFound}
          onError={(err) => {
            window.__testResult = { passed: false, error: err.message };
            setVerdict({ tone: 'fail', text: `Error: ${err.message}` });
          }}
        />
      )}

      {/* The AR scene runs for real, just behind the report. */}
      <style>{`a-scene { opacity: ${stage ? 1 : 0.25}; }`}</style>

      <div
        className={`relative z-20 mx-auto max-w-[780px] px-5 pt-9 pb-20 ${stage ? 'hidden' : ''}`}
      >
        <h1 className="mb-1.5 text-[25px] tracking-[-0.02em]">Tracking self-test</h1>
        <p className="mb-[18px] max-w-[62ch] text-muted">
          Replaces the camera with a synthetic feed that shows each marker in turn, then runs the
          real tracking pipeline and checks that every target in the manifest fires{' '}
          <code className="font-mono">targetFound</code>.
        </p>

        <div className="rounded-2xl border border-stroke bg-ink/90 px-5 py-[18px]">
          {MARKERS.map((marker, i) => {
            const ms = found.get(marker.id);
            const status =
              ms != null ? (
                <span className="text-ok">found in {(ms / 1000).toFixed(1)}s</span>
              ) : i < current ? (
                <span className="text-warn">not found</span>
              ) : i === current ? (
                <span className="text-muted">showing…</span>
              ) : (
                <span className="text-muted">queued</span>
              );

            return (
              <div
                key={marker.id}
                className={`flex items-center justify-between gap-3.5 ${
                  i > 0 ? 'mt-2.5 border-t border-white/[0.08] pt-2.5' : ''
                }`}
              >
                <span>
                  {marker.code} · {marker.title}
                </span>
                <span className="font-mono text-[13px] text-muted">
                  targetIndex {i} — {status}
                </span>
              </div>
            );
          })}
        </div>

        <div className={`mt-[18px] text-lg font-semibold ${verdictColor}`}>{verdict.text}</div>

        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className="mt-4 block w-[220px] rounded-xl border border-stroke"
        />
      </div>
    </div>
  );
}
