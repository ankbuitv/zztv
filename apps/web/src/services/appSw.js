/**
 * playZ — service worker registration
 * ============================================================================
 * Registration is separate from `services/push.js`, which registers on demand
 * when a user opts into notifications. PWA installability requires the worker
 * to be registered on load, so it is registered here instead.
 *
 * Two deliberate constraints:
 *
 *   - Production only. A service worker in development serves stale bundles and
 *     makes hot reload lie about what the code does.
 *   - Failures are swallowed. A browser with service workers disabled, or a
 *     private-mode context that refuses registration, must not break the app.
 *
 * Note: changing the cache version requires a new service worker file. The
 * browser will pick it up on the next load; `skipWaiting` in sw.js means the
 * new worker takes over without requiring every tab to be closed.
 */

const SW_URL = '/sw.js';

export function registerServiceWorker() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  // Only ship the worker in a production build.
  if (!import.meta.env.PROD) return;
  // Never register inside the Capacitor shell: the native app is already
  // installed and a worker would intercept its local asset requests.
  if (window.Capacitor?.isNativePlatform?.()) return;

  const register = () => {
    navigator.serviceWorker.register(SW_URL, { scope: '/' })
      .then((reg) => {
        // Look for an updated worker when the tab regains focus, so users do
        // not run an old bundle for days.
        const check = () => { if (!document.hidden) reg.update().catch(() => {}); };
        document.addEventListener('visibilitychange', check);
      })
      .catch(() => { /* offline, disabled, or unsupported — the app still works */ });
  };

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

/** Removes any registered worker and its caches. Useful when diagnosing a stale UI. */
export async function unregisterServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('playz-')).map((k) => caches.delete(k)));
    }
  } catch { /* nothing to clean up */ }
}
