import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import Prose from '../components/Prose.jsx';
import { ReconnectPrompt, SyncBadge, TeammateBanner } from '../components/SyncStatus.jsx';
import WaitingPanel from '../components/WaitingPanel.jsx';
import { useHunt } from '../hooks/useHunt.js';
import { LEVEL_COUNT, displayTeamCode, isKnownTeam } from '../lib/hunt.js';

const SHELL = 'mx-auto w-[min(560px,100%)] px-5 pt-[calc(28px+env(safe-area-inset-top))] pb-[calc(40px+env(safe-area-inset-bottom))]';
// The level space adds room for the sticky camera bar so the last row is never
// trapped underneath it.
const SHELL_WITH_BAR = `${SHELL} pb-[calc(132px+env(safe-area-inset-bottom))]`;
const EYEBROW = 'text-[11px] tracking-[0.18em] uppercase text-accent';
const MONO = 'font-mono text-[13px] text-muted';
const FIELD = 'w-full rounded-xl border border-stroke bg-black/30 px-3.5 py-3 font-mono text-paper';

/**
 * The gate.
 *
 * The code decides which of the two routes this team walks; the pin is what
 * stops a team opening a rival's run and burning their progress, which matters
 * now that progress is shared and there is a board to be top of. Both are on
 * the slip handed out at registration.
 *
 * A build with no Worker skips the pin entirely — see useHunt — because there
 * is nothing to sign into. That is the rehearsal and dev path, and it should
 * not make anybody invent a credential to get past a screen.
 */
function TeamGate({ onJoin, multiplayer }) {
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const unknown = code.trim().length > 2 && !isKnownTeam(code);
  const ready = code.trim() && (!multiplayer || pin.trim());

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
        onSubmit={async (event) => {
          event.preventDefault();
          if (!ready || busy) return;
          setBusy(true);
          setError(null);
          const result = await onJoin(code, pin);
          setBusy(false);
          if (!result.ok) setError(result.error);
        }}
      >
        <label className="mb-1.5 block text-[13px] text-muted" htmlFor="team">
          Team code
        </label>
        <input
          id="team"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="BC-07"
          className={`${FIELD} uppercase`}
        />
        {unknown && (
          <p className="mt-2 font-mono text-[13px] text-warn">Not a code we know.</p>
        )}

        {multiplayer && (
          <>
            <label className="mt-4 mb-1.5 block text-[13px] text-muted" htmlFor="pin">
              Pin
            </label>
            <input
              id="pin"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              inputMode="numeric"
              autoComplete="off"
              placeholder="0000"
              className={FIELD}
            />
            <p className="mt-2 text-xs text-paper/40">
              Everyone on your team enters the same two. Your progress is shared between all your
              phones.
            </p>
          </>
        )}

        {error && <p className="mt-3 font-mono text-[13px] text-warn">{error}</p>}

        <div className="mt-5">
          <Button type="submit" disabled={!ready || busy}>
            {busy ? 'Joining…' : 'Begin'}
          </Button>
        </div>
      </form>

      <Link to="/leaderboard" className={`${MONO} mt-8 inline-block no-underline`}>
        Standings →
      </Link>
    </div>
  );
}

/** One row in the level list. Locked levels deliberately reveal nothing. */
function LevelRow({ level, status, pending, open, onToggle }) {
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
                ? pending
                  ? 'border-warn/50 text-warn'
                  : 'border-ok/50 text-ok'
                : 'border-stroke text-muted'
          }`}
        >
          {status === 'done' ? '✓' : level.n}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px]">{locked ? 'Locked' : level.title}</span>
          {status === 'current' && <span className={`${MONO} block`}>current objective</span>}
          {/* Found here, not yet on the team's record. Worth a word: it is the
              difference between the board having you at this level and not. */}
          {pending && (
            <span className="block font-mono text-[13px] text-warn">not sent yet</span>
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

      {/* `location` is organiser metadata — it reads like a console entry
          because that is what it is ("… — its wall emblem"). Showing it before
          the station is found printed the answer directly above the cipher
          meant to yield it, which made every puzzle optional. It appears only
          once a team has actually been there, where it confirms the place and
          helps them re-read the level later. */}
      <div className="rounded-xl border border-stroke bg-white/[0.03] px-4 py-3.5">
        <p className={EYEBROW}>{done ? 'Found at' : 'Go to'}</p>
        {done ? (
          <p className="mt-1 text-[15px]">{level.station.location}</p>
        ) : (
          <p className="mt-1 text-[15px] text-muted">Work it out from this.</p>
        )}
        <Prose className={`${MONO} mt-1 leading-relaxed`} html={level.station.brief} />
      </div>

      {/* No button here: the camera is the primary action of the whole screen
          and lives in the sticky bar below, where it cannot fall under the
          fold. Measured on a 375x650 viewport, this button sat at y=608 of a
          650px window — a team had to scroll to find the one thing they came
          to do. */}
      {!done && (
        <p className="mt-4 text-xs text-paper/40">
          Find the marker at this location and hold it in frame to unlock level {level.n + 1}.
          Whoever scans it, the whole team moves up.
        </p>
      )}
    </div>
  );
}

export default function HuntPage() {
  const navigate = useNavigate();
  const {
    team,
    join,
    leave,
    levels,
    progress,
    current,
    finished,
    reset,
    sync,
    syncNow,
    clearTeammate,
    multiplayer,
    started,
    startedAt,
  } = useHunt();
  const [openLevel, setOpenLevel] = useState(null);

  if (!team) return <TeamGate onJoin={join} multiplayer={multiplayer} />;

  // Joined, but the organiser has not opened the hunt. Held here rather than
  // shown a level list with a dead camera button — a disabled control invites
  // a team to keep pressing it.
  if (!started) return <WaitingPanel team={team} startsAt={startedAt} onLeave={leave} />;

  // Default the open row to wherever the team actually is, so the common case —
  // opening the app to find out what to do next — needs no taps at all.
  const open = openLevel ?? current?.n ?? LEVEL_COUNT;
  const done = Math.min(progress.unlocked - 1, LEVEL_COUNT);
  const pending = new Set(progress.pending);

  return (
    <div className={finished ? SHELL : SHELL_WITH_BAR}>
      <div className="flex items-baseline justify-between gap-4">
        <p className={EYEBROW}>Operation Breadcrumb</p>
        <button type="button" onClick={leave} className={`${MONO} cursor-pointer`}>
          {displayTeamCode(team)} ✕
        </button>
      </div>

      <h1 className="mt-2 mb-1 text-[26px] tracking-[-0.02em]">
        {finished ? 'Trail ended' : `Level ${current?.n ?? 1} of ${LEVEL_COUNT}`}
      </h1>
      <p className="mb-4 text-muted">
        {finished
          ? 'You followed it all the way. What you do with what you found is the last decision, and it is not ours to make.'
          : done === 0
            ? 'Start where the breach did.'
            : `${done} of ${LEVEL_COUNT} stations found.`}
      </p>

      <div className="mb-5 flex items-center justify-between gap-4">
        <SyncBadge sync={sync} pending={progress.pending} onRetry={syncNow} />
        <Link to="/leaderboard" className={`${MONO} no-underline`}>
          Standings →
        </Link>
      </div>

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

      {sync.teammate != null && (
        <TeammateBanner level={sync.teammate} onDismiss={clearTeammate} />
      )}

      {sync.status === 'signed-out' && <ReconnectPrompt team={team} onJoin={join} />}

      <ul className="list-none p-0">
        {levels.map((level) => (
          <LevelRow
            key={level.id}
            level={level}
            status={level.n < progress.unlocked ? 'done' : level.n === progress.unlocked ? 'current' : 'locked'}
            pending={pending.has(level.n)}
            open={open === level.n}
            onToggle={() => setOpenLevel(open === level.n ? -1 : level.n)}
          />
        ))}
      </ul>

      {/* The primary action, pinned. A team opening the app in a corridor is
          almost always doing one of two things: reading where to go, or going
          there. This is the second, and it should never need a scroll. */}
      {current && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-stroke bg-ink/95 backdrop-blur-md">
          <div className="mx-auto w-[min(560px,100%)] px-5 pt-3.5 pb-[calc(14px+env(safe-area-inset-bottom))]">
            <Button onClick={() => navigate('/scan')}>Open camera</Button>
            <p className="mt-2 text-center text-xs text-paper/40">
              Level {current.n} of {LEVEL_COUNT}
            </p>
          </div>
        </div>
      )}

      {/* Only where there is no server to disagree with. With one, the next
          poll puts the team's real progress straight back — correct, and a
          baffling button. The organiser's reset lives in the console. */}
      {!multiplayer && (
        <button type="button" onClick={reset} className={`${MONO} mt-10 cursor-pointer`}>
          Reset this team&apos;s progress
        </button>
      )}
    </div>
  );
}
