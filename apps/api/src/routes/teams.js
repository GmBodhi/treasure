import { Hono } from 'hono';
import { badRequest, notFound } from '../lib/http.js';
import { issueToken, normalizeTeamCode, requireTeam } from '../lib/auth.js';
import { applyCompletions, readProgress } from '../lib/progress.js';
import { routeForTeam } from '../lib/routes.js';
import { hasStarted, readStartedAt } from '../lib/settings.js';

/** @type {Hono<{ Bindings: Env }>} */
export const teams = new Hono();

/**
 * Join a team from a phone.
 *
 * Code and pin both come off the slip handed out at registration. The reply
 * carries the team's current progress as well as a token, so a phone joining
 * halfway through the afternoon — a flat battery swapped for a teammate's
 * spare — lands straight on the right level instead of starting at one.
 */
teams.post('/join', async (c) => {
  const body = await c.req.json().catch(() => null);
  const code = normalizeTeamCode(body?.code);
  const pin = String(body?.pin ?? '').trim();

  if (!code) throw badRequest('code is required');

  const team = await c.env.DB.prepare('SELECT code, name, pin FROM teams WHERE code = ?')
    .bind(code)
    .first();

  // One message for both "no such team" and "wrong pin". Not because the code
  // is secret — it is printed on a wristband — but because a split answer turns
  // the endpoint into a roster anyone can enumerate before the event starts.
  if (!team || team.pin !== pin) {
    return c.json({ error: 'That team code and pin do not match' }, 401);
  }

  const levelCount = Number(c.env.LEVEL_COUNT ?? 10);

  const startedAt = await readStartedAt(c.env.DB);

  return c.json({
    token: await issueToken(c.env, code),
    team: { code: team.code, name: team.name },
    startedAt,
    progress: await readProgress(c.env.DB, code),
    // The route comes back with the token because the phone cannot play
    // without it, and asking for it separately would put a second round-trip
    // between a team and their first clue.
    route: await routeForTeam(c.env.DB, code, levelCount),
  });
});

/**
 * The whole of sync, in one call.
 *
 * The client posts every completion it holds and renders whatever comes back.
 * That is what makes the server authoritative rather than merely informed: the
 * reply replaces the phone's view, so an organiser resetting a team, or a level
 * refused for being out of sequence, actually lands on every device instead of
 * being outvoted by a local tally.
 *
 * Deliberately not a delta. An outbox of unsent items is itself state that can
 * be lost or double-sent, and the interesting case on a campus network is a
 * phone that was in a dead-spot for twenty minutes and has three finds to
 * report. Posting the full set makes that identical to the empty case, and
 * makes a poll and a report the same request.
 */
teams.post('/sync', async (c) => {
  const code = await requireTeam(c);
  const body = await c.req.json().catch(() => ({}));
  const completions = Array.isArray(body?.completions) ? body.completions : [];

  if (completions.length > 64) throw badRequest('too many completions in one sync');

  const startedAt = await readStartedAt(c.env.DB);

  const { progress, accepted, rejected, reason } = await applyCompletions(
    c.env.DB,
    code,
    completions,
    body?.deviceId,
    hasStarted(startedAt),
  );

  // The route rides along on every sync, not just on join. It is a few hundred
  // bytes, and it means an organiser regenerating routes reaches every phone
  // through the ordinary poll instead of needing fifteen teams to sign out.
  const route = await routeForTeam(c.env.DB, code, Number(c.env.LEVEL_COUNT ?? 10));

  // startedAt rides on the sync for the same reason the route does: the poll is
  // already running, so "go" reaches every phone within one interval without
  // anybody refreshing anything.
  return c.json({ code, progress, route, startedAt, accepted, rejected, reason });
});

/**
 * Standings, public and unauthenticated — teams are meant to watch it.
 *
 * It shows how far each team has got and when they last found something, and
 * nothing else. Not which station: the two variants of a level are in different
 * places, and naming one would hand every other team a shortcut to a marker
 * their own route may be about to send them to.
 */
teams.get('/leaderboard', async (c) => {
  const levelCount = Number(c.env.LEVEL_COUNT ?? 10);

  const { results } = await c.env.DB.prepare(
    `SELECT t.code,
            t.name,
            COUNT(c.level)  AS completed,
            MIN(c.at)       AS started_at,
            MAX(c.at)       AS last_at
       FROM teams t
       LEFT JOIN completions c ON c.team_code = t.code
      GROUP BY t.code, t.name
      -- Furthest first; among equals, whoever got there first. A team that has
      -- found nothing has last_at NULL, which sorts last either way.
      ORDER BY completed DESC, last_at ASC, t.code ASC`,
  ).all();

  return c.json({
    levelCount,
    startedAt: await readStartedAt(c.env.DB),
    at: new Date().toISOString(),
    teams: results.map((row) => ({
      code: row.code,
      name: row.name,
      completed: row.completed,
      startedAt: row.started_at,
      lastAt: row.last_at,
      // The finishing time is what settles a tie at the top, so it is computed
      // here rather than left to each client to infer from `completed`.
      finishedAt: row.completed >= levelCount ? row.last_at : null,
    })),
  });
});

teams.get('/:code/progress', async (c) => {
  const code = normalizeTeamCode(c.req.param('code'));
  const team = await c.env.DB.prepare('SELECT code, name FROM teams WHERE code = ?').bind(code).first();
  if (!team) throw notFound('No such team');

  return c.json({ team: { code: team.code, name: team.name }, progress: await readProgress(c.env.DB, code) });
});
