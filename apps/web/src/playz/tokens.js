/**
 * playZ — design tokens
 * ============================================================================
 * The single source of truth for colour, spacing, radius, shadow, motion and
 * layering. Components must read from here rather than hardcoding values, so a
 * brand change stays a one-file change (which is how the playZ → playZ colour
 * migration was possible at all).
 *
 * These mirror the CSS custom properties in `src/index.css`. JS is used where a
 * value must be computed or passed to a canvas/player; CSS is used for styling.
 */

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------
export const color = {
  // Surfaces — OLED-friendly black first.
  bg: '#08080A',
  bgElevated: '#101014',
  card: '#16161C',
  cardHover: '#1E1E26',
  overlay: 'rgba(8,8,10,.82)',
  line: '#24242C',
  lineStrong: '#33333E',

  // Typography
  text: '#F5F5F7',
  textMuted: '#8A8A99',
  textFaint: '#55555F',

  // Accent semantics.
  // Each colour means one thing. Do not scatter them decoratively.
  blue: '#2F6BFF',       // brand + primary action
  blueSoft: '#6E9BFF',
  orange: '#FF6B2C',     // major CTA, promotional, live-action
  yellow: '#FFC53D',     // premium, rating, awards
  red: '#FF3B47',        // live, destructive, urgent

  // Rating/quality badges
  imdb: '#F5C518',
  hd: '#8A8A99',

  // Legacy aliases — the migrated playZ components reference these names.
  brand: '#2F6BFF',
  brandSoft: '#6E9BFF',
};

export const gradient = {
  // Used for active navigation, marketing blocks, selected cards, glows.
  brand: 'linear-gradient(135deg,#2F6BFF 0%,#6E9BFF 55%,#0F3FCC 100%)',
  cta: 'linear-gradient(135deg,#FF8A3D 0%,#FF6B2C 60%,#E2450F 100%)',
  premium: 'linear-gradient(135deg,#FFD466 0%,#FFC53D 60%,#E8A300 100%)',
  heroScrim: 'linear-gradient(to top, rgba(8,8,10,1) 0%, rgba(8,8,10,.86) 22%, rgba(8,8,10,.35) 55%, rgba(8,8,10,.05) 100%)',
  heroSide: 'linear-gradient(to right, rgba(8,8,10,.95) 0%, rgba(8,8,10,.6) 42%, transparent 72%)',
};

// ---------------------------------------------------------------------------
// Space / radius / shadow
// ---------------------------------------------------------------------------
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };

export const radius = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };

export const shadow = {
  card: '0 4px 20px rgba(0,0,0,.45)',
  cardHover: '0 16px 44px rgba(0,0,0,.62)',
  modal: '0 28px 90px rgba(0,0,0,.75)',
  glowBlue: '0 0 26px rgba(47,107,255,.42)',
  glowOrange: '0 0 26px rgba(255,107,44,.42)',
  focusRing: '0 0 0 2px #08080A, 0 0 0 4px #2F6BFF',
};

// ---------------------------------------------------------------------------
// Motion
//
// Rule: animate transform and opacity only. Animating width/height/top/left
// forces layout on every frame and is what makes OTT UIs feel janky while
// scrolling rails.
// ---------------------------------------------------------------------------
export const motion = {
  instant: 90,
  fast: 180,
  base: 240,
  slow: 300,
  hero: 700,

  ease: 'cubic-bezier(.2,.8,.2,1)',
  easeOut: 'cubic-bezier(.22,.9,.3,1)',
  spring: 'cubic-bezier(.34,1.4,.64,1)',

  // Helpers for inline styles / CSS-in-JS
  t: (ms = 240, easing = 'cubic-bezier(.2,.8,.2,1)', props = 'opacity,transform') =>
    `${props} ${ms}ms ${easing}`,
};

/** True when the user has asked the OS to reduce motion. */
export function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Layout constants — the shell depends on these being consistent.
// ---------------------------------------------------------------------------
export const layout = {
  sidebarCollapsed: 80,
  sidebarExpanded: 248,
  headerHeight: 64,
  railGap: 12,
  maxContentWidth: 1680,
};

// ---------------------------------------------------------------------------
// Layering
//
// Every floating element draws from this scale. Arbitrary z-index values are
// what cause dropdowns to render under modals.
// ---------------------------------------------------------------------------
export const z = {
  base: 0,
  rail: 10,
  stickyHeader: 40,
  sidebar: 50,
  sidebarOverlay: 45,
  dropdown: 60,
  drawer: 70,
  modal: 100,
  player: 150,
  toast: 200,
  splash: 300,
};
