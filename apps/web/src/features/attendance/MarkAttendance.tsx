import { useEffect, useState, useCallback } from 'react';
import { Loader2, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useApiList } from '@/hooks/useApiList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import type { AcademicSection } from '@/lib/dto';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave' | 'half_day';
type Method = 'manual' | 'qr' | 'rfid' | 'biometric';

const STATUS_OPTIONS: AttendanceStatus[] = ['present', 'absent', 'late', 'leave', 'half_day'];
const METHOD_OPTIONS: { value: Method; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'qr', label: 'QR Code' },
  { value: 'rfid', label: 'RFID' },
  { value: 'biometric', label: 'Biometric' },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

interface RosterApiRow {
  studentId: string;
  admissionNo: string;
  rollNo: string | null;
  fullName: string;
  attendanceId: string | null;
  status: string | null;
}

interface RosterResponse {
  data: RosterApiRow[];
  date: string;
  sectionId: string;
  sectionName: string;
  className: string;
  marked: boolean;
}

export function MarkAttendance() {
  const { can } = useAuth();
  const canMark = can('attendance:mark');

  const [sectionId, setSectionId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(todayStr());
  const [method, setMethod] = useState<Method>('manual');
  const [scanInput, setScanInput] = useState('');

  const [roster, setRoster] = useState<RosterApiRow[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [rosterInfo, setRosterInfo] = useState<Omit<RosterResponse, 'data'> | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetch sections list for the selector
  const { rows: sections } = useApiList<AcademicSection>({
    path: '/academics/sections',
    limit: 200,
  });

  // Load roster when section + date are set
  const loadRoster = useCallback(() => {
    if (!sectionId || !attendanceDate) return;
    let cancelled = false;
    setRosterLoading(true);
    setRosterError(null);
    setSaveMsg(null);
    setSaveError(null);
    api
      .get<RosterResponse>(`/attendance/section/${sectionId}?date=${attendanceDate}`)
      .then((res) => {
        if (cancelled) return;
        // The response may be wrapped in envelope { data: RosterResponse }
        const body = res.data as unknown as RosterResponse;
        const rows: RosterApiRow[] = Array.isArray(body)
          ? (body as RosterApiRow[])
          : body.data ?? [];
        const info = Array.isArray(body)
          ? null
          : { date: body.date, sectionId: body.sectionId, sectionName: body.sectionName, className: body.className, marked: body.marked };
        setRoster(rows);
        setRosterInfo(info);
        // Pre-fill statuses from existing attendance
        const initial: Record<string, AttendanceStatus> = {};
        for (const r of rows) {
          if (r.status) initial[r.studentId] = r.status as AttendanceStatus;
          else initial[r.studentId] = 'present'; // default
        }
        setStatuses(initial);
      })
      .catch(() => {
        if (!cancelled) setRosterError('Could not load attendance roster.');
      })
      .finally(() => {
        if (!cancelled) setRosterLoading(false);
      });
    return () => { cancelled = true; };
  }, [sectionId, attendanceDate]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  // Parse scanner input and mark matching students as present
  function applyScanner() {
    const ids = scanInput
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) return;
    setStatuses((prev) => {
      const next = { ...prev };
      for (const r of roster) {
        if (ids.includes(r.admissionNo)) {
          next[r.studentId] = 'present';
        }
      }
      return next;
    });
    setScanInput('');
  }

  async function handleSave() {
    if (!sectionId || roster.length === 0) return;
    setSaving(true);
    setSaveMsg(null);
    setSaveError(null);
    try {
      const records = roster.map((r) => ({
        studentId: r.studentId,
        status: statuses[r.studentId] ?? 'present',
      }));
      const res = await api.post<{ saved: number; date: string; sectionId: string }>(
        `/attendance/section/${sectionId}/bulk`,
        { date: attendanceDate, method, records },
      );
      const saved = (res.data as { saved: number }).saved ?? records.length;
      setSaveMsg(`Saved ${saved} attendance records.`);
    } catch {
      setSaveError('Failed to save attendance. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Section</label>
          <div className="w-56">
            <SearchableSelect
              value={sections.map(s => ({ value: s.id, label: `${s.name}${s.teacherName ? ` (${s.teacherName})` : ''}` })).find(o => o.value === sectionId) || null}
              onChange={(val: any) => setSectionId(val?.value || '')}
              options={sections.map(s => ({ value: s.id, label: `${s.name}${s.teacherName ? ` (${s.teacherName})` : ''}` }))}
              placeholder="Select section..."
              isClearable
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Date</label>
          <Input
            type="date"
            value={attendanceDate}
            onChange={(e) => setAttendanceDate(e.target.value)}
            className="w-44"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Method</label>
          <Select
            value={method}
            onChange={(e) => setMethod(e.target.value as Method)}
            className="w-36"
          >
            {METHOD_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Scanner input for non-manual methods */}
      {method !== 'manual' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Scanner Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Paste or type admission numbers (comma or newline separated). Matched students will be
              marked Present.
            </p>
            <textarea
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              placeholder="ADM001, ADM002, ADM003…"
            />
            <Button variant="secondary" size="sm" onClick={applyScanner}>
              Apply to Roster
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Roster info badge */}
      {rosterInfo && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium">
            {rosterInfo.className} · {rosterInfo.sectionName}
          </span>
          {rosterInfo.marked && (
            <Badge variant="success">Already Marked</Badge>
          )}
        </div>
      )}

      {rosterError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {rosterError}
        </div>
      )}

      {saveMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {saveMsg}
        </div>
      )}

      {saveError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {saveError}
        </div>
      )}

      {!sectionId && (
        <div className="rounded-xl border border-border bg-card py-10 text-center text-sm text-muted-foreground">
          Select a section to load the attendance roster.
        </div>
      )}

      {sectionId && rosterLoading && (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {sectionId && !rosterLoading && roster.length > 0 && (
        <>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Roll</TH>
                <TH>Name</TH>
                <TH>Adm No</TH>
                <TH>Status</TH>
                <TH>Record</TH>
              </TR>
            </THead>
            <TBody>
              {roster.map((r) => (
                <TR key={r.studentId}>
                  <TD className="text-muted-foreground">{r.rollNo ?? '—'}</TD>
                  <TD className="font-medium text-foreground">{r.fullName}</TD>
                  <TD className="font-mono text-xs">{r.admissionNo}</TD>
                  <TD>
                    {canMark ? (
                      <Select
                        value={statuses[r.studentId] ?? 'present'}
                        onChange={(e) =>
                          setStatuses((prev) => ({
                            ...prev,
                            [r.studentId]: e.target.value as AttendanceStatus,
                          }))
                        }
                        className="w-32"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s.replace('_', ' ')}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Badge variant={
                        statuses[r.studentId] === 'present' ? 'success'
                        : statuses[r.studentId] === 'absent' ? 'destructive'
                        : 'warning'
                      }>
                        {statuses[r.studentId] ?? '—'}
                      </Badge>
                    )}
                  </TD>
                  <TD>
                    {r.attendanceId ? (
                      <Badge variant="success">Marked</Badge>
                    ) : (
                      <Badge variant="default">Unmarked</Badge>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          {canMark && (
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save All
              </Button>
            </div>
          )}
        </>
      )}

      {sectionId && !rosterLoading && roster.length === 0 && !rosterError && (
        <div className="rounded-xl border border-border bg-card py-10 text-center text-sm text-muted-foreground">
          No students found for this section.
        </div>
      )}
    </div>
  );
}
