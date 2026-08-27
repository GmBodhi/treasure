/**
 * Seed an API instance from data/experiences.seed.json, then upload the
 * compiled target if one is on disk.
 *
 * This goes through the public API rather than generating SQL, for one reason
 * that is not stylistic: a `.mind` bundle is megabytes of binary, D1 caps a SQL
 * statement at 100 KB, and a hex literal of the file would be several times
 * larger than the file. The bytes have to arrive over HTTP.
 *
 *   npm run db:seed -- [baseUrl] [targetFile]
 */
import fs from 'node:fs/promises';

const BASE = process.argv[2] ?? process.env.API_BASE ?? 'https://localhost:8787';
const TARGET = process.argv[3] ?? new URL('../seed/targets/demo.mind', import.meta.url);

// The dev certs are self-signed; this script only ever talks to a local API.
if (BASE.startsWith('https://localhost') || BASE.startsWith('https://127.') || BASE.startsWith('https://192.')) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const seed = JSON.parse(
  await fs.readFile(new URL('../seed/experiences.seed.json', import.meta.url), 'utf8'),
);

for (const experience of seed.experiences) {
  const res = await fetch(`${BASE}/api/experiences/${encodeURIComponent(experience.id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(experience),
  });
  if (!res.ok) {
    console.error(`PUT ${experience.id} → ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  console.log(`seeded experience "${experience.id}" (${experience.markers.length} markers)`);
}

const first = seed.experiences[0];
let bytes;
try {
  bytes = await fs.readFile(TARGET);
} catch {
  console.log(`no target file on disk — compile one at /studio, or upload it there`);
  process.exit(0);
}

const body = new FormData();
body.append('target', new Blob([bytes], { type: 'application/octet-stream' }), `${first.id}.mind`);

const upload = await fetch(`${BASE}/api/experiences/${encodeURIComponent(first.id)}/target`, {
  method: 'POST',
  body,
});
const payload = await upload.json().catch(() => ({}));
if (!upload.ok) {
  console.error(`target upload → ${upload.status} ${JSON.stringify(payload)}`);
  process.exit(1);
}
console.log(`uploaded target ${payload.targetFile} (${(payload.bytes / 1024).toFixed(1)} KB)`);
