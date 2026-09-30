import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Khi chạy `npm run dev`, frontend gọi API bằng đường dẫn tương đối (/api, /auth, ...)
// nên cần proxy sang Cloudflare Worker. Mặc định trỏ về production; muốn test Worker
// chạy local (`npx wrangler dev --port 8787`) thì:
//   VITE_DEV_API_TARGET=http://127.0.0.1:8787 npm run dev
const API_TARGET = process.env.VITE_DEV_API_TARGET || 'https://thelac.dpdns.org';
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
}

// Lịch bóng đá: gọi cùng origin để tránh CORS/CSP chặn TheSportsDB + ESPN.
proxy['/tsdb'] = {
  target: 'https://www.thesportsdb.com',
  changeOrigin: true,
  secure: false,
  rewrite: (p) => p.replace(/^\/tsdb/, '/api/v1/json/3'),
};
proxy['/espn'] = {
  target: 'https://site.api.espn.com',
  changeOrigin: true,
  secure: false,
  rewrite: (p) => p.replace(/^\/espn/, '/apis/site/v2'),
};

export default defineConfig({
  plugins: [react()],
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
    chunkSizeWarningLimit: 2000,
  }
});
