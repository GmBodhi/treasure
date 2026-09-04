/**
 * A team's place in the hunt, as this device currently understands it.
 *
 * The server is authoritative. This file is not a second opinion — it is a
 * cache of the server's last answer plus a short list of finds this phone has
 * verified and not yet had confirmed. Two fields, and the difference between
 * them is the whole design:
 *
 *   confirmed  what the server said, last time we asked. Replaced wholesale on
 *              every sync, never merged upward. That is what makes the server
 *              authoritative in practice: an organiser resetting a team, or a
 *              level refused for arriving out of sequence, actually lands on
 *              every phone instead of being outvoted by a local tally.
 *   pending    finds this device made and could not report yet. Rendered as
 *              progress, because the alternative is a team standing at a marker
 *              in a wifi dead-spot watching nothing happen — verification is
 *              the scan, and the scan already succeeded. Held until the server
 *              either records it or refuses it.
 *
 * localStorage rather than sessionStorage because the run lasts hours and a
 * phone will be locked, backgrounded and reopened many times in that window.
 * Keyed per team code, so an organiser can check a team's phone without
 * destroying what is on it.
 */

const KEY = 'breadcrumb.progress';

/** `{ [team]: { confirmed: {unlocked, completedAt}, pending: {[level]: entry} } }` */
function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    // Corrupt or unavailable storage must not take the hunt down; a team
    // re-syncing from the server is recoverable, a white screen mid-event is not.
    return {};
  }
}

function writeAll(all) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Private mode, or a full quota. The run continues in memory for this
    // session, and the server still has the team's real progress.
  }
}

const blank = () => ({ confirmed: { unlocked: 1, completedAt: {} }, pending: {}, route: null });

function readRaw(teamCode) {
  const stored = readAll()[teamCode];
  if (!stored) return blank();
  return {
    confirmed: {
      unlocked: Number(stored.confirmed?.unlocked) || 1,
      completedAt: stored.confirmed?.completedAt ?? {},
    },
    pending: stored.pending ?? {},
    // Cached so a phone reopened in a dead-spot still knows where to send its
    // team. Without this the first screen after a cold start would have to wait
    // on the network to render a single station.
    route: stored.route ?? null,
  };
}

/** The team's route as last served, or null if this device has never had one. */
export function readRoute(teamCode) {
  return readRaw(teamCode).route;
}

/**
 * Store the route the server just handed over.
 *
 * Separate from `applyServerProgress` because the two arrive together but mean
 * different things: progress is a running tally, a route is an assignment that
 * changes only when an organiser regenerates it.
 */
export function writeRoute(teamCode, route) {
  const state = readRaw(teamCode);
  if (!route) return view(state);
  write(teamCode, { ...state, route });
  return route;
}

function write(teamCode, state) {
  const all = readAll();
  all[teamCode] = state;
  writeAll(all);
  return view(state);
}

/**
 * The two halves folded into the one shape the UI renders.
 *
 * `unlocked` runs past the last level once the final station is found — that
 * overrun is how the app knows the hunt is over rather than parking the team on
 * a finished level forever.
 */
function view(state) {
  const levels = Object.keys(state.pending).map(Number);
  const pendingTop = levels.length ? Math.max(...levels) + 1 : 0;

  const completedAt = { ...state.confirmed.completedAt };
  for (const [level, entry] of Object.entries(state.pending)) {
    completedAt[level] = completedAt[level] ?? entry.at;
  }

  return {
    unlocked: Math.max(state.confirmed.unlocked, pendingTop),
    completedAt,
    // Which levels are showing on this phone's word alone. The header uses it
    // to say so, rather than letting a team believe the board has them at a
    // level nobody else can see.
    pending: levels.sort((a, b) => a - b),
  };
}

export function readProgress(teamCode) {
  return view(readRaw(teamCode));
}

/**
 * Record a verified find.
 *
 * Idempotent on purpose: a marker fires `targetFound` every time it re-enters
 * frame, and a team holding a phone unsteadily will fire it repeatedly. A level
 * the server has already confirmed is not re-queued, and a level already
 * pending keeps its original timestamp — the find happened when it happened,
 * not when the tracker last re-acquired.
 */
export function recordFind(teamCode, levelNumber, stationId, levelCount) {
  const state = readRaw(teamCode);
  if (levelNumber < 1 || levelNumber > levelCount) return view(state);
  if (state.confirmed.completedAt[levelNumber] != null) return view(state);
  if (state.pending[levelNumber]) return view(state);

  return write(teamCode, {
    ...state,
    pending: { ...state.pending, [levelNumber]: { level: levelNumber, stationId, at: Date.now() } },
  });
}

/**
 * Everything this device believes it has completed, for the next sync.
 *
 * Confirmed levels go up alongside pending ones even though the server already
 * has them. It costs a few integers and it makes the request self-healing: a
 * device whose cache and the server have drifted apart for any reason gets put
 * back in step by the ordinary poll, with no special case to write or test.
 */
export function completionsFor(teamCode) {
  const state = readRaw(teamCode);
  const entries = Object.entries(state.confirmed.completedAt).map(([level, at]) => ({
    level: Number(level),
    at,
  }));
  return [...entries, ...Object.values(state.pending)].sort((a, b) => a.level - b.level);
}

/**
 * Take the server's answer.
 *
 * Pending entries are cleared when the server has recorded them *or* refused
 * them. Refusal has to clear too: leaving a rejected level queued would have
 * the phone re-posting it every twenty seconds forever while showing progress
 * the server denies. The caller surfaces the rejection instead.
 */
export function applyServerProgress(teamCode, serverProgress, rejected = []) {
  const state = readRaw(teamCode);
  const confirmed = {
    unlocked: Number(serverProgress?.unlocked) || 1,
    completedAt: serverProgress?.completedAt ?? {},
  };

  const pending = {};
  for (const [level, entry] of Object.entries(state.pending)) {
    const settled = confirmed.completedAt[level] != null || rejected.includes(Number(level));
    if (!settled) pending[level] = entry;
  }

  // Spread `state` forward rather than building a fresh object: the route
  // lives in the same record and a progress update must not drop it.
  return write(teamCode, { ...state, confirmed, pending });
}

/** Local wipe, for handing a device to another team. The server is untouched. */
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
