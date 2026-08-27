const SESSION_KEY = 'treasure-ar.session';

/**
 * Where the API lives.
 *
 * Empty in development: Vite proxies `/api` to the Worker, so requests stay
 * same-origin and CORS never enters into it. In production the Worker is a
 * separate deployment, and `VITE_API_BASE` points at it.
 */
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

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
  // preflight — a wasted round-trip on the critical path before the camera
  // can open, on exactly the mobile connections that can least afford one.
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
  listExperiences: () => request('/api/experiences'),

  getExperience: (id) => request(`/api/experiences/${encodeURIComponent(id)}`),

  /**
   * True when the experience's compiled .mind is actually stored. `targetUrl`
   * arrives absolute from the API, so it is used as-is rather than re-based.
   */
  hasTarget: (targetUrl) =>
    fetch(targetUrl, { method: 'HEAD' }).then((r) => r.ok, () => false),

  /**
   * Report a marker hit. Uses sendBeacon when available so the report survives
   * the user backgrounding the tab right after a scan.
   */
  reportScan(payload) {
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

  /** Attach a compiled .mind bundle to an experience. */
  async uploadTarget(experienceId, file, filename = `${experienceId}.mind`) {
    const body = new FormData();
    body.append('target', file, filename);
    const res = await fetch(url(`/api/experiences/${encodeURIComponent(experienceId)}/target`), {
      method: 'POST',
      body,
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error ?? `${res.status} ${res.statusText}`);
    return payload;
  },
};
