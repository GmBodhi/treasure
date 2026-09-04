import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LEVEL_COUNT, levelsFor, normalizeTeamCode } from '../lib/hunt.js';
import { MULTIPLAYER_ENABLED, joinTeam, leaveTeam, syncTeam, tokenTeam } from '../api/teams.js';
import {
  applyServerProgress,
  completionsFor,
  readProgress,
  readRoute,
  readTeam,
  recordFind,
  resetProgress,
  writeRoute,
  writeTeam,
} from '../lib/progress.js';

/**
 * The team's run: who they are, their route, and how far the team — not this
 * phone — has got.
 *
 * The division of labour is: the client verifies, the server decides. Only the
 * phone can know that MindAR matched the image in front of it, so the scan is
 * the verification and nothing on the server can re-check it. What the server
 * owns is the record: whether that find may be counted, when the team got
 * there, and what every other phone on the team sees. This hook renders the
 * server's answer, and holds an unreported find as pending until it has one.
 *
 * Rendering is never blocked on the network. The stored view is read
 * synchronously on mount, so a team opening the app in a corridor sees their
 * level immediately and the sync catches up behind it.
 */

/**
 * How often a phone asks the team's state.
 *
 * Twenty seconds is chosen from the other side: it is how long a teammate's
 * find should take to appear on your screen. Fifteen teams times a handful of
 * phones is a few requests a second, which is nothing for a Worker — the real
 * cost of polling faster is radio wake-ups on a phone somebody is carrying
 * around campus for two hours.
 */
const SYNC_INTERVAL_MS = 20_000;

const initialSync = () => ({
  status: MULTIPLAYER_ENABLED ? 'idle' : 'solo',
  at: null,
  error: null,
  rejected: [],
  // The level a *teammate* just unlocked, if the last sync brought one back.
  // Null the rest of the time. See syncNow for why this is knowable.
  teammate: null,
});

export function useHunt() {
  const [team, setTeamState] = useState(() => readTeam());
  const [progress, setProgress] = useState(() => readProgress(readTeam() ?? ''));
  const [sync, setSync] = useState(initialSync);

  /**
   * The team's route, as the server last served it.
   *
   * Read from the cache first so a cold start in a corridor renders the right
   * station immediately. `levelsFor` falls back to a locally derived route when
   * this is null, which is what keeps a build with no Worker playable.
   */
  const [route, setRoute] = useState(() => readRoute(readTeam() ?? ''));

  const levels = useMemo(() => (team ? levelsFor(team, route) : []), [team, route]);

  // A second sync starting while the first is in flight would post a stale
  // completion set and race its own answer into state. One at a time; the
  // caller that lost is a poll that will come round again in twenty seconds.
  const inFlight = useRef(false);
  const teamRef = useRef(team);
  teamRef.current = team;
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const syncNow = useCallback(async () => {
    const code = teamRef.current;
    if (!code || !MULTIPLAYER_ENABLED) return;

    // A token for a different team is what a shared device looks like after
    // someone signs out and back in as somebody else. Syncing with it would
    // write this team's finds onto that one's record.
    if (tokenTeam() !== code) {
      setSync((prev) => ({ ...prev, status: 'signed-out' }));
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setSync((prev) => ({ ...prev, status: prev.status === 'synced' ? 'synced' : 'syncing' }));

    try {
      const answer = await syncTeam(completionsFor(code));
      // Only commit if this is still the team on screen — an await spans a
      // sign-out, and the reply would otherwise resurrect the old team's state.
      if (teamRef.current !== code) return;

      // The route lands before the progress: an organiser who regenerated the
      // matrix has changed which stations the positions mean, and rendering a
      // new position against a stale route would point a team at the wrong
      // marker for one frame.
      if (answer.route) setRoute(writeRoute(code, answer.route));

      const before = progressRef.current.unlocked;
      const next = applyServerProgress(code, answer.progress, answer.rejected);
      setProgress(next);

      // Anything this device found is already counted in `before`, because a
      // find is written locally the moment the tracker matches. So a rise
      // across this call can only have come from another phone on the team —
      // which is the one thing worth interrupting somebody to tell them.
      setSync({
        status: 'synced',
        at: Date.now(),
        error: null,
        rejected: answer.rejected ?? [],
        teammate: next.unlocked > before ? next.unlocked - 1 : null,
      });
    } catch (err) {
      if (teamRef.current !== code) return;
      setSync((prev) => ({
        ...prev,
        // 401 is the token being refused, which needs a pin and a person. Any
        // other failure is the network, which needs neither — the finds are
        // held and the next poll will carry them.
        status: err.status === 401 ? 'signed-out' : 'offline',
        error: err.message,
      }));
    } finally {
      inFlight.current = false;
    }
  }, []);

  /**
   * Poll while the app is in front of somebody.
   *
   * The visibility listener is the one that matters. A team walks between
   * stations with the phone in a pocket; the interval ticking through that is
   * wasted radio, and the moment worth being fresh for is the screen coming
   * back on — which is exactly when this fires.
   */
  useEffect(() => {
    if (!team || !MULTIPLAYER_ENABLED) return undefined;

    syncNow();
    const id = setInterval(() => {
      if (!document.hidden) syncNow();
    }, SYNC_INTERVAL_MS);

    const onVisible = () => {
      if (!document.hidden) syncNow();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', syncNow);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', syncNow);
    };
  }, [team, syncNow]);

  const adopt = useCallback((code) => {
    writeTeam(code);
    setTeamState(code);
    setProgress(readProgress(code));
    setRoute(readRoute(code));
  }, []);

  /**
   * Sign this device into a team with the code and pin from the slip.
   *
   * A wrong pin is refused. A network failure is not: the gate is the first
   * screen of the afternoon and often the most crowded corner of campus, so a
   * failed join still lets the team start playing, marked `signed-out` with a
   * reconnect prompt. The alternative is a wifi blip at registration stopping
   * a team from beginning at all.
   */
  const join = useCallback(
    async (code, pin) => {
      const normalized = normalizeTeamCode(code);
      if (!normalized) return { ok: false, error: 'Enter your team code.' };

      if (!MULTIPLAYER_ENABLED) {
        adopt(normalized);
        return { ok: true };
      }

      try {
        const payload = await joinTeam(normalized, pin);
        writeTeam(normalized);
        setTeamState(normalized);
        setRoute(writeRoute(normalized, payload.route));
        setProgress(applyServerProgress(normalized, payload.progress));
        setSync({ status: 'synced', at: Date.now(), error: null, rejected: [], teammate: null });
        return { ok: true };
      } catch (err) {
        if (err.status === 401) return { ok: false, error: err.message };
        adopt(normalized);
        setSync({ status: 'signed-out', at: null, error: err.message, rejected: [], teammate: null });
        return { ok: true, offline: true };
      }
    },
    [adopt],
  );

  /** Dismiss the teammate banner without touching anything else. */
  const clearTeammate = useCallback(() => {
    setSync((prev) => (prev.teammate == null ? prev : { ...prev, teammate: null }));
  }, []);

  const leave = useCallback(() => {
    leaveTeam();
    writeTeam(null);
    setTeamState(null);
    setRoute(null);
    setSync(initialSync());
  }, []);

  /**
   * A station was found. Called by the scanner, and only by the scanner.
   *
   * The find is written locally first and the reveal plays immediately — the
   * scan is the verification, and it has already happened. The sync that
   * follows is the server being told, not the team being granted permission;
   * if it fails the level stays pending and goes up with the next poll.
   */
  const complete = useCallback(
    (levelNumber, stationId) => {
      if (!team) return;
      setProgress(recordFind(team, levelNumber, stationId, LEVEL_COUNT));
      syncNow();
    },
    [team, syncNow],
  );

  /**
   * Clear this device's cached copy.
   *
   * Only meaningful with no server: where there is one, the next poll puts the
   * team's real progress straight back, which is the correct behaviour and a
   * confusing button. The console offers the organiser's version — see the
   * admin routes — which resets the record everyone shares.
   */
  const reset = useCallback(() => {
    if (!team) return;
    resetProgress(team);
    setProgress(readProgress(team));
    setRoute(null);
    syncNow();
  }, [team, syncNow]);

  // `unlocked` counts levels, so it runs past LEVEL_COUNT once the last station
  // is found — that overrun is how the app knows the hunt is over rather than
  // parking the team on a finished level forever.
  const finished = progress.unlocked > LEVEL_COUNT;
  const current = finished ? null : levels[progress.unlocked - 1] ?? null;

  return {
    team,
    join,
    leave,
    levels,
    route,
    progress,
    current,
    finished,
    complete,
    reset,
    sync,
    clearTeammate,
    syncNow,
    multiplayer: MULTIPLAYER_ENABLED,
  };
}
