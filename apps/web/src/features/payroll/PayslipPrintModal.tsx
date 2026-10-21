/**
 * PayslipPrintModal — printable staff payslip.
 * Fetches GET /payroll/payslips/:id on open.
 */
import { useEffect, useState } from 'react';
import { Loader2, Printer } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { money, date, statusVariant } from '@/lib/format';
import type { FullPayslip } from '@/lib/dto';

interface PayslipPrintModalProps {
  open: boolean;
  payslipId: string;
  onClose: () => void;
}

export function PayslipPrintModal({ open, payslipId, onClose }: PayslipPrintModalProps) {
  const [payslip, setPayslip] = useState<FullPayslip | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !payslipId) return;
    setPayslip(null);
    setError(null);
    setLoading(true);

    api
      .get<FullPayslip>(`/payroll/payslips/${payslipId}`)
      .then((res) => setPayslip(res.data))
      .catch(() => setError('Could not load payslip details.'))
      .finally(() => setLoading(false));
  }, [open, payslipId]);

  async function downloadPdf() {
    try {
      await api.download(`/payroll/payslips/${payslipId}/pdf`);
    } catch {
      setError('Could not download PDF.');
    }
  }

  return (
    <>
      <style>{`
        @media print {
          body > *:not(#payslip-print-root) { display: none !important; }
          #payslip-print-root {
            position: static !important;
            background: none !important;
          }
          #payslip-print-root .print\\:hidden { display: none !important; }
          #payslip-print-root .dialog-backdrop { display: none !important; }
          #payslip-print-root [role="dialog"] {
            box-shadow: none !important;
            border: none !important;
            max-width: 100% !important;
            width: 100% !important;
            padding: 0 !important;
          }
        }
      `}</style>

      <div id="payslip-print-root">
        <Dialog open={open} onClose={onClose} className="max-w-3xl">
          <div className="print:hidden">
            <DialogHeader
              title="Print Payslip"
              description="Official salary slip"
              onClose={onClose}
            />
          </div>

          <DialogBody className="overflow-y-auto max-h-[75vh] print:max-h-none print:overflow-visible">
            {loading && (
              <div className="flex justify-center py-10 text-muted-foreground print:hidden">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">
                {error}
              </div>
            )}

            {payslip && (
              <div className="space-y-6 print:space-y-8 bg-white print:p-8">
                {/* Header */}
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-6">
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">EduCore ERP</h1>
                    <p className="text-muted-foreground mt-1">123 Education Lane, Knowledge City</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-2xl font-bold text-foreground uppercase tracking-wider">Payslip</h2>
                    <p className="text-muted-foreground font-medium mt-1">Period: {payslip.periodMonth}</p>
                    <div className="mt-2 print:hidden">
                       <Badge variant={statusVariant(payslip.status)}>{payslip.status}</Badge>
                    </div>
                  </div>
                </div>

                {/* Staff Details */}
                <div className="grid grid-cols-2 gap-8 rounded-xl border border-slate-200 bg-slate-50 p-6 print:border-slate-300 print:bg-transparent">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider border-b border-slate-200 pb-2">Employee Details</h3>
                    <div className="space-y-3">
                      <InfoRow label="Employee Name" value={payslip.staffName} />
                      <InfoRow label="Employee ID" value={payslip.staffId.slice(0, 8).toUpperCase()} />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider border-b border-slate-200 pb-2">Salary Details</h3>
                    <div className="space-y-3">
                      <InfoRow label="Payment Date" value={date(new Date().toISOString())} />
                      <InfoRow label="Base Salary" value={money(payslip.baseSalary)} />
                    </div>
                  </div>
                </div>

                {/* Salary Components */}
                <div className="grid grid-cols-2 gap-8">
                  {/* Earnings */}
                  <div>
                    <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider border-b-2 border-emerald-200 pb-2 mb-4">Earnings</h3>
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100">
                        <tr className="bg-slate-50 font-medium">
                          <td className="py-2 px-3">Base Salary</td>
                          <td className="py-2 px-3 text-right font-mono">{money(payslip.baseSalary)}</td>
                        </tr>
                        {payslip.components?.filter(c => c.componentType === 'allowance').map(c => (
                          <tr key={c.id}>
                            <td className="py-2 px-3 text-foreground">{c.name}</td>
                            <td className="py-2 px-3 text-right font-mono text-foreground">{money(c.amount)}</td>
                          </tr>
                        ))}
                        {payslip.bonus > 0 && (
                          <tr>
                            <td className="py-2 px-3 text-foreground">Bonus</td>
                            <td className="py-2 px-3 text-right font-mono text-emerald-600">{money(payslip.bonus)}</td>
                          </tr>
                        )}
                        <tr className="border-t-2 border-slate-200 font-bold bg-slate-50">
                          <td className="py-3 px-3">Total Earnings</td>
                          <td className="py-3 px-3 text-right font-mono text-emerald-700">
                            {money(payslip.baseSalary + payslip.allowances + payslip.bonus)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Deductions */}
                  <div>
                    <h3 className="text-sm font-bold text-red-800 uppercase tracking-wider border-b-2 border-red-200 pb-2 mb-4">Deductions</h3>
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {payslip.components?.filter(c => c.componentType === 'deduction').map(c => (
                          <tr key={c.id}>
                            <td className="py-2 px-3 text-foreground">{c.name}</td>
                            <td className="py-2 px-3 text-right font-mono text-foreground">{money(c.amount)}</td>
                          </tr>
                        ))}
                        {payslip.deductions === 0 && (
                          <tr>
                            <td className="py-2 px-3 text-muted-foreground italic" colSpan={2}>No deductions</td>
                          </tr>
                        )}
                        <tr className="border-t-2 border-slate-200 font-bold bg-slate-50">
                          <td className="py-3 px-3">Total Deductions</td>
                          <td className="py-3 px-3 text-right font-mono text-red-700">
                            {money(payslip.deductions)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Net Pay */}
                <div className="mt-8 rounded-xl border-2 border-primary/20 bg-primary/10 p-6 flex items-center justify-between print:border-slate-900 print:bg-transparent">
                  <div>
                    <p className="text-sm font-semibold text-primary uppercase tracking-widest print:text-foreground">Net Salary Payable</p>
                    <p className="text-xs text-primary mt-1 print:text-muted-foreground">Total Earnings minus Total Deductions</p>
                  </div>
                  <div className="text-4xl font-bold text-primary font-mono print:text-foreground">
                    {money(payslip.baseSalary + payslip.allowances + payslip.bonus - payslip.deductions)}
                  </div>
                </div>

                {/* Signatures */}
                <div className="mt-24 pt-8 grid grid-cols-2 gap-8 text-center text-sm font-medium text-foreground">
                  <div>
                    <div className="mx-auto w-48 border-t-2 border-slate-300 pt-2">
                      Employer Signature
                    </div>
                  </div>
                  <div>
                    <div className="mx-auto w-48 border-t-2 border-slate-300 pt-2">
                      Employee Signature
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 text-center text-xs text-muted-foreground print:block hidden">
                  This is a computer generated document and requires no stamp. Generated on {date(new Date().toISOString())}.
                </div>
              </div>
            )}
          </DialogBody>

          <DialogFooter className="print:hidden">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {payslip && (
              <>
                <Button variant="secondary" onClick={downloadPdf}>
                  Download PDF
                </Button>
                <Button onClick={() => window.print()}>
                  <Printer className="h-4 w-4" />
                  Print Payslip
                </Button>
              </>
            )}
          </DialogFooter>
        </Dialog>
      </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
