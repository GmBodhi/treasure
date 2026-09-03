/**
 * A team's place in the hunt, kept in localStorage.
 *
 * localStorage rather than sessionStorage because the run lasts hours and a
 * phone will get locked, backgrounded and reopened many times in that window —
 * sessionStorage would drop the team back to level one on a browser restart.
 *
 * The honest failure mode: progress lives on one device. A team that switches
 * phones or clears their browser loses it, which is why the console has an
 * override to put a team back where it belongs. That is a two-minute
 * conversation with an organiser rather than a reason to run a server.
 *
 * Stored per team code, so an organiser can check a team's phone without
 * destroying the state that is already on it.
 */

const KEY = 'breadcrumb.progress';

/** `{ unlocked, completedAt: { [levelNumber]: epochMs } }` */
function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    // Corrupt or unavailable storage must not take the whole hunt down; a team
    // starting over is recoverable, a white screen mid-event is not.
    return {};
  }
}

function writeAll(all) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Private mode, or a full quota. The run continues in memory for this
    // session; there is nothing useful to say to the player about it.
  }
}

const blank = () => ({ unlocked: 1, completedAt: {} });

export function readProgress(teamCode) {
  const stored = readAll()[teamCode];
  if (!stored) return blank();

  return {
    unlocked: Number(stored.unlocked) || 1,
    completedAt: stored.completedAt ?? {},
  };
}

/**
 * Record that a level's station was found.
 *
 * Idempotent and monotonic on purpose: a marker fires `targetFound` every time
 * it re-enters frame, and a team re-reading an old level must not be able to
 * walk their own progress backwards.
 */
export function completeLevel(teamCode, levelNumber, levelCount) {
  const all = readAll();
  const current = readProgress(teamCode);

  const next = {
    unlocked: Math.min(Math.max(current.unlocked, levelNumber + 1), levelCount + 1),
    completedAt: { ...current.completedAt, [levelNumber]: current.completedAt[levelNumber] ?? Date.now() },
  };

  all[teamCode] = next;
  writeAll(all);
  return next;
}

/** Organiser override, for a dead phone or a mis-scan. */
export function setUnlocked(teamCode, levelNumber) {
  const all = readAll();
  all[teamCode] = { ...readProgress(teamCode), unlocked: Math.max(1, levelNumber) };
  writeAll(all);
  return all[teamCode];
}

export function resetProgress(teamCode) {
  const all = readAll();
  delete all[teamCode];
  writeAll(all);
}

/** The team playing on this device. */
const TEAM_KEY = 'breadcrumb.team';

export function readTeam() {
  try {
    return localStorage.getItem(TEAM_KEY);
  } catch {
    return null;
  }
}

export function writeTeam(teamCode) {
  try {
    if (teamCode) localStorage.setItem(TEAM_KEY, teamCode);
    else localStorage.removeItem(TEAM_KEY);
  } catch {
    /* see writeAll */
  }
}
