#!/usr/bin/env node
/**
 * Generate migrations/0000_baseline.sql from the Worker's own schema.
 *
 * The Worker has always self-provisioned through ensureSchema(): a list of
 * CREATE TABLE IF NOT EXISTS statements, followed by a series of
 * `ALTER TABLE ... ADD COLUMN` migrations that are applied with a
 * try/catch because SQLite has no `ADD COLUMN IF NOT EXISTS`.
 *
 * D1 migrations are different: each file runs exactly once, and a file that
 * contains a non-idempotent statement will abort the whole apply. So the
 * baseline has to be the *result* of that history, not the history itself —
 * every column that the ALTERs added is folded into its CREATE TABLE, and
 * every index is created with IF NOT EXISTS. The result is a file that is a
 * no-op against an already-provisioned production database and a complete
 * schema against a fresh one.
 *
 *   node scripts/gen-d1-baseline.mjs          # writes migrations/0000_baseline.sql
 *   node scripts/gen-d1-baseline.mjs --check  # fail if the file is out of date
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKER = resolve(ROOT, 'worker/worker.js');
const OUT = resolve(ROOT, 'migrations/0000_baseline.sql');
const CHECK_ONLY = process.argv.includes('--check');

const src = readFileSync(WORKER, 'utf8');

// ---- 1. every CREATE TABLE inside SCHEMA_STATEMENTS ------------------------
const arrayBody = (() => {
  const start = src.indexOf('const SCHEMA_STATEMENTS = [');
  if (start < 0) throw new Error('SCHEMA_STATEMENTS not found in worker/worker.js');
  const end = src.indexOf('\n];', start);
  if (end < 0) throw new Error('end of SCHEMA_STATEMENTS not found');
  return src.slice(start, end);
})();

const creates = [...arrayBody.matchAll(/`(CREATE TABLE IF NOT EXISTS\s+[a-z_0-9]+\s*\([^`]*?\))`/g)].map((m) => m[1]);
if (creates.length < 20) throw new Error(`only parsed ${creates.length} CREATE TABLE statements — refusing to write a truncated baseline`);

// ---- 2. every ALTER TABLE ... ADD COLUMN applied by ensureSchema() -----------
// Only the ones inside ensureSchema(): an ALTER elsewhere would be a per-request
// tweak, not part of the schema history.
const ensureStart = src.indexOf('async function ensureSchema(env) {');
const ensureEnd = src.indexOf('\nasync function ', ensureStart + 10) > 0
  ? src.indexOf('\nasync function ', ensureStart + 10)
  : src.length;
const ensureSrc = src.slice(ensureStart, ensureEnd > ensureStart ? ensureEnd : src.length);

const addedColumns = new Map(); // table -> Set<"COLUMN definition">
for (const m of ensureSrc.matchAll(/"ALTER TABLE\s+([a-z_0-9]+)\s+ADD COLUMN\s+([a-z_0-9]+\s+[^"]*?)"/gi)) {
  const [, table, column] = m;
  if (!addedColumns.has(table)) addedColumns.set(table, new Set());
  addedColumns.get(table).add(column.trim().replace(/\s+/g, ' '));
}

// ---- 3. fold the added columns into their CREATE TABLE ---------------------
function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

const columnNames = (defs) => new Set(
  defs
    .map((d) => d.trim().split(/\s+/)[0])
    .filter((n) => n && !/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)$/i.test(n))
);

const lines = [];
for (const stmt of creates) {
  const head = stmt.match(/^CREATE TABLE IF NOT EXISTS\s+([a-z_0-9]+)\s*\(/i);
  if (!head) continue;
  const table = head[1];
  const defs = splitTopLevel(stmt.slice(stmt.indexOf('(') + 1, stmt.lastIndexOf(')')));
  const existing = columnNames(defs);
  for (const col of addedColumns.get(table) || []) {
    if (existing.has(col.split(/\s+/)[0])) continue;
    defs.push(col);
  }
  // A PRIMARY KEY added as part of a table constraint (e.g. "PRIMARY KEY(a,b)")
  // must stay last in the column list for readability only — SQLite accepts any
  // order, so we keep the original ordering and just append new columns before
  // the table-level constraints to stay conventional.
  const constraints = defs.filter((d) => /^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)\b/i.test(d));
  const cols = defs.filter((d) => !/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)\b/i.test(d));
  lines.push(`CREATE TABLE IF NOT EXISTS ${table} (\n  ${[...cols, ...constraints].join(',\n  ')}\n);`);
}

// ---- 4. every CREATE INDEX anywhere in the worker ---------------------------
const indexes = [...src.matchAll(/`?(CREATE INDEX IF NOT EXISTS\s+[a-z_0-9]+\s+ON\s+[a-z_0-9]+\s*\([^`]*?\))`?/gi)].map((m) => m[1]);
const seen = new Set();
const uniqueIndexes = indexes.filter((i) => {
  const key = i.replace(/\s+/g, ' ');
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

const header = [
  '-- ===========================================================================',
  '-- 0000_baseline - playZ / CHRTV production schema',
  '--',
  '-- GENERATED by scripts/gen-d1-baseline.mjs. Do not hand-edit; re-run the',
  '-- generator after changing SCHEMA_STATEMENTS in worker/worker.js.',
  '--',
  '-- Why this file exists',
  '-- --------------------',
  '-- Production was provisioned by hand (wrangler d1 execute --file=schema.sql)',
  '-- and then kept current by ensureSchema() running CREATE TABLE IF NOT EXISTS',
  '-- plus try/catch ALTER TABLE ADD COLUMN on every cold isolate. That works, but',
  '-- it leaves the database with no migration history: D1 own d1_migrations',
  '-- table is empty, so the first "wrangler d1 migrations apply" would try to run',
  '-- every statement again.',
  '--',
  '-- This baseline is written so that is safe:',
  '--',
  '--   * every table is created with IF NOT EXISTS  -> existing tables untouched',
  '--   * every column that ensureSchema() ever added by ALTER is folded into the',
  '--     CREATE TABLE, so a fresh database is born at the current shape',
  '--   * every index is created with IF NOT EXISTS',
  '--',
  '-- There is no DROP, no DELETE, no data rewrite anywhere in this file. Applying',
  '-- it to a populated production database changes nothing; applying it to an',
  '-- empty one produces exactly the schema the Worker expects.',
  '--',
  `-- Tables: ${lines.length} / indexes: ${uniqueIndexes.length}`,
  '-- ===========================================================================',
  '',
  '',
].join('\n');

const body = `${header}${lines.join(';\n\n')};\n\n${uniqueIndexes.join(';\n')};\n`;

if (CHECK_ONLY) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (current !== body) {
    console.error('✗ migrations/0000_baseline.sql is out of date — run: node scripts/gen-d1-baseline.mjs');
    process.exit(1);
  }
  console.log('✓ migrations/0000_baseline.sql matches worker/worker.js');
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, body);
  console.log(`✓ wrote ${OUT} (${lines.length} tables, ${uniqueIndexes.length} indexes)`);
}
