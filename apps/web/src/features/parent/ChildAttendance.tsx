import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { date, statusVariant } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Pagination } from '@/components/Pagination';
import type { ChildAttendanceRow, ChildAttendanceSummary } from '@/lib/dto';
import type { ListMeta } from '@/hooks/useApiList';

interface Props {
  studentId: string;
}

interface AttendanceResponse {
  data: ChildAttendanceRow[];
  meta: ListMeta;
  summary: ChildAttendanceSummary;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function monthAgoStr() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

export function ChildAttendance({ studentId }: Props) {
  const [from, setFrom] = useState(monthAgoStr());
  const [to, setTo] = useState(todayStr());
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ChildAttendanceRow[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [summary, setSummary] = useState<ChildAttendanceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ from, to, page: String(page), limit: '20' });
    api
      .get<AttendanceResponse>(`/parent/children/${studentId}/attendance?${qs}`)
      .then((res) => {
        if (cancelled) return;
        // The API returns { data: { data: rows[], meta, summary } }
        const body = res.data as unknown as AttendanceResponse;
        const innerRows = Array.isArray(body) ? (body as ChildAttendanceRow[]) : body.data ?? [];
        const innerMeta = Array.isArray(body) ? (res.meta ?? null) : (body.meta ?? null);
        const innerSummary = Array.isArray(body) ? null : (body.summary ?? null);
        setRows(innerRows as ChildAttendanceRow[]);
        setMeta(innerMeta as ListMeta | null);
        setSummary(innerSummary);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load attendance data.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, from, to, page]);

  return (
    <div className="space-y-6">
      {/* Date range filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">From</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            className="w-44"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">To</label>
          <Input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1); }}
            className="w-44"
          />
        </div>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Marked</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-foreground">{summary.totalMarked}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Present</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-emerald-600">{summary.present}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Absent</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-red-600">{summary.absent}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Attendance %</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-primary">
                {summary.attendancePct.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Date</TH>
            <TH>Status</TH>
            <TH>Section</TH>
          </TR>
        </THead>
        <TBody>
          {loading && (
            <TR className="hover:bg-transparent">
              <TD colSpan={3} className="py-10 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </TD>
            </TR>
          )}
          {!loading && rows.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={3} className="py-10 text-center text-muted-foreground">
                No attendance records found for the selected range.
              </TD>
            </TR>
          )}
          {!loading &&
            rows.map((r, i) => (
              <TR key={`${r.date}-${i}`}>
                <TD>{date(r.date)}</TD>
                <TD>
                  <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                </TD>
                <TD>{r.sectionName ?? '—'}</TD>
              </TR>
            ))}
        </TBody>
      </Table>

      <Pagination meta={meta} page={page} onPage={setPage} noun="records" />
    </div>
  );
}
