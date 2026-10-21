import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useApiList } from '@/hooks/useApiList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Pagination } from '@/components/Pagination';
import type { AttendanceReportRow, AttendanceReportSummary, AttendanceDaySummary, AcademicSection } from '@/lib/dto';
import type { ListMeta } from '@/hooks/useApiList';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function monthAgoStr() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

interface ReportApiResponse {
  data: AttendanceReportRow[];
  meta: ListMeta;
  summary: AttendanceReportSummary;
}

export function AttendanceReport() {
  const [sectionId, setSectionId] = useState('');
  const [from, setFrom] = useState(monthAgoStr());
  const [to, setTo] = useState(todayStr());
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<AttendanceReportRow[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [summary, setSummary] = useState<AttendanceReportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [todaySummary, setTodaySummary] = useState<AttendanceDaySummary | null>(null);
  const [todayLoading, setTodayLoading] = useState(false);

  // Fetch sections for dropdown
  const { rows: sections } = useApiList<AcademicSection>({
    path: '/academics/sections',
    limit: 200,
  });

  // Load today's summary on mount
  useEffect(() => {
    let cancelled = false;
    setTodayLoading(true);
    api
      .get<AttendanceDaySummary>(`/attendance/summary?date=${todayStr()}`)
      .then((res) => {
        if (cancelled) return;
        const body = res.data;
        setTodaySummary(body as AttendanceDaySummary);
      })
      .catch(() => {/* silently fail for today summary */})
      .finally(() => {
        if (!cancelled) setTodayLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Load report on filter change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ from, to, page: String(page), limit: '20' });
    if (sectionId) qs.set('sectionId', sectionId);
    api
      .get<ReportApiResponse>(`/attendance/report?${qs}`)
      .then((res) => {
        if (cancelled) return;
        const body = res.data as unknown as ReportApiResponse;
        const innerRows = Array.isArray(body) ? (body as AttendanceReportRow[]) : body.data ?? [];
        const innerMeta = Array.isArray(body) ? (res.meta ?? null) : (body.meta ?? null);
        const innerSummary = Array.isArray(body) ? null : (body.summary ?? null);
        setRows(innerRows as AttendanceReportRow[]);
        setMeta(innerMeta as ListMeta | null);
        setSummary(innerSummary as AttendanceReportSummary | null);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load attendance report.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [sectionId, from, to, page]);

  return (
    <div className="space-y-6">
      {/* Today's quick summary card */}
      {(todayLoading || todaySummary) && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Today at a Glance
          </h3>
          {todayLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading today's summary…
            </div>
          ) : todaySummary ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                { label: 'Total Students', value: todaySummary.totalStudents, color: 'text-foreground' },
                { label: 'Present', value: todaySummary.present, color: 'text-emerald-600' },
                { label: 'Absent', value: todaySummary.absent, color: 'text-red-600' },
                { label: 'Late', value: todaySummary.late, color: 'text-amber-600' },
                { label: 'Unmarked', value: todaySummary.unmarked, color: 'text-muted-foreground' },
              ].map((item) => (
                <Card key={item.label}>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs font-medium text-muted-foreground">{item.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={`text-2xl font-semibold ${item.color}`}>{item.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Section</label>
          <div className="w-56">
            <SearchableSelect
              value={sections.map(s => ({ value: s.id, label: s.name })).find(o => o.value === sectionId) || null}
              onChange={(val: any) => { setSectionId(val?.value || ''); setPage(1); }}
              options={sections.map(s => ({ value: s.id, label: s.name }))}
              placeholder="All sections"
              isClearable
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            className="w-44"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <Input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1); }}
            className="w-44"
          />
        </div>
      </div>

      {/* Summary KPIs */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-foreground">{summary.totalStudents}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Attendance %</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-primary">
                {typeof summary.avgAttendancePct === 'number'
                  ? summary.avgAttendancePct.toFixed(1)
                  : '—'}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Present</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-emerald-600">{summary.totalPresent}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Absent</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-red-600">{summary.totalAbsent}</p>
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
            <TH>Name</TH>
            <TH>Adm No</TH>
            <TH>Section</TH>
            <TH className="text-right">Present</TH>
            <TH className="text-right">Absent</TH>
            <TH className="text-right">Attendance %</TH>
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
                No data for the selected filters.
              </TD>
            </TR>
          )}
          {!loading &&
            rows.map((r) => (
              <TR key={r.id}>
                <TD className="font-medium text-foreground">{r.fullName}</TD>
                <TD className="font-mono text-xs">{r.admissionNo}</TD>
                <TD>{r.sectionName}</TD>
                <TD className="text-right text-emerald-700">{r.presentDays}</TD>
                <TD className="text-right text-red-700">{r.absentDays}</TD>
                <TD className="text-right">
                  {typeof r.attendancePct === 'number' ? r.attendancePct.toFixed(1) : '—'}%
                </TD>
              </TR>
            ))}
        </TBody>
      </Table>

      <Pagination meta={meta} page={page} onPage={setPage} noun="students" />
    </div>
  );
}
