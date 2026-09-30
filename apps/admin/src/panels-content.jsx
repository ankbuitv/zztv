/**
 * playZ admin — content and system panels
 * ============================================================================
 * The second half of the admin. Every one of these was badged SOON, and every
 * one of them turned out to already have endpoints behind it: homepage promos,
 * movie sources, sports clips, short moderation, chat announcements, themes,
 * ad placements, and the payment/region/maintenance settings. Nothing here
 * required a backend change either.
 *
 * The shape of a panel is always the same, and deliberately so: a table of what
 * exists, one action per row for the thing that goes wrong day to day, and a
 * create form that stays collapsed until it is wanted. Two rules held:
 *
 * - A mutation reloads the list it just changed rather than patching local state.
 *   Optimistic edits here would mean an operator looking at a row that says
 *   "hidden" while the API still says otherwise.
 * - Destructive actions are two-step. Nothing in this app deletes on one click.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { color as C, radius, api } from './api';
import {
  useApi, pick, asArray, Card, Stat, Button, Field, Pill, States, Table, Toast, fmtNum, fmtDate,
} from './ui';

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------
const inputStyle = {
  height: 32, padding: '0 9px', background: 'rgba(255,255,255,.05)',
  border: `1px solid ${C.line}`, borderRadius: radius.sm, color: C.text,
  fontSize: 12.5, outline: 'none', width: '100%', boxSizing: 'border-box',
};
const areaStyle = { ...inputStyle, height: 64, padding: 9, resize: 'vertical', font: 'inherit' };
const labelStyle = { fontSize: 11, color: C.textMuted, display: 'block', marginBottom: 4 };

/** Row of labelled inputs. Used by every create form below. */
function FormRow({ children, cols = 3 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 10 }}>
      {children}
    </div>
  );
}
function FormField({ label, children }) {
  return <label style={{ display: 'block' }}><span style={labelStyle}>{label}</span>{children}</label>;
}

/** Two-step delete. First click arms, second confirms, blur disarms. */
function DangerButton({ children, confirmLabel = 'Chắc chắn?', onConfirm, disabled }) {
  const [armed, setArmed] = useState(false);
  return (
    <Button
      variant={armed ? 'danger' : 'default'}
      disabled={disabled}
      onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}
    >
      {armed ? confirmLabel : children}
    </Button>
  );
}

/** Wraps the try/reload/toast dance so no panel repeats it. */
function useMutate(reload, toast) {
  const [busy, setBusy] = useState(false);
  return {
    busy,
    async run(path, opts, okMessage) {
      setBusy(true);
      try {
        await api(path, opts);
        await reload();
        if (okMessage) toast(okMessage, 'success');
        return true;
      } catch (e) {
        toast(e.message || 'Không thực hiện được', 'error');
        return false;
      } finally { setBusy(false); }
    },
  };
}

const activePill = (v) => (Number(v)
  ? <Pill tone="good">Đang bật</Pill>
  : <Pill>Đang tắt</Pill>);

// ---------------------------------------------------------------------------
// Homepage — hero slides and scheduled promos
// ---------------------------------------------------------------------------
const LINK_TYPES = [
  ['none', 'Không liên kết'],
  ['channel', 'Kênh truyền hình'],
  ['movie', 'Phim / TV Show'],
  ['url', 'Đường dẫn ngoài'],
  ['plans', 'Trang gói cước'],
];

export function HomepagePanel({ toast }) {
  const list = useApi('/admin/events');
  const events = asArray(pick(list.data, ['events', 'data'], []));
  const mut = useMutate(list.reload, toast);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '', subtitle: '', image_url: '', link_type: 'none',
    link_value: '', starts_at: '', ends_at: '', sort_order: 0,
  });

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const onInput = (k) => (e) => set(k)(e.target.value);

  // Sorted panels are what the consumer hero actually reads, so reordering has
  // to write real sort_order values rather than reorder an array in place.
  const reorder = (row, dir) => {
    const sorted = [...events].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const i = sorted.findIndex((r) => r.id === row.id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    const a = sorted[i], b = sorted[j];
    const sa = a.sort_order ?? i, sb = b.sort_order ?? j;
    mut.run('/admin/events', { method: 'PUT', body: { id: a.id, sort_order: sb } }, 'Đã đổi thứ tự');
    mut.run('/admin/events', { method: 'PUT', body: { id: b.id, sort_order: sa } });
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Card
        title={`Slide & khuyến mãi (${events.length})`}
        subtitle="Hero trang chủ và các banner có lịch chạy. Thứ tự ở đây là thứ tự hiển thị."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={list.reload}>Tải lại</Button>
            <Button variant="primary" onClick={() => setOpen((v) => !v)}>{open ? 'Đóng' : 'Thêm slide'}</Button>
          </div>
        }
      >
        {open && (
          <div style={{ display: 'grid', gap: 10, padding: 12, marginBottom: 12, background: 'rgba(255,255,255,.03)', border: `1px solid ${C.line}`, borderRadius: radius.md }}>
            <FormRow cols={2}>
              <FormField label="Tiêu đề"><input style={inputStyle} value={form.title} onChange={onInput('title')} placeholder="Chung kết C1 — trực tiếp" /></FormField>
              <FormField label="Phụ đề"><input style={inputStyle} value={form.subtitle} onChange={onInput('subtitle')} placeholder="22:00 hôm nay trên playZ" /></FormField>
            </FormRow>
            <FormField label="Ảnh (URL)">
              <input style={inputStyle} value={form.image_url} onChange={onInput('image_url')} placeholder="/img/w780/b1.png" />
            </FormField>
            <FormRow cols={4}>
              <FormField label="Kiểu liên kết">
                <select style={inputStyle} value={form.link_type} onChange={onInput('link_type')}>
                  {LINK_TYPES.map(([v, l]) => <option key={v} value={v} style={{ background: '#16161C' }}>{l}</option>)}
                </select>
              </FormField>
              <FormField label="Giá trị liên kết">
                <input style={inputStyle} value={form.link_value} onChange={onInput('link_value')} placeholder="VTV1 hoặc 550" />
              </FormField>
              <FormField label="Bắt đầu (YYYY-MM-DD HH:MM:SS)">
                <input style={inputStyle} value={form.starts_at} onChange={onInput('starts_at')} placeholder="2026-10-01 20:00:00" />
              </FormField>
              <FormField label="Kết thúc">
                <input style={inputStyle} value={form.ends_at} onChange={onInput('ends_at')} placeholder="2026-10-08 00:00:00" />
              </FormField>
            </FormRow>
            <p style={{ fontSize: 11, color: C.textMuted, margin: 0 }}>
              Để trống thời gian là chạy ngay và không hết hạn. Ảnh nên theo tỉ lệ 16:9 để không bị cắt trong hero.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                variant="primary"
                disabled={mut.busy || !form.title.trim()}
                onClick={async () => {
                  const ok = await mut.run('/admin/events', {
                    method: 'POST',
                    body: { ...form, sort_order: events.length },
                  }, 'Đã thêm slide');
                  if (ok) { setForm({ title: '', subtitle: '', image_url: '', link_type: 'none', link_value: '', starts_at: '', ends_at: '', sort_order: 0 }); setOpen(false); }
                }}
              >
                Lưu slide
              </Button>
              <Button onClick={() => setOpen(false)}>Huỷ</Button>
            </div>
          </div>
        )}

        <States loading={list.loading} error={list.error} empty={events.length === 0} onRetry={list.reload}
          emptyText="Chưa có slide nào — hero sẽ dùng nội dung mặc định từ danh mục phim.">
          <Table
            columns={[
              {
                key: 'image_url', label: '', width: 76,
                render: (r) => (r.image_url
                  ? <img src={r.image_url} alt="" width="64" height="36" style={{ objectFit: 'cover', borderRadius: radius.xs, background: C.cardHover }} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                  : <span style={{ display: 'inline-block', width: 64, height: 36, borderRadius: radius.xs, background: C.cardHover }} />),
              },
              {
                key: 'title', label: 'Slide',
                render: (r) => (
                  <div>
                    <div>{r.title}</div>
                    {r.subtitle && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{r.subtitle}</div>}
                  </div>
                ),
              },
              {
                key: 'link', label: 'Liên kết', width: 150, muted: true,
                render: (r) => (r.link_type && r.link_type !== 'none' ? `${r.link_type}: ${r.link_value || '—'}` : '—'),
              },
              {
                key: 'window', label: 'Lịch chạy', width: 180, muted: true,
                render: (r) => (r.starts_at || r.ends_at
                  ? <span style={{ fontSize: 11 }}>{r.starts_at ? fmtDate(r.starts_at) : '—'} → {r.ends_at ? fmtDate(r.ends_at) : 'mở'}</span>
                  : <span style={{ fontSize: 11 }}>Luôn chạy</span>),
              },
              { key: 'is_active', label: 'Trạng thái', width: 100, render: (r) => activePill(r.is_active) },
              {
                key: 'order', label: 'Thứ tự', width: 96,
                render: (r) => (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Button disabled={mut.busy} onClick={() => reorder(r, -1)}>↑</Button>
                    <Button disabled={mut.busy} onClick={() => reorder(r, +1)}>↓</Button>
                  </div>
                ),
              },
              {
                key: 'act', label: '', width: 168, align: 'right',
                render: (r) => (
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <Button disabled={mut.busy} onClick={() => mut.run('/admin/events', { method: 'PUT', body: { id: r.id, is_active: Number(r.is_active) ? 0 : 1 } }, 'Đã cập nhật')}>
                      {Number(r.is_active) ? 'Tắt' : 'Bật'}
                    </Button>
                    <DangerButton disabled={mut.busy} onConfirm={() => mut.run('/admin/events', { method: 'DELETE', body: { id: r.id } }, 'Đã xoá slide')}>Xoá</DangerButton>
                  </div>
                ),
              },
            ]}
            rows={events}
            rowKey={(r) => r.id}
          />
        </States>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Movies / TV sources
// ---------------------------------------------------------------------------
export function MoviesPanel({ toast }) {
  const list = useApi('/admin/movie_sources');
  const sources = asArray(pick(list.data, ['sources'], []));
  const builtins = asArray(pick(list.data, ['builtin_sources'], []));
  const allowlist = asArray(pick(list.data, ['frame_allowlist'], []));
  const builtinsOn = !!pick(list.data, ['builtin_enabled'], false);
  const mut = useMutate(list.reload, toast);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', kind: 'iframe', url_template: '', label: '', license_note: '' });
  const onInput = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 14 }}>
        <Stat label="Nguồn tự thêm" value={fmtNum(sources.length)} />
        <Stat label="Nguồn dựng sẵn" value={builtinsOn ? `Bật (${builtins.length})` : 'Tắt'} tone={builtinsOn ? 'good' : 'default'} />
        <Stat label="Tên miền nhúng cho phép" value={allowlist.length ? `${allowlist.length}` : 'Chưa giới hạn'} tone={allowlist.length ? 'good' : 'warn'} />
      </div>

      <Card
        title="Nguồn phim"
        subtitle="Thứ tự quyết định nguồn nào được thử trước khi phát."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={list.reload}>Tải lại</Button>
            <Button variant="primary" onClick={() => setOpen((v) => !v)}>{open ? 'Đóng' : 'Thêm nguồn'}</Button>
          </div>
        }
      >
        {open && (
          <div style={{ display: 'grid', gap: 10, padding: 12, marginBottom: 12, background: 'rgba(255,255,255,.03)', border: `1px solid ${C.line}`, borderRadius: radius.md }}>
            <FormRow cols={3}>
              <FormField label="Tên"><input style={inputStyle} value={form.name} onChange={onInput('name')} placeholder="Nguồn dự phòng" /></FormField>
              <FormField label="Kiểu">
                <select style={inputStyle} value={form.kind} onChange={onInput('kind')}>
                  {['iframe', 'hls', 'mp4', 'api'].map((k) => <option key={k} value={k} style={{ background: '#16161C' }}>{k}</option>)}
                </select>
              </FormField>
              <FormField label="Nhãn hiển thị"><input style={inputStyle} value={form.label} onChange={onInput('label')} placeholder="Server 2" /></FormField>
            </FormRow>
            <FormField label="URL template — dùng {tmdb}, {type}, {season}, {episode}">
              <input style={inputStyle} value={form.url_template} onChange={onInput('url_template')} placeholder="https://…/embed/{type}/{tmdb}?s={season}&e={episode}" />
            </FormField>
            <FormField label="Ghi chú bản quyền"><input style={inputStyle} value={form.license_note} onChange={onInput('license_note')} placeholder="Nguồn có thoả thuận" /></FormField>
            <p style={{ fontSize: 11, color: C.textMuted, margin: 0 }}>
              Nguồn kiểu <code>iframe</code> chỉ chạy nếu tên miền của nó nằm trong danh sách nhúng cho phép của Worker.
              Thêm nguồn ngoài danh sách sẽ bị chặn ở phía máy chủ, không phải ở giao diện.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                variant="primary" disabled={mut.busy || !form.name.trim() || !form.url_template.trim()}
                onClick={async () => {
                  const ok = await mut.run('/admin/movie_sources', { method: 'POST', body: { ...form, is_active: 1, sort_order: sources.length } }, 'Đã thêm nguồn');
                  if (ok) { setForm({ name: '', kind: 'iframe', url_template: '', label: '', license_note: '' }); setOpen(false); }
                }}
              >
                Lưu nguồn
              </Button>
              <Button onClick={() => setOpen(false)}>Huỷ</Button>
            </div>
          </div>
        )}

        <States loading={list.loading} error={list.error} empty={sources.length === 0} onRetry={list.reload}
          emptyText={builtinsOn ? 'Chưa thêm nguồn riêng — đang dùng nguồn dựng sẵn.' : 'Chưa có nguồn nào. Phát phim sẽ báo lỗi cho tới khi thêm một nguồn.'}>
          <Table
            columns={[
              { key: 'name', label: 'Nguồn', render: (r) => <div>{r.name}{r.label ? <span style={{ color: C.textMuted, fontSize: 11 }}> · {r.label}</span> : null}</div> },
              { key: 'kind', label: 'Kiểu', width: 90, muted: true },
              {
                key: 'url_template', label: 'URL', muted: true,
                render: (r) => <span style={{ fontSize: 11, wordBreak: 'break-all' }}>{r.url_template}</span>,
              },
              { key: 'sort_order', label: 'Ưu tiên', width: 80, align: 'right', render: (r) => r.sort_order ?? 0 },
              { key: 'is_active', label: 'Trạng thái', width: 100, render: (r) => activePill(r.is_active) },
              {
                key: 'act', label: '', width: 168, align: 'right',
                render: (r) => (
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <Button disabled={mut.busy} onClick={() => mut.run('/admin/movie_sources', { method: 'PUT', body: { id: r.id, is_active: Number(r.is_active) ? 0 : 1 } }, 'Đã cập nhật')}>
                      {Number(r.is_active) ? 'Tắt' : 'Bật'}
                    </Button>
                    <DangerButton disabled={mut.busy} onConfirm={() => mut.run('/admin/movie_sources', { method: 'DELETE', body: { id: r.id } }, 'Đã xoá nguồn')}>Xoá</DangerButton>
                  </div>
                ),
              },
            ]}
            rows={sources}
            rowKey={(r) => r.id}
          />
        </States>
      </Card>

      {builtinsOn && builtins.length > 0 && (
        <Card title={`Nguồn dựng sẵn (${builtins.length})`} subtitle="Cấu hình sẵn trong Worker. Chỉ đọc — sửa bằng biến môi trường.">
          <Table
            columns={[
              { key: 'name', label: 'Tên', render: (r) => r.name || r.id || r.key || '—' },
              { key: 'kind', label: 'Kiểu', width: 90, muted: true, render: (r) => r.kind || '—' },
              { key: 'url_template', label: 'URL', muted: true, render: (r) => <span style={{ fontSize: 11, wordBreak: 'break-all' }}>{r.url_template || r.url || '—'}</span> },
            ]}
            rows={builtins}
            rowKey={(r, i) => r.id || r.key || i}
          />
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sports clips
// ---------------------------------------------------------------------------
export function SportsPanel({ toast }) {
  const list = useApi('/admin/sports-videos');
  const videos = asArray(pick(list.data, ['videos'], []));
  const mut = useMutate(list.reload, toast);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', league: '', video_url: '', thumb_url: '', duration: '' });
  const onInput = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Card
      title={`Clip thể thao (${videos.length})`}
      subtitle="Clip nổi bật trong trang Thể thao. Giải đấu để trống thì clip hiện ở mọi giải."
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={list.reload}>Tải lại</Button>
          <Button variant="primary" onClick={() => setOpen((v) => !v)}>{open ? 'Đóng' : 'Thêm clip'}</Button>
        </div>
      }
    >
      {open && (
        <div style={{ display: 'grid', gap: 10, padding: 12, marginBottom: 12, background: 'rgba(255,255,255,.03)', border: `1px solid ${C.line}`, borderRadius: radius.md }}>
          <FormRow cols={3}>
            <FormField label="Tiêu đề"><input style={inputStyle} value={form.title} onChange={onInput('title')} placeholder="Bàn thắng phút 90" /></FormField>
            <FormField label="Giải đấu"><input style={inputStyle} value={form.league} onChange={onInput('league')} placeholder="Ngoại hạng Anh" /></FormField>
            <FormField label="Thời lượng"><input style={inputStyle} value={form.duration} onChange={onInput('duration')} placeholder="1:24" /></FormField>
          </FormRow>
          <FormRow cols={2}>
            <FormField label="Link video"><input style={inputStyle} value={form.video_url} onChange={onInput('video_url')} placeholder="https://…/clip.mp4" /></FormField>
            <FormField label="Ảnh đại diện"><input style={inputStyle} value={form.thumb_url} onChange={onInput('thumb_url')} placeholder="https://…/thumb.jpg" /></FormField>
          </FormRow>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="primary" disabled={mut.busy || !form.title.trim() || !form.video_url.trim()}
              onClick={async () => {
                const ok = await mut.run('/admin/sports-videos', { method: 'POST', body: { ...form, is_active: 1, sort_order: videos.length } }, 'Đã thêm clip');
                if (ok) { setForm({ title: '', league: '', video_url: '', thumb_url: '', duration: '' }); setOpen(false); }
              }}
            >
              Lưu clip
            </Button>
            <Button onClick={() => setOpen(false)}>Huỷ</Button>
          </div>
        </div>
      )}

      <States loading={list.loading} error={list.error} empty={videos.length === 0} onRetry={list.reload}
        emptyText="Chưa có clip nào. Trang Thể thao vẫn chạy bình thường, chỉ thiếu mục clip nổi bật.">
        <Table
          columns={[
            {
              key: 'thumb_url', label: '', width: 76,
              render: (r) => (r.thumb_url
                ? <img src={r.thumb_url} alt="" width="64" height="36" style={{ objectFit: 'cover', borderRadius: radius.xs, background: C.cardHover }} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                : <span style={{ display: 'inline-block', width: 64, height: 36, borderRadius: radius.xs, background: C.cardHover }} />),
            },
            { key: 'title', label: 'Tiêu đề' },
            { key: 'league', label: 'Giải', width: 170, muted: true, render: (r) => r.league || 'Mọi giải' },
            { key: 'duration', label: 'Dài', width: 80, muted: true, render: (r) => r.duration || '—' },
            { key: 'is_active', label: 'Trạng thái', width: 100, render: (r) => activePill(r.is_active) },
            {
              key: 'act', label: '', width: 168, align: 'right',
              render: (r) => (
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <Button disabled={mut.busy} onClick={() => mut.run('/admin/sports-videos', { method: 'PUT', body: { id: r.id, is_active: Number(r.is_active) ? 0 : 1 } }, 'Đã cập nhật')}>
                    {Number(r.is_active) ? 'Ẩn' : 'Hiện'}
                  </Button>
                  <DangerButton disabled={mut.busy} onConfirm={() => mut.run('/admin/sports-videos', { method: 'DELETE', body: { id: r.id } }, 'Đã xoá clip')}>Xoá</DangerButton>
                </div>
              ),
            },
          ]}
          rows={videos}
          rowKey={(r) => r.id}
        />
      </States>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Shorts moderation
// ---------------------------------------------------------------------------
export function ShortsPanel({ toast }) {
  const [tab, setTab] = useState('shorts');
  const shorts = useApi('/admin/shorts', { enabled: tab === 'shorts' });
  const creators = useApi('/admin/short-creators', { enabled: tab === 'creators' });
  const mut = useMutate(async () => { await shorts.reload(); await creators.reload(); }, toast);

  const shortRows = asArray(pick(shorts.data, ['shorts'], []));
  const creatorRows = asArray(pick(creators.data, ['creators'], []));

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant={tab === 'shorts' ? 'primary' : 'default'} onClick={() => setTab('shorts')}>Video ({shortRows.length})</Button>
        <Button variant={tab === 'creators' ? 'primary' : 'default'} onClick={() => setTab('creators')}>Nhà sáng tạo ({creatorRows.length})</Button>
      </div>

      {tab === 'shorts' ? (
        <Card title="Kiểm duyệt video ngắn" subtitle="Ẩn video sẽ khiến nó biến mất khỏi feed ngay lập tức, không cần chờ bộ nhớ đệm.">
          <States loading={shorts.loading} error={shorts.error} empty={shortRows.length === 0} onRetry={shorts.reload}
            emptyText="Chưa có video ngắn nào.">
            <Table
              columns={[
                {
                  key: 'thumb_url', label: '', width: 76,
                  render: (r) => (r.thumb_url
                    ? <img src={r.thumb_url} alt="" width="64" height="36" style={{ objectFit: 'cover', borderRadius: radius.xs, background: C.cardHover }} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                    : <span style={{ display: 'inline-block', width: 64, height: 36, borderRadius: radius.xs, background: C.cardHover }} />),
                },
                {
                  key: 'title', label: 'Video',
                  render: (r) => (
                    <div>
                      <div>{r.title || `Short #${r.id}`}</div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                        {r.creator_handle ? `@${r.creator_handle}` : (r.author || 'khách')} · {fmtNum(r.views || 0)} lượt xem · {fmtNum(r.likes || 0)} thích
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'status', label: 'Trạng thái', width: 110,
                  render: (r) => (r.status === 'hidden' ? <Pill tone="warn">Đang ẩn</Pill> : <Pill tone="good">Đang hiện</Pill>),
                },
                { key: 'created_at', label: 'Đăng lúc', width: 130, muted: true, render: (r) => fmtDate(r.created_at) },
                {
                  key: 'act', label: '', width: 168, align: 'right',
                  render: (r) => (
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <Button disabled={mut.busy} onClick={() => mut.run('/admin/shorts', { method: 'PUT', body: { id: r.id, status: r.status === 'hidden' ? 'live' : 'hidden' } }, 'Đã cập nhật')}>
                        {r.status === 'hidden' ? 'Hiện' : 'Ẩn'}
                      </Button>
                      <DangerButton disabled={mut.busy} onConfirm={() => mut.run('/admin/shorts', { method: 'DELETE', body: { id: r.id } }, 'Đã xoá video')}>Xoá</DangerButton>
                    </div>
                  ),
                },
              ]}
              rows={shortRows}
              rowKey={(r) => r.id}
            />
          </States>
        </Card>
      ) : (
        <Card title="Nhà sáng tạo" subtitle="Xoá hồ sơ sẽ bỏ theo dõi và tách video khỏi hồ sơ, nhưng không xoá video.">
          <States loading={creators.loading} error={creators.error} empty={creatorRows.length === 0} onRetry={creators.reload}
            emptyText="Chưa có nhà sáng tạo nào.">
            <Table
              columns={[
                { key: 'handle', label: 'Kênh', render: (r) => <div>@{r.handle}<div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{r.display_name}</div></div> },
                { key: 'shorts_count', label: 'Video', width: 80, align: 'right', render: (r) => fmtNum(r.shorts_count || 0) },
                { key: 'followers', label: 'Theo dõi', width: 100, align: 'right', render: (r) => fmtNum(r.followers || 0) },
                {
                  key: 'verified', label: 'Xác minh', width: 110,
                  render: (r) => (Number(r.verified) ? <Pill tone="good">Đã xác minh</Pill> : <Pill>Thường</Pill>),
                },
                {
                  key: 'act', label: '', width: 210, align: 'right',
                  render: (r) => (
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <Button disabled={mut.busy} onClick={() => mut.run('/admin/short-creators', { method: 'PUT', body: { id: r.id, verified: Number(r.verified) ? 0 : 1 } }, 'Đã cập nhật')}>
                        {Number(r.verified) ? 'Bỏ tick' : 'Tick xanh'}
                      </Button>
                      <DangerButton disabled={mut.busy} onConfirm={() => mut.run('/admin/short-creators', { method: 'DELETE', body: { id: r.id } }, 'Đã xoá hồ sơ')}>Xoá</DangerButton>
                    </div>
                  ),
                },
              ]}
              rows={creatorRows}
              rowKey={(r) => r.id}
            />
          </States>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat — announcements that ride along with the live room
// ---------------------------------------------------------------------------
export function ChatPanel({ toast }) {
  const list = useApi('/admin/broadcasts');
  const rows = asArray(pick(list.data, ['broadcasts'], []));
  const mut = useMutate(list.reload, toast);
  const [msg, setMsg] = useState('');
  const [type, setType] = useState('info');
  const [minutes, setMinutes] = useState('60');

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Card title="Thông báo trong phòng chat" subtitle="Hiện cho mọi người đang mở Cộng đồng hoặc phòng xem chung. Tự hết hạn để không còn dòng cũ nằm mãi.">
        <div style={{ display: 'grid', gap: 10 }}>
          <FormField label="Nội dung">
            <textarea style={areaStyle} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Sự cố kênh VTV1 đang được xử lý, dự kiến 15 phút." />
          </FormField>
          <FormRow cols={3}>
            <FormField label="Mức độ">
              <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value)}>
                {[['info', 'Thông tin'], ['warning', 'Cảnh báo'], ['danger', 'Khẩn']].map(([v, l]) => <option key={v} value={v} style={{ background: '#16161C' }}>{l}</option>)}
              </select>
            </FormField>
            <FormField label="Hết hạn sau (phút)">
              <input style={inputStyle} value={minutes} onChange={(e) => setMinutes(e.target.value)} inputMode="numeric" />
            </FormField>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <Button
                variant="primary" disabled={mut.busy || !msg.trim()}
                onClick={async () => {
                  const ok = await mut.run('/admin/broadcast', {
                    method: 'POST',
                    body: { message: msg.trim(), type, expiresAt: Date.now() + Math.max(1, Number(minutes) || 60) * 60000 },
                  }, 'Đã gửi thông báo');
                  if (ok) setMsg('');
                }}
              >
                Gửi
              </Button>
            </div>
          </FormRow>
        </div>
      </Card>

      <Card title={`Đang hiển thị (${rows.length})`} action={<Button onClick={list.reload}>Tải lại</Button>}>
        <States loading={list.loading} error={list.error} empty={rows.length === 0} onRetry={list.reload}
          emptyText="Không có thông báo nào đang chạy.">
          <Table
            columns={[
              {
                key: 'type', label: 'Mức', width: 100,
                render: (r) => (r.type === 'danger' ? <Pill tone="bad">Khẩn</Pill> : r.type === 'warning' ? <Pill tone="warn">Cảnh báo</Pill> : <Pill tone="info">Thông tin</Pill>),
              },
              { key: 'message', label: 'Nội dung' },
              { key: 'created_at', label: 'Gửi lúc', width: 140, muted: true, render: (r) => fmtDate(r.created_at) },
              {
                key: 'expires_at', label: 'Hết hạn', width: 140, muted: true,
                render: (r) => {
                  const t = Number(r.expires_at || 0);
                  if (!t) return <span style={{ fontSize: 11 }}>Không hết hạn</span>;
                  const left = Math.round((t * (t < 1e12 ? 1000 : 1) - Date.now()) / 60000);
                  return <span style={{ fontSize: 11 }}>{left > 0 ? `còn ${left} phút` : 'đã hết hạn'}</span>;
                },
              },
              {
                key: 'act', label: '', width: 90, align: 'right',
                render: (r) => <DangerButton disabled={mut.busy} onConfirm={() => mut.run('/admin/broadcast', { method: 'DELETE', body: { id: r.id } }, 'Đã gỡ thông báo')}>Gỡ</DangerButton>,
              },
            ]}
            rows={rows}
            rowKey={(r) => r.id}
          />
        </States>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Branding — seasonal themes
// ---------------------------------------------------------------------------
const toHex = (v) => (/^#[0-9a-f]{3,8}$/i.test(String(v || '')) ? v : C.line);

export function BrandingPanel({ toast }) {
  const list = useApi('/admin/themes');
  const themes = asArray(pick(list.data, ['themes'], []));
  const mut = useMutate(list.reload, toast);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    key: '', name: '', emoji: '', description: '', primary_color: '#2F6BFF',
    secondary_color: '#08080A', accent_color: '#FF6B2C',
  });
  const onInput = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const active = themes.find((t) => Number(t.is_active));

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 14 }}>
        <Stat label="Chủ đề" value={fmtNum(themes.length)} />
        <Stat label="Đang áp dụng" value={active?.name || 'Mặc định'} tone={active ? 'good' : 'default'} />
        <Stat label="Logo" value="/brand/playz-symbol-dark.svg" hint="Biểu tượng ZZ đơn sắc — không đổi theo chủ đề" />
      </div>

      <Card
        title="Chủ đề theo mùa"
        subtitle="Chủ đề chỉ đổi màu nhấn và ảnh nền. Màu thương hiệu xanh và biểu tượng giữ nguyên để nhận diện không bị phá."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={list.reload}>Tải lại</Button>
            <Button variant="primary" onClick={() => setOpen((v) => !v)}>{open ? 'Đóng' : 'Thêm chủ đề'}</Button>
          </div>
        }
      >
        {open && (
          <div style={{ display: 'grid', gap: 10, padding: 12, marginBottom: 12, background: 'rgba(255,255,255,.03)', border: `1px solid ${C.line}`, borderRadius: radius.md }}>
            <FormRow cols={3}>
              <FormField label="Khoá"><input style={inputStyle} value={form.key} onChange={onInput('key')} placeholder="tet-2027" /></FormField>
              <FormField label="Tên"><input style={inputStyle} value={form.name} onChange={onInput('name')} placeholder="Tết 2027" /></FormField>
              <FormField label="Biểu tượng"><input style={inputStyle} value={form.emoji} onChange={onInput('emoji')} placeholder="🧧" /></FormField>
            </FormRow>
            <FormField label="Mô tả"><input style={inputStyle} value={form.description} onChange={onInput('description')} placeholder="Áp dụng từ mùng 1 đến mùng 5" /></FormField>
            <FormRow cols={3}>
              <FormField label="Màu chính"><input style={inputStyle} value={form.primary_color} onChange={onInput('primary_color')} /></FormField>
              <FormField label="Màu nền"><input style={inputStyle} value={form.secondary_color} onChange={onInput('secondary_color')} /></FormField>
              <FormField label="Màu nhấn"><input style={inputStyle} value={form.accent_color} onChange={onInput('accent_color')} /></FormField>
            </FormRow>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {[form.primary_color, form.secondary_color, form.accent_color].map((c, i) => (
                <span key={i} style={{ width: 28, height: 28, borderRadius: radius.sm, background: toHex(c), border: `1px solid ${C.lineStrong}` }} />
              ))}
              <span style={{ fontSize: 11, color: C.textMuted }}>Xem trước</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                variant="primary" disabled={mut.busy || !form.key.trim() || !form.name.trim()}
                onClick={async () => {
                  const ok = await mut.run('/admin/themes', { method: 'POST', body: { ...form, is_active: 0, sort_order: themes.length } }, 'Đã thêm chủ đề');
                  if (ok) { setOpen(false); setForm({ key: '', name: '', emoji: '', description: '', primary_color: '#2F6BFF', secondary_color: '#08080A', accent_color: '#FF6B2C' }); }
                }}
              >
                Lưu chủ đề
              </Button>
              <Button onClick={() => setOpen(false)}>Huỷ</Button>
            </div>
          </div>
        )}

        <States loading={list.loading} error={list.error} empty={themes.length === 0} onRetry={list.reload}
          emptyText="Chưa có chủ đề nào — giao diện dùng bảng màu mặc định của playZ.">
          <Table
            columns={[
              {
                key: 'name', label: 'Chủ đề',
                render: (r) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ display: 'flex' }}>
                      {[r.primary_color, r.accent_color, r.secondary_color].map((c, i) => (
                        <span key={i} style={{ width: 14, height: 22, background: toHex(c), marginLeft: i ? -3 : 0, borderRadius: i === 0 ? '4px 0 0 4px' : i === 2 ? '0 4px 4px 0' : 0, border: `1px solid ${C.lineStrong}` }} />
                      ))}
                    </span>
                    <div>
                      <div>{r.emoji ? `${r.emoji} ` : ''}{r.name}</div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{r.key}{r.description ? ` · ${r.description}` : ''}</div>
                    </div>
                  </div>
                ),
              },
              {
                key: 'window', label: 'Lịch', width: 170, muted: true,
                render: (r) => (r.starts_at || r.ends_at ? `${r.starts_at ? fmtDate(r.starts_at) : '—'} → ${r.ends_at ? fmtDate(r.ends_at) : 'mở'}` : 'Không hẹn lịch'),
              },
              { key: 'is_active', label: 'Áp dụng', width: 110, render: (r) => (Number(r.is_active) ? <Pill tone="good">Đang dùng</Pill> : <Pill>Chưa dùng</Pill>) },
              {
                key: 'act', label: '', width: 168, align: 'right',
                render: (r) => (
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <Button disabled={mut.busy || Number(r.is_active)} onClick={() => mut.run('/admin/themes', { method: 'PUT', body: { id: r.id, is_active: 1 } }, 'Đã áp dụng chủ đề')}>Áp dụng</Button>
                    <DangerButton disabled={mut.busy} onConfirm={() => mut.run('/admin/themes', { method: 'DELETE', body: { id: r.id } }, 'Đã xoá chủ đề')}>Xoá</DangerButton>
                  </div>
                ),
              },
            ]}
            rows={themes}
            rowKey={(r) => r.id || r.key}
          />
        </States>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Navigation — where promos are allowed to appear
// ---------------------------------------------------------------------------
export function NavigationPanel({ toast }) {
  const list = useApi('/admin/ads');
  const ads = asArray(pick(list.data, ['ads'], []));
  const mut = useMutate(list.reload, toast);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ slot: 'banner', title: '', image_url: '', link_url: '' });
  const onInput = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const bySlot = useMemo(() => {
    const m = new Map();
    ads.forEach((a) => { const s = a.slot || 'banner'; m.set(s, (m.get(s) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [ads]);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Card title="Vị trí đặt quảng cáo" subtitle="Mỗi vị trí là một chỗ cố định trong giao diện. Bật/tắt ở đây là tắt ở mọi thiết bị, không cần phát hành lại.">
        {bySlot.length === 0 ? (
          <p style={{ fontSize: 12.5, color: C.textMuted, margin: 0 }}>Chưa có vị trí nào đang chạy.</p>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {bySlot.map(([slot, n]) => (
              <span key={slot} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'rgba(255,255,255,.04)', border: `1px solid ${C.line}`, borderRadius: radius.pill, fontSize: 12 }}>
                <span style={{ fontFamily: 'ui-monospace, monospace' }}>{slot}</span>
                <span style={{ color: C.textMuted }}>{n}</span>
              </span>
            ))}
          </div>
        )}
      </Card>

      <Card
        title={`Quảng cáo & banner (${ads.length})`}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={list.reload}>Tải lại</Button>
            <Button variant="primary" onClick={() => setOpen((v) => !v)}>{open ? 'Đóng' : 'Thêm'}</Button>
          </div>
        }
      >
        {open && (
          <div style={{ display: 'grid', gap: 10, padding: 12, marginBottom: 12, background: 'rgba(255,255,255,.03)', border: `1px solid ${C.line}`, borderRadius: radius.md }}>
            <FormRow cols={2}>
              <FormField label="Vị trí (slot)">
                <input style={inputStyle} value={form.slot} onChange={onInput('slot')} placeholder="banner / home-top / player-preroll" />
              </FormField>
              <FormField label="Tiêu đề"><input style={inputStyle} value={form.title} onChange={onInput('title')} /></FormField>
            </FormRow>
            <FormRow cols={2}>
              <FormField label="Ảnh"><input style={inputStyle} value={form.image_url} onChange={onInput('image_url')} placeholder="/img/w780/b2.png" /></FormField>
              <FormField label="Link đích"><input style={inputStyle} value={form.link_url} onChange={onInput('link_url')} placeholder="https://…" /></FormField>
            </FormRow>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                variant="primary" disabled={mut.busy || !form.slot.trim()}
                onClick={async () => {
                  const ok = await mut.run('/admin/ads', { method: 'POST', body: { ...form, is_active: 1, sort_order: ads.length } }, 'Đã thêm');
                  if (ok) { setOpen(false); setForm({ slot: 'banner', title: '', image_url: '', link_url: '' }); }
                }}
              >
                Lưu
              </Button>
              <Button onClick={() => setOpen(false)}>Huỷ</Button>
            </div>
          </div>
        )}

        <States loading={list.loading} error={list.error} empty={ads.length === 0} onRetry={list.reload}
          emptyText="Chưa có quảng cáo nào.">
          <Table
            columns={[
              { key: 'slot', label: 'Vị trí', width: 150, render: (r) => <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{r.slot}</span> },
              {
                key: 'title', label: 'Nội dung',
                render: (r) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {r.image_url ? <img src={r.image_url} alt="" width="48" height="27" style={{ objectFit: 'cover', borderRadius: radius.xs, background: C.cardHover }} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} /> : null}
                    <span>{r.title || '—'}</span>
                  </div>
                ),
              },
              {
                key: 'window', label: 'Lịch', width: 160, muted: true,
                render: (r) => (r.starts_at || r.ends_at ? `${r.starts_at ? fmtDate(r.starts_at) : '—'} → ${r.ends_at ? fmtDate(r.ends_at) : 'mở'}` : 'Luôn chạy'),
              },
              { key: 'is_active', label: 'Trạng thái', width: 100, render: (r) => activePill(r.is_active) },
              {
                key: 'act', label: '', width: 168, align: 'right',
                render: (r) => (
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <Button disabled={mut.busy} onClick={() => mut.run('/admin/ads', { method: 'PUT', body: { ...r, is_active: Number(r.is_active) ? 0 : 1 } }, 'Đã cập nhật')}>
                      {Number(r.is_active) ? 'Tắt' : 'Bật'}
                    </Button>
                    <DangerButton disabled={mut.busy} onConfirm={() => mut.run('/admin/ads', { method: 'DELETE', body: { id: r.id } }, 'Đã xoá')}>Xoá</DangerButton>
                  </div>
                ),
              },
            ]}
            rows={ads}
            rowKey={(r) => r.id}
          />
        </States>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings — payment, regions, maintenance window, stream credentials
// ---------------------------------------------------------------------------
export function SettingsPanel({ toast }) {
  const pay = useApi('/admin/payment-config');
  const regions = useApi('/admin/regions', { deps: [] });
  const maint = useApi('/admin/maintenance');
  const creds = useApi('/admin/stream-credentials');

  const cfg = pick(pay.data, ['config'], {}) || {};
  const regionItems = asArray(pick(regions.data, ['items'], []));
  const maintenance = asArray(pick(maint.data, ['items'], []));
  const credentials = asArray(pick(creds.data, ['credentials'], []));

  const mut = useMutate(async () => { await Promise.all([pay.reload(), regions.reload(), maint.reload(), creds.reload()]); }, toast);

  const [bank, setBank] = useState(null);
  const [cred, setCred] = useState({ channel_id: '', upstream_token: '' });
  const [mnt, setMnt] = useState({ channel_id: '', minutes: '30', note: '' });
  const [regionDraft, setRegionDraft] = useState({});

  // The bank form starts empty and only adopts server values once, so typing
  // does not get overwritten by a background reload.
  const bankForm = bank ?? {
    bank_id: cfg.bank_id || '', account_no: cfg.account_no || '',
    account_name: cfg.account_name || '', template: cfg.template || 'compact2', note: cfg.note || '',
  };
  const onBank = (k) => (e) => setBank({ ...bankForm, [k]: e.target.value });

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Card
        title="Thanh toán"
        subtitle="Thông tin nhận chuyển khoản. Token SePay chỉ ghi đè khi nhập, nên mở trang này không bao giờ làm mất token đang chạy."
        action={<Pill tone={cfg.has_sepay ? 'good' : 'warn'}>{cfg.has_sepay ? 'Đã có token SePay' : 'Chưa cấu hình SePay'}</Pill>}
      >
        <States loading={pay.loading} error={pay.error} empty={false} onRetry={pay.reload}>
          <div style={{ display: 'grid', gap: 10 }}>
            <FormRow cols={3}>
              <FormField label="Mã ngân hàng"><input style={inputStyle} value={bankForm.bank_id} onChange={onBank('bank_id')} placeholder="970436" /></FormField>
              <FormField label="Số tài khoản"><input style={inputStyle} value={bankForm.account_no} onChange={onBank('account_no')} /></FormField>
              <FormField label="Chủ tài khoản"><input style={inputStyle} value={bankForm.account_name} onChange={onBank('account_name')} /></FormField>
            </FormRow>
            <FormRow cols={3}>
              <FormField label="Kiểu VietQR">
                <select style={inputStyle} value={bankForm.template} onChange={onBank('template')}>
                  {['compact2', 'compact', 'qr_only', 'print'].map((t) => <option key={t} value={t} style={{ background: '#16161C' }}>{t}</option>)}
                </select>
              </FormField>
              <FormField label="Ghi chú chuyển khoản"><input style={inputStyle} value={bankForm.note} onChange={onBank('note')} placeholder="PLAYZ <mã đơn>" /></FormField>
              <FormField label="Token SePay (nhập để thay)">
                <input style={inputStyle} type="password" onChange={(e) => setBank({ ...bankForm, sepay_token: e.target.value })} placeholder={cfg.has_sepay ? '•••••••• (giữ nguyên nếu để trống)' : 'chưa có'} />
              </FormField>
            </FormRow>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Button variant="primary" disabled={mut.busy} onClick={() => mut.run('/admin/payment-config', { method: 'PUT', body: bankForm }, 'Đã lưu cấu hình thanh toán')}>Lưu</Button>
              <span style={{ fontSize: 11, color: C.textMuted }}>
                Khoá bí mật của cổng thanh toán phải nằm trong biến môi trường của Worker, không nhập ở đây.
              </span>
            </div>
          </div>
        </States>
      </Card>

      <Card title={`Vùng chặn (${regionItems.length})`} subtitle="Áp dụng cho kênh, sự kiện, quảng cáo và nguồn phim. Để trống nghĩa là không chặn ở đâu.">
        <States loading={regions.loading} error={regions.error} empty={regionItems.length === 0} onRetry={regions.reload}
          emptyText="Không có mục nào bị chặn theo vùng.">
          <Table
            columns={[
              { key: 'name', label: 'Mục', render: (r) => r.name || r.title || r.channel_id || r.id },
              {
                key: 'blocked_regions', label: 'Vùng chặn', width: 420,
                render: (r) => {
                  const key = r.channel_id || r.id;
                  const cur = regionDraft[key] ?? (r.blocked_regions || '');
                  return (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        style={{ ...inputStyle, width: 300 }}
                        value={cur}
                        onChange={(e) => setRegionDraft((d) => ({ ...d, [key]: e.target.value }))}
                        placeholder="VN, TH — để trống là bỏ chặn"
                      />
                      <Button
                        disabled={mut.busy || cur === (r.blocked_regions || '')}
                        onClick={() => mut.run('/admin/regions', { method: 'PUT', body: { type: regions.data?.type || 'channel', id: r.id, channel_id: r.channel_id, regions: cur } }, 'Đã lưu vùng chặn')}
                      >
                        Lưu
                      </Button>
                    </div>
                  );
                },
              },
            ]}
            rows={regionItems.slice(0, 60)}
            rowKey={(r) => r.channel_id || r.id}
          />
        </States>
      </Card>

      <Card title={`Bảo trì kênh (${maintenance.length})`} subtitle="Tạm ẩn một kênh trong lúc sửa nguồn, thay vì để người xem gặp lỗi phát.">
        <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
          <FormRow cols={3}>
            <FormField label="Mã kênh"><input style={inputStyle} value={mnt.channel_id} onChange={(e) => setMnt({ ...mnt, channel_id: e.target.value })} placeholder="VTV1" /></FormField>
            <FormField label="Số phút"><input style={inputStyle} value={mnt.minutes} onChange={(e) => setMnt({ ...mnt, minutes: e.target.value })} inputMode="numeric" /></FormField>
            <FormField label="Ghi chú"><input style={inputStyle} value={mnt.note} onChange={(e) => setMnt({ ...mnt, note: e.target.value })} placeholder="Nhà cung cấp đang đổi CDN" /></FormField>
          </FormRow>
          <div>
            <Button
              variant="primary" disabled={mut.busy || !mnt.channel_id.trim()}
              onClick={async () => {
                const ok = await mut.run('/admin/maintenance', { method: 'POST', body: { ...mnt, status: 'maintenance' } }, 'Đã đặt lịch bảo trì');
                if (ok) setMnt({ channel_id: '', minutes: '30', note: '' });
              }}
            >
              Đặt bảo trì
            </Button>
          </div>
        </div>
        <States loading={maint.loading} error={maint.error} empty={maintenance.length === 0} onRetry={maint.reload}
          emptyText="Không có kênh nào đang bảo trì.">
          <Table
            columns={[
              { key: 'name', label: 'Kênh', render: (r) => r.name || r.channel_id },
              { key: 'group_title', label: 'Nhóm', width: 180, muted: true },
              { key: 'note', label: 'Ghi chú', muted: true, render: (r) => r.note || '—' },
              {
                key: 'until', label: 'Tới', width: 140,
                render: (r) => fmtDate(new Date(Number(r.maintenance_until || 0) * 1000).toISOString()),
              },
              {
                key: 'act', label: '', width: 120, align: 'right',
                render: (r) => <Button disabled={mut.busy} onClick={() => mut.run('/admin/maintenance', { method: 'DELETE', body: { channel_id: r.channel_id } }, 'Đã kết thúc bảo trì')}>Kết thúc</Button>,
              },
            ]}
            rows={maintenance}
            rowKey={(r) => r.channel_id}
          />
        </States>
      </Card>

      <Card title={`Token nguồn phát (${credentials.length})`} subtitle="Token dùng để lấy luồng .mpd của nhà cung cấp. Chỉ hiển thị ngày cập nhật, không bao giờ trả token ra ngoài.">
        <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
          <FormRow cols={3}>
            <FormField label="Mã kênh"><input style={inputStyle} value={cred.channel_id} onChange={(e) => setCred({ ...cred, channel_id: e.target.value })} /></FormField>
            <FormField label="Token mới (≥ 16 ký tự)"><input style={inputStyle} type="password" value={cred.upstream_token} onChange={(e) => setCred({ ...cred, upstream_token: e.target.value })} /></FormField>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <Button
                variant="primary" disabled={mut.busy || !cred.channel_id.trim() || cred.upstream_token.length < 16}
                onClick={async () => {
                  const ok = await mut.run('/admin/stream-credentials', { method: 'POST', body: cred }, 'Đã cập nhật token');
                  if (ok) setCred({ channel_id: '', upstream_token: '' });
                }}
              >
                Cập nhật
              </Button>
            </div>
          </FormRow>
        </div>
        <States loading={creds.loading} error={creds.error} empty={credentials.length === 0} onRetry={creds.reload}
          emptyText="Chưa kênh nào có token riêng.">
          <Table
            columns={[
              { key: 'channel_id', label: 'Kênh' },
              { key: 'updated_at', label: 'Cập nhật', width: 180, muted: true, render: (r) => (r.updated_at ? fmtDate(new Date(Number(r.updated_at) * 1000).toISOString()) : '—') },
              {
                key: 'act', label: '', width: 110, align: 'right',
                render: (r) => <DangerButton disabled={mut.busy} onConfirm={() => mut.run('/admin/stream-credentials', { method: 'DELETE', body: { channel_id: r.channel_id } }, 'Đã xoá token')}>Xoá</DangerButton>,
              },
            ]}
            rows={credentials}
            rowKey={(r) => r.channel_id}
          />
        </States>
      </Card>
    </div>
  );
}

export const CONTENT_PANELS = {
  homepage: HomepagePanel,
  movies: MoviesPanel,
  sports: SportsPanel,
  shorts: ShortsPanel,
  chat: ChatPanel,
  branding: BrandingPanel,
  navigation: NavigationPanel,
  settings: SettingsPanel,
};
