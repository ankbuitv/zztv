/**
 * playZ — content rails
 * ============================================================================
 * Two families:
 *   <Rail>       standard poster/landscape row
 *   <Top10Rail>  the signature ranking row — oversized outlined numerals with
 *                the poster layered over them, which is the one place in the
 *                product where typography is allowed to be loud
 *
 * Both scroll horizontally with transform-free native overflow, so wheel,
 * trackpad and touch all work without custom gesture code. Arrow buttons are
 * progressive enhancement and are hidden from assistive tech, since the rail is
 * already keyboard- and screen-reader-scrollable.
 */
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Play, Plus, Check, Star } from 'lucide-react';
import { color as C, motion, radius, shadow, prefersReducedMotion } from './tokens';
import { Badge, LiveDot, Skeleton } from './ui';

// ---------------------------------------------------------------------------
// Poster / landscape art with a graceful fallback.
// A missing poster must not leave a broken-image glyph or a silent black box.
// ---------------------------------------------------------------------------
function Art({ src, alt, ratio, radiusR = radius.md }) {
  const [state, setState] = useState('load');
  return (
    <div style={{
      aspectRatio: String(ratio), borderRadius: radiusR, overflow: 'hidden',
      background: '#15151B', position: 'relative', width: '100%',
    }}>
      {state === 'load' && <Skeleton h="100%" r={radiusR} />}
      {state !== 'error' && src && (
        <img
          src={src} alt={alt} loading="lazy" decoding="async"
          onLoad={() => setState('ok')} onError={() => setState('error')}
          style={{
            width: '100%', height: '100%', objectFit: 'cover', display: 'block',
            opacity: state === 'ok' ? 1 : 0, transition: 'opacity 300ms ease',
          }}
        />
      )}
      {state === 'error' && (
        <div className="flex items-center justify-center" style={{ position: 'absolute', inset: 0, color: C.textFaint }}>
          <span style={{ fontSize: 10.5 }}>Không có ảnh</span>
        </div>
      )}
    </div>
  );
}

function RailArrow({ dir, onClick, disabled, visible }) {
  const [hover, setHover] = useState(false);
  const Icon = dir === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} tabIndex={-1} aria-hidden="true"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        position: 'absolute', [dir]: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 5,
        width: 42, height: 42, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(10,10,14,.88)', border: `1px solid ${C.lineStrong}`, color: '#fff',
        cursor: disabled ? 'default' : 'pointer',
        opacity: !visible || disabled ? 0 : hover ? 1 : 0.92,
        pointerEvents: disabled ? 'none' : 'auto',
        boxShadow: shadow.card, transition: prefersReducedMotion() ? 'none' : 'opacity 180ms ease',
      }}
    >
      <Icon size={20} strokeWidth={2.6} />
    </button>
  );
}

/** Shared horizontal scroller used by both rail types. */
function Scroller({ children, gap = 12, itemWidth }) {
  const ref = useRef(null);
  const [hover, setHover] = useState(false);
  const [at, setAt] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setAt({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', measure); ro.disconnect(); };
  }, [measure, children]);

  const step = () => {
    const el = ref.current;
    if (!el) return 0;
    return Math.max(itemWidth ? itemWidth * 2 : 0, el.clientWidth * 0.82);
  };

  const scrollBy = (dir) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -step() : step(), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
    >
      <div
        ref={ref}
        className="scrollbar-none"
        style={{
          display: 'flex', gap, overflowX: 'auto', overflowY: 'visible',
          scrollSnapType: 'x proximity', paddingBottom: 6, paddingTop: 6,
        }}
      >
        {children}
      </div>
      {!at.start && <RailArrow dir="left" onClick={() => scrollBy('left')} visible={hover} />}
      {!at.end && <RailArrow dir="right" onClick={() => scrollBy('right')} visible={hover} />}
    </div>
  );
}

function SectionHead({ title, subtitle, action, actionLabel = 'Xem tất cả' }) {
  return (
    <div className="flex items-end justify-between" style={{ marginBottom: 12, paddingRight: 4 }}>
      <div>
        <h2 style={{ fontSize: 17.5, fontWeight: 800, color: C.text, letterSpacing: '-.015em', lineHeight: 1.25 }}>
          {title}
        </h2>
        {subtitle && <p style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>{subtitle}</p>}
      </div>
      {action && (
        <button
          type="button" onClick={action}
          style={{ background: 'none', border: 'none', color: C.blueSoft, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
        >
          {actionLabel} →
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MediaCard — the standard cinematic tile.
// Hover lifts the card and reveals metadata; nothing animates while scrolling.
// ---------------------------------------------------------------------------
export function MediaCard({ item, onOpen, width = 190, ratio = 2 / 3, showMeta = true }) {
  const [hover, setHover] = useState(false);
  const title = item.title || item.name || item.original_title || 'Không rõ';
  const year = (item.release_date || item.first_air_date || '').slice(0, 4);
  const rating = item.vote_average;
  const isLive = item.__type === 'channel';

  return (
    <button
      type="button"
      onClick={() => onOpen && onOpen(item)}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)} onBlur={() => setHover(false)}
      aria-label={title}
      style={{
        width, flexShrink: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
        textAlign: 'left', scrollSnapAlign: 'start',
        transform: hover ? 'translateY(-6px)' : 'none',
        transition: prefersReducedMotion() ? 'none' : motion.t(motion.fast, motion.easeOut),
      }}
    >
      <div style={{ position: 'relative', borderRadius: radius.md, boxShadow: hover ? shadow.cardHover : shadow.card, transition: 'box-shadow 200ms ease' }}>
        <Art src={item.__image || item.poster || item.logo} alt={title} ratio={ratio} />

        {/* Live badge for channels */}
        {isLive && (
          <div style={{ position: 'absolute', top: 8, left: 8 }}>
            <Badge tone="red"><LiveDot showLabel={false} size={6} />LIVE</Badge>
          </div>
        )}

        {/* Rating */}
        {!isLive && rating > 0 && (
          <div style={{ position: 'absolute', top: 8, right: 8 }}>
            <Badge tone="dark" icon={Star}>{Number(rating).toFixed(1)}</Badge>
          </div>
        )}

        {/* Hover affordance */}
        {hover && (
          <div
            className="flex items-center justify-center"
            style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,.34)',
              borderRadius: radius.md, animation: prefersReducedMotion() ? 'none' : 'playzFadeIn 160ms ease both',
            }}
          >
            <span className="flex items-center justify-center" style={{
              width: 44, height: 44, borderRadius: '50%', background: C.blue, color: '#fff',
              boxShadow: shadow.glowBlue,
            }}>
              <Play size={19} fill="#fff" strokeWidth={0} style={{ marginLeft: 2 }} />
            </span>
          </div>
        )}
      </div>

      {showMeta && (
        <div style={{ marginTop: 8 }}>
          <p style={{
            fontSize: 12.5, fontWeight: 700, color: C.text, lineHeight: 1.35,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{title}</p>
          <p style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>
            {[year, item.__sub].filter(Boolean).join(' · ')}
          </p>
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Rail
// ---------------------------------------------------------------------------
export default function Rail({
  title, subtitle, items = [], onOpen, onSeeAll, loading = false,
  ratio = 2 / 3, cardWidth = 190, emptyText = 'Chưa có nội dung.',
}) {
  if (!loading && items.length === 0) {
    return (
      <section style={{ marginBottom: 34 }}>
        <SectionHead title={title} subtitle={subtitle} action={onSeeAll} />
        <p style={{ fontSize: 12.5, color: C.textMuted, padding: '10px 2px' }}>{emptyText}</p>
      </section>
    );
  }

  return (
    <section style={{ marginBottom: 34 }}>
      <SectionHead title={title} subtitle={subtitle} action={onSeeAll} />
      <Scroller gap={14} itemWidth={cardWidth}>
        {loading
          ? Array.from({ length: 7 }).map((_, i) => (
            <div key={i} style={{ width: cardWidth, flexShrink: 0 }}>
              <Skeleton h={0} style={{ aspectRatio: String(ratio), height: 'auto' }} r={radius.md} />
              <Skeleton w="72%" h={12} style={{ marginTop: 9 }} />
              <Skeleton w="42%" h={10} style={{ marginTop: 6 }} />
            </div>
          ))
          : items.map((item, i) => (
            <MediaCard
              key={item.id || item.channel_id || item.__key || i}
              item={item} onOpen={onOpen} width={cardWidth} ratio={ratio}
            />
          ))}
      </Scroller>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Top 10 — the signature ranking rail
//
// The numeral is rendered as a stroked text element sized to the poster height,
// so it stays crisp at any zoom and costs one glyph rather than an image. The
// poster overlaps it, which creates the layered depth that makes the row read
// as a ranking rather than a strip of posters.
// ---------------------------------------------------------------------------
export function Top10Rail({ title = 'Top 10 tuần này', subtitle, items = [], onOpen, onSeeAll, loading }) {
  return (
    <section style={{ marginBottom: 34 }}>
      <SectionHead title={title} subtitle={subtitle} action={onSeeAll} />
      {!loading && items.length === 0 ? (
        <p style={{ fontSize: 12.5, color: C.textMuted, padding: '10px 2px' }}>Chưa có dữ liệu xếp hạng.</p>
      ) : (
        <Scroller gap={8} itemWidth={238}>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ width: 238, flexShrink: 0, display: 'flex', gap: 0 }}>
                <Skeleton w={78} h={225} r={radius.sm} />
                <Skeleton w={150} h={225} r={radius.md} style={{ marginLeft: -22 }} />
              </div>
            ))
            : items.slice(0, 10).map((item, i) => <Top10Card key={item.id || i} item={item} rank={i + 1} onOpen={onOpen} />)}
        </Scroller>
      )}
    </section>
  );
}

function Top10Card({ item, rank, onOpen }) {
  const [hover, setHover] = useState(false);
  const title = item.title || item.name || '';

  return (
    <button
      type="button" onClick={() => onOpen && onOpen(item)}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)} onBlur={() => setHover(false)}
      aria-label={`Hạng ${rank}: ${title}`}
      style={{
        width: 238, flexShrink: 0, display: 'flex', alignItems: 'flex-end',
        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
        scrollSnapAlign: 'start',
        transform: hover ? 'translateY(-4px)' : 'none',
        transition: prefersReducedMotion() ? 'none' : motion.t(motion.fast, motion.easeOut),
      }}
    >
      {/* Outlined numeral */}
      <span
        aria-hidden="true"
        style={{
          fontSize: 200, fontWeight: 900, lineHeight: 0.72, letterSpacing: '-.09em',
          color: 'transparent',
          WebkitTextStroke: `2.5px ${hover ? C.blueSoft : '#3A3A46'}`,
          transition: prefersReducedMotion() ? 'none' : 'all 200ms ease',
          userSelect: 'none', marginRight: -26, marginBottom: -6, flexShrink: 0,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {rank}
      </span>

      {/* Poster layered in front of the numeral */}
      <div style={{
        width: 150, position: 'relative', zIndex: 2,
        borderRadius: radius.md, overflow: 'hidden',
        boxShadow: hover ? shadow.cardHover : shadow.card,
        transition: 'box-shadow 200ms ease',
      }}>
        <Art src={item.__image || item.poster} alt={title} ratio={2 / 3} />
      </div>
    </button>
  );
}

export { Art, SectionHead, Scroller };
