// Shorts fixture — in-memory vertical feed for development.
//
// Why this exists: Shorts is the one surface that cannot be faked with text.
// The player measures the real video element to decide the frame size, picks
// HLS or plain <video> from the URL, and falls back through /api/proxy on a
// blocked source. A list of dummy objects would exercise none of that, so the
// fixture serves five actual clips from tools/fixture-media/ (about 30 KB
// each) and mutates its counters in memory the way D1 would.
//
// Nothing here is product content and nothing here is ever deployed.

const CLIPS = [
  { file: 's1', title: 'Night Drive', caption: 'Đường phố sau mưa, đèn neon trôi ngược.', views: 18400, likes: 1240 },
  { file: 's2', title: 'Sunset Loop', caption: 'Mặt trời lặn sau khán đài hiệp hai.', views: 9310, likes: 733 },
  { file: 's3', title: 'Cold Front', caption: 'Không khí lạnh tràn về, sân đấu trắng xoá.', views: 26800, likes: 2050 },
  { file: 's4', title: 'Gold Hour', caption: 'Bàn thắng vàng ở phút 89.', views: 44200, likes: 3910 },
  { file: 's5', title: 'Red Line', caption: 'Cuộc đua quyết định ngôi đầu bảng.', views: 6180, likes: 512 },
];

const CREATORS = [
  { handle: 'playZ', display_name: 'playZ', bio: 'Kênh chính thức của playZ.', verified: true, followers: 128400 },
  { handle: 'mienTay', display_name: 'Miền Tây Sports', bio: 'Bóng đá miền sông nước.', verified: true, followers: 38200 },
  { handle: 'muaBui', display_name: 'Mưa Bụi', bio: 'Quay đời thường bằng điện thoại.', verified: false, followers: 9410 },
  { handle: 'sauCanNha', display_name: 'Sau Cần Nhà', bio: 'Talkshow bóng bàn.', verified: false, followers: 2130 },
];

export function createShorts() {
  const base = CLIPS.map((c, i) => ({
    id: i + 1,
    video_url: `/media/${c.file}.mp4`,
    thumb_url: `/media/${c.file}.png`,
    title: c.title,
    caption: c.caption,
    author: CREATORS[i % CREATORS.length].display_name,
    views: c.views,
    likes: c.likes,
    width: 540,
    height: 960,
    duration: 5,
    created_at: new Date(Date.now() - i * 7 * 3600e3).toISOString(),
    // The card reads follow state off the embedded creator, and it keeps its
    // own optimistic copy after a tap — so the nested object has to carry the
    // same fields the standalone creator endpoint returns.
    creator: {
      id: i + 1,
      handle: CREATORS[i % CREATORS.length].handle,
      display_name: CREATORS[i % CREATORS.length].display_name,
      bio: CREATORS[i % CREATORS.length].bio,
      verified: CREATORS[i % CREATORS.length].verified,
      followers: CREATORS[i % CREATORS.length].followers,
      is_following: false,
      avatar_url: `/img/w185/lc${i + 1}.png`,
      shorts_count: 1 + (i % 3),
    },
  }));

  const state = {
    shorts: base,
    // creator_id -> followed
    following: new Map(),
    // Creator profiles created at runtime through POST /creator/profile.
    profiles: new Map(),
    stars: 0,
    spentXp: 0,
  };

  const withFollow = (short) => ({
    ...short,
    creator: { ...short.creator, is_following: !!state.following.get(short.creator.id) },
  });

  const list = () => state.shorts.map(withFollow);

  const creators = () =>
    CREATORS.map((c, i) => ({
      id: i + 1,
      ...c,
      avatar_url: `/img/w185/lc${i + 1}.png`,
      shorts_count: state.shorts.filter((s) => s.creator.id === i + 1).length || 1,
      is_following: !!state.following.get(i + 1),
    }));

  const findCreator = (rawId, rawHandle) => {
    const id = Number(rawId);
    if (id) return creators().find((c) => c.id === id) || null;
    const handle = String(rawHandle || '').replace(/^@/, '').toLowerCase();
    if (handle) return creators().find((c) => c.handle.toLowerCase() === handle) || null;
    return null;
  };

  const creatorProfile = (rawId, rawHandle) => {
    const creator = findCreator(rawId, rawHandle);
    if (!creator) return { success: false, error: 'Không tìm thấy creator', code: 'NOT_FOUND' };
    return {
      success: true,
      creator,
      shorts: list().filter((s) => s.creator.id === creator.id),
    };
  };

  return {
    list,
    creators,
    creatorProfile,

    react({ id, action }) {
      const short = state.shorts.find((s) => String(s.id) === String(id));
      if (!short) return { success: false, error: 'Không tìm thấy short', code: 'NOT_FOUND' };
      if (action === 'like') short.likes += 1;
      else if (action === 'view') short.views += 1;
      return { success: true, likes: short.likes, views: short.views };
    },

    star({ stars = 1 }) {
      const n = Math.max(1, Math.min(50, Number(stars) || 1));
      state.stars += n;
      state.spentXp += n * 10;
      return { success: true, stars: n, total_stars: state.stars, spent_xp: state.spentXp };
    },

    follow({ creator_id }) {
      const id = Number(creator_id);
      const creator = creators().find((c) => c.id === id);
      if (!creator) return { success: false, error: 'Không tìm thấy creator', code: 'NOT_FOUND' };
      const next = !state.following.get(id);
      state.following.set(id, next);
      const followers = creator.followers + (next ? 1 : 0);
      // Keep the embedded copy consistent, otherwise the next render reads the
      // old count back out of the short and the tap looks like it did nothing.
      state.shorts.forEach((s) => {
        if (s.creator.id === id) {
          s.creator.followers = followers;
          s.creator.is_following = next;
        }
      });
      return { success: true, is_following: next, followers };
    },

    upload(form) {
      if (!form?.video_url) return { success: false, error: 'Thiếu link video', status: 400 };
      const id = Math.max(...state.shorts.map((s) => s.id)) + 1;
      const creator = creators()[0];
      state.shorts.unshift({
        id,
        video_url: form.video_url,
        thumb_url: form.thumb_url || '',
        title: form.title || 'Không tiêu đề',
        caption: form.caption || '',
        author: creator.display_name,
        views: 0,
        likes: 0,
        duration: Number(form.duration) || 0,
        created_at: new Date().toISOString(),
        creator: { ...creator, is_following: false },
      });
      return { success: true, id };
    },

    saveProfile(form) {
      const handle = String(form?.handle || '').replace(/^@/, '').trim();
      if (handle.length < 3) return { success: false, error: 'Handle cần ≥3 ký tự', status: 400 };
      if (!form?.display_name) return { success: false, error: 'Thiếu tên hiển thị', status: 400 };
      const profile = { id: 99, handle, display_name: form.display_name, bio: form.bio || '', verified: false, followers: 0 };
      state.profiles.set(handle, profile);
      return { success: true, profile };
    },

    myProfile() {
      const profile = [...state.profiles.values()][0];
      return profile ? { success: true, profile } : { success: false, code: 'NO_PROFILE' };
    },
  };
}
