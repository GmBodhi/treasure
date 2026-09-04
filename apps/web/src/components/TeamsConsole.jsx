import { useCallback, useEffect, useState } from 'react';
import { adminApi, readAdminToken, writeAdminToken } from '../api/admin.js';
import { Card, SectionTitle } from './PageShell.jsx';
import { LEVEL_COUNT, displayTeamCode } from '../lib/hunt.js';

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
export default function TeamsConsole() {
  const [token, setToken] = useState(readAdminToken);
  const [teams, setTeams] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!readAdminToken()) return;
    setBusy(true);
    try {
      const payload = await adminApi.teams();
      setTeams(payload.teams);
      setError(null);
    } catch (err) {
      setError(err.message);
      setTeams(null);
    } finally {
      setBusy(false);
    }
  }, []);

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
    </>
  );
}
