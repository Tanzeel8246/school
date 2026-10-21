import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { date, money, statusVariant } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Pagination } from '@/components/Pagination';
import type { ChildFeeRow, ChildFeeSummary } from '@/lib/dto';
import type { ListMeta } from '@/hooks/useApiList';

interface Props {
  studentId: string;
}

interface FeeResponse {
  data: ChildFeeRow[];
  meta: ListMeta;
  summary: ChildFeeSummary;
}

const STATUS_OPTIONS = ['', 'paid', 'partial', 'pending', 'overdue'];

export function ChildFees({ studentId }: Props) {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ChildFeeRow[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [summary, setSummary] = useState<ChildFeeSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ page: String(page), limit: '20' });
    if (status) qs.set('status', status);
    api
      .get<FeeResponse>(`/parent/children/${studentId}/fees?${qs}`)
      .then((res) => {
        if (cancelled) return;
        const body = res.data as unknown as FeeResponse;
        const innerRows = Array.isArray(body) ? (body as ChildFeeRow[]) : body.data ?? [];
        const innerMeta = Array.isArray(body) ? (res.meta ?? null) : (body.meta ?? null);
        const innerSummary = Array.isArray(body) ? null : (body.summary ?? null);
        setRows(innerRows as ChildFeeRow[]);
        setMeta(innerMeta as ListMeta | null);
        setSummary(innerSummary);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load fee data.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, status, page]);

  return (
    <div className="space-y-6">
      {/* Status filter */}
      <div className="flex items-center gap-3">
        <Select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="w-44"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s ? s[0].toUpperCase() + s.slice(1) : 'All statuses'}
            </option>
          ))}
        </Select>
      </div>

      {/* Summary KPIs */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Charged</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-foreground">{money(summary.totalCharged)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-emerald-600">{money(summary.totalPaid)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-red-600">{money(summary.totalOutstanding)}</p>
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
            <TH>Challan No</TH>
            <TH>Billing Month</TH>
            <TH className="text-right">Total</TH>
            <TH className="text-right">Paid</TH>
            <TH className="text-right">Outstanding</TH>
            <TH>Due Date</TH>
            <TH>Status</TH>
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
                No fee records found.
              </TD>
            </TR>
          )}
          {!loading &&
            rows.map((r) => (
              <TR key={r.id}>
                <TD className="font-mono text-xs">{r.challanNo}</TD>
                <TD>{r.billingMonth ?? '—'}</TD>
                <TD className="text-right">{money(r.total)}</TD>
                <TD className="text-right text-emerald-700">{money(r.paid)}</TD>
                <TD className="text-right text-red-700">{money(r.outstanding)}</TD>
                <TD>{date(r.dueDate)}</TD>
                <TD>
                  <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                </TD>
              </TR>
            ))}
        </TBody>
      </Table>

      <Pagination meta={meta} page={page} onPage={setPage} noun="invoices" />
    </div>
  );
}
