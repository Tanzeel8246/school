/**
 * ResultCardModal — printable student result card.
 * Fetches GET /exams/:id/results/:studentId on open.
 */
import { useEffect, useState } from 'react';
import { Loader2, Printer } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { StudentResult } from '@/lib/dto';

const GRADE_CLASS: Record<string, string> = {
  'A+': 'bg-emerald-50 text-emerald-700',
  A: 'bg-green-50 text-green-700',
  'B+': 'bg-sky-50 text-sky-700',
  B: 'bg-primary/10 text-primary',
  'C+': 'bg-yellow-50 text-yellow-700',
  C: 'bg-amber-50 text-amber-700',
  D: 'bg-orange-50 text-orange-700',
  F: 'bg-red-50 text-red-700',
};

function GradeBadge({ grade }: { grade: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        GRADE_CLASS[grade] ?? 'bg-muted text-foreground',
      )}
    >
      {grade}
    </span>
  );
}

interface ResultCardModalProps {
  open: boolean;
  examId: string;
  studentId: string;
  examName: string;
  onClose: () => void;
}

export function ResultCardModal({
  open,
  examId,
  studentId,
  examName,
  onClose,
}: ResultCardModalProps) {
  const [result, setResult] = useState<StudentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setError(null);
    setLoading(true);

    api
      .get<StudentResult>(`/exams/${examId}/results/${studentId}`)
      .then((res) => setResult(res.data))
      .catch(() => setError('Could not load result card.'))
      .finally(() => setLoading(false));
  }, [open, examId, studentId]);

  return (
    <>
      {/* Inject print styles that hide the dialog backdrop and show only the card */}
      <style>{`
        @media print {
          body > *:not(#result-card-print-root) { display: none !important; }
          #result-card-print-root {
            position: static !important;
            background: none !important;
          }
          #result-card-print-root .print\\:hidden { display: none !important; }
          #result-card-print-root .dialog-backdrop { display: none !important; }
          #result-card-print-root [role="dialog"] {
            box-shadow: none !important;
            border: none !important;
            max-width: 100% !important;
            width: 100% !important;
          }
        }
      `}</style>

      <div id="result-card-print-root">
        <Dialog open={open} onClose={onClose} className="max-w-2xl">
          <DialogHeader
            title="Result Card"
            description={examName}
            onClose={onClose}
          />

          <DialogBody className="overflow-y-auto max-h-[75vh]">
            {loading && (
              <div className="flex justify-center py-10 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {result && (
              <div className="space-y-5">
                {/* Card header */}
                <div className="text-center border-b border-border pb-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    School ERP
                  </p>
                  <h2 className="text-xl font-bold text-foreground mt-1">Result Card</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{examName}</p>
                </div>

                {/* Student info */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm rounded-lg border border-slate-100 bg-muted/50 px-4 py-3">
                  <InfoRow label="Student Name" value={result.studentName} />
                  <InfoRow label="Admission No" value={result.admissionNo} />
                  <InfoRow label="Roll No" value={result.rollNo ?? '—'} />
                  <InfoRow label="Position" value={`${result.position}`} />
                </div>

                {/* Subject results table */}
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                          Subject
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                          Total
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                          Obtained
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">
                          Grade
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.subjectResults.map((sr) => (
                        <tr key={sr.subjectId} className="hover:bg-muted/50">
                          <td className="px-3 py-2 font-medium text-foreground">
                            {sr.subjectName}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                            {sr.totalMarks}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs text-foreground font-semibold">
                            {sr.isAbsent ? (
                              <span className="text-muted-foreground">AB</span>
                            ) : (
                              sr.marksObtained
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {sr.grade ? <GradeBadge grade={sr.grade} /> : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {sr.isAbsent ? (
                              <Badge variant="warning">Absent</Badge>
                            ) : sr.marksObtained >= (sr.totalMarks * 0.33) ? (
                              <Badge variant="success">Pass</Badge>
                            ) : (
                              <Badge variant="destructive">Fail</Badge>
                            )}
                          </td>
                        </tr>
                      ))}

                      {/* Footer totals row */}
                      <tr className="bg-muted/50 font-semibold border-t-2 border-border">
                        <td className="px-3 py-2 text-foreground">Total</td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-foreground">
                          {result.totalMarks}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-foreground">
                          {result.totalObtained}
                        </td>
                        <td className="px-3 py-2 text-center text-muted-foreground">—</td>
                        <td className="px-3 py-2 text-center text-muted-foreground">—</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Summary row */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 rounded-xl border border-border bg-muted/50 px-4 py-3">
                  <SummaryItem label="Percentage" value={`${result.percentage.toFixed(1)}%`} />
                  <SummaryItem label="GPA" value={result.gpa.toFixed(2)} />
                  <SummaryItem label="Grade" value={<GradeBadge grade={result.grade} />} />
                  <SummaryItem label="Position" value={`${result.position}`} />
                  <SummaryItem
                    label="Result"
                    value={
                      <Badge variant={result.isPassed ? 'success' : 'destructive'}>
                        {result.isPassed ? 'PASS' : 'FAIL'}
                      </Badge>
                    }
                    className="col-span-2 sm:col-span-2"
                  />
                </div>
              </div>
            )}
          </DialogBody>

          <DialogFooter className="print:hidden">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {result && (
              <Button onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Print
              </Button>
            )}
          </DialogFooter>
        </Dialog>
      </div>
    </>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-0.5', className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="font-semibold text-foreground text-sm">{value}</div>
    </div>
  );
}
