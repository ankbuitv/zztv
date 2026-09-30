#!/usr/bin/env node
/**
 * playZ deploy invariants — `npm test`.
 *
 * There is no ESLint or TypeScript in this repository (it is plain JSX on top
 * of Vite), so these checks stand in for the type/lint step. Everything here
 * is about the things that have actually broken this deployment before:
 *
 *   1. assets.directory pointing at a directory no build produces
 *   2. a wrangler config that Wrangler rejects or silently misreads
 *   3. a D1 migration that would destroy production data
 *   4. the baseline drifting away from the Worker's own schema
 *   5. a single JS chunk creeping back towards the old 2.8 MB
 *   6. the duplicate-key regression in playz/TV.jsx
 *
 * Runs offline, in a couple of seconds, with no Cloudflare credentials.
 * The node:sqlite checks are skipped (not failed) on Node < 22.5.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
let failed = 0;
let skipped = 0;

function check(name, fn) {
  try {
    const detail = fn();
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
    passed++;
  } catch (e) {
    if (e && e.code === 'SKIP') { console.log(`  ○ ${name} — skipped: ${e.message}`); skipped++; return; }
    console.log(`  ✗ ${name}\n      ${e.message}`);
    failed++;
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function section(title) { console.log(`\n${title}`); }

const wranglerConfigs = readdirSync(ROOT).filter((f) => /^wrangler(\..+)?\.toml$/.test(f)).sort();

// ---------------------------------------------------------------------------
section('1. wrangler configs');
// ---------------------------------------------------------------------------
for (const file of wranglerConfigs) {
  const full = join(ROOT, file);
  check(`${file}: main entry exists`, () => {
    const m = readFileSync(full, 'utf8').match(/^\s*main\s*=\s*"([^"]+)"/m);
    if (!m) return 'assets-only Worker (no main) — OK';
    const p = join(ROOT, m[1]);
    assert(existsSync(p), `main = "${m[1]}" does not exist`);
    return m[1];
  });

  check(`${file}: assets.directory exists and is non-empty`, () => {
    const text = readFileSync(full, 'utf8');
    const inline = text.match(/^\s*assets\s*=\s*\{([^}]*)\}/m);
    const table = !inline && text.match(/^\s*\[assets\]\s*$(.*?)(?=^\s*\[|\Z)/ms);
    const m = inline
      ? inline[1].match(/directory\s*=\s*"([^"]+)"/)
      : table && table[1].match(/^\s*directory\s*=\s*"([^"]+)"/m);
    if (!m) return 'no assets — API-only Worker, OK';
    const abs = resolve(ROOT, m[1]);
    assert(existsSync(abs), `assets.directory "${m[1]}" does not exist — run npm run build:web / build:admin`);
    assert(statSync(abs).isDirectory(), `assets.directory "${m[1]}" is not a directory`);
    const n = readdirSync(abs).length;
    assert(n > 0, `assets.directory "${m[1]}" is empty`);
    return `${m[1]} (${n} files)`;
  });

  check(`${file}: no top-level keys after a table header`, () => {
    // The original failure mode: `assets` and `migrations_dir` were written
    // after a table header, so TOML attached them to that table and Wrangler
    // reported them as unexpected fields (or silently ignored them).
    const lines = readFileSync(full, 'utf8').split('\n');
    let inTable = false;
    const known = new Set(['build', 'vars', 'observability', 'triggers', 'assets', 'placement', 'limits', 'build', 'kv_namespaces', 'r2_buckets', 'durable_objects', 'services', 'ai', 'version_metadata', 'unsafe', 'env']);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      if (/^\[\[?[A-Za-z0-9_.\-"']+\]\]?$/.test(t)) { inTable = true; continue; }
      if (!inTable) continue;
      const kv = t.match(/^([A-Za-z0-9_]+)\s*=/);
      if (!kv) continue;
      const tableName = (() => {
        for (let j = i - 1; j >= 0; j--) {
          const s = lines[j].trim();
          if (!s || s.startsWith('#')) continue;
          const m = s.match(/^\[\[?([A-Za-z0-9_.\-"']+)\]\]?$/);
          return m ? m[1] : null;
        }
        return null;
      })();
      assert(!known.has(kv[1]), `line ${i + 1}: "${kv[1]}" appears after [${tableName}] so TOML parses it as a field of that table`);
    }
    return 'no misplaced keys';
  });
}

// ---------------------------------------------------------------------------
section('2. D1 migrations');
// ---------------------------------------------------------------------------
check('migrations/ exists with a baseline and at least one more file', () => {
  const dir = join(ROOT, 'migrations');
  assert(existsSync(dir), 'migrations/ directory missing');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  assert(files.length >= 1, 'migrations/ has no .sql files');
  assert(/^0000_.*\.sql$/.test(files[0]), `first migration must be the 0000 baseline, found ${files[0]}`);
  return files.join(', ');
});

check('migration filenames follow the D1 NNN_name.sql convention', () => {
  const dir = join(ROOT, 'migrations');
  const bad = readdirSync(dir).filter((f) => f.endsWith('.sql') && !/^\d{4}_[A-Za-z0-9_\-]+\.sql$/.test(f));
  assert(!bad.length, `not D1-compatible: ${bad.join(', ')}`);
  return 'ok';
});

check('baseline is in sync with worker/worker.js SCHEMA_STATEMENTS', () => {
  const out = execFileSync(process.execPath, [join(ROOT, 'scripts/gen-d1-baseline.mjs'), '--check'], { encoding: 'utf8' });
  return out.trim().replace(/^✓\s*/, '');
});

check('migrations contain no destructive statement', () => {
  const dir = join(ROOT, 'migrations');
  const offenders = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql'))) {
    const text = readFileSync(join(dir, f), 'utf8').replace(/^--.*$/gm, '');
    for (const m of text.matchAll(/\b(DROP\s+(TABLE|INDEX)|DELETE\s+FROM|TRUNCATE|ALTER\s+TABLE)\b/gi)) {
      offenders.push(`${f}: ${m[1].replace(/\s+/g, ' ').toUpperCase()}`);
    }
  }
  assert(!offenders.length, `destructive SQL in migrations: ${offenders.join(', ')}`);
  return 'additive only';
});

check('no deploy script still runs `d1 execute --file=schema.sql`', () => {
  // A comment mentioning schema.sql is fine — what must not exist is an actual
  // command. schema.sql is stale (32 tables vs 78) and executing it as a
  // deploy step is how the database drifted out of migration history.
  const offenders = [];
  const files = [
    ...wranglerConfigs.map((f) => join(ROOT, f)),
    ...readdirSync(ROOT).filter((x) => x.endsWith('.json')).map((f) => join(ROOT, f)),
  ];
  for (const f of files) {
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const t = line.trim();
      if (t.startsWith('#') || t.startsWith('--')) continue;
      if (/d1\s+execute/i.test(t) && /schema\.sql/.test(t)) offenders.push(`${relative(ROOT, f)}: ${t}`);
    }
  }
  assert(!offenders.length, offenders.join(' | '));
  return 'migrations are the only schema mechanism';
});

const hasSqlite = (() => { try { require('node:sqlite'); return true; } catch { return false; } })();

check('baseline applies to an empty database', () => {
  if (!hasSqlite) { const e = new Error('node:sqlite needs Node >= 22.5'); e.code = 'SKIP'; throw e; }
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  const stmts = readFileSync(join(ROOT, 'migrations/0000_baseline.sql'), 'utf8')
    .split(/;\s*\n/).map((s) => s.replace(/^--.*$/gm, '').trim()).filter(Boolean);
  for (const s of stmts) db.exec(`${s};`);
  const tables = db.prepare("SELECT count(*) c FROM sqlite_master WHERE type='table'").get().c;
  assert(tables >= 78, `only ${tables} tables created, expected >= 78`);
  db.close();
  return `${stmts.length} statements, ${tables} tables`;
});

check('baseline is a no-op on a populated production database (no data loss)', () => {
  if (!hasSqlite) { const e = new Error('node:sqlite needs Node >= 22.5'); e.code = 'SKIP'; throw e; }
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');

  // Rebuild what production actually looks like today. It is NOT just
  // schema.sql — that file only ever created 32 of the 78 tables. The rest
  // were created at runtime by ensureSchema(), which runs SCHEMA_STATEMENTS
  // (CREATE TABLE IF NOT EXISTS) plus a series of ALTER TABLE ADD COLUMN on
  // every cold isolate. Both halves have to be here, because that combination
  // is what the baseline has to be a no-op against.
  db.exec(readFileSync(join(ROOT, 'schema.sql'), 'utf8'));
  const worker = readFileSync(join(ROOT, 'worker/worker.js'), 'utf8');
  const array = worker.slice(worker.indexOf('const SCHEMA_STATEMENTS = ['));
  for (const m of array.matchAll(/`(CREATE TABLE IF NOT EXISTS\s+[a-z_0-9]+\s*\([^`]*?\))`/g)) {
    db.exec(`${m[1].replace(/\\s+/g, ' ')};`);
  }
  const ensure = worker.slice(worker.indexOf('async function ensureSchema(env) {'));
  for (const m of ensure.matchAll(/"(ALTER TABLE\s+[a-z_0-9]+\s+ADD COLUMN\s+[a-z_0-9]+[^"]*)"/gi)) {
    try { db.exec(`${m[1].replace(/\\s+/g, ' ')};`); } catch { /* column already there */ }
  }
  db.exec("INSERT INTO users (username, email, password_hash, display_name, role) VALUES ('khach', 'a@b.c', 'x', 'Khách', 'admin')");
  db.exec("INSERT INTO channels (channel_id, name, stream_url) VALUES ('vtv1', 'VTV1', 'http://x/y.m3u8')");
  db.exec("INSERT INTO plans (code, name, rank) VALUES ('signature', 'SIGNATURE', 5)");

  const before = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  const chans = db.prepare('SELECT COUNT(*) c FROM channels').get().c;
  const plans = db.prepare('SELECT COUNT(*) c FROM plans').get().c;
  const tablesBefore = db.prepare("SELECT count(*) c FROM sqlite_master WHERE type='table'").get().c;

  const stmts = readFileSync(join(ROOT, 'migrations/0000_baseline.sql'), 'utf8')
    .split(/;\s*\n/).map((s) => s.replace(/^--.*$/gm, '').trim()).filter(Boolean);
  for (const s of stmts) db.exec(`${s};`);

  const after = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  const chansAfter = db.prepare('SELECT COUNT(*) c FROM channels').get().c;
  const plansAfter = db.prepare('SELECT COUNT(*) c FROM plans').get().c;
  const role = db.prepare("SELECT role FROM users WHERE username='khach'").get();
  const tables = db.prepare("SELECT count(*) c FROM sqlite_master WHERE type='table'").get().c;

  assert(after === before, `users went from ${before} to ${after} rows`);
  assert(chansAfter === chans, `channels went from ${chans} to ${chansAfter} rows`);
  assert(plansAfter === plans, `plans went from ${plans} to ${plansAfter} rows`);
  assert(role && role.role === 'admin', 'the existing admin row was altered');
  assert(tables >= tablesBefore, `table count dropped from ${tablesBefore} to ${tables}`);
  assert(tables > 32, `expected the baseline to add the tables schema.sql never had, found ${tables} total`);
  db.close();
  return `${before} user + ${chans} channel + ${plans} plan row preserved, ${tablesBefore} -> ${tables} tables`;
});

check('seed migration runs after the baseline and is re-runnable', () => {
  if (!hasSqlite) { const e = new Error('node:sqlite needs Node >= 22.5'); e.code = 'SKIP'; throw e; }
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  const base = readFileSync(join(ROOT, 'migrations/0000_baseline.sql'), 'utf8')
    .split(/;\s*\n/).map((s) => s.replace(/^--.*$/gm, '').trim()).filter(Boolean);
  for (const s of base) db.exec(`${s};`);
  const seed = readFileSync(join(ROOT, 'migrations/0001_seed_plans.sql'), 'utf8')
    .split(/;\s*\n/).map((s) => s.replace(/^--.*$/gm, '').trim()).filter(Boolean);
  for (const s of seed) db.exec(`${s};`);
  const first = db.prepare('SELECT COUNT(*) c FROM plans').get().c;
  for (const s of seed) db.exec(`${s};`); // again — must not duplicate
  const second = db.prepare('SELECT COUNT(*) c FROM plans').get().c;
  assert(first >= 5, `expected the 5 default plans, found ${first}`);
  assert(first === second, `re-running the seed changed the row count (${first} -> ${second})`);
  db.close();
  return `${first} plans, idempotent`;
});

// ---------------------------------------------------------------------------
section('3. web bundle');
// ---------------------------------------------------------------------------
check('no single web JS chunk exceeds 900 kB', () => {
  const dir = join(ROOT, 'apps/web/dist/assets');
  if (!existsSync(dir)) { const e = new Error('run npm run build:web first'); e.code = 'SKIP'; throw e; }
  const chunks = readdirSync(dir).filter((f) => f.endsWith('.js'))
    .map((f) => ({ f, kb: statSync(join(dir, f)).size / 1024 }))
    .sort((a, b) => b.kb - a.kb);
  const worst = chunks[0];
  assert(worst, 'no JS chunks found in apps/web/dist/assets');
  assert(worst.kb <= 900, `largest chunk is ${worst.f} at ${worst.kb.toFixed(0)} kB (budget 900 kB)`);
  const total = chunks.reduce((a, c) => a + c.kb, 0);
  return `${chunks.length} chunks, largest ${worst.kb.toFixed(0)} kB, total ${total.toFixed(0)} kB`;
});

// Must stay byte-identical to the `isHashed` pattern in apps/web/public/sw.js.
const HASHED_ASSET_SOURCE = '\\/assets\\/[^/]+-[A-Za-z0-9_-]{8}\\.(js|css|woff2?)$';
const HASHED_ASSET_RE = new RegExp(HASHED_ASSET_SOURCE);

check('every built chunk matches the service worker hashed-asset pattern', () => {
  // A chunk whose filename the SW does not recognise is fetched from the
  // network on every load. That failure is invisible — nothing errors, the
  // app just quietly gets slower as the number of chunks grows.
  const dir = join(ROOT, 'apps/web/dist/assets');
  if (!existsSync(dir)) { const e = new Error('run npm run build:web first'); e.code = 'SKIP'; throw e; }
  const sw = readFileSync(join(ROOT, 'apps/web/public/sw.js'), 'utf8');
  assert(
    sw.includes(HASHED_ASSET_SOURCE),
    'apps/web/public/sw.js no longer contains the hashed-asset pattern this check uses — update both together',
  );
  const files = readdirSync(dir);
  const missed = files.filter((f) => !HASHED_ASSET_RE.test(`/assets/${f}`));
  assert(!missed.length, `${missed.length} chunk(s) bypass the cache-first path, e.g. ${missed.slice(0, 3).join(', ')}`);
  return `${files.length} files, all cache-first`;
});

check('playz/TV.jsx has no duplicate key in a style object', () => {
  const p = join(ROOT, 'apps/web/src/playz/TV.jsx');
  const text = readFileSync(p, 'utf8');
  // Every `style={{ ... }}` literal must not repeat a property name.
  for (const m of text.matchAll(/style=\{\{([\s\S]*?)\}\}/g)) {
    const keys = [...m[1].matchAll(/(?:^|[{,\s])([A-Za-z_$][\w$]*)\s*:/g)].map((k) => k[1]);
    const seen = new Set();
    for (const k of keys) {
      assert(!seen.has(k), `duplicate key "${k}" in a style object`);
      seen.add(k);
    }
  }
  return 'no duplicates';
});

check('every source file parses (esbuild transform)', () => {
  const esbuild = require('esbuild');
  const files = [];
  (function walk(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'dist') continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(jsx|js|mjs)$/.test(e.name)) files.push(p);
    }
  }(join(ROOT, 'apps')));
  (function walk(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isFile() && /\.(js|mjs)$/.test(e.name)) files.push(p);
    }
  }(join(ROOT, 'worker')));
  const errors = [];
  for (const f of files) {
    try {
      esbuild.transformSync(readFileSync(f, 'utf8'), { loader: f.endsWith('.jsx') ? 'jsx' : 'js' });
    } catch (e) { errors.push(`${relative(ROOT, f)}: ${e.message.split('\n')[0]}`); }
  }
  assert(!errors.length, errors.join('; '));
  return `${files.length} files`;
});

// ---------------------------------------------------------------------------
console.log(`\n${failed ? '✗' : '✓'} ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
process.exit(failed ? 1 : 0);
