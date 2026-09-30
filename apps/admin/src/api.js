/**
 * playZ admin — API client and shared tokens.
 *
 * Kept intentionally small for now. Once the shared workspace package exists
 * (`packages/shared`), the token set moves there so the consumer app and the
 * admin cannot drift apart visually.
 */

const ENV_BASE = (import.meta.env.VITE_API_BASE || '').trim();

function detectBase() {
  if (ENV_BASE) return ENV_BASE.replace(/\/+$/, '');
  try {
    const override = localStorage.getItem('chrtv_api_base');
    if (override && override.trim()) return override.trim().replace(/\/+$/, '');
  } catch { /* storage unavailable */ }
  // Same origin by default. The admin is its own Worker (wrangler.admin.toml),
  // so "same origin" only holds when the API is on the same hostname — set
  // VITE_API_BASE to an absolute URL when it is not.
  return '';
}

export const API_BASE = detectBase();

/**
 * Public origin of the consumer app. The admin links to it for sign-in and
 * from the header, so it is a build variable rather than a literal: the same
 * admin build can point at production, at a staging consumer, or at a workers.dev
 * subdomain without an edit to source. Falls back to the same host the admin
 * itself is served from, which is correct for any single-hostname setup.
 */
export const WEB_APP_URL = (
  (import.meta.env.VITE_WEB_APP_URL || '').trim() ||
  (typeof window !== 'undefined' && window.location ? window.location.origin : '')
).replace(/\/+$/, '');

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

export function authHeaders(extra = {}) {
  const token = (() => {
    try { return localStorage.getItem('chrtv_token') || ''; } catch { return ''; }
  })();
  return token ? { Authorization: `Bearer ${token}`, ...extra } : { ...extra };
}

/** JSON request helper with credentials and an explicit error surface. */
export async function api(path, { method = 'GET', body, headers } = {}) {
  const res = await fetch(apiUrl(path), {
    method,
    headers: authHeaders({
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    }),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = data?.code;
    throw err;
  }
  return data;
}

export const color = {
  bg: '#08080A',
  bgElevated: '#101014',
  card: '#16161C',
  cardHover: '#1E1E26',
  line: '#24242C',
  lineStrong: '#33333E',
  text: '#F5F5F7',
  textMuted: '#8A8A99',
  textFaint: '#55555F',
  blue: '#2F6BFF',
  blueSoft: '#6E9BFF',
  orange: '#FF6B2C',
  yellow: '#FFC53D',
  red: '#FF3B47',
  green: '#22C55E',
};

export const radius = { xs: 4, sm: 8, md: 12, lg: 16, pill: 999 };
