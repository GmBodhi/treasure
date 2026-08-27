/**
 * Compiled `.mind` bundles stored in D1.
 *
 * D1 caps a single BLOB at 2 MB and the app accepts uploads up to 10 MB, so a
 * target is written across several rows and reassembled on read. The chunk size
 * is well under the cap rather than at it: the limit applies to the whole row,
 * not just the blob column, and leaving headroom means a future column cannot
 * silently push a working target over the edge.
 *
 * Object storage (R2) is the natural home for blobs this size. This exists
 * because the deployment is deliberately D1-only.
 */
export const CHUNK_BYTES = 1_000_000;

/** Replace an experience's target with `bytes`. Returns the chunk count. */
export async function writeTarget(db, experienceId, bytes) {
  const data = new Uint8Array(bytes);
  const statements = [
    db.prepare('DELETE FROM target_chunks WHERE experience_id = ?').bind(experienceId),
  ];

  for (let seq = 0, offset = 0; offset < data.byteLength; seq += 1, offset += CHUNK_BYTES) {
    // `slice` copies, which matters: a subarray would share the parent buffer
    // and D1 would serialise the whole upload for every chunk.
    const chunk = data.slice(offset, Math.min(offset + CHUNK_BYTES, data.byteLength));
    statements.push(
      db
        .prepare('INSERT INTO target_chunks (experience_id, seq, bytes) VALUES (?, ?, ?)')
        .bind(experienceId, seq, chunk),
    );
  }

  // One batch so a failed upload cannot leave a half-written target behind.
  await db.batch(statements);
  return statements.length - 1;
}

/**
 * Read a target back as one contiguous buffer, or null when none is stored.
 *
 * Chunks are concatenated rather than streamed: the whole point of the file is
 * to be handed to MindAR's compiler as a single ArrayBuffer, and 10 MB is well
 * inside a Worker's memory budget.
 */
export async function readTarget(db, experienceId) {
  const { results } = await db
    .prepare('SELECT bytes FROM target_chunks WHERE experience_id = ? ORDER BY seq')
    .bind(experienceId)
    .all();

  if (results.length === 0) return null;

  const parts = results.map((row) => new Uint8Array(row.bytes));
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

/** Byte length of the stored target without reading the bytes themselves. */
export async function targetSize(db, experienceId) {
  const row = await db
    .prepare('SELECT SUM(LENGTH(bytes)) AS bytes FROM target_chunks WHERE experience_id = ?')
    .bind(experienceId)
    .first();
  return row?.bytes ?? 0;
}

export async function deleteTarget(db, experienceId) {
  await db.prepare('DELETE FROM target_chunks WHERE experience_id = ?').bind(experienceId).run();
}
