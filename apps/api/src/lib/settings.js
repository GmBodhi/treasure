/**
 * Event-wide state. One key so far: `started_at`.
 *
 * The hunt not being open is enforced here and in applyCompletions, not just
 * drawn on the phone. A waiting screen that the server does not back is
 * decoration — the client is the thing being held back, so it cannot also be
 * the thing doing the holding.
 */

export async function readSetting(db, key) {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
  return row?.value ?? null;
}

export async function writeSetting(db, key, value) {
  const now = new Date().toISOString();
  if (value == null) {
    await db.prepare('DELETE FROM settings WHERE key = ?').bind(key).run();
    return null;
  }
  await db
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(key, value, now)
    .run();
  return value;
}

export const STARTED_AT = 'started_at';

/**
 * When the hunt opens, or null if nobody has opened it.
 *
 * The value may be in the future: an organiser announcing "we start at three"
 * should be able to set it and walk away. So "is it open" is a comparison, not
 * a null check — see `hasStarted`.
 */
export const readStartedAt = (db) => readSetting(db, STARTED_AT);

export const hasStarted = (startedAt) =>
  Boolean(startedAt) && Date.parse(startedAt) <= Date.now();
