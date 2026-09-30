/**
 * playZ — brand review sheet
 * Renders every identity asset onto its real surface so the mark can be judged
 * in context, including at favicon sizes where most marks fall apart.
 *
 *   node scripts/brand-preview.mjs      → docs/brand-preview.png
 */
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const B = join(ROOT, 'apps/web/public/brand');
const OUT = join(ROOT, 'docs/brand-preview.png');

const BG = '#08080A';
const CARD = '#121218';

const svgOf = (f) => readFileSync(join(B, f), 'utf8');
const render = (svg, w, bg) =>
  new Resvg(svg, {
    fitTo: { mode: 'width', value: w },
    background: bg,
    font: { loadSystemFonts: false },
  }).render().asPng();

const b64 = (buf) => Buffer.from(buf).toString('base64');

const W = 1240, H = 980;
const out = [];
out.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
out.push(`<rect width="${W}" height="${H}" fill="${BG}"/>`);

const label = (x, y, txt, sub = '') =>
  out.push(`<text x="${x}" y="${y}" fill="#8A8A99" font-family="monospace" font-size="13">${txt}</text>` +
    (sub ? `<text x="${x}" y="${y + 17}" fill="#4E4E5A" font-family="monospace" font-size="11">${sub}</text>` : ''));

const panel = (x, y, w, h, fill = CARD) =>
  out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${fill}" stroke="#23232C"/>`);

const img = (href, x, y, w, h) =>
  out.push(`<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${href}"/>`);

// -- row 1: symbol + lockup --------------------------------------------------
panel(28, 28, 420, 420);
img(b64(render(svgOf('playz-symbol-dark.svg'), 360, 'rgba(0,0,0,0)')), 58, 58, 360, 360);
label(28, 472, 'playz-symbol-dark.svg', '512px raster, dark surface');

panel(468, 28, 744, 420);
img(b64(render(svgOf('playz-logo-dark.svg'), 660, 'rgba(0,0,0,0)')), 510, 148, 660, 180);
label(468, 472, 'playz-logo-dark.svg', 'mark + path-built wordmark, no font dependency');

// -- row 2: favicon sizes ----------------------------------------------------
panel(28, 512, 420, 200);
const sizes = [64, 32, 16];
let sx = 60;
for (const s of sizes) {
  const png = render(svgOf('playz-symbol-dark.svg'), s, 'rgba(0,0,0,0)');
  img(b64(png), sx, 580, s, s);
  out.push(`<text x="${sx}" y="676" fill="#4E4E5A" font-family="monospace" font-size="11">${s}px</text>`);
  sx += s + 56;
}
label(28, 548, 'favicon legibility', 'the real test — ring cuts must survive downscaling');

// -- row 3: maskable safe zone ----------------------------------------------
panel(468, 512, 240, 200);
img(b64(readFileSync(join(ROOT, 'apps/web/public/maskable-192.png'))), 492, 536, 192, 192);
label(468, 548, 'maskable', 'inner 62% safe');

// -- row 4: light surface + ink icon ----------------------------------------
panel(728, 512, 484, 200, '#F4F4F6');
img(b64(render(svgOf('playz-logo-light.svg'), 400, 'rgba(0,0,0,0)')), 770, 570, 400, 109);
label(728, 548, 'playz-logo-light.svg', 'light surface', );
out.push(`<text x="728" y="700" fill="#8A8A99" font-family="monospace" font-size="11">monochrome identity — colour lives in the UI, not the logo</text>`);

// -- row 5: palette ----------------------------------------------------------
out.push(`<text x="28" y="770" fill="#8A8A99" font-family="monospace" font-size="13">accent semantics</text>`);
const swatches = [
  ['blue', '#2F6BFF', 'brand + action'],
  ['orange', '#FF6B2C', 'major CTA / live-action'],
  ['yellow', '#FFC53D', 'premium / rating'],
  ['red', '#FF3B47', 'live / destructive'],
];
let px = 28;
for (const [name, hex, use] of swatches) {
  out.push(`<rect x="${px}" y="790" width="180" height="72" rx="10" fill="${hex}"/>`);
  out.push(`<text x="${px + 14}" y="822" fill="#0B0B0F" font-family="monospace" font-size="13" font-weight="bold">${hex}</text>`);
  out.push(`<text x="${px + 14}" y="842" fill="#0B0B0F" font-family="monospace" font-size="10">${use}</text>`);
  px += 196;
}
out.push(`<text x="${px + 6}" y="822" fill="#4E4E5A" font-family="monospace" font-size="11">surfaces</text>`);
out.push(`<text x="${px + 6}" y="842" fill="#4E4E5A" font-family="monospace" font-size="11">${BG} · ${CARD}</text>`);

// -- full lockup on the app background --------------------------------------
out.push(`<rect x="28" y="886" width="1184" height="70" rx="12" fill="${BG}" stroke="#23232C"/>`);
img(b64(render(svgOf('playz-logo-dark.svg'), 260, 'rgba(0,0,0,0)')), 48, 903, 260, 71);
out.push(`<text x="340" y="930" fill="#3A3A46" font-family="monospace" font-size="11">playZ — premium OTT, OLED black, dark-first</text>`);

out.push('</svg>');
mkdirSync(join(ROOT, 'docs'), { recursive: true });
writeFileSync(OUT, render(out.join('\n'), W, BG));
console.log('wrote', OUT.replace(ROOT + '/', ''));
