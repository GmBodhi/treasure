/**
 * A team's place in the hunt. The server owns it.
 *
 * The split of responsibility is: the client verifies, the server decides.
 * Verification is the scan — only the phone can know that MindAR matched the
 * image in front of it, and no amount of server logic can re-check that after
 * the fact. So the client asserts "we found level 4" and this decides whether
 * that is a thing that may happen, records it, and hands back the team's
 * progress. What the client renders is this answer, not its own tally.
 *
 * Progress is derived, never stored: `unlocked` is MAX(level) + 1 over the
 * completions rows. One place a level can be recorded, so no counter can drift
 * from the rows it was counted from, and two teammates scanning the same marker
 * a second apart write the same primary key instead of incrementing twice.
 */

/** `{ unlocked, completedAt: { [level]: epochMs } }` — the shape the client renders. */
export async function readProgress(db, code) {
  const { results } = await db
    .prepare('SELECT level, station_id, at FROM completions WHERE team_code = ? ORDER BY level')
    .bind(code)
    .all();

  const completedAt = {};
  const stations = {};
  let highest = 0;

  for (const row of results) {
    completedAt[row.level] = Date.parse(row.at);
    stations[row.level] = row.station_id;
    if (row.level > highest) highest = row.level;
  }

  return { unlocked: highest + 1, completedAt, stations };
}

/**
 * Record what a device claims to have found, and answer with the truth.
 *
 * Three rules are enforced here, and they are the only ones the server can
 * meaningfully enforce given that verification happens on the phone:
 *
 *   Open. Nothing counts before the organiser starts the hunt.
 *
 *   Sequence. A level with no completed predecessor is refused. The hunt is
 *   sequential, so a jump from 2 to 9 is never a race — it is a bug or a team
 *   in devtools. A legitimate client can only ever hold a contiguous run, so
 *   the rule costs it nothing.
 *
 *   First finder. `ON CONFLICT` keeps the *earlier* timestamp, because the
 *   honest answer to "when did this team find station 4" is whoever got there
 *   first, not whichever phone's request happened to arrive second. That also
 *   makes a late sync from a phone that was offline for twenty minutes correct
 *   rather than merely tolerated — its real find time survives.
 *
 * Rejections come back to the caller rather than being swallowed, so a client
 * that has drifted out of step can be told, instead of quietly showing a level
 * the server does not believe it has.
 */
export async function applyCompletions(db, code, completions, deviceId, started = true) {
  const current = await readProgress(db, code);
  const known = new Set(Object.keys(current.completedAt).map(Number));

  // Before the organiser opens the hunt, nothing counts. This is the gate; the
  // waiting screen on the phone is only its picture. A team that finds a marker
  // early — or someone who skips the screen entirely — still records nothing,
  // and the refusal comes back so the client can say why rather than silently
  // dropping a scan somebody watched succeed.
  if (!started) {
    return {
      progress: current,
      accepted: [],
      rejected: completions.map((entry) => entry.level).filter(Number.isInteger),
      reason: 'not-started',
    };
  }

  const incoming = [...completions]
    .filter((entry) => Number.isInteger(entry.level) && entry.level >= 1)
    .sort((a, b) => a.level - b.level);

  const accepted = [];
  const rejected = [];

  for (const entry of incoming) {
    if (known.has(entry.level)) continue;
    if (entry.level !== 1 && !known.has(entry.level - 1)) {
      rejected.push(entry.level);
      continue;
    }
    known.add(entry.level);
    accepted.push(entry);
  }

  if (accepted.length) {
    await db.batch(
      accepted.map((entry) =>
        db
          .prepare(
            `INSERT INTO completions (team_code, level, station_id, device_id, at)
                  VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT (team_code, level) DO UPDATE SET at = MIN(completions.at, excluded.at)`,
          )
          .bind(
            code,
            entry.level,
            entry.stationId ?? null,
            deviceId ?? null,
            // Clamped to now: a phone with a wrong clock must not be able to
            // claim it finished the hunt yesterday and take the top of the board.
            new Date(Math.min(Number(entry.at) || Date.now(), Date.now())).toISOString(),
          ),
      ),
    );
  }

  return { progress: await readProgress(db, code), accepted: accepted.map((e) => e.level), rejected };
}
