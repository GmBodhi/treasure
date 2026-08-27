import MarkerSheet from './MarkerSheet.jsx';
import Reticle from './Reticle.jsx';
import { SHOW_HUD } from './panels.js';

/**
 * Transparent overlay on the live camera feed.
 *
 * `pointer-events-none` on the container with `auto` on the children is what
 * lets the user still interact with the scene between the controls — the HUD
 * covers the whole viewport but only its own chrome is clickable.
 */
export default function ScanHud({ status, hint, marker, total, foundCount, onClose, controls, paused }) {
  return (
    <section
      className={
        'col-start-1 row-start-1 relative grid grid-rows-[auto_1fr_auto] pointer-events-none ' +
        'px-4 pt-[calc(14px+env(safe-area-inset-top))] pb-[calc(16px+env(safe-area-inset-bottom))] ' +
        'invisible opacity-0 transition-[opacity,visibility] duration-[260ms] ease-out-back ' +
        `[&>*]:pointer-events-auto ${SHOW_HUD}`
      }
    >
      {/* A paused feed keeps showing its last frame, which is indistinguishable
          from a frozen app. Say so. */}
      {paused && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-ink/55 backdrop-blur-[2px]">
          <p className="text-sm tracking-[0.16em] uppercase text-muted">Paused</p>
        </div>
      )}

      <header className="relative flex items-center justify-between">
        <span className="inline-flex items-center gap-2 rounded-full border border-stroke bg-surface px-[15px] py-[9px] text-[13px] font-medium backdrop-blur-md">
          <i
            className={`size-[7px] rounded-full bg-accent group-data-[state=found]/ui:bg-ok group-data-[state=found]/ui:animate-none ${
              paused ? '' : 'animate-pulse-dot'
            }`}
          />
          <span>{status}</span>
        </span>
        <button
          type="button"
          aria-label="Stop camera"
          onClick={onClose}
          className="grid size-10 place-items-center rounded-full border border-stroke bg-surface text-[15px] text-paper backdrop-blur-md cursor-pointer"
        >
          ✕
        </button>
      </header>

      <Reticle hidden={paused} />

      <div className="relative flex flex-col gap-3">
        <p className="m-0 text-center text-sm text-muted transition-opacity duration-200 ease-out-back group-data-[state=found]/ui:opacity-0">
          {hint}
        </p>
        {controls}
      </div>

      <MarkerSheet marker={marker} total={total} />

      {foundCount > 0 && total > 1 && (
        <div className="absolute right-4 top-[calc(64px+env(safe-area-inset-top))] rounded-full border border-stroke bg-surface px-3 py-1.5 text-xs text-muted">
          {`${foundCount} / ${total} found`}
        </div>
      )}
    </section>
  );
}
