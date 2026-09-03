import { useCallback, useMemo, useState } from 'react';
import { LEVEL_COUNT, levelsFor, normalizeTeamCode } from '../lib/hunt.js';
import { completeLevel, readProgress, readTeam, resetProgress, writeTeam } from '../lib/progress.js';

/**
 * The team's run: who they are, their route, and how far they have got.
 *
 * Everything here is synchronous — the levels are code and the progress is
 * localStorage, so there is no loading state to render and no failure mode
 * where a team stares at a spinner in a corridor with one bar of signal.
 */
export function useHunt() {
  const [team, setTeamState] = useState(() => readTeam());
  const [progress, setProgress] = useState(() => readProgress(readTeam() ?? ''));

  const levels = useMemo(() => (team ? levelsFor(team) : []), [team]);

  const setTeam = useCallback((code) => {
    const normalized = normalizeTeamCode(code);
    writeTeam(normalized);
    setTeamState(normalized);
    setProgress(readProgress(normalized));
  }, []);

  const leave = useCallback(() => {
    writeTeam(null);
    setTeamState(null);
  }, []);

  /** Called when a station's marker is found. See progress.js on idempotence. */
  const complete = useCallback(
    (levelNumber) => {
      if (!team) return;
      setProgress(completeLevel(team, levelNumber, LEVEL_COUNT));
    },
    [team],
  );

  const reset = useCallback(() => {
    if (!team) return;
    resetProgress(team);
    setProgress(readProgress(team));
  }, [team]);

  // `unlocked` counts levels, so it runs past LEVEL_COUNT once the last station
  // is found — that overrun is how the app knows the hunt is over rather than
  // parking the team on a finished level forever.
  const finished = progress.unlocked > LEVEL_COUNT;
  const current = finished ? null : levels[progress.unlocked - 1] ?? null;

  return { team, setTeam, leave, levels, progress, current, finished, complete, reset };
}
