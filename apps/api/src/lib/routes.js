/**
 * Generating team routes.
 *
 * The server does this knowing nothing about the content. It works in beats
 * (1..levelCount) and variant letters, and the client maps those onto the
 * stations in its bundle. That separation is deliberate: routes can be
 * regenerated on the morning of the event without redeploying the Worker, and
 * the Worker never has to be redeployed because somebody reworded a clue.
 */

/** The two physical versions of every beat. */
export const VARIANTS = ['A', 'B'];

/**
 * Every variant assignment with an equal split between A and B.
 *
 * Balance matters as much as distinctness: a team drawn nine A's and one B
 * spends the afternoon walking the same half of campus as everybody else with a
 * lopsided draw. With ten beats there are 252 balanced assignments, which is
 * ample for fifteen teams.
 */
function balancedAssignments(levelCount) {
  const out = [];
  const target = Math.floor(levelCount / 2);
  for (let bits = 0; bits < 1 << levelCount; bits += 1) {
    let ones = 0;
    for (let i = 0; i < levelCount; i += 1) ones += (bits >> i) & 1;
    if (ones === target) out.push(bits);
  }
  return out;
}

/**
 * The order the beats are played in.
 *
 * `story` is the default and tells the ten beats straight through, because they
 * are a narrative and reading chapter seven first is not a design, it is a
 * mistake.
 *
 * `stagger` rotates each team's starting beat around the ring. It exists for
 * one real problem: fifteen teams all beginning at beat 1 means fifteen teams
 * split across that beat's two stations in the first five minutes, which is a
 * queue, not a hunt. The cost is that the story arrives out of sequence, so it
 * is opt-in and the organiser decides whether the crush or the narrative
 * matters more on their campus.
 */
export const ORDERS = ['story', 'stagger'];

function beatOrder(order, levelCount, index, teamCount) {
  if (order !== 'stagger') return Array.from({ length: levelCount }, (_, i) => i + 1);

  const start = Math.floor((index * levelCount) / Math.max(teamCount, 1));
  return Array.from({ length: levelCount }, (_, i) => ((start + i) % levelCount) + 1);
}

/**
 * Routes for a list of team codes.
 *
 * Assignments are spread across the balanced set by index rather than hashed:
 * with fifteen teams a birthday collision is likely enough to be worth
 * designing out, and two teams on an identical route is the one outcome the
 * whole variant scheme exists to prevent.
 */
export function generateRoutes(codes, { levelCount = 10, order = 'story' } = {}) {
  const assignments = balancedAssignments(levelCount);
  const routes = new Map();

  codes.forEach((code, index) => {
    const bits = assignments[Math.floor((index * assignments.length) / Math.max(codes.length, 1))];
    const beats = beatOrder(order, levelCount, index, codes.length);

    routes.set(
      code,
      beats.map((beat) => ({
        beat,
        // The bit is read at the beat's own index, so a team's variant for a
        // given beat does not move when the order is staggered — only when the
        // assignment itself is regenerated.
        variant: VARIANTS[(bits >> (beat - 1)) & 1],
      })),
    );
  });

  return routes;
}

/**
 * A stored route, or null.
 *
 * Anything malformed is null rather than a throw: a team whose row is somehow
 * corrupt should be handed a fresh route by the caller, not shown an error at
 * the gate while fourteen other teams are already running.
 */
export function parseRoute(raw, levelCount) {
  if (!raw) return null;
  try {
    const route = JSON.parse(raw);
    if (!Array.isArray(route) || route.length !== levelCount) return null;
    if (!route.every((step) => Number.isInteger(step?.beat) && VARIANTS.includes(step?.variant))) {
      return null;
    }
    return route;
  } catch {
    return null;
  }
}

/**
 * The route a team plays, generating and storing one if they have none.
 *
 * The lazy path matters for a roster seeded before routes existed, and for a
 * team added by hand mid-event. It uses the team's position in the full roster
 * so a late addition still lands on a balanced assignment that no one else has.
 */
export async function routeForTeam(db, code, levelCount) {
  const row = await db.prepare('SELECT route FROM teams WHERE code = ?').bind(code).first();
  const stored = parseRoute(row?.route, levelCount);
  if (stored) return stored;

  const { results } = await db.prepare('SELECT code FROM teams ORDER BY code').all();
  const codes = results.map((r) => r.code);
  const route = generateRoutes(codes, { levelCount }).get(code);
  if (!route) return null;

  await db.prepare('UPDATE teams SET route = ? WHERE code = ?').bind(JSON.stringify(route), code).run();
  return route;
}
