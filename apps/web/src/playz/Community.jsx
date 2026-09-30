/**
 * playZ — Community
 * ============================================================================
 * Three things on one page:
 *
 *   1. Feed      — posts, likes, replies. Additive: posts are stored in the
 *                  existing `comments` table under a reserved target, so they
 *                  inherit the moderation queue, rate limits, XP and delete
 *                  paths that already exist. The only new state is the like
 *                  table. No second, weaker content pipeline was introduced.
 *
 *   2. Live chat — a real room backed by D1, polled every few seconds. This
 *                  reuses the watch-party transport the product already runs on
 *                  rather than inventing a WebSocket path: the worker is built
 *                  for D1 + polling, and a parallel realtime stack would be a
 *                  second thing to operate for no user-visible gain.
 *
 *   3. The legacy blocks (public profile, top fans, predictions) are kept
 *      verbatim below. Nothing that existed before was removed.
 *
 * The chat is deliberately a room, not a global broadcast: on a page reached
 * from every device, a single firehose is unreadable, and moderation has no
 * scope to act on.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Users, Heart, MessageCircle, Send, Smile, Flag, Trophy, Eye, EyeOff, Save,
  Zap, Target, RefreshCw, Radio,
} from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE } from '../services/config';
import { authHeaders } from '../services/session';
import { getMyProfile, saveMyProfile, fetchTopFans, fetchPredict } from '../services/social';
import ShareButtons, { buildDeepLink } from '../components/ShareButtons';
import { color as C, radius, motion, prefersReducedMotion } from './tokens';
import { Button, EmptyState, Skeleton, IconButton } from './ui';

// Community posts live under this reserved target so they share the existing
// comment pipeline — moderation, rate limiting and XP all apply unchanged.
const FEED_TARGET = 'community';
const CHAT_ROOM = 'community';
const CHAT_POLL_MS = 3500;

const EMOJI = ['👏', '🔥', '😂', '😮', '❤️', '🎯'];

const timeAgo = (ts) => {
  if (!ts) return '';
  // D1 hands back 'YYYY-MM-DD HH:MM:SS' in UTC, without a zone marker.
  const iso = /Z|[+-]\d\d:?\d\d$/.test(ts) ? ts : `${String(ts).replace(' ', 'T')}Z`;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return 'vừa xong';
  if (secs < 3600) return `${Math.floor(secs / 60)} phút`;
  if (secs < 86400) return `${Math.floor(secs / 3600)} giờ`;
  if (secs < 2592000) return `${Math.floor(secs / 86400)} ngày`;
  return new Date(then).toLocaleDateString('vi-VN');
};

function Avatar({ name, size = 34 }) {
  const [err, setErr] = useState(false);
  const initial = String(name || '?').trim().slice(0, 1).toUpperCase();
  // Deterministic hue per name — the same person always gets the same colour.
  let h = 0;
  for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(size * 0.4), fontWeight: 800, color: '#fff',
        background: `linear-gradient(135deg, hsl(${h} 62% 48%), hsl(${(h + 48) % 360} 58% 34%))`,
      }}
    >
      {initial}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------
function Post({ post, likes, liked, canPost, onLike, onRequireLogin, onReport }) {
  const [hover, setHover] = useState(false);
  return (
    <article
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        padding: 14, borderRadius: radius.lg,
        background: hover ? C.cardHover : C.card,
        border: `1px solid ${C.line}`,
        transition: prefersReducedMotion() ? 'none' : motion.t(motion.fast, motion.easeOut),
      }}
    >
      <header className="flex items-center" style={{ gap: 10, marginBottom: 9 }}>
        <Avatar name={post.name} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {post.name || 'Thành viên'}
          </p>
          <p style={{ fontSize: 10.5, color: C.textFaint }}>{timeAgo(post.created_at)}</p>
        </div>
        <IconButton
          icon={Flag} label="Báo cáo bài viết" size={30} iconSize={13}
          onClick={() => (canPost ? onReport(post) : onRequireLogin())}
          style={{ color: C.textFaint }}
        />
      </header>

      <p style={{ fontSize: 13.5, lineHeight: 1.55, color: C.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {post.body}
      </p>

      <footer className="flex items-center" style={{ gap: 6, marginTop: 11 }}>
        <button
          type="button"
          onClick={() => (canPost ? onLike(post) : onRequireLogin())}
          aria-pressed={liked}
          className="flex items-center"
          style={{
            gap: 6, padding: '5px 10px', borderRadius: radius.pill, cursor: 'pointer',
            background: liked ? 'rgba(255,59,71,.14)' : 'rgba(255,255,255,.05)',
            border: `1px solid ${liked ? 'rgba(255,59,71,.36)' : C.line}`,
            color: liked ? C.red : C.textMuted, fontSize: 11.5, fontWeight: 700,
            transition: prefersReducedMotion() ? 'none' : motion.t(motion.fast),
          }}
        >
          <Heart size={13} fill={liked ? C.red : 'none'} strokeWidth={liked ? 0 : 2.2} />
          {likes > 0 ? likes : ''}
        </button>
      </footer>
    </article>
  );
}

function Composer({ onPost, disabled, placeholder }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    const ok = await onPost(body);
    if (ok) setText('');
    setBusy(false);
  };

  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: radius.lg, padding: 12 }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 500))}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
        disabled={disabled}
        rows={3}
        placeholder={placeholder}
        aria-label="Viết bài"
        style={{
          width: '100%', resize: 'vertical', background: 'rgba(255,255,255,.04)',
          border: `1px solid ${C.line}`, borderRadius: radius.md, padding: 10,
          color: C.text, fontSize: 13, lineHeight: 1.5, outline: 'none',
        }}
      />
      <div className="flex items-center" style={{ gap: 8, marginTop: 9 }}>
        <span style={{ fontSize: 11, color: C.textFaint }}>{text.length}/500</span>
        <Button
          variant="primary" size="sm" onClick={submit}
          disabled={disabled || busy || !text.trim()}
          style={{ marginLeft: 'auto' }}
        >
          {busy ? 'Đang gửi…' : 'Đăng bài'}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live chat
// ---------------------------------------------------------------------------
function LiveChat({ name, canChat, onRequireLogin }) {
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [draft, setDraft] = useState('');
  const [connected, setConnected] = useState(false);
  const cursor = useRef(0);
  const listRef = useRef(null);
  const atBottom = useRef(true);

  const poll = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/party/feed?room=${encodeURIComponent(CHAT_ROOM)}&after=${cursor.current}`);
      if (!r.ok) { setConnected(false); return; }
      const d = await r.json();
      setConnected(true);
      setMembers(Array.isArray(d.members) ? d.members : []);
      const incoming = Array.isArray(d.messages) ? d.messages : [];
      if (incoming.length) {
        cursor.current = Math.max(cursor.current, ...incoming.map((m) => Number(m.id) || 0));
        setMessages((prev) => [...prev, ...incoming].slice(-200));
      }
    } catch {
      // A dropped poll is not worth surfacing: the next tick usually succeeds
      // and an error banner that flickers is worse than the missing tick.
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, CHAT_POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  // Only auto-scroll when the reader is already at the bottom. Yanking the view
  // down while somebody is reading back through the room is the classic way to
  // make a chat feel hostile.
  useEffect(() => {
    const el = listRef.current;
    if (!el || !atBottom.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onScroll = (e) => {
    const el = e.currentTarget;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  const send = async (text) => {
    const body = String(text || '').trim();
    if (!body || !canChat) return;
    setDraft('');
    try {
      await fetch(`${API_BASE}/api/party/say`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ room: CHAT_ROOM, name, text: body.slice(0, 300) }),
      });
      poll();
    } catch { /* the message simply does not appear; the room stays usable */ }
  };

  const sendReaction = async (emoji) => {
    if (!canChat) return;
    try {
      await fetch(`${API_BASE}/api/party/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ room: CHAT_ROOM, name, emoji }),
      });
      poll();
    } catch { /* ignore */ }
  };

  return (
    <div
      className="flex flex-col"
      style={{ background: C.bgElevated, border: `1px solid ${C.line}`, borderRadius: radius.lg, overflow: 'hidden', height: 'min(66vh, 600px)' }}
    >
      <header className="flex items-center" style={{ gap: 8, padding: '12px 14px', borderBottom: `1px solid ${C.line}` }}>
        <Radio size={15} style={{ color: C.red }} />
        <h3 style={{ fontSize: 13.5, fontWeight: 800, color: C.text }}>Trò chuyện trực tiếp</h3>
        <span className="flex items-center" style={{ gap: 5, marginLeft: 'auto' }}>
          <span
            style={{
              width: 6, height: 6, borderRadius: '50%',
              background: connected ? '#3FCF6B' : C.textFaint,
              animation: connected && !prefersReducedMotion() ? 'playzLive 2.4s ease-in-out infinite' : 'none',
            }}
          />
          <span style={{ fontSize: 10.5, color: C.textMuted }}>
            {connected ? `${members.length} người` : 'đang kết nối…'}
          </span>
        </span>
      </header>

      {/* Who is around, as a single readable line rather than a column of names. */}
      {members.length > 0 && (
        <div className="scrollbar-none" style={{ padding: '8px 14px', borderBottom: `1px solid ${C.line}`, overflowX: 'auto', whiteSpace: 'nowrap' }}>
          {members.slice(0, 14).map((m) => (
            <span
              key={m.name}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, marginRight: 10,
                fontSize: 11, color: C.textMuted,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#3FCF6B' }} />
              {m.name}
            </span>
          ))}
        </div>
      )}

      <div
        ref={listRef} onScroll={onScroll}
        className="flex flex-col scrollbar-thin"
        style={{ flex: 1, overflowY: 'auto', padding: 12, gap: 8 }}
      >
        {messages.length === 0 && (
          <EmptyState compact icon={MessageCircle} title="Chưa có tin nhắn" description="Là người mở đầu câu chuyện." />
        )}
        {messages.map((m) => {
          if (m.kind === 'reaction') {
            return (
              <p key={m.id} style={{ fontSize: 12, color: C.textMuted, textAlign: 'center' }}>
                <span style={{ fontSize: 15 }}>{m.text}</span>
              </p>
            );
          }
          if (m.kind === 'join' || m.kind === 'leave') {
            return (
              <p key={m.id} style={{ fontSize: 11, color: C.textFaint, textAlign: 'center' }}>{m.text}</p>
            );
          }
          const mine = m.from_name === name;
          return (
            <div key={m.id} className="flex" style={{ gap: 8, flexDirection: mine ? 'row-reverse' : 'row' }}>
              <Avatar name={m.from_name} size={26} />
              <div style={{ maxWidth: '78%' }}>
                {!mine && <p style={{ fontSize: 10.5, color: C.textFaint, marginBottom: 2 }}>{m.from_name}</p>}
                <p
                  style={{
                    padding: '7px 11px', borderRadius: radius.md, fontSize: 12.5, lineHeight: 1.5,
                    background: mine ? C.blue : 'rgba(255,255,255,.07)',
                    color: '#fff', wordBreak: 'break-word',
                  }}
                >
                  {m.text}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {canChat ? (
        <div style={{ borderTop: `1px solid ${C.line}`, padding: 10 }}>
          <div className="flex items-center" style={{ gap: 4, marginBottom: 8 }}>
            <Smile size={13} style={{ color: C.textFaint, flexShrink: 0 }} />
            {EMOJI.map((e) => (
              <button
                key={e} type="button" onClick={() => sendReaction(e)}
                aria-label={`Thả ${e}`}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 15, lineHeight: 1, padding: 2, borderRadius: radius.xs,
                }}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="flex items-center" style={{ gap: 8 }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 300))}
              onKeyDown={(e) => { if (e.key === 'Enter') send(draft); }}
              placeholder="Nhập tin nhắn…"
              aria-label="Tin nhắn"
              style={{
                flex: 1, minWidth: 0, height: 36, padding: '0 12px',
                background: 'rgba(255,255,255,.06)', border: `1px solid ${C.line}`,
                borderRadius: radius.md, color: C.text, fontSize: 12.5, outline: 'none',
              }}
            />
            <IconButton icon={Send} label="Gửi" size={36} iconSize={15} onClick={() => send(draft)} />
          </div>
        </div>
      ) : (
        <div style={{ borderTop: `1px solid ${C.line}`, padding: 12 }}>
          <Button variant="subtle" size="sm" onClick={onRequireLogin} style={{ width: '100%' }}>
            Đăng nhập để trò chuyện
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function PlayzCommunity({ onRequireLogin }) {
  const { t } = useI18n();
  const { addToast } = useToast();
  const { isAuthenticated, user } = useAuth();

  const [posts, setPosts] = useState([]);
  const [likes, setLikes] = useState({});
  const [mine, setMine] = useState(() => new Set());
  const [feedLoading, setFeedLoading] = useState(true);

  // Legacy blocks, kept.
  const [prof, setProf] = useState({ handle: '', bio: '', avatar_url: '', is_public: 0 });
  const [fans, setFans] = useState([]);
  const [board, setBoard] = useState([]);
  const [saving, setSaving] = useState(false);

  const displayName = useMemo(() => {
    if (!isAuthenticated || !user) return 'Khách';
    return user.display_name || user.username || 'Thành viên';
  }, [isAuthenticated, user]);

  // --- feed ----------------------------------------------------------------
  const loadFeed = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/community/feed`, { headers: authHeaders() });
      const d = await r.json();
      if (!d?.success) throw new Error('feed');
      setPosts(Array.isArray(d.posts) ? d.posts : []);
      setLikes(d.likes || {});
      setMine(new Set(Array.isArray(d.mine) ? d.mine : []));
    } catch {
      setPosts([]);
    } finally {
      setFeedLoading(false);
    }
  }, []);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  const requireLogin = () => onRequireLogin && onRequireLogin(t('fan.need_login'));

  const onPost = async (body) => {
    if (!isAuthenticated) { requireLogin(); return false; }
    try {
      const r = await fetch(`${API_BASE}/api/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ target: FEED_TARGET, body }),
      });
      const d = await r.json();
      if (!r.ok || !d?.success) throw new Error(d?.error || 'post');
      await loadFeed();
      addToast('Đã đăng bài', 'success');
      return true;
    } catch (e) {
      addToast(e.message === 'RATE_LIMITED' ? 'Bạn đăng hơi nhanh — thử lại sau.' : 'Không đăng được bài.', 'error');
      return false;
    }
  };

  const onLike = async (post) => {
    // Optimistic: a like that waits for the network feels broken.
    const key = `community:${post.id}`;
    const wasLiked = mine.has(key);
    setMine((prev) => {
      const next = new Set(prev);
      if (wasLiked) next.delete(key); else next.add(key);
      return next;
    });
    setLikes((prev) => ({ ...prev, [key]: Math.max(0, (prev[key] || 0) + (wasLiked ? -1 : 1)) }));
    try {
      const r = await fetch(`${API_BASE}/api/community/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ id: post.id }),
      });
      const d = await r.json();
      if (d?.success) {
        setLikes((prev) => ({ ...prev, [key]: d.count }));
        setMine((prev) => {
          const next = new Set(prev);
          if (d.liked) next.add(key); else next.delete(key);
          return next;
        });
      }
    } catch {
      // Roll back to what the server last told us rather than leaving a lie in
      // the counts.
      await loadFeed();
    }
  };

  const onReport = async (post) => {
    if (!isAuthenticated) { requireLogin(); return; }
    try {
      // Reports go through the comment pipeline under a reserved target so they
      // land in the same moderation queue the operators already read.
      await fetch(`${API_BASE}/api/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ target: `report:${post.id}`, body: `Báo cáo bài viết #${post.id}` }),
      });
      addToast('Đã gửi báo cáo — cảm ơn bạn.', 'success');
    } catch {
      addToast('Không gửi được báo cáo.', 'error');
    }
  };

  // --- legacy blocks -------------------------------------------------------
  useEffect(() => {
    fetchTopFans().then(setFans).catch(() => {});
    fetchPredict('').then((d) => setBoard(d.board || [])).catch(() => {});
    if (isAuthenticated) {
      getMyProfile()
        .then((p) => { if (p) setProf({ handle: p.handle || '', bio: p.bio || '', avatar_url: p.avatar_url || '', is_public: p.is_public ? 1 : 0 }); })
        .catch(() => {});
    }
  }, [isAuthenticated]);

  const save = async () => {
    if (!isAuthenticated) { requireLogin(); return; }
    setSaving(true);
    try {
      await saveMyProfile(prof);
      addToast(t('community.saved'), 'success');
    } catch (e) {
      addToast(e.message || t('community.save_fail'), 'error');
    } finally { setSaving(false); }
  };

  const myFan = fans.find((f) => user && f.user_id === user.id);
  const myRank = myFan ? fans.indexOf(myFan) + 1 : 0;
  const pubLink = prof.handle ? buildDeepLink({ u: prof.handle }) : '';

  const inputStyle = {
    width: '100%', marginTop: 4, padding: '9px 11px',
    background: 'rgba(255,255,255,.04)', border: `1px solid ${C.line}`,
    borderRadius: radius.md, color: C.text, fontSize: 12.5, outline: 'none',
  };

  return (
    <div style={{ padding: '0 clamp(14px,2.6vw,40px) 40px', maxWidth: 1560, margin: '0 auto' }}>
      <div className="flex items-center flex-wrap" style={{ gap: 10, marginTop: 16, marginBottom: 16 }}>
        <Users size={21} style={{ color: C.blueSoft }} />
        <h1 style={{ fontSize: 21, fontWeight: 900, color: C.text, letterSpacing: '-.01em' }}>{t('community.title')}</h1>
        <span style={{ fontSize: 12, color: C.textMuted }}>{t('community.sub')}</span>
        <IconButton
          icon={RefreshCw} label="Tải lại" size={32} iconSize={14}
          onClick={() => { setFeedLoading(true); loadFeed(); }}
          style={{ marginLeft: 'auto', color: C.textMuted }}
        />
      </div>

      <div className="playz-split playz-split--aside" style={{ gap: 18, marginBottom: 26 }}>
        {/* Feed */}
        <div className="playz-aside">
          <Composer
            onPost={onPost}
            disabled={!isAuthenticated}
            placeholder={isAuthenticated ? `Chia sẻ với cộng đồng, ${displayName}…` : 'Đăng nhập để đăng bài — bạn vẫn đọc được mọi bài viết.'}
          />
          <div className="flex flex-col" style={{ gap: 12, marginTop: 14 }}>
            {feedLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={132} r={radius.lg} />)
            ) : posts.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title="Chưa có bài viết nào"
                description="Cộng đồng đang im ắng. Bài viết đầu tiên sẽ hiện ở đây."
              />
            ) : (
              posts.map((p) => (
                <Post
                  key={p.id}
                  post={p}
                  likes={likes[`community:${p.id}`] || 0}
                  liked={mine.has(`community:${p.id}`)}
                  canPost={isAuthenticated}
                  onLike={onLike}
                  onReport={onReport}
                  onRequireLogin={requireLogin}
                />
              ))
            )}
          </div>
        </div>

        {/* Live chat */}
        <div className="playz-aside">
          <LiveChat name={displayName} canChat={isAuthenticated} onRequireLogin={requireLogin} />
        </div>
      </div>

      {/* ---- legacy blocks, unchanged in behaviour ---- */}
      <div className="grid lg:grid-cols-2" style={{ gap: 18, marginBottom: 22 }}>
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: radius.lg, padding: 16 }}>
          <h2 style={{ fontSize: 14.5, fontWeight: 800, color: C.text, marginBottom: 3 }}>🌟 {t('community.profile')}</h2>
          <p style={{ fontSize: 11.5, color: C.textMuted, marginBottom: 12 }}>{t('community.profile_sub')}</p>
          {!isAuthenticated ? (
            <Button variant="primary" size="sm" onClick={requireLogin} style={{ width: '100%' }}>{t('nav.login')}</Button>
          ) : (
            <div className="flex flex-col" style={{ gap: 10 }}>
              <label style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', color: C.textMuted, textTransform: 'uppercase' }}>
                @{t('community.handle')}
                <input
                  value={prof.handle}
                  onChange={(e) => setProf({ ...prof, handle: e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20) })}
                  placeholder="vd: fan_vtv3" style={inputStyle}
                />
              </label>
              <label style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', color: C.textMuted, textTransform: 'uppercase' }}>
                {t('community.bio')}
                <input
                  value={prof.bio} onChange={(e) => setProf({ ...prof, bio: e.target.value.slice(0, 200) })}
                  placeholder={t('community.bio_ph')} style={inputStyle}
                />
              </label>
              <label style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', color: C.textMuted, textTransform: 'uppercase' }}>
                {t('community.avatar')}
                <input
                  value={prof.avatar_url} onChange={(e) => setProf({ ...prof, avatar_url: e.target.value.slice(0, 300) })}
                  placeholder="https://..." style={inputStyle}
                />
              </label>
              <button
                type="button" onClick={() => setProf({ ...prof, is_public: prof.is_public ? 0 : 1 })}
                className="flex items-center" aria-pressed={!!prof.is_public}
                style={{
                  gap: 9, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontSize: 12, fontWeight: 700, color: C.text,
                }}
              >
                <span style={{ width: 38, height: 22, borderRadius: radius.pill, position: 'relative', background: prof.is_public ? '#2F6BFF' : 'rgba(255,255,255,.12)', transition: prefersReducedMotion() ? 'none' : 'background 180ms' }}>
                  <span style={{ position: 'absolute', top: 2, left: prof.is_public ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: prefersReducedMotion() ? 'none' : 'left 180ms' }} />
                </span>
                {prof.is_public ? <Eye size={15} style={{ color: C.blueSoft }} /> : <EyeOff size={15} style={{ color: C.textFaint }} />}
                {t('community.public')}
              </button>
              <Button variant="primary" size="sm" onClick={save} disabled={saving}>
                <Save size={14} />{t('community.save')}
              </Button>
              {prof.handle && prof.is_public ? (
                <div style={{ background: 'rgba(0,0,0,.3)', border: `1px solid ${C.line}`, borderRadius: radius.md, padding: 10 }}>
                  <p style={{ fontSize: 10.5, color: C.textMuted, marginBottom: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pubLink}</p>
                  <ShareButtons url={pubLink} title={`@${prof.handle} — playZ`} compact />
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: radius.lg, padding: 16 }}>
          <h2 style={{ fontSize: 14.5, fontWeight: 800, color: C.text, marginBottom: 3 }}>🏆 {t('community.topfans')}</h2>
          <p style={{ fontSize: 11.5, color: C.textMuted, marginBottom: 12 }}>{t('community.topfans_sub')}</p>
          {myFan && (
            <div className="flex items-center" style={{ gap: 9, background: 'rgba(47,107,255,.12)', border: '1px solid rgba(47,107,255,.4)', borderRadius: radius.md, padding: '8px 11px', marginBottom: 8 }}>
              <span style={{ fontSize: 11.5, fontWeight: 900, color: C.blueSoft }}>#{myRank}</span>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{myFan.name || user?.username}</span>
              <span className="flex items-center" style={{ gap: 4, fontSize: 12, fontWeight: 900, color: C.yellow }}><Zap size={13} />{myFan.xp}</span>
            </div>
          )}
          <div className="flex flex-col scrollbar-thin" style={{ gap: 5, maxHeight: 360, overflowY: 'auto' }}>
            {fans.length === 0 && <EmptyState compact icon={Trophy} title={t('sports.no_data')} />}
            {fans.map((f, i) => (
              <div key={f.user_id} className="flex items-center" style={{ gap: 9, background: 'rgba(255,255,255,.03)', border: `1px solid ${C.line}`, borderRadius: radius.md, padding: '7px 10px' }}>
                <span style={{
                  width: 24, height: 24, borderRadius: radius.sm, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11.5, fontWeight: 900, flexShrink: 0,
                  background: i === 0 ? 'rgba(255,197,61,.18)' : 'rgba(255,255,255,.07)',
                  color: i === 0 ? C.yellow : (i < 3 ? C.text : C.textFaint),
                }}>
                  {i + 1}
                </span>
                <Avatar name={f.name || `Fan #${f.user_id}`} size={24} />
                <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name || `Fan #${f.user_id}`}
                </span>
                <span className="flex items-center" style={{ gap: 4, fontSize: 12, fontWeight: 900, color: C.yellow, fontVariantNumeric: 'tabular-nums' }}>
                  <Zap size={13} />{f.xp}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {board.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: radius.lg, padding: 16 }}>
          <h2 className="flex items-center" style={{ gap: 8, fontSize: 14.5, fontWeight: 800, color: C.text, marginBottom: 12 }}>
            <Target size={15} style={{ color: C.blueSoft }} />🔮 {t('match.board')}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 8 }}>
            {board.slice(0, 8).map((r, i) => (
              <div key={i} className="flex items-center" style={{ gap: 8, background: 'rgba(255,255,255,.03)', border: `1px solid ${C.line}`, borderRadius: radius.md, padding: '8px 10px' }}>
                <Trophy size={14} style={{ color: i === 0 ? C.yellow : C.textFaint, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name || '?'}</span>
                <span style={{ fontSize: 12, fontWeight: 900, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{r.pts}đ</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
