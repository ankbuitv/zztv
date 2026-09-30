/**
 * playZ admin — management panels
 * ============================================================================
 * One panel per navigation entry, each wired to the endpoints the Worker already
 * serves. These are screens over an existing API, not a new one: every read and
 * every mutation below was already reachable from the old embedded admin, which
 * is exactly why the admin could be split into its own application without
 * touching the backend contract.
 *
 * Mutations are deliberately narrow. The point of this pass is that an operator
 * can see and act on the things that go wrong day to day — a channel stuck
 * inactive, an abusive comment, a user who needs access revoked — rather than
 * every field the API can write.
 */
import React, { useMemo, useState } from 'react';
import { color as C, radius, api } from './api';
import {
  useApi, pick, asArray, Card, Stat, Button, Field, Pill, States, Table, Bars, Toast, fmtNum, fmtDate,
} from './ui';

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
const dayLabel = (row) => {
  const raw = row?.day || row?.date || row?.d || '';
  const t = Date.parse(/Z|[+-]\d\d:?\d\d$/.test(raw) ? raw : `${String(raw).replace(' ', 'T')}Z`);
  if (!Number.isFinite(t)) return String(raw).slice(5, 10);
  return `${String(new Date(t).getDate()).padStart(2, '0')}/${String(new Date(t).getMonth() + 1).padStart(2, '0')}`;
};
const dayValue = (row) => Number(row?.views ?? row?.n ?? row?.count ?? row?.total ?? 0);

export function DashboardPanel() {
  const summary = useApi('/admin/analytics/summary');
  const presence = useApi('/admin/presence');

  const viewsByDay = asArray(pick(summary.data, ['viewsByDay'], []));
  const topChannels = asArray(pick(summary.data, ['topChannels'], []));
  const viewers = asArray(pick(presence.data, ['viewers'], []));

  const totalViews = viewsByDay.reduce((a, r) => a + dayValue(r), 0);
  const series = viewsByDay.slice(-14).map((r) => ({ label: dayLabel(r), value: dayValue(r) }));

  return (
    <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Stat label="Lượt xem (14 ngày)" value={fmtNum(totalViews)} hint={`${viewsByDay.length} ngày có dữ liệu`} />
        <Stat label="Đang xem" value={fmtNum(viewers.length)} tone={viewers.length > 0 ? 'good' : 'default'} hint="người xem trong 5 phút gần nhất" />
        <Stat label="Kênh dẫn đầu" value={asArray(topChannels)[0]?.name || '—'} hint={asArray(topChannels)[0] ? `${fmtNum(asArray(topChannels)[0].views ?? asArray(topChannels)[0].n)} lượt` : 'chưa có dữ liệu'} />
      </div>

      <Card title="Lượt xem theo ngày" subtitle="14 ngày gần nhất">
        <States loading={summary.loading} error={summary.error} empty={series.length === 0} onRetry={summary.reload}>
          <Bars data={series} height={140} />
        </States>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <Card title="Kênh xem nhiều">
          <States loading={summary.loading} error={summary.error} empty={topChannels.length === 0} onRetry={summary.reload}>
            <Table
              columns={[
                { key: 'name', label: 'Kênh', render: (r) => r.name || r.channel_id || '—' },
                { key: 'views', label: 'Lượt xem', align: 'right', numeric: true, width: 90, render: (r) => fmtNum(r.views ?? r.n) },
              ]}
              rows={topChannels.slice(0, 10)}
              rowKey={(r, i) => r.channel_id || r.name || i}
            />
          </States>
        </Card>

        <Card title="Đang xem" subtitle="hoạt động trong 5 phút gần nhất">
          <States loading={presence.loading} error={presence.error} empty={viewers.length === 0} onRetry={presence.reload}>
            <Table
              columns={[
                { key: 'name', label: 'Người xem', render: (r) => r.name || r.username || r.user_id || '—' },
                { key: 'channel', label: 'Kênh', muted: true, render: (r) => r.channel_name || r.channel_id || '—' },
              ]}
              rows={viewers.slice(0, 10)}
              rowKey={(r, i) => r.user_id || i}
            />
          </States>
        </Card>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------
export function AnalyticsPanel() {
  const summary = useApi('/admin/analytics/summary');
  const viewsByDay = asArray(pick(summary.data, ['viewsByDay'], []));
  const loginsByDay = asArray(pick(summary.data, ['loginsByDay'], []));
  const byEvent = asArray(pick(summary.data, ['byEvent'], []));

  return (
    <>
      <Card title="Lượt xem theo ngày">
        <States loading={summary.loading} error={summary.error} empty={viewsByDay.length === 0} onRetry={summary.reload}>
          <Bars data={viewsByDay.map((r) => ({ label: dayLabel(r), value: dayValue(r) }))} height={150} />
        </States>
      </Card>

      <Card title="Đăng nhập theo ngày">
        <States loading={summary.loading} error={summary.error} empty={loginsByDay.length === 0} onRetry={summary.reload}>
          <Bars data={loginsByDay.map((r) => ({ label: dayLabel(r), value: Number(r.logins ?? r.n ?? r.count ?? 0) }))} height={120} tone={C.blueSoft} />
        </States>
      </Card>

      <Card title="Sự kiện theo loại">
        <States loading={summary.loading} error={summary.error} empty={byEvent.length === 0} onRetry={summary.reload}>
          <Table
            columns={[
              { key: 'kind', label: 'Loại', render: (r) => r.kind || r.event || r.name || '—' },
              { key: 'n', label: 'Số lần', align: 'right', numeric: true, width: 100, render: (r) => fmtNum(r.n ?? r.count ?? r.total) },
            ]}
            rows={byEvent.slice(0, 20)}
            rowKey={(r, i) => r.kind || r.event || i}
          />
        </States>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Live TV — channels
// ---------------------------------------------------------------------------
export function LiveTvPanel({ toast }) {
  const list = useApi('/admin/channels');
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');
  const [busy, setBusy] = useState(null);

  const channels = asArray(pick(list.data, ['channels', 'data'], []));

  const groups = useMemo(() => {
    const s = new Set(channels.map((c) => c.group_title).filter(Boolean));
    return ['all', ...[...s].sort()];
  }, [channels]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return channels.filter((c) => {
      if (group !== 'all' && c.group_title !== group) return false;
      if (!needle) return true;
      return `${c.name || ''} ${c.channel_id || ''}`.toLowerCase().includes(needle);
    });
  }, [channels, q, group]);

  const toggle = async (ch) => {
    setBusy(ch.channel_id);
    try {
      // The upsert keeps stream_token when the field is omitted (NULLIF), so
      // flipping visibility cannot silently wipe a channel's .mpd token.
      await api('/admin/channels', {
        method: 'POST',
        body: { ...ch, is_active: Number(ch.is_active) ? 0 : 1 },
      });
      await list.reload();
      toast(Number(ch.is_active) ? 'Đã ẩn kênh' : 'Đã hiện kênh', 'success');
    } catch (e) {
      toast(e.message || 'Không cập nhật được', 'error');
    } finally { setBusy(null); }
  };

  return (
    <Card
      title={`Danh sách kênh (${channels.length})`}
      subtitle="Bật/tắt hiển thị. Không cần tải lại toàn bộ bảng để sửa một kênh."
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <Field placeholder="Tìm kênh…" value={q} onChange={setQ} width={190} />
          <select
            value={group} onChange={(e) => setGroup(e.target.value)}
            style={{
              height: 32, padding: '0 8px', background: 'rgba(255,255,255,.05)',
              border: `1px solid ${C.line}`, borderRadius: radius.sm, color: C.text, fontSize: 12.5, outline: 'none',
            }}
          >
            {groups.map((g) => <option key={g} value={g} style={{ background: '#16161C' }}>{g === 'all' ? 'Tất cả nhóm' : g}</option>)}
          </select>
          <Button onClick={list.reload}>Tải lại</Button>
        </div>
      }
    >
      <States loading={list.loading} error={list.error} empty={rows.length === 0} onRetry={list.reload}>
        <Table
          columns={[
            {
              key: 'logo', label: '', width: 44,
              render: (r) => (r.logo
                ? <img src={r.logo} alt="" width="28" height="28" style={{ objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                : <span />),
            },
            { key: 'name', label: 'Tên kênh', render: (r) => r.name || r.channel_id },
            { key: 'group_title', label: 'Nhóm', muted: true, width: 160 },
            {
              key: 'is_active', label: 'Trạng thái', width: 110,
              render: (r) => (Number(r.is_active) ? <Pill tone="good">Đang hiện</Pill> : <Pill>Đang ẩn</Pill>),
            },
            {
              key: 'act', label: '', width: 90, align: 'right',
              render: (r) => (
                <Button
                  variant={Number(r.is_active) ? 'danger' : 'default'}
                  disabled={busy === r.channel_id}
                  onClick={() => toggle(r)}
                >
                  {Number(r.is_active) ? 'Ẩn' : 'Hiện'}
                </Button>
              ),
            },
          ]}
          rows={rows.slice(0, 300)}
          rowKey={(r) => r.channel_id}
        />
        {rows.length > 300 && (
          <p style={{ fontSize: 11.5, color: C.textMuted, marginTop: 10 }}>
            Hiển thị 300/{rows.length} kênh — thu hẹp bằng ô tìm kiếm.
          </p>
        )}
      </States>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// EPG
// ---------------------------------------------------------------------------
export function EpgPanel({ toast }) {
  const list = useApi('/admin/epg-overrides');
  const rows = asArray(pick(list.data, ['overrides', 'data'], []));

  const remove = async (r) => {
    try {
      await api('/admin/epg-overrides', { method: 'DELETE', body: { id: r.id, channel_id: r.channel_id } });
      await list.reload();
      toast('Đã xoá', 'success');
    } catch (e) { toast(e.message || 'Không xoá được', 'error'); }
  };

  return (
    <Card title="Ghi đè EPG" subtitle="Chương trình do người vận hành sửa tay, thay cho dữ liệu nhà cung cấp.">
      <States loading={list.loading} error={list.error} empty={rows.length === 0} onRetry={list.reload}>
        <Table
          columns={[
            { key: 'channel_id', label: 'Kênh', width: 150 },
            { key: 'title', label: 'Tiêu đề', render: (r) => r.title || r.name || '—' },
            { key: 'start', label: 'Bắt đầu', muted: true, width: 140, render: (r) => fmtDate(r.start || r.start_at) },
            { key: 'stop', label: 'Kết thúc', muted: true, width: 140, render: (r) => fmtDate(r.stop || r.end_at) },
            { key: 'act', label: '', width: 80, align: 'right', render: (r) => <Button variant="danger" onClick={() => remove(r)}>Xoá</Button> },
          ]}
          rows={rows}
          rowKey={(r, i) => r.id || i}
        />
      </States>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Community — moderation
// ---------------------------------------------------------------------------
export function CommunityPanel({ toast }) {
  const list = useApi('/admin/comments');
  const [q, setQ] = useState('');
  const comments = asArray(pick(list.data, ['comments'], []));

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return comments;
    return comments.filter((c) => `${c.body || ''} ${c.name || ''} ${c.target || ''}`.toLowerCase().includes(needle));
  }, [comments, q]);

  const remove = async (c) => {
    try {
      await api('/admin/comments', { method: 'DELETE', body: { id: c.id } });
      await list.reload();
      toast('Đã xoá', 'success');
    } catch (e) { toast(e.message || 'Không xoá được', 'error'); }
  };

  const isCommunityPost = (c) => String(c.target || '') === 'community';

  return (
    <Card
      title={`Bài viết & bình luận (${comments.length})`}
      subtitle="Bài viết cộng đồng nằm cùng hàng đợi với bình luận — cùng một đường kiểm duyệt."
      action={<Field placeholder="Tìm nội dung…" value={q} onChange={setQ} width={210} />}
    >
      <States loading={list.loading} error={list.error} empty={rows.length === 0} onRetry={list.reload}>
        <Table
          columns={[
            {
              key: 'target', label: 'Loại', width: 110,
              render: (c) => (isCommunityPost(c) ? <Pill tone="good">Bài viết</Pill> : <Pill>Bình luận</Pill>),
            },
            { key: 'name', label: 'Người gửi', width: 140, render: (c) => c.name || `#${c.user_id}` },
            { key: 'body', label: 'Nội dung', wrap: true, maxWidth: 520, render: (c) => c.body },
            {
              key: 'status', label: 'Trạng thái', width: 100,
              render: (c) => (c.status === 'visible' ? <Pill tone="good">Hiện</Pill> : <Pill tone="warn">{c.status || 'ẩn'}</Pill>),
            },
            { key: 'created_at', label: 'Thời gian', muted: true, width: 130, render: (c) => fmtDate(c.created_at) },
            { key: 'act', label: '', width: 80, align: 'right', render: (c) => <Button variant="danger" onClick={() => remove(c)}>Xoá</Button> },
          ]}
          rows={rows.slice(0, 200)}
          rowKey={(c) => c.id}
        />
      </States>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
const USER_ACTIONS = [
  { id: 'ban', label: 'Khoá', variant: 'danger' },
  { id: 'unban', label: 'Mở khoá' },
  { id: 'reset-devices', label: 'Đăng xuất thiết bị' },
];

export function UsersPanel({ toast }) {
  const list = useApi('/admin/users');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(null);
  const users = asArray(pick(list.data, ['users'], []));

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((u) => `${u.username || ''} ${u.email || ''} ${u.display_name || ''}`.toLowerCase().includes(needle));
  }, [users, q]);

  const act = async (u, action) => {
    setBusy(`${u.id}:${action}`);
    try {
      await api('/admin/users/action', { method: 'POST', body: { id: u.id, action } });
      await list.reload();
      toast('Đã thực hiện', 'success');
    } catch (e) { toast(e.message || 'Không thực hiện được', 'error'); }
    finally { setBusy(null); }
  };

  return (
    <Card
      title={`Tài khoản (${users.length})`}
      subtitle="Khoá, mở khoá và thu hồi phiên trên mọi thiết bị."
      action={<Field placeholder="Tìm tài khoản…" value={q} onChange={setQ} width={210} />}
    >
      <States loading={list.loading} error={list.error} empty={rows.length === 0} onRetry={list.reload}>
        <Table
          columns={[
            { key: 'username', label: 'Tài khoản', width: 160, render: (u) => u.username || `#${u.id}` },
            { key: 'email', label: 'Email', muted: true, render: (u) => u.email || '—' },
            { key: 'role', label: 'Vai trò', width: 100, render: (u) => <Pill tone={u.role === 'admin' ? 'gold' : 'default'}>{u.role || 'user'}</Pill> },
            { key: 'plan', label: 'Gói', width: 110, muted: true, render: (u) => u.plan || u.plan_code || '—' },
            {
              key: 'banned', label: 'Trạng thái', width: 110,
              render: (u) => (Number(u.banned) ? <Pill tone="live">Đã khoá</Pill> : <Pill tone="good">Hoạt động</Pill>),
            },
            { key: 'created_at', label: 'Tạo lúc', muted: true, width: 130, render: (u) => fmtDate(u.created_at) },
            {
              key: 'act', label: '', width: 250, align: 'right',
              render: (u) => (
                <span style={{ display: 'inline-flex', gap: 6 }}>
                  {USER_ACTIONS.map((a) => (
                    <Button
                      key={a.id} variant={a.variant} disabled={busy === `${u.id}:${a.id}`}
                      onClick={() => act(u, a.id)}
                    >{a.label}</Button>
                  ))}
                </span>
              ),
            },
          ]}
          rows={rows.slice(0, 200)}
          rowKey={(u) => u.id}
        />
      </States>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------
export function PlansPanel() {
  const list = useApi('/admin/plans');
  const plans = asArray(pick(list.data, ['plans'], []));
  return (
    <Card title={`Gói cước (${plans.length})`} subtitle="Bậc giá và quyền lợi hiển thị cho người xem.">
      <States loading={list.loading} error={list.error} empty={plans.length === 0} onRetry={list.reload}>
        <Table
          columns={[
            { key: 'code', label: 'Mã', width: 120 },
            { key: 'name', label: 'Tên gói', render: (p) => p.name || '—' },
            { key: 'price', label: 'Giá', align: 'right', numeric: true, width: 130, render: (p) => fmtNum(p.price ?? p.amount) },
            { key: 'days', label: 'Số ngày', align: 'right', numeric: true, width: 90, render: (p) => p.days ?? p.duration ?? '—' },
            { key: 'groups', label: 'Nhóm kênh', muted: true, render: (p) => p.groups || p.group_title || 'tất cả' },
            { key: 'is_active', label: 'Trạng thái', width: 110, render: (p) => (Number(p.is_active) ? <Pill tone="good">Đang bán</Pill> : <Pill>Ngừng bán</Pill>) },
          ]}
          rows={plans}
          rowKey={(p) => p.code || p.id}
        />
      </States>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
export function PaymentsPanel() {
  const list = useApi('/admin/payments');
  const rows = asArray(pick(list.data, ['payments'], []));
  const total = rows.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const paid = rows.filter((r) => String(r.status) === 'paid').length;

  return (
    <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Stat label="Giao dịch" value={fmtNum(rows.length)} />
        <Stat label="Đã thanh toán" value={fmtNum(paid)} tone="good" />
        <Stat label="Tổng tiền" value={fmtNum(total)} hint="đơn vị theo cổng thanh toán" />
      </div>
      <Card title="Lịch sử giao dịch">
        <States loading={list.loading} error={list.error} empty={rows.length === 0} onRetry={list.reload}>
          <Table
            columns={[
              { key: 'id', label: 'Mã', width: 110 },
              { key: 'username', label: 'Tài khoản', width: 150, render: (r) => r.username || r.user_id || '—' },
              { key: 'plan', label: 'Gói', width: 120, muted: true, render: (r) => r.plan_code || r.plan || '—' },
              { key: 'amount', label: 'Số tiền', align: 'right', numeric: true, width: 130, render: (r) => fmtNum(r.amount) },
              {
                key: 'status', label: 'Trạng thái', width: 130,
                render: (r) => {
                  const s = String(r.status || '').toLowerCase();
                  return <Pill tone={s === 'paid' ? 'good' : s === 'pending' ? 'warn' : 'default'}>{r.status || '—'}</Pill>;
                },
              },
              { key: 'created_at', label: 'Thời gian', muted: true, width: 140, render: (r) => fmtDate(r.created_at) },
            ]}
            rows={rows.slice(0, 200)}
            rowKey={(r) => r.id || r.code}
          />
        </States>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export function NotificationsPanel({ toast }) {
  const list = useApi('/admin/notifications');
  const [form, setForm] = useState({ title: '', body: '' });
  const [sending, setSending] = useState(false);
  const rows = asArray(pick(list.data, ['notifications'], []));

  const send = async () => {
    if (!form.title.trim()) { toast('Nhập tiêu đề', 'error'); return; }
    setSending(true);
    try {
      await api('/admin/notify', { method: 'POST', body: { title: form.title.trim(), body: form.body.trim() } });
      setForm({ title: '', body: '' });
      await list.reload();
      toast('Đã gửi thông báo', 'success');
    } catch (e) { toast(e.message || 'Không gửi được', 'error'); }
    finally { setSending(false); }
  };

  return (
    <>
      <Card title="Gửi thông báo" subtitle="Hiện trong chuông thông báo của người xem.">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Field placeholder="Tiêu đề" value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} width={260} />
          <Field placeholder="Nội dung" value={form.body} onChange={(v) => setForm((f) => ({ ...f, body: v }))} width={380} />
          <Button variant="primary" onClick={send} disabled={sending}>{sending ? 'Đang gửi…' : 'Gửi'}</Button>
        </div>
      </Card>

      <Card title={`Đã gửi (${rows.length})`}>
        <States loading={list.loading} error={list.error} empty={rows.length === 0} onRetry={list.reload}>
          <Table
            columns={[
              { key: 'title', label: 'Tiêu đề', render: (n) => n.title || '—' },
              { key: 'body', label: 'Nội dung', muted: true, maxWidth: 460, wrap: true, render: (n) => n.body || '' },
              { key: 'audience', label: 'Đối tượng', width: 130, muted: true, render: (n) => n.audience || n.target || 'tất cả' },
              { key: 'created_at', label: 'Thời gian', muted: true, width: 140, render: (n) => fmtDate(n.created_at) },
            ]}
            rows={rows.slice(0, 100)}
            rowKey={(n) => n.id}
          />
        </States>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
export function AuditPanel() {
  const list = useApi('/admin/audit');
  const [q, setQ] = useState('');
  const rows = asArray(pick(list.data, ['audit'], []));

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => `${r.action || ''} ${r.actor || ''} ${r.target || ''} ${r.detail || ''}`.toLowerCase().includes(needle));
  }, [rows, q]);

  return (
    <Card
      title={`Nhật ký thao tác (${rows.length})`}
      subtitle="Ai đã làm gì, khi nào. Không sửa được từ giao diện — cố ý."
      action={<Field placeholder="Tìm trong nhật ký…" value={q} onChange={setQ} width={220} />}
    >
      <States loading={list.loading} error={list.error} empty={filtered.length === 0} onRetry={list.reload}>
        <Table
          columns={[
            { key: 'created_at', label: 'Thời gian', width: 150, render: (r) => fmtDate(r.created_at || r.ts) },
            { key: 'actor', label: 'Người thực hiện', width: 160, render: (r) => r.actor || r.username || '—' },
            { key: 'action', label: 'Hành động', width: 180, render: (r) => <Pill tone="default">{r.action || '—'}</Pill> },
            { key: 'target', label: 'Đối tượng', muted: true, width: 180, render: (r) => r.target || r.target_id || '—' },
            { key: 'detail', label: 'Chi tiết', muted: true, wrap: true, maxWidth: 400, render: (r) => r.detail || r.meta || '' },
          ]}
          rows={filtered.slice(0, 300)}
          rowKey={(r, i) => r.id || i}
        />
      </States>
    </Card>
  );
}

export const PANELS = {
  dashboard: DashboardPanel,
  analytics: AnalyticsPanel,
  livetv: LiveTvPanel,
  epg: EpgPanel,
  community: CommunityPanel,
  users: UsersPanel,
  plans: PlansPanel,
  payments: PaymentsPanel,
  notifications: NotificationsPanel,
  audit: AuditPanel,
};
