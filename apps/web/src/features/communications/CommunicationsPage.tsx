/**
 * CommunicationsPage — tabbed: Send Message | Announcements | Templates | Message Logs
 * Permissions:
 *   communications:read  — view Announcements, Templates, Logs
 *   communications:write — Send Message tab
 *   communications:manage — Notification Settings, New/Edit Template, New Announcement
 */
import { useEffect, useState } from 'react';
import {
  Plus,
  Loader2,
  MessageSquare,
  Send,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useApiList } from '@/hooks/useApiList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { RowMenu } from '@/components/RowMenu';
import { Pagination } from '@/components/Pagination';
import { date } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
  CommChannel,
  EventType,
  TargetType,
  AnnouncementStatus,
  MessageStatus,
  MessageTemplate,
  NotificationSetting,
  Announcement,
  MessageLog,
} from '@/lib/dto';

// ─── Channel + status helpers ─────────────────────────────────────────────────

function channelBadgeClass(ch: CommChannel): string {
  if (ch === 'sms') return 'bg-blue-100 text-primary';
  if (ch === 'whatsapp') return 'bg-green-100 text-green-700';
  return 'bg-indigo-100 text-primary';
}

function ChannelPill({ ch }: { ch: CommChannel }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        channelBadgeClass(ch),
      )}
    >
      {ch === 'whatsapp' ? 'WhatsApp' : ch.toUpperCase()}
    </span>
  );
}

function announcementStatusVariant(
  s: AnnouncementStatus,
): 'default' | 'success' | 'warning' | 'destructive' {
  if (s === 'sent') return 'success';
  if (s === 'sending') return 'warning';
  if (s === 'failed') return 'destructive';
  return 'default';
}

function messageStatusVariant(
  s: MessageStatus,
): 'default' | 'success' | 'warning' | 'destructive' {
  if (s === 'sent') return 'success';
  if (s === 'failed') return 'destructive';
  if (s === 'bounced') return 'warning';
  return 'default';
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  attendance_absent: 'Attendance Absent',
  fee_due: 'Fee Due',
  result_published: 'Result Published',
  announcement: 'Announcement',
  custom: 'Custom',
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  all_users: 'All Users',
  all_students: 'All Students',
  all_parents: 'All Parents',
  all_staff: 'All Staff',
  class: 'By Class',
  section: 'By Section',
};

// ─── Tab bar ──────────────────────────────────────────────────────────────────

type Tab = 'send' | 'announcements' | 'templates' | 'logs';

const TABS: { id: Tab; label: string }[] = [
  { id: 'send', label: 'Send Message' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'templates', label: 'Templates' },
  { id: 'logs', label: 'Message Logs' },
];

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex gap-1 border-b border-border overflow-x-auto">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            'whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
            active === t.id
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function CommunicationsPage() {
  const [tab, setTab] = useState<Tab>('send');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <MessageSquare className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Communications</h1>
          <p className="text-sm text-muted-foreground">
            Send messages, manage announcements, templates and view message logs.
          </p>
        </div>
      </div>

      <TabBar active={tab} onChange={setTab} />

      {tab === 'send' && <SendMessageTab />}
      {tab === 'announcements' && <AnnouncementsTab />}
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'logs' && <MessageLogsTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — Send Message
// ═══════════════════════════════════════════════════════════════════════════════

function SendMessageTab() {
  const { can } = useAuth();
  const canWrite = can('communications:write');
  const canManage = can('communications:manage');

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Left: Single Message Form */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">Send Single Message</h2>
        {canWrite ? (
          <SendMessageForm />
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-700">
            You need <strong>communications:write</strong> permission to send messages.
          </div>
        )}
      </div>

      {/* Right: Notification Settings */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">Notification Settings</h2>
        {canManage ? (
          <NotificationSettingsGrid />
        ) : (
          <div className="rounded-lg border border-border bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
            You need <strong>communications:manage</strong> permission to change notification settings.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Send Message Form ────────────────────────────────────────────────────────

function SendMessageForm() {
  const [channel, setChannel] = useState<CommChannel>('sms');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Load templates when channel changes
  useEffect(() => {
    setTemplatesLoading(true);
    setSelectedTemplateId('');
    api
      .get<MessageTemplate[]>(`/communications/templates?channel=${channel}&limit=100`)
      .then((r) => setTemplates(r.data ?? []))
      .catch(() => setTemplates([]))
      .finally(() => setTemplatesLoading(false));
  }, [channel]);

  // Prefill when template is selected
  function handleTemplateChange(id: string) {
    setSelectedTemplateId(id);
    if (!id) return;
    const tmpl = templates.find((t) => t.id === id);
    if (tmpl) {
      setBody(tmpl.body);
      if (channel === 'email' && tmpl.subject) setSubject(tmpl.subject);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setResult(null);
    try {
      await api.post('/communications/send', {
        channel,
        to,
        subject: channel === 'email' ? subject || undefined : undefined,
        body,
      });
      setResult({ ok: true, message: 'Message sent successfully.' });
      setTo('');
      setBody('');
      setSubject('');
      setSelectedTemplateId('');
    } catch (err) {
      const msg = err instanceof ApiError ? `Error ${err.status}` : 'Failed to send message.';
      setResult({ ok: false, message: msg });
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSend} className="space-y-4 rounded-xl border border-border bg-card p-5">
      {result && (
        <div
          className={cn(
            'rounded-lg px-4 py-3 text-sm',
            result.ok
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border border-red-200 bg-red-50 text-red-700',
          )}
        >
          {result.message}
        </div>
      )}

      {/* Channel selector */}
      <div className="space-y-2">
        <Label>Channel</Label>
        <div className="flex gap-3">
          {(['sms', 'whatsapp', 'email'] as CommChannel[]).map((ch) => (
            <label
              key={ch}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                channel === ch
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted/50',
              )}
            >
              <input
                type="radio"
                name="channel"
                value={ch}
                checked={channel === ch}
                onChange={() => setChannel(ch)}
                className="sr-only"
              />
              {ch === 'sms' ? 'SMS' : ch === 'whatsapp' ? 'WhatsApp' : 'Email'}
            </label>
          ))}
        </div>
      </div>

      <Field label={channel === 'email' ? 'To (email)' : 'To (phone, e.g. +92300…)'}>
        <Input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          required
          placeholder={channel === 'email' ? 'user@example.com' : '+923001234567'}
        />
      </Field>

      {channel === 'email' && (
        <Field label="Subject">
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject…"
          />
        </Field>
      )}

      {/* Template picker */}
      <Field label="Load from Template (optional)">
        {templatesLoading ? (
          <div className="flex h-10 items-center text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading templates…
          </div>
        ) : (
          <Select
            value={selectedTemplateId}
            onChange={(e) => handleTemplateChange(e.target.value)}
          >
            <option value="">— choose template —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.isDefault ? ' (default)' : ''}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label="Message Body">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={4}
          placeholder="Type your message…"
        />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" disabled={sending}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send
        </Button>
      </div>
    </form>
  );
}

// ─── Notification Settings Grid ───────────────────────────────────────────────

const SETTING_EVENT_TYPES: { key: EventType; label: string }[] = [
  { key: 'attendance_absent', label: 'Attendance Absent' },
  { key: 'fee_due', label: 'Fee Due' },
  { key: 'result_published', label: 'Result Published' },
];

const SETTING_CHANNELS: CommChannel[] = ['sms', 'whatsapp', 'email'];

function NotificationSettingsGrid() {
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    api
      .get<NotificationSetting[]>('/communications/settings')
      .then((r) => setSettings(r.data ?? []))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  function isEnabled(eventType: string, channel: CommChannel): boolean {
    return settings.some((s) => s.eventType === eventType && s.channel === channel && s.isEnabled);
  }

  async function toggle(eventType: EventType, channel: CommChannel) {
    const current = isEnabled(eventType, channel);
    const next = settings
      .filter((s) => !(s.eventType === eventType && s.channel === channel))
      .concat({ eventType, channel, isEnabled: !current });
    setSettings(next);
    setSaving(true);
    try {
      await api.put('/communications/settings', { settings: next });
      setSavedAt(Date.now());
    } catch {
      // revert
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-4 border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground">
        <div className="px-4 py-2.5">Event</div>
        {SETTING_CHANNELS.map((ch) => (
          <div key={ch} className="px-4 py-2.5 text-center capitalize">
            {ch === 'whatsapp' ? 'WhatsApp' : ch.toUpperCase()}
          </div>
        ))}
      </div>

      {SETTING_EVENT_TYPES.map((et, idx) => (
        <div
          key={et.key}
          className={cn(
            'grid grid-cols-4 border-b border-slate-100',
            idx % 2 === 1 && 'bg-muted/50/60',
          )}
        >
          <div className="px-4 py-3 text-sm font-medium text-foreground">{et.label}</div>
          {SETTING_CHANNELS.map((ch) => (
            <div key={ch} className="flex items-center justify-center px-4 py-3">
              <input
                type="checkbox"
                checked={isEnabled(et.key, ch)}
                onChange={() => toggle(et.key, ch)}
                className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                disabled={saving}
              />
            </div>
          ))}
        </div>
      ))}

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
        <span>Changes saved automatically</span>
        {saving && (
          <span className="flex items-center gap-1 text-amber-600">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving…
          </span>
        )}
        {!saving && savedAt && (
          <span className="text-emerald-600 font-medium">Saved</span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — Announcements
// ═══════════════════════════════════════════════════════════════════════════════

function AnnouncementsTab() {
  const { can } = useAuth();
  const canManage = can('communications:manage');

  const [statusFilter, setStatusFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { rows, meta, loading, error, page, setPage, refetch } = useApiList<Announcement>({
    path: '/communications/announcements',
    params: { status: statusFilter || undefined },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-44"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="sending">Sending</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </Select>
        {canManage && (
          <Button className="ml-auto" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New Announcement
          </Button>
        )}
      </div>

      {error && <ErrorBox message={error} />}

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Title</TH>
            <TH>Channels</TH>
            <TH>Target</TH>
            <TH>Status</TH>
            <TH>Sent / Failed</TH>
            <TH>Created</TH>
            <TH>Sent At</TH>
          </TR>
        </THead>
        <TBody>
          {loading && (
            <TR className="hover:bg-transparent">
              <TD colSpan={7} className="py-10 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </TD>
            </TR>
          )}
          {!loading && rows.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={7} className="py-10 text-center text-muted-foreground">
                No announcements found.
              </TD>
            </TR>
          )}
          {!loading &&
            rows.map((a) => (
              <TR key={a.id}>
                <TD className="font-medium text-foreground max-w-xs truncate">{a.title}</TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {a.channels.map((ch) => (
                      <ChannelPill key={ch} ch={ch} />
                    ))}
                  </div>
                </TD>
                <TD className="text-muted-foreground text-sm">
                  {TARGET_TYPE_LABELS[a.targetType] ?? a.targetType}
                </TD>
                <TD>
                  <Badge variant={announcementStatusVariant(a.status)}>
                    {a.status === 'sending' ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {a.status}
                      </span>
                    ) : (
                      a.status
                    )}
                  </Badge>
                </TD>
                <TD className="text-sm">
                  <span className="text-emerald-700">{a.sentCount}</span>
                  {' / '}
                  <span className="text-red-600">{a.failedCount}</span>
                </TD>
                <TD className="text-sm text-muted-foreground">{date(a.createdAt)}</TD>
                <TD className="text-sm text-muted-foreground">{date(a.sentAt)}</TD>
              </TR>
            ))}
        </TBody>
      </Table>

      <Pagination meta={meta} page={page} onPage={setPage} noun="announcements" />

      <AnnouncementDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={refetch}
      />
    </div>
  );
}

// ─── AnnouncementDialog ───────────────────────────────────────────────────────

function AnnouncementDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [channels, setChannels] = useState<CommChannel[]>(['sms']);
  const [targetType, setTargetType] = useState<TargetType>('all_users');
  const [targetId, setTargetId] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle('');
      setMessage('');
      setChannels(['sms']);
      setTargetType('all_users');
      setTargetId('');
      setScheduleEnabled(false);
      setScheduledAt('');
      setError(null);
    }
  }, [open]);

  function toggleChannel(ch: CommChannel) {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (channels.length === 0) {
      setError('Select at least one channel.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/communications/announcements', {
        title,
        message,
        channels,
        targetType,
        targetId: (targetType === 'class' || targetType === 'section') ? (targetId || undefined) : undefined,
        scheduledAt: scheduleEnabled && scheduledAt ? scheduledAt : undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not create announcement.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-xl">
      <form onSubmit={submit}>
        <DialogHeader title="New Announcement" onClose={onClose} />
        <DialogBody className="space-y-4 overflow-y-auto max-h-[70vh]">
          {error && <ErrorBox message={error} />}

          <Field label="Title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Announcement title"
            />
          </Field>

          <Field label="Message">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={5}
              placeholder="Message content…"
            />
          </Field>

          {/* Channels */}
          <div className="space-y-1.5">
            <Label>Channels</Label>
            <div className="flex gap-3">
              {(['sms', 'whatsapp', 'email'] as CommChannel[]).map((ch) => (
                <label
                  key={ch}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors select-none',
                    channels.includes(ch)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted/50',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={channels.includes(ch)}
                    onChange={() => toggleChannel(ch)}
                    className="sr-only"
                  />
                  {ch === 'sms' ? 'SMS' : ch === 'whatsapp' ? 'WhatsApp' : 'Email'}
                </label>
              ))}
            </div>
          </div>

          {/* Target */}
          <Field label="Target">
            <Select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as TargetType)}
            >
              <option value="all_users">All Users</option>
              <option value="all_students">All Students</option>
              <option value="all_parents">All Parents</option>
              <option value="all_staff">All Staff</option>
              <option value="class">By Class</option>
              <option value="section">By Section</option>
            </Select>
          </Field>

          {(targetType === 'class' || targetType === 'section') && (
            <Field label={targetType === 'class' ? 'Class ID' : 'Section ID'}>
              <Input
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder={targetType === 'class' ? 'Class UUID' : 'Section UUID'}
              />
            </Field>
          )}

          {/* Schedule */}
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={scheduleEnabled}
              onChange={(e) => setScheduleEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Schedule for later
          </label>

          {scheduleEnabled && (
            <Field label="Scheduled Date & Time">
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </Field>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Send Announcement
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — Templates
// ═══════════════════════════════════════════════════════════════════════════════

function TemplatesTab() {
  const { can } = useAuth();
  const canManage = can('communications:manage');

  const [channelFilter, setChannelFilter] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MessageTemplate | null>(null);

  const { rows, meta, loading, error, page, setPage, refetch } = useApiList<MessageTemplate>({
    path: '/communications/templates',
    params: {
      channel: channelFilter || undefined,
      eventType: eventTypeFilter || undefined,
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          className="w-44"
        >
          <option value="">All channels</option>
          <option value="sms">SMS</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">Email</option>
        </Select>
        <Select
          value={eventTypeFilter}
          onChange={(e) => setEventTypeFilter(e.target.value)}
          className="w-52"
        >
          <option value="">All event types</option>
          <option value="attendance_absent">Attendance Absent</option>
          <option value="fee_due">Fee Due</option>
          <option value="result_published">Result Published</option>
          <option value="announcement">Announcement</option>
          <option value="custom">Custom</option>
        </Select>
        {canManage && (
          <Button
            className="ml-auto"
            onClick={() => { setEditingTemplate(null); setFormOpen(true); }}
          >
            <Plus className="h-4 w-4" />
            New Template
          </Button>
        )}
      </div>

      {error && <ErrorBox message={error} />}

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Name</TH>
            <TH>Channel</TH>
            <TH>Event Type</TH>
            <TH>Default</TH>
            <TH>Preview</TH>
            {canManage && <TH className="text-right">Actions</TH>}
          </TR>
        </THead>
        <TBody>
          {loading && (
            <TR className="hover:bg-transparent">
              <TD colSpan={6} className="py-10 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </TD>
            </TR>
          )}
          {!loading && rows.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={6} className="py-10 text-center text-muted-foreground">
                No templates found.
              </TD>
            </TR>
          )}
          {!loading &&
            rows.map((t) => (
              <TR key={t.id}>
                <TD className="font-medium text-foreground">{t.name}</TD>
                <TD>
                  <ChannelPill ch={t.channel} />
                </TD>
                <TD className="text-sm text-muted-foreground">
                  {EVENT_TYPE_LABELS[t.eventType] ?? t.eventType}
                </TD>
                <TD>
                  {t.isDefault && (
                    <Badge variant="success">Default</Badge>
                  )}
                </TD>
                <TD className="max-w-xs truncate text-sm text-muted-foreground">
                  {t.body.length > 60 ? t.body.slice(0, 60) + '…' : t.body}
                </TD>
                {canManage && (
                  <TD className="text-right">
                    <RowMenu
                      items={[
                        {
                          label: 'Edit',
                          onClick: () => { setEditingTemplate(t); setFormOpen(true); },
                        },
                        {
                          label: 'Delete',
                          onClick: () => setDeleteTarget(t),
                          danger: true,
                        },
                      ]}
                    />
                  </TD>
                )}
              </TR>
            ))}
        </TBody>
      </Table>

      <Pagination meta={meta} page={page} onPage={setPage} noun="templates" />

      <TemplateDialog
        open={formOpen}
        template={editingTemplate}
        onClose={() => setFormOpen(false)}
        onSaved={refetch}
      />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        title="Delete Template"
        message={`Delete template "${deleteTarget?.name}"? This cannot be undone.`}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.del(`/communications/templates/${deleteTarget.id}`);
          setDeleteTarget(null);
          refetch();
        }}
      />
    </div>
  );
}

// ─── TemplateDialog ───────────────────────────────────────────────────────────

function TemplateDialog({
  open,
  template,
  onClose,
  onSaved,
}: {
  open: boolean;
  template: MessageTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [eventType, setEventType] = useState<EventType>('custom');
  const [channel, setChannel] = useState<CommChannel>('sms');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setEventType(template.eventType as EventType);
      setChannel(template.channel);
      setSubject(template.subject ?? '');
      setBody(template.body);
      setIsDefault(template.isDefault);
    } else {
      setName('');
      setEventType('custom');
      setChannel('sms');
      setSubject('');
      setBody('');
      setIsDefault(false);
    }
    setError(null);
  }, [template, open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name,
        eventType,
        channel,
        subject: channel === 'email' ? (subject || undefined) : undefined,
        body,
        isDefault,
      };
      if (template) {
        await api.patch(`/communications/templates/${template.id}`, payload);
      } else {
        await api.post('/communications/templates', payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not save template.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-xl">
      <form onSubmit={submit}>
        <DialogHeader
          title={template ? 'Edit Template' : 'New Template'}
          onClose={onClose}
        />
        <DialogBody className="space-y-4 overflow-y-auto max-h-[70vh]">
          {error && <ErrorBox message={error} />}

          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Fee Reminder SMS"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Event Type">
              <Select
                value={eventType}
                onChange={(e) => setEventType(e.target.value as EventType)}
              >
                <option value="attendance_absent">Attendance Absent</option>
                <option value="fee_due">Fee Due</option>
                <option value="result_published">Result Published</option>
                <option value="announcement">Announcement</option>
                <option value="custom">Custom</option>
              </Select>
            </Field>

            <Field label="Channel">
              <Select
                value={channel}
                onChange={(e) => setChannel(e.target.value as CommChannel)}
              >
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
              </Select>
            </Field>
          </div>

          {channel === 'email' && (
            <Field label="Subject">
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject…"
              />
            </Field>
          )}

          <Field label="Body">
            {/* monospace hint: template variables look better in mono */}
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={6}
              placeholder="Message body…"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Available variables:{' '}
              <code>{'{{studentName}}'}</code>{' '}
              <code>{'{{schoolName}}'}</code>{' '}
              <code>{'{{amount}}'}</code>{' '}
              <code>{'{{dueDate}}'}</code>{' '}
              <code>{'{{examName}}'}</code>{' '}
              <code>{'{{date}}'}</code>
            </p>
          </Field>

          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Mark as default template for this event + channel
          </label>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {template ? 'Save Changes' : 'Create'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4 — Message Logs
// ═══════════════════════════════════════════════════════════════════════════════

function MessageLogsTab() {
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { rows, meta, loading, error, query, page, setQuery, setPage } = useApiList<MessageLog>({
    path: '/communications/logs',
    params: {
      channel: channelFilter || undefined,
      status: statusFilter || undefined,
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          className="w-44"
        >
          <option value="">All channels</option>
          <option value="sms">SMS</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">Email</option>
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-44"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="bounced">Bounced</option>
        </Select>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="w-52"
        />
      </div>

      {error && <ErrorBox message={error} />}

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Channel</TH>
            <TH>Event Type</TH>
            <TH>Recipient</TH>
            <TH>Body</TH>
            <TH>Status</TH>
            <TH>Sent At</TH>
          </TR>
        </THead>
        <TBody>
          {loading && (
            <TR className="hover:bg-transparent">
              <TD colSpan={6} className="py-10 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </TD>
            </TR>
          )}
          {!loading && rows.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={6} className="py-10 text-center text-muted-foreground">
                No message logs found.
              </TD>
            </TR>
          )}
          {!loading &&
            rows.map((log) => {
              const recipient =
                log.channel === 'email'
                  ? log.recipientEmail
                  : log.recipientPhone;
              const bodyPreview =
                log.body.length > 50 ? log.body.slice(0, 50) + '…' : log.body;

              return (
                <TR key={log.id}>
                  <TD>
                    <ChannelPill ch={log.channel} />
                  </TD>
                  <TD className="text-sm text-muted-foreground">
                    {EVENT_TYPE_LABELS[log.eventType] ?? log.eventType}
                  </TD>
                  <TD className="font-mono text-xs text-muted-foreground">
                    {recipient ?? '—'}
                  </TD>
                  <TD className="max-w-xs text-sm text-muted-foreground">
                    <span title={log.body}>{bodyPreview}</span>
                    {log.status === 'failed' && log.errorMessage && (
                      <p className="text-xs text-orange-600 mt-0.5 truncate" title={log.errorMessage}>
                        {log.errorMessage.length > 50
                          ? log.errorMessage.slice(0, 50) + '…'
                          : log.errorMessage}
                      </p>
                    )}
                  </TD>
                  <TD>
                    <Badge variant={messageStatusVariant(log.status)}>{log.status}</Badge>
                  </TD>
                  <TD className="text-sm text-muted-foreground">{date(log.sentAt)}</TD>
                </TR>
              );
            })}
        </TBody>
      </Table>

      <Pagination meta={meta} page={page} onPage={setPage} noun="logs" />
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}

function ConfirmDeleteDialog({
  open,
  title,
  message,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch {
      setError('Operation failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader title={title} onClose={onClose} />
      <DialogBody>
        {error && <ErrorBox message={error} />}
        <p className="text-sm text-muted-foreground">{message}</p>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={go} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Delete
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
