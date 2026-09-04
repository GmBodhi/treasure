import Button from './Button.jsx';
import Prose from './Prose.jsx';
import { EYEBROW, LEDE, PANEL_BASE, PANEL_INNER, SHOW_INTRO, TITLE } from './panels.js';

const BULLET =
  "relative pl-[22px] text-sm text-muted before:content-[''] before:absolute before:left-1 " +
  'before:top-2 before:size-1.5 before:rounded-full before:bg-accent';

/**
 * What the team sees before the camera opens: where they are going and what
 * they are looking for.
 *
 * Repeated here rather than left behind on the level space because this is the
 * screen someone actually stands in front of the marker holding — the brief
 * needs to be readable at the moment it is being used, not one navigation away.
 */
export default function StationPanel({ level, onStart, onBack }) {
  return (
    <section className={`${PANEL_BASE} ${SHOW_INTRO}`}>
      <div className={PANEL_INNER}>
        {/* No location here either. This screen is reachable before a team has
            worked out where to go, and naming the place would hand them the
            answer on the way to the camera. */}
        <p className={EYEBROW}>Level {level?.n}</p>
        <h1 className={TITLE}>{level?.title ?? 'Station'}</h1>
        <Prose className={LEDE} html={level?.station?.brief} />

        {/* Framing tips, not instructions. First thing to go when the screen is
            short — a landscape phone has ~390px of height and the button
            matters more than the advice. */}
        <ul className="mb-7 grid gap-2 list-none p-0 short:hidden">
          <li className={BULLET}>Good, even light</li>
          <li className={BULLET}>Whole marker in frame</li>
          <li className={BULLET}>Hold steady for a beat</li>
        </ul>

        {/* The camera prompt must be behind a user gesture on iOS. */}
        <Button onClick={onStart} disabled={!level}>
          Start camera
        </Button>

        <button
          type="button"
          onClick={onBack}
          className="mt-4 block font-mono text-[13px] text-muted cursor-pointer"
        >
          ← back to levels
        </button>

        <p className="mt-3.5 text-xs text-paper/40 short:hidden">
          Video stays on your device. Only station hits are reported.
        </p>
      </div>
    </section>
  );
}
