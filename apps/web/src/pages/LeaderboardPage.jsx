import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MULTIPLAYER_ENABLED, fetchLeaderboard } from '../api/teams.js';
import { usePageHidden } from '../hooks/usePageVisibility.js';
import { displayTeamCode } from '../lib/hunt.js';
import { readTeam } from '../lib/progress.js';

const SHELL = 'mx-auto w-[min(560px,100%)] px-5 pt-[calc(28px+env(safe-area-inset-top))] pb-[calc(40px+env(safe-area-inset-bottom))]';
const EYEBROW = 'text-[11px] tracking-[0.18em] uppercase text-accent';
const MONO = 'font-mono text-[13px] text-muted';

const REFRESH_MS = 20_000;

/**
 * How long ago, in the shortest true form.
 *
 * Wall-clock times would be more precise and less useful: the question a team
 * asks looking at this is "are they still moving", and "4m ago" answers it
 * without anyone having to subtract.
 */
function ago(iso) {
  if (!iso) return 'not started';
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
}

function Row({ team, rank, levelCount, mine }) {
  const share = levelCount ? team.completed / levelCount : 0;

  return (
    <li
      className={`flex items-center gap-3.5 border-t border-white/[0.07] py-3.5 first:border-t-0 ${
        mine ? 'text-paper' : ''
      }`}
    >
      <span
        className={`w-6 shrink-0 text-right font-mono text-[13px] ${
          rank === 1 && team.completed > 0 ? 'text-accent' : 'text-muted'
        }`}
      >
        {rank}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={`truncate text-[15px] ${mine ? 'text-accent' : ''}`}>
            {displayTeamCode(team.code)}
          </span>
          {mine && <span className="shrink-0 font-mono text-[11px] text-accent/70">you</span>}
          {team.finishedAt && (
            <span className="shrink-0 font-mono text-[11px] text-ok">finished</span>
          )}
        </span>
        <span className={`${MONO} block`}>{ago(team.lastAt)}</span>
        <span className="mt-1.5 block h-0.5 w-full overflow-hidden rounded-full bg-white/10">
          <span
            className={`block h-full rounded-full transition-[width] duration-500 ease-out-back ${
              team.finishedAt ? 'bg-ok' : 'bg-accent'
            }`}
            style={{ width: `${share * 100}%` }}
          />
        </span>
      </span>

      <span className="shrink-0 font-mono text-[13px]">
        {team.completed}
        <span className="text-muted">/{levelCount}</span>
      </span>
    </li>
  );
}

/**
 * Standings, for teams and organisers alike.
 *
 * It shows how far and how recently, and deliberately nothing about where. The
 * two variants of a level sit in different places on campus, so naming the
 * station a team just found would hand every other team a shortcut to a marker
 * their own route may be about to send them to.
 */
export default function LeaderboardPage() {
  const [board, setBoard] = useState(null);
  const [error, setError] = useState(null);
  const hidden = usePageHidden();
  const mine = readTeam();

  // The poll must not stack up behind a slow response, and a reply that lands
  // after the page is gone must not set state on an unmounted component.
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const load = useCallback(async () => {
    try {
      const payload = await fetchLeaderboard();
      if (!alive.current) return;
      setBoard(payload);
      setError(null);
    } catch (err) {
      if (!alive.current) return;
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    if (!MULTIPLAYER_ENABLED || hidden) return undefined;
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [hidden, load]);

  return (
    <div className={SHELL}>
      <div className="flex items-baseline justify-between gap-4">
        <p className={EYEBROW}>Operation Breadcrumb</p>
        <Link to="/" className={`${MONO} no-underline`}>
          ← Back
        </Link>
      </div>

      <h1 className="mt-2 mb-1 text-[26px] tracking-[-0.02em]">Standings</h1>
      <p className="mb-7 text-muted">
        Stations found, and how long since each team last found one. Updates on its own.
      </p>

      {!MULTIPLAYER_ENABLED && (
        <p className="rounded-xl border border-stroke bg-white/[0.03] px-4 py-3.5 text-[14px] text-muted">
          This build has no server behind it, so there is nothing to compare. Set{' '}
          <span className="text-paper">VITE_API_BASE</span> and every team&apos;s progress lands
          here.
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-warn/40 bg-warn/[0.07] px-4 py-3.5 font-mono text-[13px] text-warn">
          {error}
        </p>
      )}

      {board && (
        <ul className="list-none p-0">
          {board.teams.map((team, index) => (
            <Row
              key={team.code}
              team={team}
              rank={index + 1}
              levelCount={board.levelCount}
              mine={team.code === mine}
            />
          ))}
        </ul>
      )}

      {board?.teams.length === 0 && (
        <p className="text-muted">No teams have been seeded yet.</p>
      )}
    </div>
  );
}
