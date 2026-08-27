import { Hono } from 'hono';
import { badRequest, notFound, tooLarge } from '../lib/http.js';
import { deleteTarget, readTarget, targetSize, writeTarget } from '../lib/targets.js';

const ID_RE = /^[a-z0-9][a-z0-9-_]{0,63}$/i;

/** D1 row → the manifest shape the client has always received. */
function toManifest(row, requestUrl) {
  return {
    id: row.id,
    name: row.name,
    targetFile: row.target_file,
    tracking: JSON.parse(row.tracking),
    markers: JSON.parse(row.markers),
    updatedAt: row.updated_at,
    // Absolute, because the API and the app are on different origins. A
    // relative path here would resolve against the app's origin and 404.
    targetUrl: new URL(`/api/experiences/${row.id}/target.mind`, requestUrl).toString(),
  };
}

function validate(body, id) {
  if (!ID_RE.test(id ?? '')) {
    throw badRequest('id must match /^[a-z0-9][a-z0-9-_]{0,63}$/i');
  }
  if (!body?.name) throw badRequest('name is required');
  if (!Array.isArray(body.markers)) throw badRequest('markers must be an array');

  for (const marker of body.markers) {
    if (!Number.isInteger(marker.targetIndex) || marker.targetIndex < 0) {
      throw badRequest(`marker "${marker.id ?? '?'}" needs an integer targetIndex >= 0`);
    }
  }
  const indexes = body.markers.map((m) => m.targetIndex);
  if (new Set(indexes).size !== indexes.length) {
    throw badRequest('markers must have unique targetIndex values');
  }
  return body;
}

/** @type {Hono<{ Bindings: Env }>} */
export const experiences = new Hono();

experiences.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT e.id, e.name, e.target_file,
            json_array_length(e.markers) AS marker_count
       FROM experiences e
       ORDER BY e.id`,
  ).all();

  return c.json({
    experiences: results.map((row) => ({
      id: row.id,
      name: row.name,
      targetFile: row.target_file,
      markerCount: row.marker_count,
    })),
  });
});

experiences.get('/:id', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT * FROM experiences WHERE id = ?').bind(id).first();
  if (!row) throw notFound(`No experience "${id}"`);
  return c.json(toManifest(row, c.req.url));
});

/** Create or replace an experience. */
experiences.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = validate(await c.req.json().catch(() => null), id);
  const updatedAt = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO experiences (id, name, tracking, markers, target_file, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT(id) DO UPDATE SET
       name = ?2, tracking = ?3, markers = ?4, updated_at = ?6`,
  )
    .bind(
      id,
      body.name,
      JSON.stringify(body.tracking ?? {}),
      JSON.stringify(body.markers),
      body.targetFile ?? null,
      updatedAt,
    )
    .run();

  const row = await c.env.DB.prepare('SELECT * FROM experiences WHERE id = ?').bind(id).first();
  return c.json(toManifest(row, c.req.url));
});

experiences.delete('/:id', async (c) => {
  const id = c.req.param('id');
  // The chunk table declares ON DELETE CASCADE, but D1 only enforces foreign
  // keys when PRAGMA foreign_keys is on, which is not guaranteed per session.
  await deleteTarget(c.env.DB, id);
  const { meta } = await c.env.DB.prepare('DELETE FROM experiences WHERE id = ?').bind(id).run();
  if (!meta.changes) throw notFound(`No experience "${id}"`);
  return c.body(null, 204);
});

/** Upload the compiled .mind file produced by the MindAR target compiler. */
experiences.post('/:id/target', async (c) => {
  const id = c.req.param('id');
  if (!ID_RE.test(id)) throw badRequest('invalid experience id');

  const exists = await c.env.DB.prepare('SELECT id FROM experiences WHERE id = ?').bind(id).first();
  if (!exists) throw notFound(`No experience "${id}"`);

  const form = await c.req.formData().catch(() => null);
  const file = form?.get('target');
  if (!file || typeof file === 'string') {
    throw badRequest('multipart field "target" (a .mind file) is required');
  }

  const max = Number(c.env.MAX_TARGET_BYTES ?? 10_485_760);
  if (file.size > max) throw tooLarge(`target exceeds ${max} bytes`);

  const bytes = await file.arrayBuffer();
  await writeTarget(c.env.DB, id, bytes);

  const filename = `${id}.mind`;
  await c.env.DB.prepare('UPDATE experiences SET target_file = ?, updated_at = ? WHERE id = ?')
    .bind(filename, new Date().toISOString(), id)
    .run();

  return c.json({ targetFile: filename, bytes: bytes.byteLength });
});

/** Serve the compiled target so the client never needs to guess the filename. */
experiences.on(['GET', 'HEAD'], '/:id/target.mind', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT target_file FROM experiences WHERE id = ?')
    .bind(id)
    .first();
  if (!row) throw notFound(`No experience "${id}"`);

  // The client HEADs this before opening the camera, precisely so a missing
  // target fails with something actionable instead of inside MindAR.
  if (c.req.method === 'HEAD') {
    const size = await targetSize(c.env.DB, id);
    if (!size) {
      throw notFound(
        `Target file "${row.target_file ?? id}.mind" is not stored yet — POST one to /api/experiences/${id}/target`,
      );
    }
    return c.body(null, 200, {
      'content-type': 'application/octet-stream',
      'content-length': String(size),
      'cache-control': 'public, max-age=86400',
    });
  }

  const bytes = await readTarget(c.env.DB, id);
  if (!bytes) {
    throw notFound(
      `Target file "${row.target_file ?? id}.mind" is not stored yet — POST one to /api/experiences/${id}/target`,
    );
  }

  return c.body(bytes, 200, {
    'content-type': 'application/octet-stream',
    'content-length': String(bytes.byteLength),
    // Content-addressed by experience id and replaced wholesale on re-upload.
    'cache-control': 'public, max-age=86400',
  });
});
