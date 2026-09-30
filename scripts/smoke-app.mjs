#!/usr/bin/env node
/**
 * Optional runtime smoke test for the consumer app.
 *
 * The chunk split in apps/web/src/App.jsx is the one change in this repo that
 * cannot be validated by a build alone: `React.lazy` resolves at render time,
 * so a missing <Suspense> boundary or a bad import only shows up when the
 * component is actually mounted. There is no browser in CI, so this renders
 * the real App into jsdom and walks the routes and the overlays.
 *
 *   npm i --no-save jsdom && node scripts/smoke-app.mjs
 *
 * It is NOT part of `npm test` — it needs jsdom, which is not a dependency.
 * Exits 0 on success, 1 on any React error, thrown exception or empty render.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch {
  console.error('This check needs jsdom:  npm i --no-save jsdom');
  process.exit(2);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = path.join(ROOT, '.smoke-entry.tmp.jsx');
const BUNDLE = path.join(ROOT, '.smoke-bundle.tmp.cjs');

// --- DOM + browser globals the app touches on first render ------------------
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'https://thelac.dpdns.org/?tab=channels',
  pretendToBeVisual: true,
});
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
// Node 22 defines `navigator` as a getter-only global, so it cannot be
// assigned — it has to be redefined.
try {
  Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true, writable: true });
} catch { /* keep the built-in navigator */ }
for (const k of [
  'localStorage', 'sessionStorage', 'location', 'history', 'navigator',
  'requestAnimationFrame', 'cancelAnimationFrame', 'matchMedia', 'ResizeObserver',
  'IntersectionObserver', 'CustomEvent', 'Event', 'HTMLElement', 'Node', 'getComputedStyle',
  'URL', 'URLSearchParams', 'fetch', 'Headers', 'Request', 'Response', 'AbortController',
  'scrollTo', 'MutationObserver', 'CSS', 'DOMParser', 'XMLSerializer', 'Image', 'screen',
]) {
  if (window[k] !== undefined && globalThis[k] === undefined) {
    Object.defineProperty(globalThis, k, { value: window[k], configurable: true, writable: true });
  }
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
globalThis.matchMedia = window.matchMedia;
globalThis.ResizeObserver = globalThis.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
globalThis.IntersectionObserver = globalThis.IntersectionObserver || class { observe() {} unobserve() {} disconnect() {} };

// The app posts telemetry and fetches channels on mount. Answer everything
// with something structurally plausible so the first paint completes.
const emptyJson = (body) => Promise.resolve(new Response(JSON.stringify(body), {
  status: 200, headers: { 'Content-Type': 'application/json' },
}));
window.fetch = async (input) => {
  const url = String(typeof input === 'string' ? input : (input && input.url) || '');
  if (/\/api\/channels|\/api\/playlist/.test(url)) {
    return emptyJson({ channels: [], data: [], programs: [], programmes: [] });
  }
  if (/\/user\//.test(url)) return emptyJson({ user: null });
  if (/\/api\/status|\/status/.test(url)) return emptyJson({ ok: true, online: 0, total: 0 });
  return emptyJson({});
};

// --- Capture anything React or the app complains about ----------------------
const problems = [];
const realError = console.error;
const realWarn = console.warn;
const IGNORED = [
  // React tells us a state update or a suspended chunk landed outside act().
  // This harness renders the real app outside a test renderer, so those two
  // are expected and say nothing about correctness.
  /not wrapped in act/,
  /A suspended resource finished loading inside a test/,
  /ReactDOMTestUtils/,
  /unstable_flushSync/,
];
console.error = (...args) => {
  const msg = args.map((a) => (typeof a === 'string' ? a : '')).join(' ');
  if (IGNORED.some((re) => re.test(msg))) return;
  problems.push(`console.error: ${msg.split('\n')[0]}`);
};
console.warn = () => {};

// --- Bundle the real App, then mount it ------------------------------------
fs.writeFileSync(ENTRY, `
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '${path.join(ROOT, 'apps/web/src/App.jsx').replace(/\\/g, '/')}';
export function mount(el) {
  const root = ReactDOM.createRoot(el);
  root.render(React.createElement(React.StrictMode, null, React.createElement(App)));
  return root;
}
`);

try {
  // esbuild ships a native binary; it is executed directly, not through node.
  const esbuildBin = require.resolve('esbuild/bin/esbuild');
  execFileSync(esbuildBin, [
    ENTRY, '--bundle', '--platform=browser', '--format=cjs', '--loader:.jsx=jsx',
    `--outfile=${BUNDLE}`, '--define:import.meta.env={}', '--log-level=error',
  ], { stdio: 'inherit' });

  process.stdout.write('bundled\n');
  const mod = await import(pathToFileURL(BUNDLE).href);
  const mount = mod.mount || (mod.default && mod.default.mount);
  process.stdout.write('mounting\n');
  mount(window.document.getElementById('root'));
  process.stdout.write('mounted\n');

  // Let the initial render, the channel fetch and the lazy chunks settle.
  const settle = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 12; i++) await settle(120);

  const root = window.document.getElementById('root');
  const html = root.innerHTML;
  if (!html || html.length < 200) {
    problems.push(`App rendered almost nothing (${html.length} chars) — a Suspense boundary or lazy import is wrong`);
  }

  // Walk the routes. Each one mounts a different lazy chunk, which is the
  // whole thing this test exists to exercise. The tab is read from
  // localStorage at mount, so each route is a fresh mount rather than a click
  // — that also guarantees the lazy chunk is loaded from scratch.
  const visited = [];
  for (const tab of ['movies', 'tv', 'sports', 'epg', 'community', 'shorts', 'plans', 'channels']) {
    await settle(120);
    let size = 0;
    try {
      window.localStorage.setItem('chrtv_tab', tab);
      window.history.replaceState(null, '', `/?tab=${tab}`);
      const host = window.document.createElement('div');
      window.document.body.appendChild(host);
      const r = mount(host);
      for (let i = 0; i < 8; i++) await settle(90);
      size = host.innerHTML.length;
      r.unmount();
      host.remove();
    } catch (e) {
      problems.push(`route "${tab}" threw: ${e.message}`);
    }
    visited.push(`${tab.padEnd(10)} ${String(size).padStart(6)} chars${size < 200 ? '   <-- EMPTY' : ''}`);
    if (size < 200) problems.push(`route "${tab}" rendered almost nothing (${size} chars)`);
  }

  // The CHRTV rollback surfaces. These are the components that used to be part
  // of the single 2.86 MB chunk and are now lazy; a broken import or a missing
  // Suspense boundary would leave the flag set and a blank page, which is
  // exactly the kind of regression nobody notices until they need the rollback.
  const legacyCases = [
    ['playz_home_legacy', 'channels'],
    ['playz_tv_legacy', 'tv'],
    ['playz_sports_legacy', 'sports'],
    ['playz_community_legacy', 'community'],
  ];
  const legacy = [];
  for (const [flag, tab] of legacyCases) {
    await settle(120);
    let size = 0;
    try {
      window.localStorage.setItem(flag, '1');
      window.localStorage.setItem('chrtv_tab', tab);
      window.history.replaceState(null, '', `/?tab=${tab}`);
      const host = window.document.createElement('div');
      window.document.body.appendChild(host);
      const r = mount(host);
      for (let i = 0; i < 8; i++) await settle(90);
      size = host.innerHTML.length;
      r.unmount();
      host.remove();
    } catch (e) {
      problems.push(`legacy "${flag}" threw: ${e.message}`);
    }
    window.localStorage.removeItem(flag);
    legacy.push(`${flag.padEnd(22)} ${String(size).padStart(6)} chars${size < 200 ? '   <-- EMPTY' : ''}`);
    if (size < 200) problems.push(`legacy "${flag}" rendered almost nothing (${size} chars)`);
  }

  console.error = realError;
  console.warn = realWarn;

  console.log('\nsmoke render — routes (each one is a fresh mount, so every lazy chunk is re-resolved)');
  for (const v of visited) console.log(`  ${v}`);
  console.log(`  ${'initial shell'.padEnd(10)} ${String(html.length).padStart(6)} chars\n`);
  console.log('smoke render — CHRTV rollback surfaces');
  for (const v of legacy) console.log(`  ${v}`);
  console.log('');

  if (problems.length) {
    console.error('✗ problems during render:');
    for (const p of [...new Set(problems)].slice(0, 25)) console.error(`   ${p}`);
    process.exitCode = 1;
  } else {
    console.log('✓ App mounts and navigates with no React errors');
  }
} finally {
  for (const f of [ENTRY, BUNDLE]) { try { fs.unlinkSync(f); } catch {} }
  try { dom.window.close(); } catch {}
  // The app installs intervals and jsdom's rAF loop keeps the event loop
  // alive forever; nothing after this point needs to run.
  process.exit(process.exitCode || 0);
}
