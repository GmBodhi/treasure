import { ANALYTICS_ENABLED, deviceId, request } from './client.js';

/**
 * Talking to the team's shared state.
 *
 * A team is several phones. The server owns how far the team has got; this is
 * the client's half of that — join once with the code and pin from the
 * registration slip, then post everything this device knows and render what
 * comes back.
 *
 * The same flag that gates analytics gates this, because it means the same
 * thing: a build with no `VITE_API_BASE` has no Worker to talk to. Without one
 * the hunt still runs, single-device, on local progress alone — see
 * lib/progress.js. That is a deliberate fallback, not a broken state: it is how
 * `npm run dev:web` on its own and a rehearsal on a laptop both keep working.
 */
export const MULTIPLAYER_ENABLED = ANALYTICS_ENABLED;

const TOKEN_KEY = 'breadcrumb.token';

export function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* Private mode: this device plays on, it just cannot share. */
  }
}

/** The team this token is for, without a round-trip. Used to spot a stale token. */
export function tokenTeam(token = readToken()) {
  const split = token?.lastIndexOf('.') ?? -1;
  return split > 0 ? token.slice(0, split) : null;
}

/**
 * Join, and get the team's current progress in the same reply.
 *
 * That second half matters more than it looks: a phone joining halfway through
 * the afternoon — a flat battery swapped for a teammate's spare — has to land
 * on the level the team is actually on, not start again at one.
 */
export async function joinTeam(code, pin) {
  const payload = await request('/api/teams/join', {
    method: 'POST',
    body: JSON.stringify({ code, pin }),
  });
  writeToken(payload.token);
  return payload;
}

export function leaveTeam() {
  writeToken(null);
}

/**
 * One request that is both a report and a poll.
 *
 * Everything this device holds goes up; the team's merged progress comes back
 * and replaces what was on screen. Levels the server refused come back in
 * `rejected` rather than being dropped silently, because a device showing a
 * level the server does not believe in is the one failure here worth telling
 * somebody about.
 */
export function syncTeam(completions) {
  return request('/api/teams/sync', {
    method: 'POST',
    headers: { authorization: `Bearer ${readToken()}` },
    body: JSON.stringify({ completions, deviceId: deviceId() }),
  });
}

/** Public standings. No token: teams are meant to be able to watch it. */
export function fetchLeaderboard() {
  return request('/api/teams/leaderboard');
}
