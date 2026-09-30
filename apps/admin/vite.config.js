import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * playZ admin — build configuration
 *
 * The admin ships as its own application on admin.thelac.dpdns.org rather than
 * as a hidden tab inside the consumer bundle. Consequences worth knowing:
 *
 *   - admin code is no longer downloaded by every consumer visitor
 *   - it can be deployed and rolled back independently
 *   - serving it from a separate hostname means a compromised consumer origin
 *     cannot reach the admin session
 *
 * Server-side authorisation is still the real control. This split is defence in
 * depth, not the authorisation mechanism.
 */
const API_TARGET = process.env.VITE_DEV_API_TARGET || 'http://127.0.0.1:8787';
const API_PREFIXES = ['/api', '/auth', '/user', '/admin', '/ws'];

const proxy = Object.fromEntries(
  API_PREFIXES.map((prefix) => [prefix, { target: API_TARGET, changeOrigin: true, secure: false, ws: prefix === '/ws' }])
);
if (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(API_TARGET)) {
  proxy['/img'] = { target: API_TARGET, changeOrigin: true, secure: false };
}

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
    port: 3100,
    allowedHosts: true,
    proxy,
  },
  preview: { host: '0.0.0.0', port: 3100, allowedHosts: true, proxy },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // The admin is a large data application; splitting is required rather than
    // nice to have, and is enforced from the start.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});
