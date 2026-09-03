/**
 * Operation Breadcrumb — the hunt's structure.
 *
 * ── Shape ────────────────────────────────────────────────────────────────────
 *
 * Ten story levels, each existing in two places on campus. A team plays all ten
 * in narrative order but gets variant A or B at each one, so every team sees the
 * whole story and no two teams walk the same route. Ten levels x two variants is
 * the twenty markers; 2^10 routes is far more than enough to keep fifteen teams
 * apart.
 *
 * ── Progression ──────────────────────────────────────────────────────────────
 *
 * Level N's brief says where to go. Finding and scanning that station's marker
 * unlocks level N+1. Unlocked levels stay readable forever from the level space,
 * so nobody has to walk back across campus to re-read a clue.
 *
 * Progression is client-side and therefore trusted, not enforced: the app
 * believes its own tracker. That is the right trade for a two-hour campus event
 * with no network dependency, and the honest limit of it is that someone who
 * opens devtools can skip ahead. Moving the unlock behind the Worker in
 * apps/api is the upgrade path if that ever matters.
 *
 * ── Stations ─────────────────────────────────────────────────────────────────
 *
 * A station is one physical thing on campus and one compiled target. Its `id` is
 * also its filename: `l03a` lives at `public/targets/l03a.mind`. Each is
 * compiled on its own rather than into one big bundle, because a team only ever
 * scans for the level it is on — so the app downloads a single-target file of a
 * few hundred KB, matches against exactly one image, and cannot mis-match
 * against a marker belonging to some other level.
 */

const TARGET_BASE = '/targets';

/** Passed through to the `mindar-image` component. */
export const TRACKING = {
  filterMinCF: 0.0001,
  filterBeta: 0.001,
  missTolerance: 5,
  warmupTolerance: 5,
  maxTrack: 1,
};

/**
 * The ten story beats.
 *
 * `story` and `breadcrumb` belong to the beat, so both variants tell the same
 * part of the story. Everything under `variants` is what differs between the two
 * physical versions: where it is, what the marker is, and how the overlay reads.
 *
 * `brief` is what the player is told *before* they go — the clue that sends them
 * to the station. `reveal` is what the AR overlay shows once they find it.
 */
export const LEVELS = [
  {
    n: 1,
    id: 'breach',
    title: 'The Breach',
    story:
      'The breach origin is a seemingly minor tool: the employee health app. Why would anyone target a wellness app? There is nothing valuable in it.',
    breadcrumb: 'NOT WHAT IT SEEMS',
    variants: {
      A: { id: 'l01a', location: 'Seminar Hall', marker: 'TODO: which fixed image', brief: 'TODO', reveal: 'TODO' },
      B: { id: 'l01b', location: 'Library / IT Room', marker: 'TODO', brief: 'TODO', reveal: 'TODO' },
    },
  },
  {
    n: 2,
    id: 'tracker',
    title: 'The Tracker',
    story:
      'The IP leads to a temporary server holding a corrupted dump. Inside it: a partial recording of employees during "wellness trials", under stress tests far past any standard protocol.',
    breadcrumb: "They call it 'resilience testing'... I call it abuse.",
    variants: {
      A: { id: 'l02a', location: 'Room 205', marker: 'TODO', brief: 'TODO', reveal: 'TODO' },
      B: { id: 'l02b', location: 'Projector Room', marker: 'TODO', brief: 'TODO', reveal: 'TODO' },
    },
  },
  {
    n: 3,
    id: 'report',
    title: 'The Redacted Report',
    story:
      'A classified internal research report, partly decrypted. It references Project BrightHalo — neurostim tech running under the wellness programme.',
    breadcrumb: 'Dig deeper. Look where the smiles end.',
    variants: {
      A: { id: 'l03a', location: 'Classroom', marker: 'TODO', brief: 'TODO', reveal: 'TODO' },
      B: { id: 'l03b', location: 'CS Staffroom', marker: 'TODO', brief: 'TODO', reveal: 'TODO' },
    },
  },
  {
    n: 4,
    id: 'faces',
    title: 'False Faces',
    story:
      'Cameras that appear nowhere in the infrastructure diagrams feed an internal server. Employees are being watched for emotional response, continuously.',
    breadcrumb: 'It is not data — it is control.',
    variants: {
      A: { id: 'l04a', location: 'Electronics Workshop', marker: 'TODO', brief: 'TODO', reveal: 'TODO' },
      B: { id: 'l04b', location: 'Physics Lab', marker: 'TODO', brief: 'TODO', reveal: 'TODO' },
    },
  },
  {
    n: 5,
    id: 'silenced',
    title: 'The Silenced',
    story:
      'An archived complaints folder. Every entry is marked resolved; every entry is disturbing. Several of the people who filed them have gone dark or been terminated.',
    breadcrumb: 'She tried to speak. Look up Janice L.',
    variants: {
      A: { id: 'l05a', location: 'Chemistry Lab', marker: 'TODO', brief: 'TODO', reveal: 'TODO' },
      B: { id: 'l05b', location: 'Near Storage Room', marker: 'TODO', brief: 'TODO', reveal: 'TODO' },
    },
  },
  {
    n: 6,
    id: 'ghost',
    title: 'The Ghost Interview',
    story:
      'An interview from the internal newsletter, in which Janice L. praises the company. The metadata says the footage was modified. Her real interview never aired.',
    breadcrumb: "Janice's real voice lives on... in backup sector 7.",
    variants: {
      A: { id: 'l06a', location: 'Electronics Workshop Side', marker: 'TODO', brief: 'TODO', reveal: 'TODO' },
      B: { id: 'l06b', location: 'Workshop', marker: 'TODO', brief: 'TODO', reveal: 'TODO' },
    },
  },
  {
    n: 7,
    id: 'revelation',
    title: 'The Revelation',
    story:
      'Backup sector 7 holds Janice, unedited: "They are using neural feedback to suppress dissent. This is not wellness — it is mind control."',
    breadcrumb: 'I did not hack Neodyne to destroy it. I hacked it to reveal it.',
    variants: {
      A: { id: 'l07a', location: 'CS Staffroom', marker: 'TODO', brief: 'TODO', reveal: 'TODO' },
      B: { id: 'l07b', location: 'Library / IT Room', marker: 'TODO', brief: 'TODO', reveal: 'TODO' },
    },
  },
  {
    n: 8,
    id: 'pattern',
    title: 'The Pattern',
    story:
      'The trail was always meant to be followed. Every breadcrumb was left where only someone doing this job would look. He wanted to be found — by the right people.',
    breadcrumb: "If you're reading this, you're good. But are you good?",
    variants: {
      A: { id: 'l08a', location: 'Volleyball Side', marker: 'TODO', brief: 'TODO', reveal: 'TODO' },
      B: { id: 'l08b', location: 'Near Storage Room', marker: 'TODO', brief: 'TODO', reveal: 'TODO' },
    },
  },
  {
    n: 9,
    id: 'choice',
    title: 'The Choice',
    story:
      'A hidden server, and everything on it: documents, testimony, evidence. He was never a professional. He was an intern — a nobody trying to make a difference.',
    breadcrumb:
      'Now you know. Will you bury the truth and keep your paycheck, or will you do what I could not? — Breadcrumb',
    variants: {
      A: { id: 'l09a', location: 'Workshop', marker: 'TODO', brief: 'TODO', reveal: 'TODO' },
      B: { id: 'l09b', location: 'Physics Lab', marker: 'TODO', brief: 'TODO', reveal: 'TODO' },
    },
  },
  {
    n: 10,
    id: 'ending',
    title: 'The Ending',
    story:
      'Leak it, or hand it back. One choice makes headlines and costs you everything you were hired to protect. The other makes you a promotion, and your next assignment: find the others like him.',
    breadcrumb: 'One becomes many. Welcome to the real resistance.',
    variants: {
      A: { id: 'l10a', location: 'Seminar Hall', marker: 'TODO', brief: 'TODO', reveal: 'TODO' },
      B: { id: 'l10b', location: 'Seminar Hall', marker: 'TODO', brief: 'TODO', reveal: 'TODO' },
    },
  },
];

export const LEVEL_COUNT = LEVELS.length;

/** Team codes handed out at the start. Edit this list to match your sign-ups. */
export const TEAMS = Array.from({ length: 15 }, (_, i) => `BC-${String(i + 1).padStart(2, '0')}`);

/**
 * The same codes as they come back from a phone keyboard.
 *
 * Codes are printed with a hyphen because that is what reads clearly on a slip
 * of paper, but `normalizeTeamCode` strips punctuation — so a team typing their
 * own code correctly would never match the printed list. Compare on this.
 */
const NORMALIZED_TEAMS = TEAMS.map(normalizeTeamCode);

/**
 * Every 10-bit route with exactly five A's and five B's.
 *
 * Balancing each route matters as much as making them distinct: a team whose
 * route is nine A's and one B spends the day walking the same half of campus as
 * everyone else with a lopsided route.
 */
const BALANCED_ROUTES = (() => {
  const out = [];
  for (let bits = 0; bits < 1 << LEVEL_COUNT; bits++) {
    let ones = 0;
    for (let i = 0; i < LEVEL_COUNT; i++) ones += (bits >> i) & 1;
    if (ones === LEVEL_COUNT / 2) out.push(bits);
  }
  return out;
})();

/**
 * A team's variant string, e.g. 'ABBABABAAB'.
 *
 * Known teams are spread evenly across the balanced set by index rather than
 * hashed, so no two of them can collide onto the same route — with fifteen teams
 * a birthday collision is likely enough to be worth designing out. Anything else
 * (a spare phone, an organiser testing) falls back to a hash so it still gets a
 * stable, sensible route.
 */
export function routeFor(teamCode) {
  const code = normalizeTeamCode(teamCode);
  const known = NORMALIZED_TEAMS.indexOf(code);

  const bits =
    known >= 0
      ? BALANCED_ROUTES[Math.floor((known * BALANCED_ROUTES.length) / TEAMS.length)]
      : BALANCED_ROUTES[hash(code) % BALANCED_ROUTES.length];

  return Array.from({ length: LEVEL_COUNT }, (_, i) => ((bits >> i) & 1 ? 'B' : 'A')).join('');
}

/** Team codes are typed by people; case and spacing must not decide identity. */
export function normalizeTeamCode(code) {
  return (code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isKnownTeam(code) {
  return NORMALIZED_TEAMS.includes(normalizeTeamCode(code));
}

/**
 * The ten levels as this team plays them, with the beat and its chosen variant
 * flattened into one object per level.
 */
export function levelsFor(teamCode) {
  const route = routeFor(teamCode);

  return LEVELS.map((level, i) => {
    const variant = route[i];
    const station = level.variants[variant];

    return {
      n: level.n,
      id: level.id,
      title: level.title,
      story: level.story,
      breadcrumb: level.breadcrumb,
      variant,
      station: {
        ...station,
        targetUrl: `${TARGET_BASE}/${station.id}.mind`,
      },
    };
  });
}

/** All twenty stations, for the studio and the console. */
export function listStations() {
  return LEVELS.flatMap((level) =>
    Object.entries(level.variants).map(([variant, station]) => ({
      ...station,
      variant,
      level: level.n,
      title: level.title,
      targetUrl: `${TARGET_BASE}/${station.id}.mind`,
    })),
  );
}

/**
 * True when a station's compiled target is actually deployed.
 *
 * `res.ok` alone is not enough: both the dev server and Pages route unmatched
 * paths to the SPA fallback, so a HEAD for a target that was never compiled
 * comes back 200 with index.html behind it. Taken at face value that sends
 * MindAR off to parse HTML as a feature bundle and fail somewhere deep, with the
 * camera already open — exactly what this check exists to pre-empt. A real
 * target is binary; the fallback is unambiguously HTML.
 */
export function targetExists(url) {
  return fetch(url, { method: 'HEAD' }).then(
    (res) => res.ok && !(res.headers.get('content-type') ?? '').includes('text/html'),
    () => false,
  );
}

/** FNV-1a. Only needs to be stable and well-spread, not cryptographic. */
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}
