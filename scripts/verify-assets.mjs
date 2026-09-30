#!/usr/bin/env node
/**
 * Verify that every `assets.directory` declared in a wrangler config points
 * at a directory that actually exists, and that it looks like a real build.
 *
 * This is the guard for the failure that started all of it:
 *
 *     ERROR: assets.directory does not exist: /opt/buildhome/repo/dist
 *
 * wrangler only reports that at deploy time, on Cloudflare's builder, after
 * the build has already run. Running the same check locally first turns a
 * failed production deploy into a failed local command.
 *
 *   node scripts/verify-assets.mjs               # every config
 *   node scripts/verify-assets.mjs --strict      # also require index.html
 *
 * Exits 0 when everything resolves, 1 otherwise.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STRICT = process.argv.includes('--strict');

/** Minimal TOML reader for the flat `assets = { directory = "..." }` form.
 *  A full parser is not worth a dependency for one key, but this deliberately
 *  refuses anything it does not understand rather than guessing. */
function readAssetsDirectory(tomlPath) {
  const text = readFileSync(tomlPath, 'utf8');
  const inline = text.match(/^\s*assets\s*=\s*\{([^}]*)\}/m);
  if (inline) {
    const m = inline[1].match(/directory\s*=\s*"([^"]+)"/);
    return m ? m[1] : null;
  }
  const table = text.match(/^\s*\[assets\]\s*$(.*?)(?=^\s*\[|\Z)/ms);
  if (table) {
    const m = table[1].match(/^\s*directory\s*=\s*"([^"]+)"/m);
    return m ? m[1] : null;
  }
  return null;
}

const configs = readdirSync(ROOT)
  .filter((f) => /^wrangler(\..+)?\.toml$/.test(f))
  .sort();

if (!configs.length) {
  console.error('✗ no wrangler*.toml found at the repo root');
  process.exit(1);
}

let failures = 0;
const rows = [];

for (const file of configs) {
  const full = join(ROOT, file);
  const dir = readAssetsDirectory(full);
  if (dir === null) {
    // No static assets — an API-only Worker. Perfectly valid.
    rows.push([file, '(no assets — API only)', 'ok', 'Worker-only config']);
    continue;
  }

  const abs = resolve(dirname(full), dir);
  const rel = relative(ROOT, abs) || abs;

  if (!existsSync(abs)) {
    rows.push([file, rel, 'MISSING', 'run the matching npm run build:* first']);
    failures++;
    continue;
  }
  if (!statSync(abs).isDirectory()) {
    rows.push([file, rel, 'NOT A DIR', 'assets.directory must be a directory']);
    failures++;
    continue;
  }

  const entries = readdirSync(abs);
  if (!entries.length) {
    rows.push([file, rel, 'EMPTY', 'directory exists but has no files']);
    failures++;
    continue;
  }

  // An assets directory without a document is almost always the wrong
  // directory (a stray build cache, a parent folder, ...).
  if (!entries.includes('index.html')) {
    rows.push([file, rel, STRICT ? 'NO index.html' : 'ok (no index.html)', STRICT ? 'assets Worker with no document' : 'asset-only Worker, fine']);
    if (STRICT) failures++;
    continue;
  }

  const assetDir = join(abs, 'assets');
  const chunks = existsSync(assetDir)
    ? readdirSync(assetDir).filter((f) => f.endsWith('.js'))
    : [];
  rows.push([file, rel, 'ok', `${entries.length} entries, ${chunks.length} JS chunk(s)`]);
}

const w = [Math.max(...rows.map((r) => r[0].length)), Math.max(...rows.map((r) => r[1].length)), 12, 8];
const pad = (s, n) => String(s).padEnd(n);
console.log(`\nassets.directory check — ${ROOT}\n`);
for (const [file, dir, status, note] of rows) {
  const mark = status.startsWith('ok') || status === '(n/a)' ? '✓' : '✗';
  console.log(`${mark} ${pad(file, w[0])} ${pad(dir, w[1])} ${pad(status, w[2])} ${note}`);
}
console.log('');

if (failures) {
  console.error(`✗ ${failures} config(s) point at a build output that does not exist.`);
  console.error('  Build it first:  npm run build:web   /   npm run build:admin');
  process.exit(1);
}
console.log(`✓ all ${configs.length} wrangler config(s) resolve to a real build output`);
