const SESSION_KEY = 'treasure-ar.session';

/**
 * Where the API lives.
 *
 * Empty in development: Vite proxies `/api` to the Worker, so requests stay
 * same-origin and CORS never enters into it. In production the Worker is a
 * separate deployment, and `VITE_API_BASE` points at it.
 */
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

/**
 * Scan analytics is the only thing left that needs a server, and it is
 * optional — the hunt itself is a static bundle plus a compiled target.
 *
 * A built app with no `VITE_API_BASE` has no API to talk to, so reporting is
 * switched off rather than left to fire at an origin that will 404. In dev the
 * proxy is always there, so it stays on.
 */
export const ANALYTICS_ENABLED = Boolean(API_BASE) || import.meta.env.DEV;

/**
 * Whether a Worker was actually pointed at, as opposed to merely being
 * reachable through the dev proxy if someone happens to be running one.
 *
 * The operator console uses this to decide whether to pull analytics on mount:
 * the hunt no longer needs an API, so `npm run dev:web` on its own is a normal
 * way to work, and firing a request at a proxy with nothing behind it would put
 * a 502 in everyone's console for a page that renders fine without it.
 */
export const API_CONFIGURED = Boolean(API_BASE);

const url = (path) => `${API_BASE}${path}`;

/** Stable per-tab id so the server can count unique visitors without cookies. */
export function sessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

async function request(path, options = {}) {
  // Only send content-type when there is a body. On a cross-origin GET the
  // header alone makes the request non-simple, so the browser inserts a CORS
  // preflight — a wasted round-trip for no benefit.
  const headers = options.body
    ? { 'content-type': 'application/json', ...options.headers }
    : { ...options.headers };

  const res = await fetch(url(path), { ...options, headers });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error ?? `${res.status} ${res.statusText}`);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  /**
   * Report a marker hit. Uses sendBeacon when available so the report survives
   * the user backgrounding the tab right after a scan.
   */
  reportScan(payload) {
    if (!ANALYTICS_ENABLED) return Promise.resolve(null);

    const body = JSON.stringify({ ...payload, sessionId: sessionId() });
    if (navigator.sendBeacon) {
      // text/plain, not application/json: a beacon with a non-simple content
      // type triggers a CORS preflight, and sendBeacon cannot perform one — the
      // report would be dropped without a word. The Worker parses the body as
      // JSON regardless of what the header claims.
      const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });
      const ok = navigator.sendBeacon(url('/api/scans'), blob);
      if (ok) return Promise.resolve(null);
    }
    return request('/api/scans', {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
      body,
      keepalive: true,
    }).catch((err) => {
      // Analytics must never break the experience.
      console.warn('scan report failed', err);
      return null;
    });
  },

  summary: (experienceId) =>
    request(`/api/scans/summary${experienceId ? `?experienceId=${encodeURIComponent(experienceId)}` : ''}`),
};
