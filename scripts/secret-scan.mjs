#!/usr/bin/env node
/**
 * playZ — secret scanner
 * ============================================================================
 * Guards against the exact failure that put CHRTV Play on this path: a real
 * credential committed to a public repository, then duplicated into a template
 * and hardcoded into the Worker.
 *
 *   npm run secrets:check
 *
 * Exits 1 on any finding, so it can gate CI. Deliberately dependency-free.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Known-leaked values. If any reappears, the build fails.
const KNOWN_LEAKS = [
  { value: 'c02e885e3955667731c6267bd30fa92d', what: 'CHRTV TMDB API key' },
  { value: 'Ken1402@', what: 'CHRTV Stream-Engine admin token' },
];

// Patterns that look like credentials regardless of provenance.
const PATTERNS = [
  { re: /\bsk-[A-Za-z0-9]{20,}\b/, what: 'OpenAI-style secret key' },
  { re: /\bAKIA[0-9A-Z]{16}\b/, what: 'AWS access key id' },
  { re: /\bghp_[A-Za-z0-9]{36}\b/, what: 'GitHub personal access token' },
  { re: /\bgithub_pat_[A-Za-z0-9_]{60,}\b/, what: 'GitHub fine-grained token' },
  { re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, what: 'Slack token' },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, what: 'private key block' },
  { re: /\bAIza[0-9A-Za-z_-]{35}\b/, what: 'Google API key' },
];

// A literal assignment of a long random-looking value to a secret-ish name.
const ASSIGN = /(secret|token|password|pepper|api[_-]?key)\s*[:=]\s*["'`]([A-Za-z0-9+/_\-]{24,})["'`]/i;

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.wrangler', '.vite',
  'android', 'coverage', '.cache', 'out',
]);
const SKIP_FILES = new Set(['package-lock.json', 'secret-scan.mjs']);
const TEXT = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.md', '.txt',
  '.html', '.css', '.yml', '.yaml', '.toml', '.sql', '.sh', '.env', '.example',
  '.svg', '.gradle', '.xml', '.properties',
]);

const findings = [];
const scanned = { files: 0 };

function scanFile(abs) {
  const rel = relative(ROOT, abs);
  const base = rel.split('/').pop();
  if (SKIP_FILES.has(base)) return;
  if (extname(base) && !TEXT.has(extname(base)) && !base.startsWith('.env')) return;
  // .env.example may legitimately contain placeholders and long comments.
  const isTemplate = base === '.env.example';

  let text;
  try { text = readFileSync(abs, 'utf8'); } catch { return; }
  scanned.files++;

  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const where = `${rel}:${i + 1}`;

    for (const leak of KNOWN_LEAKS) {
      if (line.includes(leak.value)) {
        findings.push({ where, what: `KNOWN LEAK — ${leak.what}`, line: line.trim().slice(0, 120) });
      }
    }

    for (const p of PATTERNS) {
      if (p.re.test(line)) {
        findings.push({ where, what: p.what, line: line.trim().slice(0, 120) });
      }
    }

    if (!isTemplate && ASSIGN.test(line)) {
      const m = line.match(ASSIGN);
      // Ignore obvious non-secrets: references, env lookups, placeholders.
      const val = m[2];
      const looksLikeCode = /process\.env|import\.meta|env\.[A-Z_]+|^[a-z]+$/.test(val);
      const looksPlaceholder = /^(x{3,}|0{3,}|your|change|example|placeholder|redacted)/i.test(val);
      if (!looksLikeCode && !looksPlaceholder) {
        findings.push({
          where, what: `hardcoded ${m[1]}`,
          line: line.trim().slice(0, 120),
        });
      }
    }
  });
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const abs = join(dir, entry);
    let st;
    try { st = statSync(abs); } catch { continue; }
    if (st.isDirectory()) walk(abs);
    else if (st.isFile() && st.size < 2_000_000) scanFile(abs);
  }
}

walk(ROOT);

console.log(`playZ secret scan — ${scanned.files} files inspected\n`);

if (findings.length === 0) {
  console.log('✅ No findings. No known-leaked values, no hardcoded secrets, no private keys.');
  process.exit(0);
}

console.log(`❌ ${findings.length} finding(s):\n`);
for (const f of findings) {
  console.log(`  ${f.where}`);
  console.log(`      ${f.what}`);
  console.log(`      > ${f.line}\n`);
}
console.log('A missing secret must fail loudly at runtime, never fall back to a committed default.');
process.exit(1);
