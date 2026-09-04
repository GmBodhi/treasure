import { Hono } from 'hono';
import { badRequest, notFound } from '../lib/http.js';
import { normalizeTeamCode, requireAdmin } from '../lib/auth.js';
import { readProgress } from '../lib/progress.js';
import { ORDERS, generateRoutes, parseRoute } from '../lib/routes.js';

/** @type {Hono<{ Bindings: Env }>} */
export const admin = new Hono();

// Every route here is behind the same token, so it is applied once rather than
// per-handler — the failure mode of the per-handler version is one route added
// later without it, which is exactly the route that leaks the pins.
admin.use('*', async (c, next) => {
  requireAdmin(c);
  await next();
});

/** The roster, with pins. This is the sheet an organiser reads off at registration. */
admin.get('/teams', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT t.code, t.name, t.pin,
            COUNT(c.level) AS completed,
            MAX(c.at)      AS last_at,
            COUNT(DISTINCT c.device_id) AS devices
       FROM teams t
       LEFT JOIN completions c ON c.team_code = t.code
      GROUP BY t.code, t.name, t.pin
      ORDER BY t.code`,
  ).all();

  return c.json({
    teams: results.map((row) => ({
      code: row.code,
      name: row.name,
      pin: row.pin,
      completed: row.completed,
      lastAt: row.last_at,
      devices: row.devices,
    })),
  });
});

/**
 * Create or replace the roster.
 *
 * Upsert rather than insert, so re-running the seed before an event updates
 * names and pins without dropping the completions of a team that has already
 * started — which is what a rehearsal run then a real run looks like.
 */
admin.put('/teams', async (c) => {
  const body = await c.req.json().catch(() => null);
  const roster = Array.isArray(body?.teams) ? body.teams : null;
  if (!roster) throw badRequest('teams must be an array');

  const now = new Date().toISOString();
  const rows = roster.map((team) => {
    const code = normalizeTeamCode(team?.code);
    const pin = String(team?.pin ?? '').trim();
    if (!code) throw badRequest('every team needs a code');
    if (!pin) throw badRequest(`team ${code} needs a pin`);
    return { code, name: team.name ?? code, pin };
  });

  // Routes are generated here rather than left to the lazy path on join, so
  // the whole matrix exists before the event starts and can be looked at,
  // argued with, and regenerated while there is still time.
  const levelCount = Number(c.env.LEVEL_COUNT ?? 10);
  const order = ORDERS.includes(body?.order) ? body.order : 'story';
  const routes = generateRoutes(rows.map((row) => row.code), { levelCount, order });

  await c.env.DB.batch(
    rows.map((row) =>
      c.env.DB.prepare(
        `INSERT INTO teams (code, name, pin, route, created_at) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT (code) DO UPDATE SET
           name  = excluded.name,
           pin   = excluded.pin,
           -- Keep a route a team is already walking. Re-running the seed to fix
           -- a name must not move a team that is three stations in to different
           -- stations; POST /api/admin/routes is the deliberate way to reroute.
           route = COALESCE(teams.route, excluded.route)`,
      ).bind(row.code, row.name, row.pin, JSON.stringify(routes.get(row.code)), now),
    ),
  );

  return c.json({ teams: rows.map(({ code, name }) => ({ code, name })) });
});

/** The matrix: every team's route, in play order. */
admin.get('/routes', async (c) => {
  const levelCount = Number(c.env.LEVEL_COUNT ?? 10);
  const { results } = await c.env.DB.prepare(
    `SELECT t.code, t.name, t.route, COUNT(c.level) AS completed
       FROM teams t
       LEFT JOIN completions c ON c.team_code = t.code
      GROUP BY t.code, t.name, t.route
      ORDER BY t.code`,
  ).all();

  return c.json({
    levelCount,
    teams: results.map((row) => ({
      code: row.code,
      name: row.name,
      completed: row.completed,
      route: parseRoute(row.route, levelCount),
    })),
  });
});

/**
 * Regenerate the matrix.
 *
 * Refuses once anybody has started, unless explicitly forced. Rerouting a team
 * mid-run sends them to a station they have already been to or one they have no
 * business at, and their completed positions would then point at the wrong
 * stations in the record — so the guard is the default and the override has to
 * be typed.
 */
admin.post('/routes', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const order = ORDERS.includes(body?.order) ? body.order : 'story';
  const levelCount = Number(c.env.LEVEL_COUNT ?? 10);

  const started = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM completions').first();
  if (started?.n > 0 && !body?.force) {
    throw badRequest(
      `${started.n} completions are already recorded. Rerouting now moves teams mid-run; pass force to do it anyway.`,
    );
  }

  const { results } = await c.env.DB.prepare('SELECT code FROM teams ORDER BY code').all();
  const codes = results.map((row) => row.code);
  if (!codes.length) throw badRequest('no teams to route');

  const routes = generateRoutes(codes, { levelCount, order });
  await c.env.DB.batch(
    codes.map((code) =>
      c.env.DB.prepare('UPDATE teams SET route = ? WHERE code = ?').bind(
        JSON.stringify(routes.get(code)),
        code,
      ),
    ),
  );

  return c.json({ order, teams: codes.length });
});

/**
 * Put a team at a level by hand.
 *
 * The case this exists for is a phone in a fountain: the team is genuinely on
 * level 6 and has nothing to prove it with. Setting it lower deletes the rows
 * above, setting it higher backfills them at the current time — marked with a
 * device_id of "organiser" so the table still says how each row got there.
 */
admin.post('/teams/:code/unlock', async (c) => {
  const code = normalizeTeamCode(c.req.param('code'));
  const body = await c.req.json().catch(() => null);
  const level = Number(body?.level);

  if (!Number.isInteger(level) || level < 1) throw badRequest('level must be an integer >= 1');

  const team = await c.env.DB.prepare('SELECT code FROM teams WHERE code = ?').bind(code).first();
  if (!team) throw notFound('No such team');

  // `unlocked` is level, so the completed levels are 1..level-1.
  const completed = level - 1;
  const now = new Date().toISOString();
  const statements = [
    c.env.DB.prepare('DELETE FROM completions WHERE team_code = ? AND level > ?').bind(code, completed),
  ];

  for (let n = 1; n <= completed; n += 1) {
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO completions (team_code, level, station_id, device_id, at)
              VALUES (?1, ?2, NULL, 'organiser', ?3)
         ON CONFLICT (team_code, level) DO NOTHING`,
      ).bind(code, n, now),
    );
  }

  await c.env.DB.batch(statements);
  return c.json({ code, progress: await readProgress(c.env.DB, code) });
});

admin.delete('/teams/:code/progress', async (c) => {
  const code = normalizeTeamCode(c.req.param('code'));
  await c.env.DB.prepare('DELETE FROM completions WHERE team_code = ?').bind(code).run();
  return c.json({ code, progress: await readProgress(c.env.DB, code) });
});
