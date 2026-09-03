import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import { useHunt } from '../hooks/useHunt.js';
import Prose from '../components/Prose.jsx';
import { LEVEL_COUNT, isKnownTeam } from '../lib/hunt.js';

const SHELL = 'mx-auto w-[min(560px,100%)] px-5 pt-[calc(28px+env(safe-area-inset-top))] pb-[calc(40px+env(safe-area-inset-bottom))]';
const EYEBROW = 'text-[11px] tracking-[0.18em] uppercase text-accent';
const MONO = 'font-mono text-[13px] text-muted';

/**
 * The gate. A team code is not authentication — it decides which of the routes
 * this device follows, and keys the progress stored on it.
 *
 * Unrecognised codes are warned about but not rejected: on the day, an organiser
 * needing a spare device to work matters more than the app being strict about a
 * typo, and an unknown code still gets a stable route.
 */
function TeamGate({ onSubmit }) {
  const [value, setValue] = useState('');
  const unknown = value.trim().length > 2 && !isKnownTeam(value);

  return (
    <div className={SHELL}>
      <p className={EYEBROW}>Neodyne Industries · incident response</p>
      <h1 className="mt-2.5 mb-3 text-[clamp(30px,8vw,40px)] leading-[1.08] tracking-[-0.02em]">
        Operation Breadcrumb
      </h1>
      <p className="mb-7 text-muted">
        An unknown intruder has breached Neodyne&apos;s systems. You have been brought in to track
        them down, contain the damage, and find out what they took.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim()) onSubmit(value);
        }}
      >
        <label className="mb-1.5 block text-[13px] text-muted" htmlFor="team">
          Team code
        </label>
        <input
          id="team"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="BC-07"
          className="w-full rounded-xl border border-stroke bg-black/30 px-3.5 py-3 font-mono text-paper uppercase"
        />
        {unknown && (
          <p className="mt-2 font-mono text-[13px] text-warn">
            Not a code we know. You can still continue.
          </p>
        )}
        <div className="mt-4">
          <Button type="submit" disabled={!value.trim()}>
            Begin
          </Button>
        </div>
      </form>
    </div>
  );
}

/** One row in the level list. Locked levels deliberately reveal nothing. */
function LevelRow({ level, status, open, onToggle }) {
  const locked = status === 'locked';

  return (
    <li className="border-t border-white/[0.07] first:border-t-0">
      <button
        type="button"
        disabled={locked}
        onClick={onToggle}
        className={`flex w-full items-center gap-3 px-1 py-3.5 text-left ${
          locked ? 'cursor-default opacity-35' : 'cursor-pointer'
        }`}
      >
        <span
          className={`grid size-7 shrink-0 place-items-center rounded-full border text-[12px] font-mono ${
            status === 'current'
              ? 'border-accent text-accent'
              : status === 'done'
                ? 'border-ok/50 text-ok'
                : 'border-stroke text-muted'
          }`}
        >
          {status === 'done' ? '✓' : level.n}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px]">{locked ? 'Locked' : level.title}</span>
          {status === 'current' && (
            <span className={`${MONO} block`}>current objective</span>
          )}
        </span>

        {!locked && <span className="text-muted">{open ? '▴' : '▾'}</span>}
      </button>

      {open && !locked && <LevelDetail level={level} status={status} />}
    </li>
  );
}

/**
 * An unlocked level's content, readable for the rest of the run.
 *
 * A team on level 7 can still open level 3 and re-read it without walking back
 * across campus, which is the whole reason progress is a space rather than a
 * single screen.
 */
function LevelDetail({ level, status }) {
  const navigate = useNavigate();
  const done = status === 'done';

  return (
    <div className="px-1 pb-5">
      {done && (
        <>
          {/* The payload first. A team reopening an old level is almost always
              after the thing they have to work with — the hash, the ciphertext,
              the grid — not the story they already read. */}
          <div className="mb-4 rounded-xl border border-accent/30 bg-accent/[0.06] px-4 py-3.5">
            <p className={EYEBROW}>Recovered</p>
            <Prose className="mt-1 break-words text-[15px] leading-relaxed" html={level.station.reveal} />
            {level.station.revealImage && (
              <img
                src={level.station.revealImage}
                alt=""
                className="mt-3 block w-full rounded-lg border border-stroke"
              />
            )}
          </div>

          <p className="mb-3 text-[14.5px] text-muted">{level.story}</p>
          <p className="mb-4 border-l-2 border-accent/60 pl-3 font-mono text-[13px] text-paper/80">
            {level.breadcrumb}
          </p>
        </>
      )}

      <div className="rounded-xl border border-stroke bg-white/[0.03] px-4 py-3.5">
        <p className={EYEBROW}>{done ? 'Found at' : 'Go to'}</p>
        <p className="mt-1 text-[15px]">{level.station.location}</p>
        <Prose className={`${MONO} mt-1 leading-relaxed`} html={level.station.brief} />
      </div>

      {!done && (
        <div className="mt-4">
          <Button onClick={() => navigate('/scan')}>Open camera</Button>
          <p className="mt-2.5 text-xs text-paper/40">
            Find the marker at this location and hold it in frame to unlock level {level.n + 1}.
          </p>
        </div>
      )}
    </div>
  );
}

export default function HuntPage() {
  const { team, setTeam, leave, levels, progress, current, finished, reset } = useHunt();
  const [openLevel, setOpenLevel] = useState(null);

  if (!team) return <TeamGate onSubmit={setTeam} />;

  // Default the open row to wherever the team actually is, so the common case —
  // opening the app to find out what to do next — needs no taps at all.
  const open = openLevel ?? current?.n ?? LEVEL_COUNT;
  const done = Math.min(progress.unlocked - 1, LEVEL_COUNT);

  return (
    <div className={SHELL}>
      <div className="flex items-baseline justify-between gap-4">
        <p className={EYEBROW}>Operation Breadcrumb</p>
        <button type="button" onClick={leave} className={`${MONO} cursor-pointer`}>
          {team} ✕
        </button>
      </div>

      <h1 className="mt-2 mb-1 text-[26px] tracking-[-0.02em]">
        {finished ? 'Trail ended' : `Level ${current?.n ?? 1} of ${LEVEL_COUNT}`}
      </h1>
      <p className="mb-5 text-muted">
        {finished
          ? 'You followed it all the way. What you do with what you found is the last decision, and it is not ours to make.'
          : done === 0
            ? 'Start where the breach did.'
            : `${done} of ${LEVEL_COUNT} stations found.`}
      </p>

      <div
        className="mb-7 h-1 w-full overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={LEVEL_COUNT}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out-back"
          style={{ width: `${(done / LEVEL_COUNT) * 100}%` }}
        />
      </div>

      <ul className="list-none p-0">
        {levels.map((level) => (
          <LevelRow
            key={level.id}
            level={level}
            status={level.n < progress.unlocked ? 'done' : level.n === progress.unlocked ? 'current' : 'locked'}
            open={open === level.n}
            onToggle={() => setOpenLevel(open === level.n ? -1 : level.n)}
          />
        ))}
      </ul>

      <button type="button" onClick={reset} className={`${MONO} mt-10 cursor-pointer`}>
        Reset this team&apos;s progress
      </button>
    </div>
  );
}
