/**
 * playZ — brand mark components
 * ============================================================================
 * The mark is inlined as SVG rather than loaded from a file so it can inherit
 * colour, scale without a network request, and be animated. Geometry is kept
 * identical to scripts/build-brand.mjs — if you change one, change both.
 *
 * A note on small sizes: the full mark (ring + ZZ ligature) is used at ≥ 40px.
 * Below that the ring and ligature collapse into each other, so the wordmark
 * carries the identity and only the ZZ is drawn.
 */
import React from 'react';
import { color as C, motion, prefersReducedMotion } from './tokens';

// --- geometry (96-unit grid) ------------------------------------------------
const RING_R = 39;
const RING_W = 6;
const CIRC = 2 * Math.PI * RING_R;
const ARC = 84;
const GAP = CIRC / 2 - ARC;              // two arcs + two gaps == circumference
const RING_ROT = 135 - (ARC + GAP / 2);  // cuts sit on the diagonal
const ZZ = 'M25 27 H71 L25 48 H71 L25 69 H71';
const ZZ_W = 6;
const ZZ_BOLD = 'M27 29 H69 L27 48 H69 L27 67 H69';

/**
 * @param {number}  size     rendered px
 * @param {string}  tint     stroke colour
 * @param {boolean} bold     heavier cut for small sizes
 * @param {boolean} zzOnly   drop the ring entirely (≤ 24px)
 * @param {boolean} animated play the ring draw-in once on mount
 */
export function PlayzMark({ size = 40, tint = 'currentColor', bold = false, zzOnly = false, animated = false, className = '', title = 'playZ' }) {
  const isTiny = size <= 24;
  const useBold = bold || (size <= 64 && size > 24);
  const dropRing = zzOnly || isTiny;
  const rw = useBold ? 8 : RING_W;
  const zw = useBold ? 8 : ZZ_W;
  const zPath = useBold ? ZZ_BOLD : ZZ;

  // Respect the OS setting: no draw-in animation when reduced motion is on.
  const animate = animated && !prefersReducedMotion();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      className={className}
      role="img"
      aria-label={title}
      style={{ display: 'block', flexShrink: 0 }}
    >
      {!dropRing && (
        <circle
          cx="48" cy="48" r={RING_R}
          fill="none" stroke={tint} strokeWidth={rw} strokeLinecap="round"
          strokeDasharray={ARC + ' ' + GAP}
          transform={'rotate(' + RING_ROT + ' 48 48)'}
          style={animate ? {
            strokeDasharray: CIRC,
            strokeDashoffset: CIRC,
            animation: 'playzRingDraw 620ms ' + motion.easeOut + ' 120ms forwards',
          } : undefined}
        />
      )}
      <g transform={dropRing ? 'translate(48 48) scale(1.55) translate(-48 -48)' : undefined}>
        <path
          d={zPath} fill="none" stroke={tint} strokeWidth={zw}
          strokeLinecap="round" strokeLinejoin="round"
          style={animate ? {
            strokeDasharray: 300,
            strokeDashoffset: 300,
            animation: 'playzZDraw 520ms ' + motion.easeOut + ' forwards',
          } : undefined}
        />
      </g>
    </svg>
  );
}

/**
 * Wordmark drawn as paths, matching the brand builder. No font is referenced,
 * so the lockup renders identically on every device — including Android TV,
 * where the system font is nothing like the web font.
 */
export function PlayzWordmark({ height = 26, tint = 'currentColor', className = '' }) {
  const WM_W = 4.2, TRACK = 8;
  const d = [];
  let x = 0;
  const at = (dx) => x + dx;

  d.push(`M${at(0)} -30 L${at(0)} 10`);
  d.push(`M${at(11)} -20 A10 10 0 1 0 ${at(11)} 0 A10 10 0 1 0 ${at(11)} -20 Z`);
  x += 21 + TRACK;
  d.push(`M${at(0)} -30 L${at(0)} 0`);
  x += 4 + TRACK;
  d.push(`M${at(10)} -20 A10 10 0 1 0 ${at(10)} 0 A10 10 0 1 0 ${at(10)} -20 Z`);
  d.push(`M${at(20)} -20 L${at(20)} 0`);
  x += 20 + TRACK;
  d.push(`M${at(0)} -20 L${at(10)} 0`);
  d.push(`M${at(20)} -20 L${at(10)} 0 L${at(3)} 10`);
  x += 20 + TRACK;
  d.push(`M${at(0)} -27 H${at(26)} L${at(0)} 0 H${at(26)}`);

  const wmWidth = x + 26;
  const scale = (height * 0.72) / 40; // cap height 27 + descender 10 ≈ 40 units
  const width = wmWidth * scale;

  return (
    <svg
      width={width} height={height} viewBox={`0 -31 ${wmWidth} 42`}
      className={className} role="img" aria-label="playZ"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <path d={d.join(' ')} fill="none" stroke={tint} strokeWidth={WM_W}
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Full lockup: mark + wordmark, optically centred against each other. */
export function PlayzLogo({ size = 34, tint = 'currentColor', showWordmark = true, animated = false, className = '' }) {
  if (!showWordmark) return <PlayzMark size={size} tint={tint} animated={animated} className={className} />;
  return (
    <span className={'inline-flex items-center ' + className} style={{ gap: size * 0.24, color: tint }}>
      <PlayzMark size={size} tint="currentColor" animated={animated} />
      <PlayzWordmark height={size * 0.78} tint="currentColor" />
    </span>
  );
}

export default PlayzLogo;
