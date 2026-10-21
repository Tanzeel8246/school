/**
 * FeeInvoicePrintModal — printable fee invoice / challan.
 * Fetches GET /fees/invoices/:id on open.
 */
import { useEffect, useState } from 'react';
import { Loader2, Printer } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { money, date, statusVariant } from '@/lib/format';
import type { Invoice, InvoicePayment } from '@/lib/dto';

interface FeeInvoicePrintModalProps {
  open: boolean;
  invoiceId: string;
  onClose: () => void;
}

export function FeeInvoicePrintModal({ open, invoiceId, onClose }: FeeInvoicePrintModalProps) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !invoiceId) return;
    setInvoice(null);
    setError(null);
    setLoading(true);

    api
      .get<Invoice>(`/fees/invoices/${invoiceId}`)
      .then((res) => setInvoice(res.data))
      .catch(() => setError('Could not load invoice details.'))
      .finally(() => setLoading(false));
  }, [open, invoiceId]);

  return (
    <>
      <style>{`
        @media print {
          body > *:not(#invoice-print-root) { display: none !important; }
          #invoice-print-root {
            position: static !important;
            background: none !important;
          }
          #invoice-print-root .print\\:hidden { display: none !important; }
          #invoice-print-root .dialog-backdrop { display: none !important; }
          #invoice-print-root [role="dialog"] {
            box-shadow: none !important;
            border: none !important;
            max-width: 100% !important;
            width: 100% !important;
            padding: 0 !important;
          }
        }
      `}</style>

      <div id="invoice-print-root">
        <Dialog open={open} onClose={onClose} className="max-w-3xl">
          <div className="print:hidden">
            <DialogHeader
              title="Print Invoice"
              description="Fee Challan Form"
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

            {invoice && (
              <div className="space-y-6 print:space-y-8 bg-white print:p-8">
                {/* Header */}
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-6">
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">EduCore ERP</h1>
                    <p className="text-muted-foreground mt-1">123 Education Lane, Knowledge City</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-2xl font-bold text-foreground uppercase tracking-wider">Fee Challan</h2>
                    <p className="text-muted-foreground font-medium mt-1">Challan No: <span className="font-mono text-foreground">{invoice.challanNo}</span></p>
                    <div className="mt-2 print:hidden">
                       <Badge variant={statusVariant(invoice.status)}>{invoice.status}</Badge>
                    </div>
                  </div>
                </div>

                {/* Details Section */}
                <div className="grid grid-cols-2 gap-8 rounded-xl border border-slate-200 bg-slate-50 p-6 print:border-slate-300 print:bg-transparent">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider border-b border-slate-200 pb-2">Billed To</h3>
                    <div className="space-y-3">
                      <InfoRow label="Student Name" value={invoice.studentName} />
                      <InfoRow label="Admission No" value={invoice.studentId.slice(0, 8).toUpperCase()} />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider border-b border-slate-200 pb-2">Invoice Details</h3>
                    <div className="space-y-3">
                      <InfoRow label="Billing Month" value={invoice.billingMonth} />
                      <InfoRow label="Due Date" value={date(invoice.dueDate)} />
                    </div>
                  </div>
                </div>

                {/* Lines Table */}
                <div>
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider border-b-2 border-slate-200 pb-2 mb-4">Fee Particulars</h3>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 border-b-2 border-slate-300">
                      <tr>
                        <th className="py-3 px-4 text-left font-semibold text-foreground">Description</th>
                        <th className="py-3 px-4 text-right font-semibold text-foreground">Amount (PKR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoice.lines?.map((l) => (
                        <tr key={l.feeHeadId}>
                          <td className="py-3 px-4 text-foreground">{l.feeHeadName}</td>
                          <td className="py-3 px-4 text-right font-mono text-foreground">{money(l.amount)}</td>
                        </tr>
                      ))}
                      {invoice.lines?.length === 0 && (
                        <tr>
                          <td className="py-3 px-4 text-muted-foreground italic" colSpan={2}>No particulars found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Totals Section */}
                <div className="flex justify-end pt-4">
                  <div className="w-full max-w-sm rounded-lg border border-slate-200 p-4 space-y-2 text-sm bg-slate-50 print:bg-transparent print:border-slate-300">
                    <SummaryRow label="Subtotal" value={money(invoice.subtotal)} />
                    {invoice.discount > 0 && <SummaryRow label="Discount" value={`-${money(invoice.discount)}`} />}
                    {invoice.fine > 0 && <SummaryRow label="Fine / Late Fee" value={`+${money(invoice.fine)}`} />}
                    <div className="border-t border-slate-200 pt-2 mt-2">
                      <SummaryRow label="Total Amount" value={money(invoice.total)} strong />
                    </div>
                    <div className="border-t-2 border-slate-300 pt-2 mt-2">
                      <SummaryRow label="Amount Paid" value={money(invoice.paid)} />
                      <div className="mt-2 text-lg">
                        <SummaryRow label="Balance Due" value={money(invoice.outstanding)} strong className="text-red-700" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payments History if paid */}
                {invoice.payments && invoice.payments.length > 0 && (
                  <div className="pt-6">
                     <h3 className="text-sm font-bold text-foreground uppercase tracking-wider border-b-2 border-slate-200 pb-2 mb-4">Payment Receipt</h3>
                     <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3 text-left font-medium text-muted-foreground">Date</th>
                          <th className="py-2 px-3 text-left font-medium text-muted-foreground">Method</th>
                          <th className="py-2 px-3 text-left font-medium text-muted-foreground">Reference</th>
                          <th className="py-2 px-3 text-right font-medium text-muted-foreground">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {invoice.payments.map((p: InvoicePayment) => (
                          <tr key={p.id}>
                            <td className="py-2 px-3 text-foreground">{date(p.paidAt)}</td>
                            <td className="py-2 px-3 text-foreground capitalize">{p.method}</td>
                            <td className="py-2 px-3 text-foreground">{p.referenceNo || '—'}</td>
                            <td className="py-2 px-3 text-right font-mono text-emerald-700 font-medium">{money(p.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                     </table>
                  </div>
                )}

                {/* Footer notes & Signatures */}
                <div className="mt-16 border-t-2 border-slate-200 pt-8 grid grid-cols-2 gap-8 text-sm text-muted-foreground">
                  <div>
                     <p className="font-medium text-foreground mb-1">Instructions:</p>
                     <ul className="list-disc pl-4 space-y-1 text-xs">
                        <li>Please pay before the due date to avoid late fees.</li>
                        <li>Cash, cheque, and online transfers are accepted.</li>
                        <li>This challan is valid only for the stated billing month.</li>
                     </ul>
                  </div>
                  <div className="text-center pt-10">
                    <div className="mx-auto w-48 border-t-2 border-slate-400 pt-2 font-medium text-foreground">
                      Authorized Signature / Stamp
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 text-center text-xs text-muted-foreground print:block hidden">
                  Generated on {date(new Date().toISOString())} by EduCore ERP.
                </div>
              </div>
            )}
          </DialogBody>

          <DialogFooter className="print:hidden">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {invoice && (
              <Button onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Print Invoice
              </Button>
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

function SummaryRow({ label, value, strong, className }: { label: string; value: string; strong?: boolean; className?: string }) {
  return (
    <div className={cn("flex justify-between items-center", className)}>
      <span className={strong ? "font-semibold" : ""}>{label}</span>
      <span className={cn("font-mono", strong ? "font-bold text-foreground" : "text-foreground")}>{value}</span>
    </div>
  );
}
