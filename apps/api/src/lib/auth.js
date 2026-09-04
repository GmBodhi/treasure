/**
 * Who is allowed to move a team's progress.
 *
 * Both `TEAM_SECRET` and `ADMIN_TOKEN` come from `wrangler secret put`, and
 * neither appears in wrangler.jsonc — a var there would overwrite the secret on
 * the next `wrangler deploy`, not be overridden by it. Local values live in
 * .dev.vars, which is never uploaded.
 *
 * A team token is the team code plus an HMAC of it. That makes it verifiable
 * without a lookup — no sessions table, no expiry to sweep, and a phone that
 * joined at registration still works six hours later on a flat battery and a
 * cold reload. The event is one afternoon; anything with a refresh cycle would
 * be machinery serving nobody.
 *
 * What this buys, precisely: a device cannot advance a team it did not join.
 * Team codes are printed on wristbands and guessable by design (BC-01..BC-15),
 * so without this any phone could type a rival's code and burn their route.
 * What it does not buy: protection from a team cheating on its own run. The
 * clues are in the bundle on their phone, so a determined team can always post
 * their own completions. Sequence enforcement and timestamps in `completions`
 * make that visible to an organiser rather than impossible.
 */
import { HTTPException } from 'hono/http-exception';

const encoder = new TextEncoder();

function unauthorized(message = 'Not signed in as this team') {
  return new HTTPException(401, {
    res: Response.json({ error: message }, { status: 401 }),
  });
}

function base64url(bytes) {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Refuse to run unconfigured.
 *
 * Without this, a missing binding reaches `encoder.encode(undefined)` and every
 * token in the deployment gets signed with the literal string "undefined" —
 * which works perfectly, forges trivially, and looks exactly like a healthy
 * system from the outside. Failing at the first request is the only version of
 * this anybody finds out about.
 */
function secretOf(env) {
  const secret = env.TEAM_SECRET;
  if (!secret) {
    throw new HTTPException(503, {
      res: Response.json(
        { error: 'TEAM_SECRET is not configured on this deployment' },
        { status: 503 },
      ),
    });
  }
  return secret;
}

async function sign(secret, code) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return base64url(await crypto.subtle.sign('HMAC', key, encoder.encode(code)));
}

export async function issueToken(env, code) {
  return `${code}.${await sign(secretOf(env), code)}`;
}

/**
 * The team a request is acting as, or 401.
 *
 * Compared with `timingSafeEqual` rather than `===`: the comparison is against
 * a value an attacker supplies and can vary freely, which is the exact shape a
 * timing oracle needs. It costs nothing to not have that conversation.
 */
export async function requireTeam(c) {
  const header = c.req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const split = token.lastIndexOf('.');
  if (split < 1) throw unauthorized();

  const code = token.slice(0, split);
  const presented = encoder.encode(token.slice(split + 1));
  const expected = encoder.encode(await sign(secretOf(c.env), code));

  if (presented.byteLength !== expected.byteLength) throw unauthorized();
  if (!crypto.subtle.timingSafeEqual(presented, expected)) throw unauthorized();

  return code;
}

/**
 * Organiser access, for the console: pins, standings, and putting a team back
 * where it belongs after a lost phone.
 *
 * A missing ADMIN_TOKEN refuses every request rather than opening the door. The
 * failure mode of the other choice is an unconfigured deployment silently
 * handing out every team's pin.
 */
export function requireAdmin(c) {
  const configured = c.env.ADMIN_TOKEN;
  if (!configured) {
    throw new HTTPException(503, {
      res: Response.json({ error: 'ADMIN_TOKEN is not configured on this deployment' }, { status: 503 }),
    });
  }

  const header = c.req.header('authorization') ?? '';
  const presented = encoder.encode(header.startsWith('Bearer ') ? header.slice(7) : '');
  const expected = encoder.encode(configured);

  if (
    presented.byteLength !== expected.byteLength ||
    !crypto.subtle.timingSafeEqual(presented, expected)
  ) {
    throw new HTTPException(401, {
      res: Response.json({ error: 'Bad admin token' }, { status: 401 }),
    });
  }
}

/** The one spelling of a team code the database ever sees. */
export const normalizeTeamCode = (code) => String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
