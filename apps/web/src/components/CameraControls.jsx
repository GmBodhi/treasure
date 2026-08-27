// The background is applied per state rather than appended: two competing
// `bg-*` utilities resolve by stylesheet order, not by class-attribute order,
// so `${CHIP} bg-accent` would not reliably win over a `bg-surface` in CHIP.
const CHIP =
  'grid size-11 place-items-center rounded-full border border-stroke ' +
  'backdrop-blur-md cursor-pointer transition-[transform,background-color] ' +
  'duration-150 ease-out-back active:scale-95 disabled:opacity-35 disabled:pointer-events-none';

const CHIP_IDLE = 'bg-surface text-paper';
const CHIP_ON = 'bg-accent text-accent-ink';

function FlipIcon() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8h11a4 4 0 0 1 4 4v1" />
      <path d="m6 5-3 3 3 3" />
      <path d="M21 16H10a4 4 0 0 1-4-4v-1" />
      <path d="m18 19 3-3-3-3" />
    </svg>
  );
}

function PauseIcon({ paused }) {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true">
      {paused ? <path d="M8 5.5v13l11-6.5z" /> : <path d="M8 5h3v14H8zm5 0h3v14h-3z" />}
    </svg>
  );
}

function TorchIcon({ on }) {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 2 4.5 13H11l-1 9 8.5-11H12l1-9Z" />
    </svg>
  );
}

/**
 * Live camera controls, rendered over the feed.
 *
 * Pause is always available — it costs nothing but stopping work. The rest are
 * conditional on the device actually reporting the capability:
 * `MediaStreamTrack.getCapabilities()` is honest about this, and a zoom slider
 * that silently does nothing is worse than no slider. iOS Safari in particular
 * exposes neither zoom nor torch, but does list its lenses as separate devices,
 * so the flip button is usually the one that survives there.
 *
 * While paused nothing else is actionable: the sensor is not delivering frames,
 * so zoom, torch and lens switching would all be lies.
 */
export default function CameraControls({
  zoomRange,
  zoom,
  onZoom,
  torchSupported,
  torch,
  onToggleTorch,
  canSwitch,
  onSwitch,
  paused,
  onTogglePause,
  hidden,
}) {
  return (
    <div
      className={`flex flex-col gap-3 transition-opacity duration-200 ease-out-back ${
        hidden ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      {zoomRange && !paused && (
        <div className="flex items-center gap-3 rounded-full border border-stroke bg-surface px-4 py-2 backdrop-blur-md">
          <span className="font-mono text-[11px] text-muted tabular-nums">
            {zoom.toFixed(1)}×
          </span>
          <input
            type="range"
            aria-label="Zoom"
            min={zoomRange.min}
            max={zoomRange.max}
            step={zoomRange.step}
            value={zoom}
            onChange={(event) => onZoom(Number(event.target.value))}
            className="h-1 w-full flex-1 cursor-pointer appearance-none rounded-full bg-white/20 [accent-color:var(--color-accent)]"
          />
          <span className="font-mono text-[11px] text-muted tabular-nums">
            {zoomRange.max.toFixed(0)}×
          </span>
        </div>
      )}

      <div className="flex justify-center gap-3">
        <button
          type="button"
          className={`${CHIP} ${paused ? CHIP_ON : CHIP_IDLE}`}
          onClick={onTogglePause}
          aria-pressed={paused}
          aria-label={paused ? 'Resume camera' : 'Pause camera'}
          title={paused ? 'Resume' : 'Pause the camera to save battery'}
        >
          <PauseIcon paused={paused} />
        </button>

        <button
          type="button"
          className={`${CHIP} ${CHIP_IDLE}`}
          onClick={onSwitch}
          disabled={!canSwitch || paused}
          aria-label="Switch camera"
          title={canSwitch ? 'Switch camera' : 'Only one camera available'}
        >
          <FlipIcon />
        </button>

        <button
          type="button"
          className={`${CHIP} ${torch ? CHIP_ON : CHIP_IDLE}`}
          onClick={onToggleTorch}
          disabled={!torchSupported || paused}
          aria-pressed={torch}
          aria-label="Toggle flashlight"
          title={torchSupported ? 'Flashlight' : 'This camera has no controllable torch'}
        >
          <TorchIcon on={torch} />
        </button>
      </div>
    </div>
  );
}
