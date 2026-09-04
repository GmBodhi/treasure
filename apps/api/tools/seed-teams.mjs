/**
 * Create the roster and print the slips to hand out at registration.
 *
 *   npm run db:teams -- [baseUrl] [adminToken]
 *
 * Pins are generated here rather than chosen, because a human picking fifteen
 * of them produces 1234 and 0000 twice. They go through the admin API rather
 * than straight into SQL so that seeding a deployed Worker and seeding the
 * local one are the same command with a different URL — there is no `--remote`
 * to forget on the morning of the event.
 *
 * Re-running is safe: the endpoint upserts, so a rehearsal roster can be
 * renamed or re-pinned without wiping the completions of a team already
 * playing. Pass --repin to roll new pins; without it, existing pins are kept.
 */
import { TEAMS } from '../../web/src/lib/hunt.js';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')));

const BASE = args[0] ?? process.env.API_BASE ?? 'https://localhost:8787';
const TOKEN = args[1] ?? process.env.ADMIN_TOKEN ?? 'dev-only-run-wrangler-secret-put-ADMIN_TOKEN';

// The dev API is self-signed; this script only ever points at one it was told to.
if (/^https:\/\/(localhost|127\.|10\.|192\.168\.)/.test(BASE)) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

/**
 * Four digits from the CSPRNG, uniformly.
 *
 * `% 10000` on a 32-bit draw is very slightly biased; the bias is irrelevant
 * for a wristband pin, but rejection sampling is two lines and means nobody
 * has to decide that a second time.
 */
function pin() {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0xffffffff / 10000) * 10000;
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return String(buf[0] % 10000).padStart(4, '0');
}

const headers = { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` };

const existing = new Map();
if (!flags.has('--repin')) {
  const res = await fetch(`${BASE}/api/admin/teams`, { headers });
  if (res.ok) {
    const { teams } = await res.json();
    for (const team of teams) existing.set(team.code, team.pin);
  } else if (res.status === 401) {
    console.error('admin token rejected — pass it as the second argument or set ADMIN_TOKEN');
    process.exit(1);
  }
}

const roster = TEAMS.map((code) => {
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return { code: normalized, name: code, pin: existing.get(normalized) ?? pin() };
});

const res = await fetch(`${BASE}/api/admin/teams`, {
  method: 'PUT',
  headers,
  body: JSON.stringify({ teams: roster }),
});

if (!res.ok) {
  console.error(`PUT /api/admin/teams → ${res.status} ${await res.text()}`);
  process.exit(1);
}

console.log(`\n  ${roster.length} teams on ${BASE}\n`);
console.log('  TEAM     PIN');
console.log('  ────     ───');
for (const team of roster) console.log(`  ${team.name.padEnd(8)} ${team.pin}`);
console.log('\n  Cut along the lines. A team needs both to join on any phone.\n');
