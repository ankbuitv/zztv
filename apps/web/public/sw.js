/* playZ — service worker
 * ============================================================================
 * Scope of responsibility is deliberately narrow: make the app open instantly
 * and survive a flaky connection. It is NOT a video cache and NOT a data cache.
 *
 * Hard rules, in order of importance:
 *
 *   1. NEVER cache /api, /auth, /user, /admin, /lic.
 *      These are authenticated per-user responses. Caching them would leak one
 *      account's data to the next person who opens the app on a shared device,
 *      and would show a signed-out user someone else's watch history.
 *
 *   2. NEVER cache media (.m3u8, .mpd, .ts, .m4s, .mp4, byte ranges).
 *      Segments are large, they are DRM/plan-gated, and the Cache API is not a
 *      media buffer. Caching them would also be a bandwidth disaster.
 *
 *   3. Never cache a response to a request carrying an Authorization header.
 *
 * What it does cache: hashed build assets (immutable by construction), the app
 * shell, and the brand icons.
 */
const VERSION = 'playz-v1';
const SHELL = `playz-shell-${VERSION}`;
const ASSETS = `playz-assets-${VERSION}`;

const SHELL_URLS = ['/', '/manifest.webmanifest', '/favicon.svg', '/pwa-192.png'];

// Never touch these paths, whatever the request method.
const PRIVATE_PREFIXES = ['/api', '/auth', '/user', '/admin', '/lic', '/ws', '/tsdb', '/espn'];

// Media extensions that must always go straight to the network.
const MEDIA_EXT = /\.(m3u8|m3u|mpd|ts|m4s|mp4|webm|mkv|mp3|m4a|aac|vtt|srt)(\?|$)/i;

function isPrivate(url) {
  return PRIVATE_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(p + '/') || url.pathname.startsWith(p));
}

function isMedia(url) {
  return MEDIA_EXT.test(url.pathname) || MEDIA_EXT.test(url.search);
}

// ---------------------------------------------------------------------------
// Install — precache the shell. Individual failures must not abort install, or
// one flaky icon would leave the app permanently un-installable.
// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await Promise.allSettled(
      SHELL_URLS.map((u) => cache.add(new Request(u, { cache: 'reload' })))
    );
    self.skipWaiting();
  })());
});

// ---------------------------------------------------------------------------
// Activate — drop caches from previous versions.
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))
    );
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.disable(); } catch { /* unsupported */ }
    }
    await self.clients.claim();
  })());
});

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only GET is cacheable. Everything else passes through untouched.
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch { return; }

  // Rule 1 + 2 + 3: private, media, or authorised → straight to the network.
  if (isPrivate(url) || isMedia(url) || request.headers.has('authorization')) return;

  // Cross-origin: let the browser handle it (TMDB images, fonts, upstream CDNs).
  // We do not want an opaque blob for every poster filling the cache.
  if (url.origin !== self.location.origin) return;

  // --- navigations: network first, fall back to the cached shell -------------
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(SHELL);
        cache.put('/', fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match('/');
        if (cached) return cached;
        return new Response(
          '<!doctype html><meta charset="utf-8"><title>playZ</title>' +
          '<body style="background:#08080A;color:#F5F5F7;font-family:system-ui;padding:40px">' +
          '<h1 style="font-size:19px">Không có kết nối</h1>' +
          '<p style="color:#8A8A99;font-size:13.5px;line-height:1.7;margin-top:10px">' +
          'playZ cần mạng để tải danh sách kênh. Kiểm tra kết nối rồi thử lại.</p></body>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
    })());
    return;
  }

  // --- hashed build assets: cache first, they are immutable ------------------
  //
  // The hash class includes `-` and `_`: Vite emits base64url-ish hashes, so
  // a chunk is routinely named `chevron-up-Bw2Ce-bT.js` and a class of
  // [A-Za-z0-9_] alone fails to match it. The old pattern silently sent every
  // such chunk down the "network every time" branch below, which is how it
  // stayed invisible for years — there used to be exactly one JS chunk. With
  // the app code-split, 87 of them would have paid that cost.
  const isHashed = /\/assets\/[^/]+-[A-Za-z0-9_-]{8}\.(js|css|woff2?)$/.test(url.pathname);

  if (isHashed) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const fresh = await fetch(request);
        if (fresh && fresh.ok && fresh.type === 'basic') {
          const cache = await caches.open(ASSETS);
          cache.put(request, fresh.clone());
        }
        return fresh;
      } catch {
        return new Response('', { status: 504 });
      }
    })());
    return;
  }

  // --- other same-origin static files: network, cache as a side effect -------
  event.respondWith((async () => {
    try {
      const fresh = await fetch(request);
      if (fresh && fresh.ok && fresh.type === 'basic') {
        const cache = await caches.open(ASSETS);
        cache.put(request, fresh.clone());
      }
      return fresh;
    } catch {
      const cached = await caches.match(request);
      return cached || new Response('', { status: 504 });
    }
  })());
});

// ---------------------------------------------------------------------------
// Web push — the payload is fetched by the page, so the notification is shown
// immediately and the data still flows through the normal authenticated API.
// ---------------------------------------------------------------------------
self.addEventListener('push', (event) => {
  let data = { title: 'playZ', body: 'Bạn có thông báo mới.' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch { /* non-JSON payload — use the default */ }

  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    tag: data.tag || 'playz',
    renotify: false,
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.includes(self.location.origin) && 'focus' in c) {
        c.navigate(target);
        return c.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
