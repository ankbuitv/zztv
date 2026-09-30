// Regenerates the Shorts fixture clips in tools/fixture-media/.
//
//   node tools/make-fixture-media.mjs
//
// The stills are drawn with @resvg (already a repo dependency). The clips are a
// slow pan over each still, which needs ffmpeg on PATH; without it the stills
// are still written and the script says so, because the Shorts list renders
// fine with a poster and no motion — what breaks is the video element.
//
// Why a pan and not generated video: building a gradient frame by frame with
// ffmpeg's geq takes about a hundred seconds per clip. Looping a still and
// zooming it takes about a second, for the same 30 KB result.
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const OUT = new URL('./fixture-media/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const SET = [
  ['s1', '#2F6BFF', '#08080A', 'NIGHT DRIVE'],
  ['s2', '#FF6B2C', '#101014', 'SUNSET LOOP'],
  ['s3', '#6E9BFF', '#0B0B0F', 'COLD FRONT'],
  ['s4', '#FFC53D', '#16161C', 'GOLD HOUR'],
  ['s5', '#FF3B47', '#08080A', 'RED LINE'],
];

for (const [name, a, b, label] of SET) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/>
    </linearGradient>
    <radialGradient id="v" cx="0.5" cy="0.42" r="0.75">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.35"/>
    </radialGradient>
  </defs>
  <rect width="720" height="1280" fill="url(#g)"/>
  <g fill="none" stroke="#FFFFFF" stroke-opacity="0.10" stroke-width="1.5">
    ${Array.from({ length: 22 }, (_, i) => `<circle cx="360" cy="470" r="${70 + i * 34}"/>`).join('')}
  </g>
  <rect width="720" height="1280" fill="url(#v)"/>
  <text x="60" y="1180" font-family="Helvetica,Arial,sans-serif" font-size="46" font-weight="bold"
        fill="#FFFFFF" fill-opacity="0.88" letter-spacing="4">${label}</text>
  <rect x="60" y="1210" width="96" height="5" rx="2.5" fill="#FFFFFF" fill-opacity="0.6"/>
</svg>`;
  writeFileSync(new URL(`${name}.png`, OUT), new Resvg(svg).render().asPng());
  console.log(`  ✓ ${name}.png`);
}

let ffmpeg = 'ffmpeg';
try {
  execFileSync(ffmpeg, ['-version'], { stdio: 'ignore' });
} catch {
  console.log('\n  ffmpeg not found — stills only. Install ffmpeg and re-run for the clips.');
  process.exit(0);
}

for (const [name] of SET) {
  execFileSync(ffmpeg, [
    '-y', '-loglevel', 'error',
    '-loop', '1', '-i', new URL(`${name}.png`, OUT).pathname, '-t', '5',
    '-vf', "scale=720:1280,zoompan=z='min(1.0+0.0009*on,1.22)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)+on*0.35':s=540x960:fps=15,format=yuv420p",
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '33', '-movflags', '+faststart',
    new URL(`${name}.mp4`, OUT).pathname,
  ]);
  console.log(`  ✓ ${name}.mp4`);
}
