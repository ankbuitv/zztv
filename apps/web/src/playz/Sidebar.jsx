/**
 * playZ — application sidebar
 * ============================================================================
 * Two real states rather than an icon rail plus a hover popout:
 *
 *   collapsed  80px  — icon above a compact label
 *   expanded  248px  — full labels; a backdrop dims the page beneath
 *
 * NAVIGATION IS DELIBERATELY SHORT.
 * An earlier pass had ten items (seven content surfaces plus settings, about
 * and contact) and it read as a wall of links. The list is now five primary
 * surfaces plus two utility entries, with about/contact demoted to small text
 * at the bottom. EPG is not a top-level destination any more: it lives inside
 * the TV page as a schedule panel beside the player, which is where it is
 * actually useful and removes a redundant way to reach the same data.
 *
 * There is no logo here. The mark belongs in the header, which is always
 * visible; repeating it in the rail competed with the navigation for attention.
 */
import React, { useEffect } from 'react';
import {
  Home, Tv, Film, Trophy, PlaySquare, Users, Settings, ShieldCheck, ChevronLeft, X,
} from 'lucide-react';
import { color as C, motion, radius, layout, z, prefersReducedMotion } from './tokens';

// Content surfaces. Five entries, ordered by how often they are opened.
export const PRIMARY_NAV = [
  { id: 'channels', label: 'Trang chủ', Icon: Home },
  { id: 'tv', label: 'Truyền hình', Icon: Tv },
  { id: 'movies', label: 'Phim & TV Shows', Icon: Film },
  { id: 'sports', label: 'Thể thao', Icon: Trophy },
  { id: 'shorts', label: 'Shorts', Icon: PlaySquare },
];

// Utility surfaces — quieter, separated from content.
export const SECONDARY_NAV = [
  { id: 'community', label: 'Cộng đồng', Icon: Users },
  { id: 'settings', label: 'Cài đặt', Icon: Settings, action: 'settings' },
];

// Tertiary: plain text links at the very bottom. These do not deserve an icon
// or a row of their own, but they must stay reachable.
const TERTIARY = [
  { id: 'about', label: 'Giới thiệu' },
  { id: 'contact', label: 'Liên hệ' },
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
        height: collapsed ? 56 : 42,
        flexDirection: collapsed ? 'column' : 'row',
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '0 4px' : '0 13px',
        gap: collapsed ? 4 : 12,
        borderRadius: radius.md,
        background: on ? 'rgba(47,107,255,.14)' : hover ? 'rgba(255,255,255,.06)' : 'transparent',
        color: on ? '#fff' : hover ? C.text : C.textMuted,
        border: 'none',
        cursor: 'pointer',
        transition: prefersReducedMotion() ? 'none' : motion.t(motion.fast, motion.ease, 'background,color'),
      }}
    >
      {/* Active indicator — the only place the brand colour appears in nav. */}
      {on && (
        <span aria-hidden="true" style={{
          position: 'absolute', left: 0, top: collapsed ? '18%' : '22%', bottom: collapsed ? '18%' : '22%',
          width: 3, borderRadius: radius.pill, background: C.blue,
        }} />
      )}
      <Icon size={collapsed ? 19 : 18} strokeWidth={on ? 2.6 : 2.1} style={{ flexShrink: 0 }} />
      <span
        style={{
          fontSize: collapsed ? 9.5 : 13,
          fontWeight: on ? 800 : 600,
          lineHeight: 1.15,
          textAlign: collapsed ? 'center' : 'left',
          whiteSpace: collapsed ? 'normal' : 'nowrap',
          overflow: 'hidden',
        }}
      >
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
    if (item.action) onOpenInfo && onOpenInfo(item.action);
    else onNavigate && onNavigate(item.id);
    if (isMobile) onCloseMobile && onCloseMobile();
  };

  const body = (
    <>
      {/* Collapse / close control. No branding here — see the note at the top. */}
      <div
        className="flex items-center shrink-0"
        style={{
          height: 52,
          padding: collapsed ? '0 10px' : '0 14px',
          justifyContent: collapsed ? 'center' : 'flex-end',
        }}
      >
        {isMobile ? (
          <button
            type="button" onClick={onCloseMobile} aria-label="Đóng menu"
            className="flex items-center justify-center"
            style={{ width: 32, height: 32, borderRadius: radius.sm, background: 'rgba(255,255,255,.07)', color: C.text, border: 'none', cursor: 'pointer' }}
          >
            <X size={16} strokeWidth={2.6} />
          </button>
        ) : (
          <button
            type="button" onClick={onToggleExpanded}
            aria-label={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
            aria-expanded={expanded}
            className="flex items-center justify-center"
            style={{
              width: 30, height: 30, borderRadius: radius.sm,
              background: 'rgba(255,255,255,.06)', color: C.textMuted,
              border: 'none', cursor: 'pointer',
              transform: collapsed ? 'rotate(180deg)' : 'none',
              transition: reduced ? 'none' : 'transform 240ms ' + motion.ease,
            }}
          >
            <ChevronLeft size={16} strokeWidth={2.6} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-none" style={{ padding: collapsed ? '4px 8px' : '4px 10px' }}>
        <div className="flex flex-col" style={{ gap: collapsed ? 2 : 3 }}>
          {PRIMARY_NAV.map((item) => (
            <NavItem key={item.id} item={item} active={activeTab} collapsed={collapsed} onClick={() => handle(item)} />
          ))}
        </div>

        <div style={{ height: 1, background: C.line, margin: '12px 6px' }} />

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

      {/* Footer: tertiary text links, only when there is room for them. */}
      {!collapsed && (
        <div className="shrink-0" style={{ padding: '12px 16px 14px', borderTop: `1px solid ${C.line}` }}>
          <div className="flex items-center" style={{ gap: 14, marginBottom: 8 }}>
            {TERTIARY.map((t) => (
              <button
                key={t.id} type="button"
                onClick={() => { onOpenInfo && onOpenInfo(t.id); if (isMobile) onCloseMobile && onCloseMobile(); }}
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontSize: 11.5, fontWeight: 600, color: C.textMuted,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 10, color: C.textFaint, lineHeight: 1.55 }}>
            playZ · thelac.dpdns.org
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
            width: Math.min(272, window.innerWidth * 0.82),
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
