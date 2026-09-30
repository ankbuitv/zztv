/**
 * playZ — application sidebar
 * ============================================================================
 * Two real states rather than an icon rail plus a hover popout:
 *
 *   collapsed  80px  — icon above a compact label (the label is kept because
 *                      Vietnamese navigation terms are not self-evident from
 *                      icons alone, and it keeps the rail scannable)
 *   expanded  248px  — full labels; a backdrop dims the page beneath
 *
 * Both states animate on transform/width with a spring-like curve. Reduced
 * motion collapses the animation to zero rather than merely shortening it.
 *
 * On mobile the sidebar becomes a drawer that slides in over the content.
 */
import React, { useEffect, useRef } from 'react';
import {
  Home, Tv, Film, Trophy, CalendarDays, PlaySquare, Users,
  Settings, Info, Mail, ShieldCheck, ChevronLeft, X,
} from 'lucide-react';
import { color as C, motion, radius, layout, z, prefersReducedMotion } from './tokens';
import { PlayzMark } from './Logo';

// Primary navigation — these are the product's real content surfaces.
export const PRIMARY_NAV = [
  { id: 'channels', label: 'Trang chủ', Icon: Home },
  { id: 'tv', label: 'Truyền hình', Icon: Tv },
  { id: 'movies', label: 'Phim & TV Shows', Icon: Film },
  { id: 'sports', label: 'Thể thao', Icon: Trophy },
  { id: 'epg', label: 'EPG', Icon: CalendarDays },
  { id: 'shorts', label: 'Shorts', Icon: PlaySquare },
  { id: 'community', label: 'Cộng đồng', Icon: Users },
];

// Secondary — utility surfaces, visually separated from content.
export const SECONDARY_NAV = [
  { id: 'settings', label: 'Cài đặt', Icon: Settings, action: 'settings' },
  { id: 'about', label: 'Giới thiệu', Icon: Info, action: 'about' },
  { id: 'contact', label: 'Liên hệ', Icon: Mail, action: 'contact' },
];

function NavItem({ item, active, collapsed, onClick }) {
  const [hover, setHover] = React.useState(false);
  const { Icon, label } = item;
  const on = active === item.id;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={on ? 'page' : undefined}
      title={collapsed ? label : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="relative flex items-center w-full"
      style={{
        height: collapsed ? 58 : 44,
        flexDirection: collapsed ? 'column' : 'row',
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '0 4px' : '0 14px',
        gap: collapsed ? 4 : 13,
        borderRadius: radius.md,
        background: on ? 'rgba(47,107,255,.14)' : hover ? 'rgba(255,255,255,.06)' : 'transparent',
        color: on ? '#fff' : hover ? C.text : C.textMuted,
        border: 'none',
        cursor: 'pointer',
        transition: prefersReducedMotion() ? 'none' : motion.t(motion.fast, motion.ease, 'background,color'),
      }}
    >
      {/* Active indicator — the only place the brand gradient appears in nav. */}
      {on && (
        <span aria-hidden="true" style={{
          position: 'absolute', left: 0, top: collapsed ? '18%' : '22%', bottom: collapsed ? '18%' : '22%',
          width: 3, borderRadius: radius.pill, background: C.blue,
        }} />
      )}
      <Icon size={collapsed ? 20 : 19} strokeWidth={on ? 2.6 : 2.1} style={{ flexShrink: 0 }} />
      <span
        style={{
          fontSize: collapsed ? 9.5 : 13.5,
          fontWeight: on ? 800 : 600,
          letterSpacing: collapsed ? '.01em' : 0,
          lineHeight: 1.15,
          textAlign: collapsed ? 'center' : 'left',
          whiteSpace: collapsed ? 'normal' : 'nowrap',
          overflow: 'hidden',
          maxWidth: collapsed ? '100%' : undefined,
        }}
      >
        {/* In the rail the first word is enough; full label lives in the tooltip. */}
        {collapsed ? label.split(' ')[0] : label}
      </span>
    </button>
  );
}

export default function PlayzSidebar({
  activeTab, onNavigate, expanded, onToggleExpanded, onCloseMobile,
  isMobile, user, onShowAdmin, onOpenInfo,
}) {
  const isAdmin = user?.role === 'admin';
  const reduced = prefersReducedMotion();
  const width = expanded ? layout.sidebarExpanded : layout.sidebarCollapsed;
  const collapsed = !expanded;

  // Escape closes the expanded rail / mobile drawer, matching every other overlay.
  useEffect(() => {
    if (!expanded && !isMobile) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') (isMobile ? onCloseMobile : onToggleExpanded)?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, isMobile, onCloseMobile, onToggleExpanded]);

  const handle = (item) => {
    if (item.action === 'settings' || item.action === 'about' || item.action === 'contact') {
      onOpenInfo && onOpenInfo(item.action);
    } else {
      onNavigate && onNavigate(item.id);
    }
    if (isMobile) onCloseMobile && onCloseMobile();
  };

  const body = (
    <>
      {/* Brand */}
      <div
        className="flex items-center shrink-0"
        style={{
          height: layout.headerHeight,
          padding: collapsed ? '0 10px' : '0 16px',
          gap: 10,
          justifyContent: collapsed ? 'center' : 'space-between',
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        <button
          type="button"
          onClick={() => handle({ id: 'channels' })}
          aria-label="playZ — về trang chủ"
          className="flex items-center"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', gap: 10, padding: 0 }}
        >
          <PlayzMark size={collapsed ? 30 : 28} tint="#fff" />
          {!collapsed && (
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.02em' }}>
              play<span style={{ color: C.blueSoft }}>Z</span>
            </span>
          )}
        </button>

        {!collapsed && !isMobile && (
          <button
            type="button" onClick={onToggleExpanded} aria-label="Thu gọn thanh điều hướng"
            className="flex items-center justify-center"
            style={{
              width: 28, height: 28, borderRadius: radius.sm, background: 'rgba(255,255,255,.07)',
              color: C.textMuted, border: 'none', cursor: 'pointer',
            }}
          >
            <ChevronLeft size={15} strokeWidth={2.6} />
          </button>
        )}
        {isMobile && (
          <button
            type="button" onClick={onCloseMobile} aria-label="Đóng menu"
            className="flex items-center justify-center"
            style={{ width: 30, height: 30, borderRadius: radius.sm, background: 'rgba(255,255,255,.07)', color: C.text, border: 'none', cursor: 'pointer' }}
          >
            <X size={16} strokeWidth={2.6} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-none" style={{ padding: collapsed ? '10px 8px' : '10px 10px' }}>
        <div className="flex flex-col" style={{ gap: collapsed ? 2 : 3 }}>
          {PRIMARY_NAV.map((item) => (
            <NavItem key={item.id} item={item} active={activeTab} collapsed={collapsed} onClick={() => handle(item)} />
          ))}
        </div>

        <div style={{ height: 1, background: C.line, margin: '12px 4px' }} />

        <div className="flex flex-col" style={{ gap: collapsed ? 2 : 3 }}>
          {SECONDARY_NAV.map((item) => (
            <NavItem key={item.id} item={item} active={activeTab} collapsed={collapsed} onClick={() => handle(item)} />
          ))}
          {isAdmin && (
            <NavItem
              item={{ id: 'admin', label: 'Quản trị', Icon: ShieldCheck }}
              active={activeTab} collapsed={collapsed}
              onClick={() => { onShowAdmin && onShowAdmin(); if (isMobile) onCloseMobile && onCloseMobile(); }}
            />
          )}
        </div>
      </nav>

      {/* Legal footer — only meaningful once there is room for it. */}
      {!collapsed && (
        <div className="shrink-0" style={{ padding: '12px 16px', borderTop: `1px solid ${C.line}` }}>
          <p style={{ fontSize: 10, color: C.textFaint, lineHeight: 1.6 }}>
            playZ · thelac.dpdns.org<br />
            Nội dung do bên thứ ba cung cấp.
          </p>
        </div>
      )}
    </>
  );

  // --- mobile drawer --------------------------------------------------------
  if (isMobile) {
    if (!expanded) return null;
    return (
      <>
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(3px)',
            zIndex: z.drawer - 1, animation: reduced ? 'none' : 'playzFadeIn 180ms ease both',
          }}
        />
        <aside
          aria-label="Điều hướng chính"
          className="flex flex-col"
          style={{
            position: 'fixed', top: 0, bottom: 0, left: 0,
            width: Math.min(280, window.innerWidth * 0.84),
            background: C.bg, borderRight: `1px solid ${C.line}`, zIndex: z.drawer,
            animation: reduced ? 'none' : 'playzDrawerIn 260ms ' + motion.ease + ' both',
          }}
        >
          {body}
        </aside>
      </>
    );
  }

  // --- desktop rail ---------------------------------------------------------
  return (
    <>
      {/* Page backdrop when expanded, so focus stays on navigation. */}
      {expanded && (
        <div
          onClick={onToggleExpanded}
          aria-hidden="true"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(2px)',
            zIndex: z.sidebarOverlay, animation: reduced ? 'none' : 'playzFadeIn 200ms ease both',
          }}
        />
      )}
      <aside
        aria-label="Điều hướng chính"
        className="flex flex-col shrink-0"
        style={{
          width, background: C.bg, borderRight: `1px solid ${C.line}`,
          zIndex: z.sidebar, position: 'relative',
          transition: reduced ? 'none' : `width ${motion.base}ms ${motion.ease}`,
          overflow: 'hidden',
        }}
      >
        {body}
      </aside>
    </>
  );
}

/** Hamburger used by the header in both layouts. */
export function MenuButton({ onClick, expanded, label }) {
  return (
    <button
      type="button" onClick={onClick} aria-label={label || 'Mở rộng thanh điều hướng'}
      aria-expanded={expanded}
      className="flex items-center justify-center shrink-0"
      style={{
        width: 38, height: 38, borderRadius: radius.md, background: 'transparent',
        color: C.text, border: 'none', cursor: 'pointer',
      }}
    >
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
        <path d="M3 6h18M3 12h18M3 18h18" />
      </svg>
    </button>
  );
}
