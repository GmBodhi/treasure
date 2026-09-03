import { useEffect, useState } from 'react';
import { getExperience, targetExists } from '../lib/clues.js';

/**
 * Resolve one hunt and confirm its compiled target is actually deployed.
 *
 * The clues themselves are hard-coded, so looking one up is synchronous and
 * cannot fail for network reasons. What remains asynchronous is the target: a
 * multi-megabyte binary that is git-ignored and compiled at `/studio`, so a
 * fresh clone genuinely has none.
 *
 * That HEAD stays on the critical path for the reason it always has — without
 * it a missing `.mind` surfaces as a generic MindAR load error *after* the
 * camera is already open, which is both alarming and unactionable.
 */
export function useExperience(id) {
  const [state, setState] = useState({ status: 'loading', experience: null, error: null });

  useEffect(() => {
    let cancelled = false;

    const experience = getExperience(id);
    if (!experience) {
      setState({
        status: 'error',
        experience: null,
        error: {
          title: 'No such hunt',
          body: `"${id}" is not defined in src/lib/clues.js. Check the ?e= parameter.`,
        },
      });
      return undefined;
    }

    (async () => {
      const ok = await targetExists(experience.targetUrl);
      if (cancelled) return;

      setState(
        ok
          ? { status: 'ready', experience, error: null }
          : {
              status: 'error',
              experience,
              error: {
                title: 'No compiled target',
                body: `"${experience.name}" has no ${experience.targetFile} yet. Open /studio, press “Compile & download”, and save the file to apps/web/public/targets/ — then reload this page.`,
              },
            },
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return state;
}
