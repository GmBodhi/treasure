import { useEffect } from 'react';

/**
 * Keep the screen awake while the camera is scanning.
 *
 * The failure this prevents is specific and near-certain over a two-hour event:
 * a team holds a phone up at a marker, says nothing, touches nothing, and the
 * display dims and locks after thirty seconds. The tracker dies mid-acquisition
 * and the team concludes the app is broken — while doing exactly the right
 * thing.
 *
 * The lock is dropped by the browser whenever the page is hidden and is not
 * restored on its own, so returning to the tab has to ask again. That is the
 * whole reason for the visibility listener rather than a single request.
 *
 * A refusal is swallowed. Safari below 16.4 has no Wake Lock API at all, and
 * every browser refuses when the battery is critical — neither is something to
 * put in front of somebody standing in a corridor, and the scan still works,
 * just with the usual screen timeout.
 */
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return undefined;

    let sentinel = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.hidden) return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
      } catch {
        // No API, or the browser declined. Not actionable by the player.
      }
    };

    const onVisible = () => {
      if (!document.hidden) acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      sentinel?.release().catch(() => {});
    };
  }, [active]);
}
