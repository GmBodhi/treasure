import { request } from './client.js';

/**
 * The organiser's half of the API: the roster with pins, and putting a team
 * back where it belongs.
 *
 * The token is held in sessionStorage, not localStorage, and that is the whole
 * of the thinking: the console gets opened on whatever laptop is on the desk,
 * and a token that survives the tab closing is a token still on a borrowed
 * machine tomorrow. Retyping it is a few seconds, once.
 */
const TOKEN_KEY = 'breadcrumb.admin';

export function readAdminToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function writeAdminToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* Private mode: the console still works, it just asks again next tab. */
  }
}

const auth = () => ({ authorization: `Bearer ${readAdminToken()}` });

export const adminApi = {
  teams: () => request('/api/admin/teams', { headers: auth() }),

  /** Set a team's current level. 1 means "has found nothing yet". */
  unlock: (code, level) =>
    request(`/api/admin/teams/${encodeURIComponent(code)}/unlock`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({ level }),
    }),

  /** The matrix: every team's route, in play order. */
  routes: () => request('/api/admin/routes', { headers: auth() }),

  /**
   * Regenerate every route. `force` is required once anyone has started, and
   * the server refuses without it rather than quietly moving teams mid-run.
   */
  regenerateRoutes: (order, force = false) =>
    request('/api/admin/routes', {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({ order, force }),
    }),

  /** Whether the hunt is open, plus how many teams are joined and playing. */
  state: () => request('/api/admin/state', { headers: auth() }),

  /** Open the hunt. `at` may be in the future; omitted means now. */
  start: (at) =>
    request('/api/admin/start', {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify(at ? { at, force: true } : {}),
    }),

  /** Close it again. Leaves every team's progress alone. */
  stop: () => request('/api/admin/start', { method: 'DELETE', headers: auth() }),

  resetProgress: (code) =>
    request(`/api/admin/teams/${encodeURIComponent(code)}/progress`, {
      method: 'DELETE',
      headers: auth(),
    }),
};
