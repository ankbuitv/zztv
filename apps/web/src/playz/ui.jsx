/**
 * playZ — design primitives
 * ============================================================================
 * Standard controls used across the product. Building these once is what keeps
 * focus rings, radii, motion and contrast consistent — and it is why new
 * screens do not need to invent their own button styling.
 *
 * Accessibility baked in:
 *   - every icon-only control requires an accessible label
 *   - keyboard focus is always visible (never `outline: none` alone)
 *   - modals trap focus and close on Escape
 *   - motion collapses to instant when the OS asks for reduced motion
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { color as C, motion, radius, shadow, z, prefersReducedMotion } from './tokens';

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------
const BTN_VARIANTS = {
  // Primary brand action.
  primary: { background: C.blue, color: '#fff', border: '1px solid transparent' },
  // Major call to action — used sparingly, for conversion surfaces.
  cta: { background: C.orange, color: '#14100C', border: '1px solid transparent' },
  premium: { background: C.yellow, color: '#181203', border: '1px solid transparent' },
  // High-emphasis neutral, e.g. "Xem ngay" over artwork.
  light: { background: '#fff', color: '#0B0B0F', border: '1px solid transparent' },
  // Low emphasis.
  subtle: { background: 'rgba(255,255,255,.09)', color: C.text, border: '1px solid rgba(255,255,255,.12)' },
  ghost: { background: 'transparent', color: C.text, border: '1px solid transparent' },
  outline: { background: 'transparent', color: C.text, border: `1px solid ${C.lineStrong}` },
  danger: { background: C.red, color: '#fff', border: '1px solid transparent' },
};

const BTN_SIZES = {
  sm: { padding: '6px 12px', fontSize: 12.5, height: 32, gap: 6 },
  md: { padding: '9px 18px', fontSize: 13.5, height: 40, gap: 8 },
  lg: { padding: '12px 26px', fontSize: 15, height: 48, gap: 9 },
};

export function Button({
  children, variant = 'primary', size = 'md', icon: Icon, iconRight: IconRight,
  full, disabled, loading, onClick, type = 'button', title, style, className = '', ...rest
}) {
  const v = BTN_VARIANTS[variant] || BTN_VARIANTS.primary;
  const s = BTN_SIZES[size] || BTN_SIZES.md;
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);
  const off = disabled || loading;

  return (
    <button
      type={type} onClick={onClick} disabled={off} title={title} aria-busy={loading || undefined}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)} onMouseUp={() => setActive(false)}
      className={'relative inline-flex items-center justify-center font-bold select-none ' + className}
      style={{
        ...v,
        height: s.height,
        padding: s.padding,
        fontSize: s.fontSize,
        gap: s.gap,
        borderRadius: radius.md,
        width: full ? '100%' : undefined,
        cursor: off ? 'not-allowed' : 'pointer',
        opacity: off ? 0.5 : 1,
        transform: active && !off ? 'scale(.97)' : hover && !off ? 'translateY(-1px)' : 'none',
        filter: hover && !off && variant !== 'ghost' && variant !== 'subtle' ? 'brightness(1.1)' : 'none',
        boxShadow: hover && !off && (variant === 'primary') ? shadow.glowBlue
          : hover && !off && variant === 'cta' ? shadow.glowOrange : 'none',
        transition: prefersReducedMotion() ? 'none' : motion.t(motion.fast),
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {loading && <Spinner size={s.fontSize + 2} />}
      {!loading && Icon && <Icon size={s.fontSize + 3} strokeWidth={2.4} />}
      {children}
      {!loading && IconRight && <IconRight size={s.fontSize + 3} strokeWidth={2.4} />}
    </button>
  );
}

export function Spinner({ size = 16, tint = 'currentColor' }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, display: 'inline-block', flexShrink: 0,
        border: `2px solid ${tint}`, borderTopColor: 'transparent',
        borderRadius: '50%', animation: 'playzSpin .7s linear infinite',
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// IconButton — an accessible label is required, not optional.
// ---------------------------------------------------------------------------
export function IconButton({
  icon: Icon, label, onClick, size = 38, iconSize, active, badge, variant = 'ghost', title, className = '', style,
}) {
  const [hover, setHover] = useState(false);
  const bg = variant === 'subtle' ? 'rgba(255,255,255,.09)' : variant === 'light' ? '#fff' : 'transparent';
  const tint = variant === 'light' ? '#0B0B0F' : C.text;

  return (
    <button
      type="button" onClick={onClick} title={title || label} aria-label={label} aria-pressed={active || undefined}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className={'relative inline-flex items-center justify-center ' + className}
      style={{
        width: size, height: size, borderRadius: radius.md,
        background: hover && variant === 'ghost' ? 'rgba(255,255,255,.10)' : bg,
        color: active ? C.blueSoft : tint,
        border: '1px solid transparent',
        cursor: 'pointer',
        transition: prefersReducedMotion() ? 'none' : motion.t(motion.fast, motion.ease, 'background,color,transform'),
        transform: hover ? 'scale(1.04)' : 'none',
        ...style,
      }}
    >
      <Icon size={iconSize || Math.round(size * 0.47)} strokeWidth={2.2} />
      {badge > 0 && (
        <span aria-hidden="true" style={{
          position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, padding: '0 4px',
          borderRadius: radius.pill, background: C.red, color: '#fff',
          fontSize: 10, fontWeight: 800, lineHeight: '16px', textAlign: 'center',
        }}>{badge > 99 ? '99+' : badge}</span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Chip / Badge
// ---------------------------------------------------------------------------
export function Chip({ children, active, onClick, icon: Icon, size = 'md', className = '' }) {
  const [hover, setHover] = useState(false);
  const pad = size === 'sm' ? '5px 11px' : '7px 15px';
  const fs = size === 'sm' ? 11.5 : 12.5;

  return (
    <button
      type="button" onClick={onClick} aria-pressed={active || undefined}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className={'inline-flex items-center shrink-0 font-bold ' + className}
      style={{
        padding: pad, fontSize: fs, gap: 6, borderRadius: radius.pill,
        background: active ? C.blue : hover ? 'rgba(255,255,255,.13)' : 'rgba(255,255,255,.07)',
        color: active ? '#fff' : hover ? '#fff' : C.textMuted,
        border: `1px solid ${active ? 'transparent' : C.line}`,
        cursor: 'pointer', whiteSpace: 'nowrap',
        transition: prefersReducedMotion() ? 'none' : motion.t(motion.fast, motion.ease, 'background,color,border-color'),
      }}
    >
      {Icon && <Icon size={fs + 2} strokeWidth={2.4} />}
      {children}
    </button>
  );
}

const BADGE_TONES = {
  neutral: { bg: 'rgba(255,255,255,.10)', fg: C.text },
  blue: { bg: 'rgba(47,107,255,.16)', fg: C.blueSoft },
  orange: { bg: 'rgba(255,107,44,.16)', fg: '#FF9A6B' },
  yellow: { bg: 'rgba(255,197,61,.16)', fg: C.yellow },
  red: { bg: C.red, fg: '#fff' },
  dark: { bg: 'rgba(0,0,0,.72)', fg: C.text },
};

export function Badge({ children, tone = 'neutral', icon: Icon, className = '', style }) {
  const t = BADGE_TONES[tone] || BADGE_TONES.neutral;
  return (
    <span
      className={'inline-flex items-center font-extrabold ' + className}
      style={{
        background: t.bg, color: t.fg, padding: '3px 8px', borderRadius: radius.xs,
        fontSize: 10.5, letterSpacing: '.03em', gap: 4, lineHeight: 1.35, ...style,
      }}
    >
      {Icon && <Icon size={11} strokeWidth={2.6} />}
      {children}
    </span>
  );
}

/**
 * Live indicator. Pulses gently — a hard blink is distracting when several
 * appear on screen at once, which is common on a sports page.
 */
export function LiveDot({ label = 'LIVE', size = 8, showLabel = true }) {
  return (
    <span className="inline-flex items-center" style={{ gap: 5 }}>
      <span style={{
        width: size, height: size, borderRadius: '50%', background: C.red,
        boxShadow: `0 0 8px ${C.red}`, flexShrink: 0,
        animation: prefersReducedMotion() ? 'none' : 'playzLive 2s ease-in-out infinite',
      }} />
      {showLabel && (
        <span style={{ fontSize: 10.5, fontWeight: 900, color: C.red, letterSpacing: '.06em' }}>{label}</span>
      )}
    </span>
  );
}

/** Star rating — yellow because yellow means rating in the playZ system. */
export function Rating({ value, count, size = 12 }) {
  if (value == null || Number.isNaN(Number(value))) return null;
  return (
    <span className="inline-flex items-center" style={{ gap: 4 }} title={count ? `${count} votes` : undefined}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill={C.yellow} aria-hidden="true">
        <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
      </svg>
      <span style={{ fontSize: size, fontWeight: 800, color: C.text }}>{Number(value).toFixed(1)}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
export function Skeleton({ w = '100%', h = 16, r = radius.sm, className = '', style }) {
  return (
    <span
      aria-hidden="true" className={'block skeleton-shimmer ' + className}
      style={{ width: w, height: h, borderRadius: r, background: 'rgba(255,255,255,.055)', ...style }}
    />
  );
}

export function SkeletonCard({ ratio = 16 / 9, className = '' }) {
  return (
    <span className={'block ' + className} style={{ aspectRatio: String(ratio) }}>
      <Skeleton h="100%" r={radius.md} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Modal — focus trap, Escape to close, backdrop click, scroll lock.
// ---------------------------------------------------------------------------
export function Modal({
  open, onClose, title, children, footer, width = 520, closeOnBackdrop = true, labelledBy,
}) {
  const ref = useRef(null);
  const restoreTo = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    restoreTo.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus into the dialog so screen readers and keyboard users land here.
    const focusFirst = () => {
      const el = ref.current;
      if (!el) return;
      const target = el.querySelector('[data-autofocus]')
        || el.querySelector('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
      (target || el).focus();
    };
    const id = setTimeout(focusFirst, 30);

    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose && onClose(); return; }
      if (e.key !== 'Tab' || !ref.current) return;
      // Keep Tab inside the dialog.
      const nodes = ref.current.querySelectorAll(
        'button:not([disabled]),[href],input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'
      );
      if (!nodes.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);

    return () => {
      clearTimeout(id);
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      try { restoreTo.current && restoreTo.current.focus && restoreTo.current.focus(); } catch { /* ignore */ }
    };
  }, [open, onClose]);

  if (!open) return null;
  const reduced = prefersReducedMotion();

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: z.modal }}
      role="presentation"
    >
      <div
        className="absolute inset-0" onClick={closeOnBackdrop ? onClose : undefined}
        style={{
          background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(6px)',
          animation: reduced ? 'none' : 'playzFadeIn 200ms ease both',
        }}
      />
      <div
        ref={ref} role="dialog" aria-modal="true" aria-label={!labelledBy ? (title || 'Dialog') : undefined}
        aria-labelledby={labelledBy} tabIndex={-1}
        className="relative w-full overflow-hidden"
        style={{
          maxWidth: width, background: C.bgElevated, border: `1px solid ${C.line}`,
          borderRadius: radius.lg, boxShadow: shadow.modal, maxHeight: '88vh', display: 'flex', flexDirection: 'column',
          animation: reduced ? 'none' : 'playzModalIn 240ms ' + motion.ease + ' both',
        }}
      >
        {(title || onClose) && (
          <div className="flex items-center justify-between shrink-0"
            style={{ padding: '18px 20px', borderBottom: `1px solid ${C.line}` }}>
            <h2 id={labelledBy} style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{title}</h2>
            {onClose && (
              <button type="button" onClick={onClose} aria-label="Đóng"
                className="flex items-center justify-center"
                style={{
                  width: 32, height: 32, borderRadius: radius.sm, color: C.textMuted,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && (
          <div className="flex justify-end shrink-0" style={{ padding: '14px 20px', borderTop: `1px solid ${C.line}`, gap: 10 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty / error states.
// A blank black rectangle never explains itself — every surface that can be
// empty uses one of these instead.
// ---------------------------------------------------------------------------
export function EmptyState({ icon: Icon, title, description, action, compact, tone = 'neutral' }) {
  const tint = tone === 'error' ? C.red : tone === 'warn' ? C.yellow : C.textFaint;
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ padding: compact ? '28px 16px' : '56px 24px', gap: 10 }}
      role={tone === 'error' ? 'alert' : undefined}
    >
      {Icon && (
        <span className="flex items-center justify-center" style={{
          width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,.05)',
          marginBottom: 2, color: tint,
        }}>
          <Icon size={24} strokeWidth={1.8} />
        </span>
      )}
      {title && <p style={{ fontSize: 14.5, fontWeight: 800, color: C.text }}>{title}</p>}
      {description && <p style={{ fontSize: 12.5, color: C.textMuted, maxWidth: 340, lineHeight: 1.6 }}>{description}</p>}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
export function Toast({ message, tone = 'info', onDismiss }) {
  const tones = { info: C.blue, success: '#22C55E', warn: C.yellow, error: C.red };
  useEffect(() => {
    if (!onDismiss) return undefined;
    const id = setTimeout(onDismiss, 4000);
    return () => clearTimeout(id);
  }, [onDismiss]);

  return (
    <div role="status" style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px',
      background: C.bgElevated, border: `1px solid ${C.line}`, borderLeft: `3px solid ${tones[tone] || tones.info}`,
      borderRadius: radius.md, boxShadow: shadow.cardHover, fontSize: 13, color: C.text,
      animation: prefersReducedMotion() ? 'none' : 'playzSlideUp 260ms ' + motion.easeOut + ' both',
    }}>
      <span>{message}</span>
    </div>
  );
}

/**
 * Shows a transient message. Shared by all new playZ surfaces so behaviour
 * (duration, dismissal, reduced-motion) is consistent.
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, tone = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, tone }]);
    return id;
  }, []);
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const node = (
    <div className="fixed flex flex-col" style={{ right: 20, bottom: 20, gap: 10, zIndex: z.toast }}>
      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} tone={t.tone} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
  return { push, dismiss, toasts, node };
}

export default {
  Button, IconButton, Chip, Badge, LiveDot, Rating, Skeleton, SkeletonCard,
  Modal, EmptyState, Toast, Spinner, useToast,
};
