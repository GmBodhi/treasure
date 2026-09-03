import { useEffect, useState } from 'react';
import { LEVEL_COUNT, TRACKING, targetExists } from '../lib/hunt.js';

/**
 * Turn one level into a scene the AR layer can run, once its target is known to
 * be deployed.
 *
 * A team only ever scans for the level they are on, so this builds a scene
 * holding exactly one image target. That is the whole anti-cheat story for
 * scanning: the other nineteen markers are not in the bundle, not in memory, and
 * cannot match — walking up to a later station and pointing a phone at it does
 * nothing at all.
 *
 * The HEAD check stays on the critical path for the reason it always has:
 * without it, a station whose target was never compiled surfaces as a generic
 * MindAR failure *after* the camera is open, which is both alarming and
 * unactionable. Here it is also a live rehearsal check — an organiser who
 * forgot to compile one of twenty stations finds out by name.
 */
export function useStation(level) {
  const [state, setState] = useState({ status: 'loading', scene: null, error: null });

  useEffect(() => {
    if (!level) return undefined;
    let cancelled = false;

    (async () => {
      const ok = await targetExists(level.station.targetUrl);
      if (cancelled) return;

      if (!ok) {
        setState({
          status: 'error',
          scene: null,
          error: {
            title: 'Station not ready',
            body: `Level ${level.n} (${level.station.id}) has no compiled target yet. Compile it in /studio and save it to apps/web/public/targets/${level.station.id}.mind.`,
          },
        });
        return;
      }

      setState({
        status: 'ready',
        error: null,
        scene: {
          id: level.station.id,
          name: level.title,
          targetUrl: level.station.targetUrl,
          tracking: TRACKING,
          // Single-target bundle, so the index is always zero.
          markers: [
            {
              id: level.station.id,
              targetIndex: 0,
              title: level.title,
              subtitle: `Level ${level.n} unlocked`,
              label: `${level.n} of ${LEVEL_COUNT}`,
              body: level.story,
              cta: { label: 'Continue', href: '/' },
              overlay: level.station.overlay ?? { type: 'card' },
            },
          ],
        },
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [level]);

  return state;
}
