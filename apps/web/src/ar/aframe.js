/**
 * Loads A-Frame and MindAR's A-Frame integration, in that order, exactly once.
 *
 * The order is not stylistic: `mindar-image-aframe.prod.js` is an IIFE that
 * calls `AFRAME.registerSystem` at evaluation time, so `window.AFRAME` has to
 * exist before it runs. Static `import` statements would let the bundler hoist
 * them into whatever order it likes, hence the explicit sequential awaits.
 *
 * Both are heavy (~1.5 MB together) and only the scan page and the tracking
 * test need them, so this is deliberately a dynamic import rather than a
 * top-level one — the admin and marker pages never pay for it.
 */
let loading = null;

export function loadAframe() {
  if (loading) return loading;
  loading = (async () => {
    await import('aframe');
    await import('mind-ar/dist/mindar-image-aframe.prod.js');
    return window.AFRAME;
  })().catch((err) => {
    // Let a later attempt retry instead of caching the failure forever.
    loading = null;
    throw err;
  });
  return loading;
}

/** The MindAR A-Frame system name, used to reach start()/stop() on the scene. */
export const MINDAR_SYSTEM = 'mindar-image-system';
