import { useEffect, useState } from 'react';
import Prose from './Prose.jsx';
import { ArrowRightIcon } from './icons.jsx';

const GLITCH_MS = 260;
const BLACK_MS = 340;

/**
 * The cinematic beat that takes over once a station is found: the live feed
 * glitches out, cuts to black, then the story fragment fades in over it.
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

      {/* Scrollable, but still centred when the content is short: the outer
          element scrolls and the inner one is min-h-full + justify-center. A
          reveal can be two lines or a full interview transcript, and a fixed
          centred column would simply cut the long ones off mid-cipher. */}
      <div
        className={
          'relative z-10 h-full overflow-y-auto overscroll-contain ' +
          'transition-opacity duration-700 ease-out-back ' +
          (phase === 'reveal' ? 'opacity-100' : 'opacity-0')
        }
      >
      <div
        className={
          'flex min-h-full flex-col items-center justify-center gap-5 px-6 text-center ' +
          'pt-[calc(56px+env(safe-area-inset-top))] pb-[calc(32px+env(safe-area-inset-bottom))]'
        }
      >
        {/* Faint scanline texture — the same declassified-file vocabulary the
            station list and found-card use elsewhere in this route. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.05] [background:repeating-linear-gradient(0deg,#fff_0px,#fff_1px,transparent_1px,transparent_3px)]"
        />

        <p className="font-mono text-[11px] tracking-[0.22em] uppercase text-ok">
          {marker?.subtitle ?? 'Decrypted'}
        </p>
        <h1 className="max-w-[18ch] text-[clamp(30px,9vw,48px)] leading-[1.05] tracking-[-0.02em]">
          {marker?.title ?? marker?.id ?? ''}
        </h1>
        {marker?.breadcrumb && (
          <p className="max-w-[38ch] border-l-2 border-accent/70 pl-3 text-[15px] italic leading-snug text-accent/90">
            “{marker.breadcrumb}”
          </p>
        )}
        {/* The payload, ahead of the story. Same order as the level space, and
            for the same reason: this is the thing the team came to collect.
            Left-aligned because it is often a cipher or an identifier, and a
            centred block of monospace is unreadable and easy to transcribe
            wrong. */}
        {marker?.reveal && (
          <div className="w-full max-w-[42ch] rounded-xl border border-accent/30 bg-accent/[0.06] px-4 py-3.5 text-left">
            <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-accent">Recovered</p>
            <Prose
              className="mt-1 break-words text-[15px] leading-relaxed text-paper"
              html={marker.reveal}
            />
            {marker.revealImage && (
              <img
                src={marker.revealImage}
                alt=""
                className="mt-3 block w-full rounded-lg border border-stroke"
              />
            )}
          </div>
        )}

        <p className="max-w-[42ch] text-[14.5px] leading-relaxed text-muted">{marker?.body ?? ''}</p>

        {cta && (
          <button
            type="button"
            onClick={() => onContinue(cta.href ?? '/')}
            aria-label={cta.label ?? 'Continue'}
            title={cta.label ?? 'Continue'}
            className={
              'mt-3 grid size-16 shrink-0 place-items-center rounded-full bg-accent text-accent-ink ' +
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
