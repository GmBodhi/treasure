import { useCallback, useEffect, useState } from 'react';
import { adminApi, readAdminToken, writeAdminToken } from '../api/admin.js';
import { Card, SectionTitle } from './PageShell.jsx';
import { LEVELS, LEVEL_COUNT, displayTeamCode } from '../lib/hunt.js';

const MONO = 'font-mono text-[13px] text-muted';
const CELL = 'px-2 py-1.5 text-left align-middle';

/**
 * Live team standings, the pins to read out at registration, and the override
 * for when a phone ends up in a fountain.
 *
 * Behind a token because it lists every team's pin. An organiser typing it once
 * a session is the correct amount of friction for a screen that, left open on a
 * desk, hands anyone walking past the ability to join any team.
 */
/**
 * The gun.
 *
 * Deliberately the first thing on the console, and deliberately the only
 * control here with a confirmation on it: this is the one action that fifteen
 * teams feel at once, and the one an organiser reaches for while being talked
 * at by fifteen people.
 *
 * Pressing Start twice is safe — the server keeps the first time rather than
 * moving the clock — but stopping is confirmed, because a mis-tap during the
 * run puts every phone back on the waiting screen.
 */
function HuntStatus({ state, onStart, onStop, busy }) {
  const started = state.started;
  const scheduled = state.startedAt && !started;

  return (
    <>
      <SectionTitle>Hunt</SectionTitle>
      <Card className="mb-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-block size-2 rounded-full ${
                  started ? 'bg-ok' : scheduled ? 'bg-accent animate-pulse-dot' : 'bg-muted/50'
                }`}
              />
              <span className="text-[15px]">
                {started ? 'Running' : scheduled ? 'Scheduled' : 'Not started'}
              </span>
            </div>
            <div className={`${MONO} mt-1`}>
              {state.startedAt
                ? `${started ? 'Started' : 'Starts'} ${new Date(state.startedAt).toLocaleTimeString()}`
                : 'Teams can join, but nothing they find will count.'}
            </div>
            <div className={`${MONO} mt-0.5`}>
              {state.teams} teams · {state.playing} playing · {state.completions} stations found
            </div>
          </div>

          {started || scheduled ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Stop the hunt? Every phone goes back to the waiting screen. Progress is kept.')) onStop();
              }}
              className="cursor-pointer rounded-lg border border-warn/50 px-4 py-2.5 font-mono text-[13px] text-warn disabled:opacity-40"
            >
              {busy ? '…' : 'Stop the hunt'}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={onStart}
              className="cursor-pointer rounded-full bg-accent px-6 py-3 text-[15px] font-semibold text-accent-ink disabled:opacity-40"
            >
              {busy ? 'Starting…' : 'Start the hunt'}
            </button>
          )}
        </div>
      </Card>
    </>
  );
}

/**
 * The matrix: which station each team plays at each position of their route.
 *
 * Read from the server, not computed here. Routes are generated and stored by
 * the Worker, so this is a view of the assignment rather than a second
 * derivation of it that could disagree with the one the phones are walking.
 *
 * It is behind the admin token for the same reason it moved off the client:
 * the whole matrix is a map of where every team will be and when, which is
 * exactly what you would want in order to camp a marker.
 */
function RouteMatrix({ matrix, onRegenerate, busy }) {
  const [order, setOrder] = useState('story');
  const started = matrix.teams.some((team) => team.completed > 0);

  return (
    <>
      <SectionTitle>Team routes</SectionTitle>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-muted">
              <th className={CELL}>team</th>
              {Array.from({ length: matrix.levelCount }, (_, i) => (
                <th key={i} className={CELL} title={`position ${i + 1}`}>
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.teams.map((team) => (
              <tr key={team.code} className="border-t border-white/[0.07]">
                <td className={`${CELL} font-mono`}>{displayTeamCode(team.code)}</td>
                {team.route ? (
                  team.route.map((step, i) => {
                    const level = LEVELS[step.beat - 1];
                    const station = level?.variants?.[step.variant];
                    return (
                      <td
                        key={i}
                        // Positions already played are dimmed, so a glance says
                        // where a team is as well as where they are going.
                        className={`${CELL} font-mono ${i < team.completed ? 'opacity-35' : ''} ${
                          step.variant === 'A' ? 'text-accent' : 'text-ok'
                        }`}
                        title={station ? `${level.title} — ${station.location}` : 'unknown station'}
                      >
                        {step.beat}
                        {step.variant}
                      </td>
                    );
                  })
                ) : (
                  <td className={`${CELL} text-warn`} colSpan={matrix.levelCount}>
                    no route — generate one below
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Card className="mt-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={order}
            onChange={(event) => setOrder(event.target.value)}
            className="cursor-pointer rounded-lg border border-stroke bg-black/30 px-3 py-2 font-mono text-[13px] text-paper"
          >
            <option value="story">story order — beats 1 to 10 in sequence</option>
            <option value="stagger">stagger — spread the starting beat across teams</option>
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={() => onRegenerate(order, started)}
            className="cursor-pointer rounded-lg border border-stroke px-3 py-2 font-mono text-[13px] text-paper disabled:opacity-40"
          >
            {busy ? 'Working…' : 'Regenerate routes'}
          </button>
        </div>
        <div className={`${MONO} mt-2`}>
          Each cell is the beat and variant played at that position. Every route has an equal split
          of A and B, so no team spends the run on one half of campus; hover a cell for the station.
          {' '}
          <span className="text-paper">Story order</span> tells the ten beats in sequence.{' '}
          <span className="text-paper">Stagger</span> starts each team at a different beat, which
          stops fifteen teams queueing at the same two markers in the first five minutes — at the
          cost of the story arriving out of order.
          {started && (
            <>
              {' '}
              <span className="text-warn">
                Teams have already started; regenerating will ask you to confirm.
              </span>
            </>
          )}
        </div>
      </Card>
    </>
  );
}

export default function TeamsConsole() {
  const [token, setToken] = useState(readAdminToken);
  const [teams, setTeams] = useState(null);
  const [matrix, setMatrix] = useState(null);
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!readAdminToken()) return;
    setBusy(true);
    try {
      // One await pair rather than two sequential ones: both are small reads
      // and the console is refreshed by hand, so there is no reason to make an
      // organiser watch them arrive one after the other.
      const [roster, routes, hunt] = await Promise.all([
        adminApi.teams(),
        adminApi.routes(),
        adminApi.state(),
      ]);
      setTeams(roster.teams);
      setMatrix(routes);
      setState(hunt);
      setError(null);
    } catch (err) {
      setError(err.message);
      setTeams(null);
      setMatrix(null);
      setState(null);
    } finally {
      setBusy(false);
    }
  }, []);

  /**
   * Regenerating mid-run is guarded twice: the server refuses without `force`,
   * and this asks first. Rerouting a team that is three stations in sends them
   * somewhere they have already been, and their recorded positions would then
   * name the wrong stations.
   */
  const regenerate = useCallback(
    async (order, started) => {
      if (started && !window.confirm('Teams have already started. Reroute them anyway?')) return;
      setBusy(true);
      try {
        await adminApi.regenerateRoutes(order, started);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
      await load();
    },
    [load],
  );

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <>
      {state && (
        <HuntStatus
          state={state}
          busy={busy}
          onStart={() => act(() => adminApi.start())}
          onStop={() => act(() => adminApi.stop())}
        />
      )}

      <SectionTitle>Teams</SectionTitle>

      <Card className="mb-3">
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            writeAdminToken(token.trim());
            load();
          }}
        >
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            type="password"
            placeholder="Admin token"
            autoComplete="off"
            className="min-w-[220px] flex-1 rounded-lg border border-stroke bg-black/30 px-3 py-2 font-mono text-[13px] text-paper"
          />
          <button
            type="submit"
            className="cursor-pointer rounded-lg border border-stroke px-3 py-2 font-mono text-[13px] text-paper"
          >
            {busy ? 'Loading…' : teams ? 'Refresh' : 'Load'}
          </button>
        </form>
        {error && <div className="mt-2 font-mono text-[13px] text-warn">{error}</div>}
        {!error && !teams && (
          <div className={`${MONO} mt-2`}>
            ADMIN_TOKEN from the Worker. Seed the roster with{' '}
            <span className="text-paper">npm run db:teams</span>.
          </div>
        )}
      </Card>

      {teams && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="text-muted">
                  <th className={CELL}>team</th>
                  <th className={CELL}>pin</th>
                  <th className={CELL}>level</th>
                  <th className={CELL}>phones</th>
                  <th className={CELL}>last find</th>
                  <th className={CELL}>override</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => (
                  <tr key={team.code} className="border-t border-white/[0.07]">
                    <td className={`${CELL} font-mono`}>{displayTeamCode(team.code)}</td>
                    <td className={`${CELL} font-mono text-accent`}>{team.pin}</td>
                    <td className={CELL}>
                      {team.completed >= LEVEL_COUNT ? (
                        <span className="text-ok">finished</span>
                      ) : (
                        <span className="font-mono">
                          {team.completed + 1}
                          <span className="text-muted">/{LEVEL_COUNT}</span>
                        </span>
                      )}
                    </td>
                    <td className={`${CELL} font-mono text-muted`}>{team.devices || 0}</td>
                    <td className={`${CELL} text-muted`}>
                      {team.lastAt ? new Date(team.lastAt).toLocaleTimeString() : '—'}
                    </td>
                    <td className={CELL}>
                      {/* A select rather than a free field: the only legal
                          values are 1..LEVEL_COUNT+1, and this is used under
                          time pressure by someone holding a stranger's phone. */}
                      <select
                        value={Math.min(team.completed + 1, LEVEL_COUNT + 1)}
                        disabled={busy}
                        onChange={(event) =>
                          act(() => adminApi.unlock(team.code, Number(event.target.value)))
                        }
                        className="cursor-pointer rounded-md border border-stroke bg-black/30 px-2 py-1 font-mono text-[13px] text-paper"
                      >
                        {Array.from({ length: LEVEL_COUNT + 1 }, (_, i) => i + 1).map((level) => (
                          <option key={level} value={level}>
                            {level > LEVEL_COUNT ? 'done' : `level ${level}`}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Card className="mt-3">
            <div className={MONO}>
              Progress is shared across every phone on a team and lives on the server, so a dead
              battery costs nothing — a teammate&apos;s phone already has it, and a replacement
              signs in with the same code and pin. The override writes the team&apos;s record
              directly; lowering it deletes the levels above.
            </div>
          </Card>
        </>
      )}

      {matrix && <RouteMatrix matrix={matrix} onRegenerate={regenerate} busy={busy} />}
    </>
  );
}
