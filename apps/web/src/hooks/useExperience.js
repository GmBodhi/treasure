import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

/**
 * Fetch one experience manifest and confirm its compiled target exists.
 *
 * The HEAD check is here rather than left to MindAR on purpose: without it the
 * failure surfaces as a generic load error *after* the camera is already open,
 * which is both alarming and unactionable.
 */
export function useExperience(id) {
  const [state, setState] = useState({ status: 'loading', experience: null, error: null });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const experience = await api.getExperience(id);
        if (cancelled) return;

        if (!(await api.hasTarget(experience.targetUrl))) {
          if (cancelled) return;
          setState({
            status: 'error',
            experience,
            error: {
              title: 'No compiled target',
              body: `"${experience.name}" has no .mind file yet. Open /studio and press “Compile & upload”, then reload this page.`,
            },
          });
          return;
        }

        setState({ status: 'ready', experience, error: null });
      } catch (err) {
        if (cancelled) return;
        setState({
          status: 'error',
          experience: null,
          error: {
            title: 'Experience not found',
            body: `${err.message}. Check the ?e= parameter or seed the server.`,
          },
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return state;
}
