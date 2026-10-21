import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { statusVariant } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import type { ChildResultRow } from '@/lib/dto';

interface Props {
  studentId: string;
}

export function ChildResults({ studentId }: Props) {
  const [rows, setRows] = useState<ChildResultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<{ data: ChildResultRow[] } | ChildResultRow[]>(`/parent/children/${studentId}/results?limit=100`)
      .then((res) => {
        if (cancelled) return;
        const body = res.data;
        const innerRows = Array.isArray(body)
          ? body
          : (body as { data: ChildResultRow[] }).data ?? [];
        setRows(innerRows);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load results.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <Table>
      <THead>
        <TR className="hover:bg-transparent">
          <TH>Exam</TH>
          <TH>Subject</TH>
          <TH className="text-right">Marks</TH>
          <TH>Grade</TH>
          <TH className="text-right">Percentage</TH>
        </TR>
      </THead>
      <TBody>
        {rows.length === 0 && (
          <TR className="hover:bg-transparent">
            <TD colSpan={5} className="py-10 text-center text-muted-foreground">
              No results available.
            </TD>
          </TR>
        )}
        {rows.map((r, i) => (
          <TR key={`${r.examId}-${r.subjectName}-${i}`}>
            <TD className="font-medium text-foreground">{r.examName}</TD>
            <TD>{r.subjectName}</TD>
            <TD className="text-right font-mono">
              {r.obtainedMarks} / {r.totalMarks}
            </TD>
            <TD>
              {r.grade ? (
                <Badge variant={statusVariant(r.grade)}>{r.grade}</Badge>
              ) : (
                '—'
              )}
            </TD>
            <TD className="text-right">{r.percentage.toFixed(1)}%</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
