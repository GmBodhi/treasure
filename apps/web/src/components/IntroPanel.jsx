import Button from './Button.jsx';
import { EYEBROW, LEDE, PANEL_BASE, PANEL_INNER, SHOW_INTRO, TITLE } from './panels.js';

const BULLET =
  "relative pl-[22px] text-sm text-muted before:content-[''] before:absolute before:left-1 " +
  'before:top-2 before:size-1.5 before:rounded-full before:bg-accent';

export default function IntroPanel({ experience, onStart }) {
  const count = experience?.markers?.length ?? 0;

  return (
    <section className={`${PANEL_BASE} ${SHOW_INTRO}`}>
      <div className={PANEL_INNER}>
        <p className={EYEBROW}>
          {count ? `${count} marker${count === 1 ? '' : 's'}` : 'Augmented reality'}
        </p>
        <h1 className={TITLE}>{experience?.name ?? 'Treasure AR'}</h1>
        <p className={LEDE}>Point your camera at a marker to reveal what it is hiding.</p>

        <ul className="mb-7 grid gap-2 list-none p-0">
          <li className={BULLET}>Good, even light</li>
          <li className={BULLET}>Whole marker in frame</li>
          <li className={BULLET}>Hold steady for a beat</li>
        </ul>

        {/* The camera prompt must be behind a user gesture on iOS. */}
        <Button onClick={onStart} disabled={!experience}>
          Start camera
        </Button>

        <p className="mt-3.5 text-xs text-paper/40">
          Video stays on your device. Only marker hits are sent to the server.
        </p>
      </div>
    </section>
  );
}
