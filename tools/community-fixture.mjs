// ============================================================================
// COMMUNITY — feed, likes and live chat
// ----------------------------------------------------------------------------
// Stands in for the D1-backed endpoints the Community page talks to:
//
//   /api/community/feed   GET   posts + like counts
//   /api/community/like   POST  toggle a like
//   /api/comments         GET/POST  (posts and replies share this pipeline)
//   /api/party/join|say|feed|leave   the live chat room
//
// Everything is in memory and resets when the fixture restarts. Posts start with
// a handful of seeded entries so the feed is not empty on first load — an empty
// feed tells you nothing about whether the layout works.
//
// Deliberately lives in the fixture rather than the Worker: production keeps its
// real moderation queue, rate limits and XP accounting.
// ============================================================================

const SEED_POSTS = [
  {
    name: 'Minh Tuấn',
    body: 'V.League tối nay căng thật, phút 89 mới gỡ hoà. Ai xem chung không?',
    minutesAgo: 12,
  },
  {
    name: 'Hà Linh',
    body: 'Vừa xem xong tập mới, phần hình ảnh đẹp hơn hẳn mùa trước. Có bác nào đang theo dõi không?',
    minutesAgo: 48,
  },
  {
    name: 'Quốc Bảo',
    body: 'Bảng xếp hạng Ngoại hạng Anh giờ nhìn khó đoán thật, top 4 cách nhau có 3 điểm.',
    minutesAgo: 130,
  },
  {
    name: 'Thảo Vy',
    body: 'Cảm ơn đội ngũ, hôm nay xem trên TV mượt hơn mọi khi, không thấy giật nữa.',
    minutesAgo: 300,
  },
  {
    name: 'Đức Anh',
    body: 'Có ai biết kênh nào chiếu giải bóng rổ NBA không? Mình tìm trong danh sách chưa thấy.',
    minutesAgo: 640,
  },
];

const SEED_CHAT = [
  { name: 'Hoàng Nam', text: 'Chào mọi người, phòng chat hôm nay đông ghê 👋', minutesAgo: 9 },
  { name: 'Lan Anh', text: 'Hi cả nhà!', minutesAgo: 8 },
  { name: 'Hoàng Nam', text: 'Trận tối nay bắt đầu lúc 8h đúng không nhỉ?', minutesAgo: 6 },
  { name: 'Tuấn Kiệt', text: 'Đúng rồi, 20h00. Mình đang đợi đây', minutesAgo: 5 },
  { name: 'Lan Anh', text: 'Ai dự đoán tỉ số không? Mình đoán 2-1 🎯', minutesAgo: 3 },
  { name: 'Tuấn Kiệt', text: 'Mình đoán 3-2, hai đội phong độ đang cao', minutesAgo: 1 },
];

export function createCommunity() {
  // Hardcoded avatars would be a lie: there is no avatar host reachable here, so
  // these are the same generated tiles the rest of the fixture uses.
  const avatarFor = (name) => `/img/w185/a${Math.abs(hashStr(name)).toString(36)}.png`;

  let nextId = 1000;
  const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

  const posts = SEED_POSTS.map((p) => ({
    id: (nextId += 1),
    user_id: 100 + (nextId % 900),
    name: p.name,
    body: p.body,
    created_at: new Date(Date.now() - p.minutesAgo * 60000).toISOString().replace('T', ' ').slice(0, 19),
  }));

  // Seeded chat history, oldest first so the room looks lived-in on open.
  const messages = [];
  let nextMsgId = 1;
  for (const c of [...SEED_CHAT].sort((a, b) => b.minutesAgo - a.minutesAgo)) {
    messages.push({
      id: nextMsgId++,
      room: 'community',
      from_name: c.name,
      kind: 'chat',
      text: c.text,
      created_at: new Date(Date.now() - c.minutesAgo * 60000).toISOString().replace('T', ' ').slice(0, 19),
    });
  }

  const likes = new Map();   // post id -> Set(user key)
  const myLikes = new Set(); // fixture has one implicit "me"
  // Seed a few likes so the counts are not all zero.
  for (const p of posts) {
    const n = (p.id * 7) % 23;
    likes.set(p.id, new Set(Array.from({ length: n }, (_, i) => `seed${i}`)));
  }

  const members = new Map();
  for (const c of SEED_CHAT) members.set(c.name, Date.now());

  const feed = () => {
    const out = {};
    const mine = [];
    for (const p of posts) {
      out[`community:${p.id}`] = likes.get(p.id)?.size || 0;
      if (myLikes.has(p.id)) mine.push(`community:${p.id}`);
    }
    return { success: true, posts, likes: out, mine };
  };

  return {
    avatarFor,
    feed,

    /** POST /api/community/like */
    like(body) {
      const id = Math.floor(Number(body?.id) || 0);
      if (!id) return { error: 'Thiếu id', status: 400 };
      const set = likes.get(id) || new Set();
      likes.set(id, set);
      const liked = !myLikes.has(id);
      if (liked) { myLikes.add(id); set.add('me'); } else { myLikes.delete(id); set.delete('me'); }
      return { success: true, liked, count: set.size };
    },

    /** GET /api/comments?target=… */
    listComments(target) {
      // Posts all live under the reserved 'community' target, matching how the
      // worker stores them. A reply thread would carry its own target; the
      // fixture does not need to model that to exercise the feed.
      if (target !== 'community') return { success: true, comments: [] };
      return { success: true, comments: posts.slice(0, 100) };
    },

    /** POST /api/comments */
    addComment(body, name = 'Bạn xem') {
      const text = String(body?.body || '').trim();
      if (!text) return { error: 'Thiếu nội dung', status: 400 };
      const post = {
        id: (nextId += 1),
        user_id: 1,
        name,
        body: text.slice(0, 500),
        created_at: now(),
      };
      posts.unshift(post);
      likes.set(post.id, new Set());
      return { success: true, id: post.id, post };
    },

    /** DELETE /api/comments */
    removeComment(id) {
      const i = posts.findIndex((p) => p.id === Number(id));
      if (i >= 0) posts.splice(i, 1);
      return { success: true };
    },

    // ---- live chat ----------------------------------------------------------
    join(body) {
      const { room, name } = body || {};
      if (!room || !name) return { error: 'Thiếu room/name', status: 400 };
      members.set(name, Date.now());
      messages.push({
        id: nextMsgId++, room, from_name: name, kind: 'join',
        text: `${name} đã vào phòng`, created_at: now(),
      });
      return { success: true };
    },

    say(body) {
      const { room, name, text } = body || {};
      if (!room || !name || !text) return { error: 'Thiếu room/name/text', status: 400 };
      members.set(name, Date.now());
      messages.push({
        id: nextMsgId++, room, from_name: name, kind: 'chat',
        text: String(text).slice(0, 300), created_at: now(),
      });
      return { success: true };
    },

    react(body) {
      const { room, name, emoji } = body || {};
      if (!room || !emoji) return { error: 'Thiếu room/emoji', status: 400 };
      messages.push({
        id: nextMsgId++, room, from_name: name || 'Khách', kind: 'reaction',
        text: String(emoji).slice(0, 8), created_at: now(),
      });
      return { success: true };
    },

    heartbeat(body) {
      const { name } = body || {};
      if (name) members.set(name, Date.now());
      return { success: true };
    },

    leave(body) {
      const { room, name } = body || {};
      if (name) members.delete(name);
      if (room && name) {
        messages.push({
          id: nextMsgId++, room, from_name: name, kind: 'leave',
          text: `${name} đã rời phòng`, created_at: now(),
        });
      }
      return { success: true };
    },

    /** GET /api/party/feed — messages after a cursor, plus who is around. */
    chatFeed(room, after) {
      // Presence window mirrors the worker's 45s activity cutoff.
      const cutoff = Date.now() - 45000;
      const active = [...members.entries()]
        .filter(([, ts]) => ts > cutoff)
        .map(([name]) => ({ name }));
      // Keep the seeded names visible rather than an empty room: a fixture with
      // nobody online would make the presence list look broken.
      if (active.length === 0) {
        for (const c of SEED_CHAT) active.push({ name: c.name });
      }
      return {
        success: true,
        messages: messages.filter((m) => m.room === room && m.id > Number(after || 0)),
        state: null,
        members: active,
      };
    },
  };
}

function hashStr(s) {
  let h = 2166136261;
  for (const ch of String(s)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
