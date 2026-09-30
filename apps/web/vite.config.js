import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Khi chạy `npm run dev`, frontend gọi API bằng đường dẫn tương đối (/api, /auth, ...)
// nên cần proxy sang Cloudflare Worker. Mặc định trỏ về production; muốn test Worker
// chạy local (`npx wrangler dev --port 8787`) thì:
//   VITE_DEV_API_TARGET=http://127.0.0.1:8787 npm run dev
//
// VITE_API_ORIGIN is the environment-configurable production origin, so a fork
// or a staging environment does not need this file edited. The literal is only
// the fallback for a shell with no environment at all.
const API_TARGET = process.env.VITE_DEV_API_TARGET
  || process.env.VITE_API_ORIGIN
  || 'https://thelac.dpdns.org';
const API_PREFIXES = ['/api', '/auth', '/user', '/admin', '/ws'];
// When the API target is a local host we are in fixture mode, so artwork is
// proxied too (see tools/dev-api.mjs). Production never hits this.
const FIXTURE_MODE = /^https?:\/\/(127\.0\.0\.1|localhost)/.test(API_TARGET);

const proxy = Object.fromEntries(
  API_PREFIXES.map((prefix) => [
    prefix,
    {
      target: API_TARGET,
      changeOrigin: true,
      secure: false,
      ws: prefix === '/ws',
    },
  ])
);
// Stream protection: AES-128 key (same origin in dev, license.thelac.dpdns.org in production)
proxy['/lic'] = {
  target: API_TARGET,
  changeOrigin: true,
  secure: false,
}
if (FIXTURE_MODE) {
  proxy['/img'] = { target: API_TARGET, changeOrigin: true, secure: false };
  // Vertical clips for Shorts, served from tools/fixture-media/. Only ever
  // reachable in fixture mode — production points at real CDN URLs.
  proxy['/media'] = { target: API_TARGET, changeOrigin: true, secure: false };
}

// Sports schedules: same-origin, because the browser cannot call TheSportsDB or
// ESPN directly (no CORS) and the Worker proxy only exists in production.
//
// In fixture mode both point at the local fixture instead of the real hosts —
// otherwise offline development is stuck behind a TCP timeout, and the sports
// page renders as a blank screen with no way to tell a layout bug from a
// network one. The fixture serves these exact paths.
proxy['/tsdb'] = FIXTURE_MODE
  ? { target: API_TARGET, changeOrigin: true }
  : {
    target: 'https://www.thesportsdb.com',
    changeOrigin: true,
    secure: false,
    rewrite: (p) => p.replace(/^\/tsdb/, '/api/v1/json/3'),
  };
proxy['/espn'] = FIXTURE_MODE
  ? { target: API_TARGET, changeOrigin: true }
  : {
    target: 'https://site.api.espn.com',
    changeOrigin: true,
    secure: false,
    rewrite: (p) => p.replace(/^\/espn/, '/apis/site/v2'),
  };

export default defineConfig({
  plugins: [react()],
  // One React, always. A workspace can easily end up with two copies: the
  // legacy TV-navigation dependency pins React 16, and if npm hoists that one to
  // the root then react-dom@18 loads it and the application renders nothing.
  // Deduping here means the bundler serves a single instance whatever the tree.
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    cors: true,
    allowedHosts: true,
    proxy,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    proxy,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,

    // A budget, not a mute button.
    //
    // This used to sit at 2000, which silenced a warning about a 2.86 MB entry
    // chunk while doing nothing about it. The entry chunk is now ~183 kB and
    // the largest single file is the shaka-player vendor chunk at ~775 kB, so
    // 900 is a ceiling comfortably above the real result and well below the
    // old one. `npm test` asserts the same number, so raising it here without
    // fixing a regression fails the suite rather than passing quietly.
    chunkSizeWarningLimit: 900,

    rollupOptions: {
      output: {
        // Split by what changes and what is needed when, not by file size.
        //
        //   react      — in the initial graph, but it changes only when the
        //                framework changes; a separate file means a UI change
        //                does not invalidate it in every visitor's cache.
        //   hls/shaka  — 47% of the old bundle and only needed once somebody
        //                presses play. They are reached exclusively through
        //                lazy() in App.jsx, so they are never on the first load.
        //   spatial-nav— the remote-control runtime, loaded with the shell.
        //   qr / xml   — QR login and EPG parsing, both on demand.
        //   i18n       — a 2,000-line dictionary that only changes when a
        //                translation does.
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            if (id.includes('/src/i18n/')) return 'vendor-i18n';
            return null;
          }
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react';
          if (id.includes('node_modules/@noriginmedia/')) return 'vendor-spatial-nav';
          if (id.includes('node_modules/hls.js/')) return 'vendor-hls';
          if (id.includes('node_modules/shaka-player/')) return 'vendor-shaka';
          if (id.includes('node_modules/jsqr/')) return 'vendor-jsqr';
          if (id.includes('node_modules/qrcode')) return 'vendor-qrcode';
          if (id.includes('node_modules/fast-xml-parser/')) return 'vendor-xml-parser';
          if (id.includes('node_modules/lodash')) return 'vendor-lodash';
          return null;
        },
      },
    },
  },
});
