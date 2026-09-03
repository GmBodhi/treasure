/**
 * The tracking test's fixture experience.
 *
 * This is not the hunt — Operation Breadcrumb lives in `hunt.js`, where each
 * level points at a single-target bundle compiled from a real thing on campus.
 * What is left here is the three-marker demo that /dev/tracking-test drives
 * against generated artwork from `markers.js` and the compiled `demo.mind`.
 *
 * It stays because it is the only end-to-end check that the AR path still
 * works — camera, tracker, target matching and overlay rendering — without
 * needing a phone, a printed marker or a walk across campus. The real stations
 * cannot serve that purpose: their targets are photographs of fixtures that only
 * exist in one building.
 */

const TARGET_BASE = '/targets';

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

/** One experience in the shape ArScene consumes, or null when the id is unknown. */
export function getExperience(id) {
  const hunt = byId.get(id);
  if (!hunt) return null;

  return {
    id: hunt.id,
    name: hunt.name,
    targetFile: `${hunt.id}.mind`,
    tracking: hunt.tracking ?? {},
    markers: hunt.clues,
    targetUrl: `${TARGET_BASE}/${hunt.id}.mind`,
  };
}
