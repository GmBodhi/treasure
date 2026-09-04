import { useEffect, useState } from 'react';
import { ArrowRightIcon } from './icons.jsx';
import Prose from './Prose.jsx';

const GLITCH_MS = 260;
const BLACK_MS = 340;

/**
 * The cinematic beat that takes over once a station is found: the live feed
 * glitches out, cuts to black, then one card fades in over it with what was
 * recovered, breadcrumb quote and reveal together, nothing else.
 *
 * Mounted only while `ScanPage` is showing a find — deliberately independent
 * of AR tracking state, so losing the marker mid-read (phone lowered, hand
 * unsteady) does not cut the reveal short the way re-tracking would.
 *
 * The phase timeline is driven by `marker.id` rather than mount/unmount: the
 * component stays mounted across a find so its own fade-out can play, and a
 * *new* find (a different marker.id) should restart the sequence rather than
 * silently swapping the text underneath the old one.
 */
export default function FoundReveal({ marker, onContinue, onClose }) {
  const [phase, setPhase] = useState('glitch');

  useEffect(() => {
    setPhase('glitch');
    const toBlack = setTimeout(() => setPhase('black'), GLITCH_MS);
    const toReveal = setTimeout(() => setPhase('reveal'), GLITCH_MS + BLACK_MS);
    return () => {
      clearTimeout(toBlack);
      clearTimeout(toReveal);
    };
  }, [marker?.id]);

  const cta = marker?.cta;
  const glitching = phase === 'glitch';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      className={`fixed inset-0 z-20 overflow-hidden transition-colors duration-150 ${glitching ? '' : 'bg-ink'}`}
    >
      {/* The live camera feed shows through here — glitch bands tear across it
          for one beat before the cut to black, rather than covering it outright. */}
      {glitching && (
        <div className="absolute inset-0 animate-glitch-flicker">
          <span className="absolute inset-x-0 top-[18%] h-[7%] bg-warn/70 mix-blend-screen animate-glitch-band-a" />
          <span className="absolute inset-x-0 top-[47%] h-[5%] bg-ok/60 mix-blend-screen animate-glitch-band-b" />
          <span className="absolute inset-x-0 top-[68%] h-[4%] bg-accent/70 mix-blend-screen animate-glitch-band-a" />
          <span className="absolute inset-0 bg-paper mix-blend-difference animate-glitch-invert" />
        </div>
      )}

      {/* One scrollable column, not a centered flex box — the reveal card can
          run much longer than a level blurb ever did, and content that
          overflows a centered container can end up unreachable by scroll. */}
      <div
        className={
          'relative z-10 h-full overflow-y-auto ' +
          'transition-opacity duration-700 ease-out-back ' +
          (phase === 'reveal' ? 'opacity-100' : 'pointer-events-none opacity-0')
        }
      >
        {/* Faint scanline texture — the same declassified-file vocabulary the
            station list and found-card use elsewhere in this route. */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 opacity-[0.05] [background:repeating-linear-gradient(0deg,#fff_0px,#fff_1px,transparent_1px,transparent_3px)]"
        />

        <div
          className={
            'mx-auto w-[min(480px,100%)] px-6 text-center ' +
            'pt-[calc(64px+env(safe-area-inset-top))] pb-[calc(40px+env(safe-area-inset-bottom))]'
          }
        >
          <p className="font-mono text-[11px] tracking-[0.22em] uppercase text-ok">
            {marker?.subtitle ?? 'Recovered'}
          </p>
          <h1 className="mt-2 mb-4 break-words text-[clamp(26px,8vw,38px)] leading-[1.1] tracking-[-0.02em]">
            {marker?.title ?? marker?.id ?? ''}
          </h1>

          {marker?.breadcrumb && (
            <p className="mb-5 border-l-2 border-accent/70 pl-3 text-left text-[15px] italic leading-snug text-accent/90">
              “{marker.breadcrumb}”
            </p>
          )}

          {marker?.reveal && (
            <div className="rounded-xl border border-accent/30 bg-accent/[0.06] px-4 py-3.5 text-left">
              <Prose className="break-words text-[15px] leading-relaxed" html={marker.reveal} />
              {marker?.revealImage && (
                <img
                  src={marker.revealImage}
                  alt=""
                  className="mt-3 block w-full rounded-lg border border-stroke"
                />
              )}
            </div>
          )}

          {cta && (
            <button
              type="button"
              onClick={() => onContinue(cta.href ?? '/')}
              aria-label={cta.label ?? 'Continue'}
              title={cta.label ?? 'Continue'}
              className={
                'mt-7 grid size-16 shrink-0 place-items-center rounded-full bg-accent text-accent-ink ' +
                'transition-transform duration-150 ease-out-back active:scale-90 animate-glow-pulse'
              }
            >
              <ArrowRightIcon size={22} />
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        aria-label="Stop camera"
        onClick={onClose}
        className={
          'absolute right-4 top-[calc(14px+env(safe-area-inset-top))] z-10 grid size-10 place-items-center ' +
          'rounded-full border border-stroke bg-surface text-[15px] text-paper backdrop-blur-md cursor-pointer ' +
          'transition-opacity duration-300 ' +
          (phase === 'reveal' ? 'opacity-100' : 'opacity-0 pointer-events-none')
        }
      >
        ✕
      </button>
    </div>
  );
}
