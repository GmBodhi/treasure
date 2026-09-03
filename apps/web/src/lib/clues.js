/**
 * Clue definitions — the hard-coded source of truth for every hunt.
 *
 * These used to be rows in D1, fetched as a manifest over HTTP. They are code
 * now: a hunt is content, it changes with the app it ships in, and a deploy is
 * already the moment it changes. That removes the database, the seed step and
 * a network round-trip from the critical path before the camera can open.
 *
 * Two vocabularies meet here, deliberately:
 *
 *   clue    what you author below — a station in the hunt, with its copy and
 *           whichever overlay type it presents.
 *   marker  what the tracker sees — an image in the compiled `.mind` bundle,
 *           addressed by `targetIndex`.
 *
 * They are the same object. `getExperience()` publishes `clues` as `markers`
 * because that is the name the A-Frame/MindAR layer, the printable sheet and
 * the `scans` table have always used, and renaming it downstream would buy
 * nothing. Author clues; the tracker reads markers.
 *
 * ── Adding a clue ────────────────────────────────────────────────────────────
 *
 * A clue is two coupled things, and one without the other does not work:
 *
 *   1. Artwork the tracker can match. Add it to `lib/markers.js`, or bring your
 *      own image. Every marker needs a different *composition*, not just a
 *      different palette — matching happens in greyscale.
 *   2. An entry below, whose `targetIndex` is the image's position in the
 *      compile order.
 *
 * Then recompile at `/studio` and save the download to
 * `public/targets/<experience-id>.mind`. A clue added here against a target
 * that does not contain its image is a station that can never fire.
 *
 * ── Clue fields ──────────────────────────────────────────────────────────────
 *
 *   targetIndex  required. Integer >= 0, unique within the hunt. Position in
 *                the compiled bundle.
 *   id           required. Unique within the hunt — it keys the scene entity,
 *                the dwell timer and the `marker_id` column in analytics.
 *   title        heading on the sheet, and the card overlay's 3D text.
 *   subtitle     eyebrow above the heading.
 *   body         the clue itself. This is the text that sends someone to the
 *                next station.
 *   accent       overrides --color-accent across the whole HUD while held.
 *   cta          { label, href }. An href starting with http opens in a new tab.
 *   overlay      what renders in 3D on the marker. See ar/overlays/Overlay.jsx:
 *                card | primitives | model | image | video | none.
 *                Omitted entirely means `{ type: 'card' }`.
 */

/**
 * Compiled targets are static assets of this app now, not API responses, so the
 * URL is root-relative and resolves against the app's own origin. The absolute
 * URL the API used to build existed only because it was served from elsewhere.
 */
const TARGET_BASE = '/targets';

/** Used when no `?e=` is given. */
export const DEFAULT_EXPERIENCE_ID = 'demo';

const HUNTS = [
  {
    id: 'demo',
    name: 'Treasure Demo Hunt',

    // MindAR tuning, passed straight through to the `mindar-image` component.
    // filterMinCF/filterBeta trade jitter against lag; the tolerances decide how
    // many frames a target may be missed or must be held before it counts.
    tracking: {
      filterMinCF: 0.0001,
      filterBeta: 0.001,
      missTolerance: 5,
      warmupTolerance: 5,
      maxTrack: 1,
    },

    clues: [
      {
        targetIndex: 0,
        id: 'chest',
        title: 'The Sunken Chest',
        subtitle: 'Station 1 of 3',
        body: 'Barnacles, brass hinges, and a lock that has not turned in ninety years. The next station is where the water used to reach.',
        accent: '#b3421c',
        cta: {
          label: 'Log this find',
          href: '/markers',
        },
        overlay: {
          type: 'card',
          width: 1,
          height: 0.75,
          color: '#14110d',
          opacity: 0.88,
        },
      },
      {
        targetIndex: 1,
        id: 'compass',
        title: 'Brass Compass',
        subtitle: 'Station 2 of 3',
        body: 'The needle turns and keeps turning. Whatever it is looking for, it has not found it either.',
        accent: '#1f6f5c',
        cta: {
          label: 'Log this find',
          href: '/markers',
        },
        overlay: {
          type: 'primitives',
          nodes: [
            {
              tag: 'a-cylinder',
              attrs: {
                radius: '0.3',
                height: '0.02',
                rotation: '90 0 0',
                position: '0 0 0.02',
                color: '#d4a637',
                metalness: '0.7',
                roughness: '0.35',
              },
            },
            {
              tag: 'a-ring',
              attrs: {
                'radius-inner': '0.31',
                'radius-outer': '0.36',
                position: '0 0 0.03',
                color: '#1f6f5c',
              },
            },
            {
              tag: 'a-entity',
              attrs: {
                position: '0 0 0.05',
                animation: 'property: rotation; to: 0 0 -360; loop: true; dur: 7000; easing: linear',
              },
              children: [
                {
                  tag: 'a-cone',
                  attrs: {
                    height: '0.34',
                    'radius-bottom': '0.05',
                    'radius-top': '0',
                    position: '0 0.17 0',
                    color: '#b3421c',
                  },
                },
                {
                  tag: 'a-cone',
                  attrs: {
                    height: '0.34',
                    'radius-bottom': '0.05',
                    'radius-top': '0',
                    rotation: '0 0 180',
                    position: '0 -0.17 0',
                    color: '#f4efe4',
                  },
                },
              ],
            },
            {
              tag: 'a-text',
              attrs: {
                value: 'N',
                align: 'center',
                width: '1.4',
                color: '#f4efe4',
                position: '0 0.44 0.03',
              },
            },
          ],
        },
      },
      {
        targetIndex: 2,
        id: 'lantern',
        title: 'Keeper\'s Lantern',
        subtitle: 'Station 3 of 3',
        body: 'Still warm, wick trimmed, glass clean. Someone was here minutes ago and left in a hurry.',
        accent: '#7a3ea8',
        cta: {
          label: 'Finish the hunt',
          href: '/admin',
        },
        overlay: {
          type: 'model',
          src: '/models/lantern.glb',
          position: '0 -0.3 0.02',
          rotation: '0 0 0',
          scale: '0.45 0.45 0.45',
          animation: 'property: rotation; to: 0 360 0; loop: true; dur: 12000; easing: linear',
        },
      },
    ],
  },
];

const byId = new Map(HUNTS.map((hunt) => [hunt.id, hunt]));

/**
 * One hunt in the shape the AR layer consumes, or null when the id is unknown.
 *
 * Synchronous on purpose: this is the step that used to be a network fetch, and
 * removing the await is most of the point of hard-coding it.
 */
export function getExperience(id) {
  const hunt = byId.get(id);
  if (!hunt) return null;

  return {
    id: hunt.id,
    name: hunt.name,
    targetFile: `${hunt.id}.mind`,
    tracking: hunt.tracking ?? {},
    // The tracker's name for the same objects. See the module comment.
    markers: hunt.clues,
    targetUrl: `${TARGET_BASE}/${hunt.id}.mind`,
  };
}

/** Summary rows for the operator pages. */
export function listExperiences() {
  return HUNTS.map((hunt) => ({
    id: hunt.id,
    name: hunt.name,
    markerCount: hunt.clues.length,
    targetFile: `${hunt.id}.mind`,
  }));
}

/**
 * True when the compiled bundle is actually deployed.
 *
 * Compiled targets are git-ignored — they are large and reproducible from
 * `/studio` — so a fresh clone genuinely has none, and the check is what turns
 * that into a sentence a person can act on instead of a MindAR failure after
 * the camera is already open.
 */
export function targetExists(url) {
  return fetch(url, { method: 'HEAD' }).then(
    (res) => res.ok && !isSpaFallback(res),
    () => false,
  );
}

/**
 * `res.ok` is not enough, because a missing target does not 404.
 *
 * Both the dev server and Pages route unmatched paths to the SPA fallback
 * (`/* /index.html 200` in public/_redirects), so a HEAD for a target that was
 * never compiled comes back 200 with the app's own HTML behind it. Taken at
 * face value that sends MindAR off to parse index.html as a feature bundle and
 * fail somewhere deep inside, with the camera already open — exactly the
 * failure this check exists to pre-empt.
 *
 * A real target is served as a binary; the fallback is unambiguously HTML, so
 * the content type is the thing that actually distinguishes them.
 */
function isSpaFallback(res) {
  return (res.headers.get('content-type') ?? '').includes('text/html');
}
