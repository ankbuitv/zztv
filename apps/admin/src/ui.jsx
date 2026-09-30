/**
 * playZ admin — shared panel primitives
 * ============================================================================
 * The admin talks to a large, long-lived API surface: 50-odd /admin/* routes
 * built up over the life of the product. Three things follow from that, and they
 * shape everything below.
 *
 * 1. Every panel loads the same way. `useApi` owns fetching, cancellation,
 *    loading and error state, so no panel invents its own. A request that lands
 *    after the operator has navigated away is dropped rather than writing into a
 *    component that no longer exists.
 *
 * 2. Nothing trusts a response shape blindly. These endpoints were written at
 *    different times and several return different keys for the same idea. `pick`
 *    reads the first non-empty of several candidate keys, so a panel renders
 *    whichever shape arrived instead of throwing on `.map` of undefined.
 *
 * 3. Errors are shown, never swallowed. An admin screen that silently renders an
 *    empty table when the API is down is how an operator concludes there is no
 *    data rather than no connection.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { color as C, radius, api } from './api';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
export function useApi(path, { deps = [], enabled = true } = {}) {
  const [state, setState] = useState({ data: null, loading: enabled, error: null });
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (!enabled) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api(path);
      if (!alive.current) return;
      setState({ data, loading: false, error: null });
    } catch (e) {
      if (!alive.current) return;
      setState({ data: null, loading: false, error: e?.message || 'Không tải được dữ liệu' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled, ...deps]);

  useEffect(() => {
    alive.current = true;
    load();
    return () => { alive.current = false; };
  }, [load]);

  return { ...state, reload: load };
}

/** First non-empty value among candidate keys — see note 2 in the file header. */
export function pick(obj, keys, fallback) {
  if (!obj || typeof obj !== 'object') return fallback;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0)) return v;
  }
  return fallback;
}

export const asArray = (v) => (Array.isArray(v) ? v : []);

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------
export function Card({ title, subtitle, action, children, padding = 16 }) {
  return (
    <section style={{
      background: C.card, border: `1px solid ${C.line}`, borderRadius: radius.lg,
      padding, marginBottom: 16,
    }}>
      {(title || action) && (
        <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: children ? 14 : 0 }}>
          <div style={{ minWidth: 0 }}>
            {title && <h2 style={{ fontSize: 13.5, fontWeight: 800, margin: 0 }}>{title}</h2>}
            {subtitle && <p style={{ fontSize: 11.5, color: C.textMuted, margin: '3px 0 0' }}>{subtitle}</p>}
          </div>
          {action && <div style={{ marginLeft: 'auto' }}>{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone = 'default' }) {
  const toneColor = tone === 'good' ? C.blueSoft : tone === 'warn' ? C.orange : tone === 'bad' ? C.red : C.text;
  return (
    <div style={{
      flex: '1 1 160px', minWidth: 150, background: C.card, border: `1px solid ${C.line}`,
      borderRadius: radius.lg, padding: 14,
    }}>
      <p style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: C.textFaint, margin: 0 }}>
        {label}
      </p>
      <p style={{ fontSize: 24, fontWeight: 900, margin: '7px 0 0', color: toneColor, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        {value}
      </p>
      {hint && <p style={{ fontSize: 11, color: C.textMuted, margin: '5px 0 0' }}>{hint}</p>}
    </div>
  );
}

export function Button({ children, onClick, variant = 'default', disabled, type = 'button', style }) {
  const [hover, setHover] = useState(false);
  const base = {
    primary: { bg: C.blue, fg: '#fff', border: 'transparent' },
    danger: { bg: 'rgba(255,59,71,.14)', fg: C.red, border: 'rgba(255,59,71,.34)' },
    default: { bg: hover ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.05)', fg: C.text, border: C.line },
  }[variant];
  return (
    <button
      type={type} onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px',
        borderRadius: radius.sm, border: `1px solid ${base.border}`,
        background: base.bg, color: base.fg,
        fontSize: 12, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? .5 : 1, transition: 'background 140ms ease', ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Field({ placeholder, value, onChange, onEnter, width = 220 }) {
  return (
    <input
      value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) onEnter(); }}
      style={{
        width, height: 32, padding: '0 11px', background: 'rgba(255,255,255,.05)',
        border: `1px solid ${C.line}`, borderRadius: radius.sm, color: C.text,
        fontSize: 12.5, outline: 'none',
      }}
    />
  );
}

export function Pill({ children, tone = 'default' }) {
  const map = {
    default: { bg: 'rgba(255,255,255,.07)', fg: C.textMuted, bd: C.line },
    good: { bg: 'rgba(47,107,255,.14)', fg: C.blueSoft, bd: 'rgba(47,107,255,.34)' },
    live: { bg: 'rgba(255,59,71,.14)', fg: C.red, bd: 'rgba(255,59,71,.34)' },
    warn: { bg: 'rgba(255,107,44,.14)', fg: C.orange, bd: 'rgba(255,107,44,.34)' },
    gold: { bg: 'rgba(255,197,61,.14)', fg: C.yellow, bd: 'rgba(255,197,61,.34)' },
  }[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
      borderRadius: radius.pill, background: map.bg, color: map.fg,
      border: `1px solid ${map.bd}`, fontSize: 10.5, fontWeight: 800, whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

/** Loading / error / empty in one place, so no panel forgets one of them. */
export function States({ loading, error, empty, onRetry, columns = 1, children }) {
  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`, gap: 12 }}>
        {Array.from({ length: columns * 2 }).map((_, i) => (
          <div key={i} style={{ height: 54, borderRadius: radius.md, background: 'rgba(255,255,255,.04)', border: `1px solid ${C.line}` }} />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: 20, borderRadius: radius.md, background: 'rgba(255,59,71,.07)', border: '1px solid rgba(255,59,71,.28)' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.red, margin: 0 }}>Không tải được dữ liệu</p>
        <p style={{ fontSize: 12, color: C.textMuted, margin: '6px 0 12px' }}>{error}</p>
        {onRetry && <Button onClick={onRetry}>Thử lại</Button>}
      </div>
    );
  }
  if (empty) {
    return (
      <p style={{ padding: '26px 0', textAlign: 'center', fontSize: 12.5, color: C.textMuted, margin: 0 }}>
        Chưa có dữ liệu.
      </p>
    );
  }
  return children;
}

export function Table({ columns, rows, rowKey = (_r, i) => i, onRowClick }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{
                  textAlign: c.align || 'left', padding: '8px 10px', fontSize: 10.5,
                  fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase',
                  color: C.textFaint, borderBottom: `1px solid ${C.line}`, whiteSpace: 'nowrap',
                  width: c.width,
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={rowKey(r, i)}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  style={{
                    padding: '9px 10px', borderBottom: `1px solid ${C.line}`,
                    textAlign: c.align || 'left', color: c.muted ? C.textMuted : C.text,
                    maxWidth: c.maxWidth, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: c.wrap ? 'normal' : 'nowrap',
                    fontVariantNumeric: c.numeric ? 'tabular-nums' : undefined,
                  }}
                >
                  {c.render ? c.render(r, i) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Horizontal bars. Enough for the handful of series the analytics endpoints
 * return; a charting dependency would be more code than the chart.
 */
export function Bars({ data, labelKey = 'label', valueKey = 'value', height = 120, tone = C.blue }) {
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey]) || 0));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height, paddingTop: 8 }}>
      {data.map((d, i) => {
        const v = Number(d[valueKey]) || 0;
        const h = Math.max(2, Math.round((v / max) * (height - 26)));
        return (
          <div key={`${d[labelKey]}-${i}`} style={{ flex: 1, minWidth: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
            title={`${d[labelKey]}: ${v}`}>
            <span style={{ fontSize: 9.5, color: C.textFaint, fontVariantNumeric: 'tabular-nums' }}>
              {v > 0 ? v : ''}
            </span>
            <span style={{ width: '100%', height: h, borderRadius: 3, background: tone, opacity: .85 }} />
            <span style={{ fontSize: 9.5, color: C.textFaint, whiteSpace: 'nowrap' }}>{d[labelKey]}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Toast({ message, tone = 'info', onDone }) {
  useEffect(() => {
    const id = setTimeout(() => onDone && onDone(), 2600);
    return () => clearTimeout(id);
  }, [onDone]);
  const toneColor = tone === 'error' ? C.red : tone === 'success' ? C.blueSoft : C.text;
  return (
    <div style={{
      position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)',
      background: C.bgElevated, border: `1px solid ${C.lineStrong}`, borderRadius: radius.md,
      padding: '10px 16px', fontSize: 12.5, fontWeight: 600, color: toneColor,
      boxShadow: '0 18px 50px rgba(0,0,0,.6)', zIndex: 60,
    }}>
      {message}
    </div>
  );
}

export const fmtNum = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('vi-VN');
};

export const fmtDate = (s) => {
  if (!s) return '—';
  const iso = /Z|[+-]\d\d:?\d\d$/.test(s) ? s : `${String(s).replace(' ', 'T')}Z`;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return String(s);
  return new Date(t).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};
