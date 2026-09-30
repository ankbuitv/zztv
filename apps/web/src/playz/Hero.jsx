/**
 * playZ — cinematic hero
 * ============================================================================
 * Occupies the first viewport and crossfades between slides every 7 seconds.
 *
 * Behaviour decisions worth stating:
 *   - rotation PAUSES on hover and on keyboard focus. Nothing is more annoying
 *     than a slide changing while you are reading it or aiming at a button.
 *   - rotation also pauses when the tab is hidden, so returning to the tab does
 *     not land on a slide that changed while nobody was watching.
 *   - the zoom (Ken Burns) is 1.0 → 1.06 over 9s. Anything faster reads as
 *     instability on a large TV panel.
 *   - the poster is used as a backdrop when there is no wide artwork, rather
 *     than showing an empty gradient.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Plus, Check, Info, Star, Volume2, VolumeX } from 'lucide-react';
import { color as C, gradient, motion, radius, shadow, prefersReducedMotion } from './tokens';
import { Badge, Button, Skeleton } from './ui';

const ROTATE_MS = 7000;
const FADE_MS = 900;

export default function Hero({ items = [], loading, onPlay, onOpenDetail, onToggleWatchlist, isInWatchlist }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const timer = useRef(null);
  const reduced = prefersReducedMotion();

  const count = items.length;
  const go = useCallback((i) => setIndex(((i % count) + count) % count), [count]);

  // Reset when the data set changes — otherwise a stale index can point past
  // the end of a shorter list after a refresh.
  useEffect(() => { if (index >= count) setIndex(0); }, [count, index]);

  useEffect(() => {
    if (paused || reduced || count < 2) return undefined;
    const tick = () => {
      if (document.hidden) return;
      setIndex((i) => (i + 1) % count);
    };
    timer.current = setInterval(tick, ROTATE_MS);
    return () => clearInterval(timer.current);
  }, [paused, reduced, count]);

  if (loading) {
    return (
      <section style={{ position: 'relative', height: 'min(78vh, 700px)', minHeight: 440 }}>
        <Skeleton h="100%" r={0} />
        <div style={{ position: 'absolute', left: 48, bottom: 92, width: 460, maxWidth: '46vw' }}>
          <Skeleton w="62%" h={38} r={radius.sm} />
          <Skeleton w="90%" h={13} style={{ marginTop: 18 }} />
          <Skeleton w="74%" h={13} style={{ marginTop: 8 }} />
          <Skeleton w={210} h={46} r={radius.md} style={{ marginTop: 26 }} />
        </div>
      </section>
    );
  }

  if (count === 0) {
    return (
      <section
        className="flex flex-col items-center justify-center text-center"
        style={{ height: 'min(62vh, 520px)', minHeight: 380, padding: 24 }}
      >
        <Info size={30} style={{ color: C.textFaint, marginBottom: 14 }} strokeWidth={1.6} />
        <h1 style={{ fontSize: 19, fontWeight: 800, color: C.text }}>Chưa tải được nội dung nổi bật</h1>
        <p style={{ fontSize: 13, color: C.textMuted, marginTop: 8, maxWidth: 420, lineHeight: 1.65 }}>
          Không kết nối được tới kho phim. Kiểm tra kết nối mạng hoặc thử lại sau ít phút —
          phần Truyền hình vẫn xem được bình thường.
        </p>
      </section>
    );
  }

  const item = items[Math.min(index, count - 1)];
  const title = item.title || item.name || item.original_title || '';
  const year = (item.release_date || item.first_air_date || '').slice(0, 4);
  const backdrop = item.__backdrop;
  const poster = item.__image;
  const inList = isInWatchlist ? isInWatchlist(item) : false;

  return (
    <section
      aria-roledescription="carousel" aria-label="Nội dung nổi bật"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      style={{
        position: 'relative', height: 'min(78vh, 700px)', minHeight: 440,
        overflow: 'hidden', background: C.bg,
      }}
    >
      {/* Backdrop stack — all slides stay mounted so the crossfade has no gap */}
      {items.map((it, i) => {
        const src = it.__backdrop || it.__image;
        const active = i === index;
        return (
          <div
            key={it.id || i}
            aria-hidden={!active}
            style={{
              position: 'absolute', inset: 0,
              opacity: active ? 1 : 0,
              transition: reduced ? 'none' : `opacity ${FADE_MS}ms ${motion.ease}`,
              zIndex: active ? 1 : 0,
            }}
          >
            {src && (
              <img
                src={src} alt="" aria-hidden="true"
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : 'auto'}
                decoding="async"
                style={{
                  width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                  // Ken Burns: only the active slide drifts.
                  transform: active && !reduced ? 'scale(1.06)' : 'scale(1)',
                  transition: reduced ? 'none' : 'transform 9000ms linear',
                }}
              />
            )}
          </div>
        );
      })}

      {/* Scrims: bottom fades into the page, left guarantees text contrast.
          Without the left scrim, white text over bright artwork fails contrast. */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: gradient.heroScrim, zIndex: 2 }} />
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, background: gradient.heroSide, zIndex: 2,
        width: '72%',
      }} />

      {/* Copy block */}
      <div
        key={title}
        style={{
          position: 'absolute', left: 'clamp(20px,4.2vw,64px)', bottom: 'clamp(40px,8vh,96px)',
          right: 'clamp(20px,4.2vw,64px)', maxWidth: 620, zIndex: 3,
          animation: reduced ? 'none' : 'playzSlideUp 520ms ' + motion.easeOut + ' both',
        }}
      >
        {/* Badges — one row, each colour carrying its own meaning */}
        <div className="flex items-center flex-wrap" style={{ gap: 8, marginBottom: 15 }}>
          <Badge tone="orange">{item.__kind === 'tv' ? 'TV SHOW' : 'PHIM'}</Badge>
          {year && <Badge tone="neutral">{year}</Badge>}
          {item.__age && <Badge tone="yellow">{item.__age}</Badge>}
          {item.__duration && <Badge tone="neutral">{item.__duration}</Badge>}
          {item.vote_average > 0 && (
            <span className="inline-flex items-center" style={{ gap: 4 }}>
              <Star size={13} fill={C.yellow} strokeWidth={0} />
              <span style={{ fontSize: 12.5, fontWeight: 800, color: C.text }}>
                {Number(item.vote_average).toFixed(1)}
              </span>
            </span>
          )}
        </div>

        <h1 style={{
          fontSize: 'clamp(30px,3.6vw,54px)', fontWeight: 900, lineHeight: 1.04,
          letterSpacing: '-.03em', color: '#fff', marginBottom: 14,
          textShadow: '0 2px 24px rgba(0,0,0,.5)',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {title}
        </h1>

        {item.overview && (
          <p style={{
            fontSize: 'clamp(13px,1.05vw,14.5px)', lineHeight: 1.65, color: 'rgba(255,255,255,.80)',
            marginBottom: 24, maxWidth: 540,
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {item.overview}
          </p>
        )}

        <div className="flex items-center flex-wrap" style={{ gap: 11 }}>
          <Button variant="light" size="lg" icon={Play} onClick={() => onPlay && onPlay(item)}>
            Xem ngay
          </Button>
          <Button
            variant="subtle" size="lg" icon={inList ? Check : Plus}
            onClick={() => onToggleWatchlist && onToggleWatchlist(item)}
            aria-pressed={inList}
          >
            {inList ? 'Đã thêm' : 'Danh sách'}
          </Button>
          <Button variant="ghost" size="lg" icon={Info} onClick={() => onOpenDetail && onOpenDetail(item)}
            style={{ color: 'rgba(255,255,255,.8)' }}>
            Chi tiết
          </Button>
        </div>
      </div>

      {/* Pagination dots + mute toggle */}
      <div
        className="flex items-center"
        style={{
          position: 'absolute', right: 'clamp(20px,4.2vw,64px)', bottom: 'clamp(40px,8vh,96px)',
          gap: 8, zIndex: 3,
        }}
      >
        <button
          type="button" onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'Bật tiếng xem trước' : 'Tắt tiếng xem trước'}
          className="flex items-center justify-center"
          style={{
            width: 38, height: 38, borderRadius: '50%', marginRight: 6,
            background: 'rgba(0,0,0,.5)', border: `1px solid ${C.lineStrong}`,
            color: '#fff', cursor: 'pointer',
          }}
        >
          {muted ? <VolumeX size={16} strokeWidth={2.2} /> : <Volume2 size={16} strokeWidth={2.2} />}
        </button>

        {items.map((_, i) => (
          <button
            key={i} type="button" onClick={() => go(i)}
            aria-label={`Chuyển tới nội dung ${i + 1}`}
            aria-current={i === index}
            style={{
              width: i === index ? 26 : 7, height: 7, padding: 0, border: 'none',
              borderRadius: radius.pill, cursor: 'pointer',
              background: i === index ? '#fff' : 'rgba(255,255,255,.36)',
              transition: reduced ? 'none' : 'all 280ms ' + motion.ease,
            }}
          />
        ))}
      </div>
    </section>
  );
}
