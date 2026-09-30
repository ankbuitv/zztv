/**
 * playZ — brand asset builder
 * ============================================================================
 * Single source of truth for the playZ identity. Writes every SVG and every
 * raster export from the same geometry, so nothing can drift.
 *
 *   node scripts/build-brand.mjs
 *
 * Design notes
 * ------------
 * The mark is an original construction, not a traced or adapted logo:
 *   - an outer ring whose stroke is intentionally CUT in two places
 *   - inside it, two "Z" letterforms sharing a middle bar (a ZZ ligature)
 * Every stroke uses round terminals, which is what makes the mark read at 16px
 * as well as at 1024px.
 *
 * The wordmark "playZ" is drawn as PATHS — no font is referenced. This is
 * deliberate: the container ships only DejaVu, and a system-font wordmark would
 * both look generic and render differently on every machine. Drawing the
 * letterforms guarantees identical output everywhere and lets the Z in the
 * wordmark reuse the exact construction of the Z inside the mark.
 */
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BRAND = join(ROOT, 'apps/web/public/brand');
const PWA = join(ROOT, 'apps/web/public');

// ---------------------------------------------------------------------------
// Palette — monochrome identity. The logo is black/white first; colour belongs
// to the UI (blue action / orange CTA / yellow premium / red live).
// ---------------------------------------------------------------------------
const INK = '#0B0B0F';   // near-black, for light backgrounds
const PAPER = '#FFFFFF'; // white, for dark backgrounds
const BG = '#08080A';    // OLED black surface

// ---------------------------------------------------------------------------
// Mark geometry — 96×96 grid
// ---------------------------------------------------------------------------
const RING_R = 39;
const CIRC = 2 * Math.PI * RING_R;              // 245.04
// The dash pattern repeats twice around the circle: two arcs + two gaps must
// sum to the circumference exactly, so the cuts land 180° apart.
const GAPS = 2;
const RING_W = 6;
const ARC = 84;
const GAP = CIRC / GAPS - ARC;                  // 122.52 − 84 = 38.52
// Rotate so the two cuts sit on the diagonal (lower-left and upper-right),
// which reads as deliberate rather than as a broken render.
const CUT_ANGLE = 135;
const RING_ROT = CUT_ANGLE - (ARC + GAP / 2);   // 31.74°

// Two Z letterforms stacked, sharing the middle bar (the ZZ ligature).
// Read top-to-bottom: top bar → diagonal → shared bar → diagonal → bottom bar.
// Sized so the corners clear the ring's inner edge (see scripts note):
// max corner radius 31.1 + half stroke 3.0 = 34.1 < inner edge 36.0.
const ZZ_PATH = 'M25 27 H71 L25 48 H71 L25 69 H71';
const ZZ_W = 6;

// Small sizes need help: at 16–32px a faithful downscale turns the arcs and the
// Z into a blur. This bolder cut widens both strokes and pulls the Z inward so
// the shapes stay separated. Used for the .ico and any raster ≤32px.
const BOLD = { ringW: 8, zzW: 8, path: 'M27 29 H69 L27 48 H69 L27 67 H69' };

/**
 * @param {string} color  stroke colour
 * @param {number} scale  uniform scale applied to the 96-grid
 * @param {number} rot    rotation of the dash pattern (deg) — moves where the ring is cut
 */
function symbolBody(color, { scale = 1, rot = RING_ROT, bold = false, zzOnly = false } = {}) {
  const rw = bold ? BOLD.ringW : RING_W;
  const zw = bold ? BOLD.zzW : ZZ_W;
  const zPath = bold ? BOLD.path : ZZ_PATH;

  // At 16px a ring plus a ligature collapses into mud. Brand practice is to
  // ship a simplified cut at that size: the ZZ alone, scaled up to fill.
  if (zzOnly) {
    return `  <g transform="scale(${scale})">
    <g transform="translate(48 48) scale(1.55) translate(-48 -48)">
      <path d="${zPath}" fill="none" stroke="${color}" stroke-width="${zw}"
            stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </g>`;
  }

  return `  <g transform="scale(${scale})">
    <circle cx="48" cy="48" r="${RING_R}" fill="none" stroke="${color}" stroke-width="${rw}"
            stroke-linecap="round" stroke-dasharray="${ARC} ${GAP}" transform="rotate(${rot} 48 48)"/>
    <path d="${zPath}" fill="none" stroke="${color}" stroke-width="${zw}"
          stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;
}

function symbolSvg(color, opts = {}) {
  const size = 96 * (opts.scale ?? 1);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="playZ">
${symbolBody(color, opts)}
</svg>
`;
}

// ---------------------------------------------------------------------------
// Wordmark — "playZ" drawn as monoline geometric paths
//
// Baseline is y = 0 (SVG y grows downward).
//   x-height  = 20  (a, y, and the bowl of p)
//   ascender  = 30  (l, and the stem of p)
//   descender = 10  (p and y)
//   cap       = 27  (Z — deliberately taller than x-height, it is the signature)
// ---------------------------------------------------------------------------
const WM_W = 4.2;
const ADV = { p: 21, l: 4, a: 20, y: 20 }; // advance widths, before letterspacing
const TRACK = 8;

function wordmarkPaths() {
  const d = [];
  let x = 0;
  const at = (dx) => x + dx;

  // p — stem + geometric bowl
  d.push(`M${at(0)} -30 L${at(0)} 10`);                              // stem
  d.push(`M${at(11)} -20 A10 10 0 1 0 ${at(11)} 0 A10 10 0 1 0 ${at(11)} -20 Z`); // bowl
  x += ADV.p + TRACK;

  // l — bare stem
  d.push(`M${at(0)} -30 L${at(0)} 0`);
  x += ADV.l + TRACK;

  // a — single-storey geometric: bowl + right stem
  d.push(`M${at(10)} -20 A10 10 0 1 0 ${at(10)} 0 A10 10 0 1 0 ${at(10)} -20 Z`);
  d.push(`M${at(20)} -20 L${at(20)} 0`);
  x += ADV.a + TRACK;

  // y — two arms meeting at the junction, right arm continues as descender
  d.push(`M${at(0)} -20 L${at(10)} 0`);
  d.push(`M${at(20)} -20 L${at(10)} 0 L${at(3)} 10`);
  x += ADV.y + TRACK;

  // Z — same construction as the Z inside the mark, at cap height
  const zW = 26, zTop = -27;
  d.push(`M${at(0)} ${zTop} H${at(zW)} L${at(0)} 0 H${at(zW)}`);

  return { d, width: x + zW };
}

const WM = wordmarkPaths();

// Mark + wordmark lockup.
// The wordmark's x-height centre is aligned to the mark's centre so the pair
// looks optically balanced rather than box-aligned.
function logoSvg({ markColor, textColor, markScale = 0.75, bg = null }) {
  const M = 96 * markScale;                 // mark box, 72 at default
  const markCy = M / 2;
  const baseline = markCy + 10;             // x-height centre = baseline - 10
  const gapX = M + 20;
  const width = gapX + WM.width;
  const height = M;

  const bgRect = bg ? `  <rect width="${width}" height="${height}" fill="${bg}"/>\n` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="playZ">
${bgRect}  <g transform="translate(0 0)">
${symbolBody(markColor, { scale: markScale })}
  </g>
  <g transform="translate(${gapX} ${baseline})">
    <path d="${WM.d.join(' ')}" fill="none" stroke="${textColor}" stroke-width="${WM_W}"
          stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>
`;
}

// ---------------------------------------------------------------------------
// Favicon badge.
// A bare mark is invisible on one of the two browser tab themes: near-black
// vanishes on dark chrome, white vanishes on light chrome. A filled rounded
// badge keeps the mark legible on both, which is why most modern brands ship
// one. Radius is 22% of the box, matching the UI's card radius family.
// ---------------------------------------------------------------------------
function badgeSvg(markColor, bgColor, size = 96, opts = {}) {
  const r = size * 0.22;
  const pad = size * 0.12;
  const inner = size - pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="playZ">
  <rect width="${size}" height="${size}" rx="${r}" fill="${bgColor}"/>
  <g transform="translate(${pad} ${pad})">
${symbolBody(markColor, { ...opts, scale: inner / 96 })}
  </g>
</svg>
`;
}

// ---------------------------------------------------------------------------
// Maskable icon: content must sit inside the inner 80% safe zone, and the
// background must bleed to every edge (the OS applies its own mask shape).
// ---------------------------------------------------------------------------
function maskableSvg(color, bg, size = 512) {
  const inner = size * 0.62;
  const off = (size - inner) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="playZ">
  <rect width="${size}" height="${size}" fill="${bg}"/>
  <g transform="translate(${off} ${off})">
${symbolBody(color, { scale: inner / 96 })}
  </g>
</svg>
`;
}

// ---------------------------------------------------------------------------
// ICO container — PNG-embedded (supported by every modern browser + Windows
// Vista onward). Sizes are written largest-first as the format expects.
// ---------------------------------------------------------------------------
function buildIco(pngs) {
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);      // reserved
  header.writeUInt16LE(1, 2);      // type: 1 = icon
  header.writeUInt16LE(count, 4);

  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  pngs.forEach(({ size, buf }, i) => {
    const b = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, b + 0); // 0 means 256
    dir.writeUInt8(size >= 256 ? 0 : size, b + 1);
    dir.writeUInt8(0, b + 2);                      // palette
    dir.writeUInt8(0, b + 3);                      // reserved
    dir.writeUInt16LE(1, b + 4);                   // colour planes
    dir.writeUInt16LE(32, b + 6);                  // bits per pixel
    dir.writeUInt32LE(buf.length, b + 8);
    dir.writeUInt32LE(offset, b + 12);
    offset += buf.length;
  });

  return Buffer.concat([header, dir, ...pngs.map((p) => p.buf)]);
}

function render(svg, width) {
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: 'rgba(0,0,0,0)',
    font: { loadSystemFonts: false }, // no text in these SVGs — pure geometry
  });
  return Buffer.from(r.render().asPng());
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------
mkdirSync(BRAND, { recursive: true });
mkdirSync(PWA, { recursive: true });

const written = [];
const put = (path, data, note = '') => {
  writeFileSync(path, data);
  written.push(`${path.replace(ROOT + '/', '')}${note ? `  — ${note}` : ''}`);
};

// --- SVG sources -----------------------------------------------------------
put(join(BRAND, 'playz-symbol.svg'), symbolSvg('currentColor'), 'inherits colour');
put(join(BRAND, 'playz-symbol-dark.svg'), symbolSvg(PAPER), 'for dark surfaces');
put(join(BRAND, 'playz-symbol-light.svg'), symbolSvg(INK), 'for light surfaces');
put(join(BRAND, 'playz-logo.svg'), logoSvg({ markColor: 'currentColor', textColor: 'currentColor' }));
put(join(BRAND, 'playz-logo-dark.svg'), logoSvg({ markColor: PAPER, textColor: PAPER }));
put(join(BRAND, 'playz-logo-light.svg'), logoSvg({ markColor: INK, textColor: INK }));
put(join(BRAND, 'playz-logo-dark-bg.svg'), logoSvg({ markColor: PAPER, textColor: PAPER, bg: BG }));
put(join(PWA, 'favicon.svg'), badgeSvg(PAPER, INK), 'badge — visible on light AND dark tabs');

// --- symbol PNGs (real raster, from vector) --------------------------------
for (const size of [1024, 512, 192, 64]) {
  put(join(BRAND, `playz-symbol-${size}.png`),
    render(symbolSvg(PAPER, { bold: size <= 64 }), size), `${size}×${size} raster`);
}
// Light-surface symbol too, so docs/print have a correct asset.
put(join(BRAND, 'playz-symbol-light-512.png'),
  render(symbolSvg(INK), 512), 'light-surface variant');

// --- lockup PNGs -----------------------------------------------------------
put(join(BRAND, 'playz-logo-dark.png'),
  render(logoSvg({ markColor: PAPER, textColor: PAPER }), 1024), 'dark surface');
put(join(BRAND, 'playz-logo-light.png'),
  render(logoSvg({ markColor: INK, textColor: INK }), 1024), 'light surface');

// --- PWA / platform --------------------------------------------------------
put(join(PWA, 'apple-touch-icon.png'), render(symbolSvg(PAPER), 180));
// Apple + Android maskable want a filled background.
const maskable192 = maskableSvg(PAPER, BG, 192);
const maskable512 = maskableSvg(PAPER, BG, 512);
put(join(PWA, 'pwa-192.png'), render(maskable192, 192), 'standard icon');
put(join(PWA, 'pwa-512.png'), render(maskable512, 512), 'standard icon');
put(join(PWA, 'maskable-192.png'), render(maskable192, 192), 'safe-zone 62%');
put(join(PWA, 'maskable-512.png'), render(maskable512, 512), 'safe-zone 62%');

// --- favicon.ico -----------------------------------------------------------
put(join(PWA, 'favicon.ico'), buildIco([
  { size: 64, buf: render(badgeSvg(PAPER, INK), 64) },
  { size: 32, buf: render(badgeSvg(PAPER, INK, 96, { bold: true }), 32) },
  { size: 16, buf: render(badgeSvg(PAPER, INK, 96, { bold: true, zzOnly: true }), 16) },
]), 'PNG-embedded badge — bold at 32, simplified ZZ-only at 16');

console.log(`playZ brand assets written (${written.length} files):\n` + written.map((w) => '  ' + w).join('\n'));
