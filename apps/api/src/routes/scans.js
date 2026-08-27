import { Hono } from 'hono';
import { badRequest } from '../lib/http.js';

/** @type {Hono<{ Bindings: Env }>} */
export const scans = new Hono();

/**
 * Record one marker acquisition. Fire-and-forget from the client.
 *
 * The body is read as text, not JSON, on purpose. The client posts this with
 * `navigator.sendBeacon` so the report survives the tab being backgrounded, and
 * a beacon carrying `application/json` to another origin triggers a CORS
 * preflight that sendBeacon cannot perform — the report would vanish silently.
 * `text/plain` keeps it a simple request; the parsing is the same either way.
 */
scans.post('/', async (c) => {
  const raw = await c.req.text();
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw badRequest('body must be JSON');
  }

  const { experienceId, markerId, targetIndex, sessionId, dwellMs } = body ?? {};
  if (!experienceId) throw badRequest('experienceId is required');
  if (!markerId && !Number.isInteger(targetIndex)) {
    throw badRequest('markerId or targetIndex is required');
  }

  const scan = {
    id: crypto.randomUUID(),
    experienceId,
    markerId: markerId ?? null,
    targetIndex: Number.isInteger(targetIndex) ? targetIndex : null,
    sessionId: sessionId ?? null,
    dwellMs: Number.isFinite(dwellMs) ? Math.round(dwellMs) : null,
    userAgent: c.req.header('user-agent') ?? null,
    at: new Date().toISOString(),
  };

  await c.env.DB.prepare(
    `INSERT INTO scans
       (id, experience_id, marker_id, target_index, session_id, dwell_ms, user_agent, at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      scan.id,
      scan.experienceId,
      scan.markerId,
      scan.targetIndex,
      scan.sessionId,
      scan.dwellMs,
      scan.userAgent,
      scan.at,
    )
    .run();

  // Trim after responding: the cap exists to stop an unattended demo growing
  // without bound, and no client is waiting on the answer.
  const cap = Number(c.env.MAX_SCANS ?? 10_000);
  c.executionCtx.waitUntil(
    c.env.DB.prepare(
      `DELETE FROM scans
        WHERE experience_id = ?1
          AND at < (SELECT at FROM scans WHERE experience_id = ?1 ORDER BY at DESC LIMIT 1 OFFSET ?2)`,
    )
      .bind(scan.experienceId, cap)
      .run()
      .catch((err) => console.error('scan prune failed', err)),
  );

  return c.json(scan, 201);
});

scans.get('/', async (c) => {
  const experienceId = c.req.query('experienceId');
  const limit = Math.min(Number(c.req.query('limit') ?? 100) || 100, 1000);

  const where = experienceId ? 'WHERE experience_id = ?' : '';
  const args = experienceId ? [experienceId] : [];

  const total = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM scans ${where}`)
    .bind(...args)
    .first();

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM scans ${where} ORDER BY at DESC LIMIT ?`,
  )
    .bind(...args, limit)
    .all();

  return c.json({
    total: total?.n ?? 0,
    scans: results.map((row) => ({
      id: row.id,
      experienceId: row.experience_id,
      markerId: row.marker_id,
      targetIndex: row.target_index,
      sessionId: row.session_id,
      dwellMs: row.dwell_ms,
      userAgent: row.user_agent,
      at: row.at,
    })),
  });
});

/**
 * Per-marker counts, unique sessions, and mean dwell time.
 *
 * This is the reason scans are rows. The file-backed version loaded every scan
 * ever recorded into memory and folded it by hand; here the database does it,
 * and the work no longer grows with the size of the history.
 */
scans.get('/summary', async (c) => {
  const experienceId = c.req.query('experienceId');
  const where = experienceId ? 'WHERE experience_id = ?' : '';
  const args = experienceId ? [experienceId] : [];

  const totals = await c.env.DB.prepare(
    `SELECT COUNT(*) AS total_scans,
            COUNT(DISTINCT session_id) AS unique_sessions
       FROM scans ${where}`,
  )
    .bind(...args)
    .first();

  const { results } = await c.env.DB.prepare(
    `SELECT COALESCE(marker_id, 'index:' || target_index) AS marker_id,
            COUNT(*)                    AS scans,
            COUNT(DISTINCT session_id)  AS unique_sessions,
            AVG(dwell_ms)               AS avg_dwell_ms
       FROM scans ${where}
       GROUP BY marker_id
       ORDER BY scans DESC`,
  )
    .bind(...args)
    .all();

  return c.json({
    totalScans: totals?.total_scans ?? 0,
    uniqueSessions: totals?.unique_sessions ?? 0,
    markers: results.map((row) => ({
      markerId: row.marker_id,
      scans: row.scans,
      uniqueSessions: row.unique_sessions,
      avgDwellMs: row.avg_dwell_ms == null ? null : Math.round(row.avg_dwell_ms),
    })),
  });
});
