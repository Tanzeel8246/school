/**
 * FeesPage — tabbed: Fee Heads | Invoices | Collection | Defaulters
 * All money displayed via money(), all API sends use toMinor().
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Loader2,
  Receipt,
  Bell,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useApiList } from '@/hooks/useApiList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Card, CardContent } from '@/components/ui/card';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { RowMenu } from '@/components/RowMenu';
import { Pagination } from '@/components/Pagination';
import { money, toMinor, date, statusVariant } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
  FeeHead,
  Invoice,
  DefaulterRow,
  CollectionRow,
  InvoicePayment,
} from '@/lib/dto';
import { FeeInvoicePrintModal } from './FeeInvoicePrintModal';

// ─── Tab bar ──────────────────────────────────────────────────────────────────

type Tab = 'heads' | 'invoices' | 'collection' | 'defaulters';

const TABS: { id: Tab; label: string }[] = [
  { id: 'heads', label: 'Fee Heads' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'collection', label: 'Collection' },
  { id: 'defaulters', label: 'Defaulters' },
];

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex gap-1 border-b border-border">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
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

export function FeesPage() {
  const [tab, setTab] = useState<Tab>('heads');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Receipt className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Fees</h1>
          <p className="text-sm text-muted-foreground">Manage fee heads, invoices, collections and defaulters.</p>
        </div>
      </div>

      <TabBar active={tab} onChange={setTab} />

      {tab === 'heads' && <FeeHeadsTab />}
      {tab === 'invoices' && <InvoicesTab />}
      {tab === 'collection' && <CollectionTab />}
      {tab === 'defaulters' && <DefaultersTab />}
    </div>
  );
}

// ─── Fee Heads tab ────────────────────────────────────────────────────────────

function FeeHeadsTab() {
  const { can } = useAuth();
  const canWrite = can('fees:write');

  const { rows, loading, error, refetch } = useApiList<FeeHead>({
    path: '/fees/heads',
    limit: 50,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FeeHead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeeHead | null>(null);

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (h: FeeHead) => { setEditing(h); setFormOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canWrite && (
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" />
            New Fee Head
          </Button>
        )}
      </div>

      {error && <ErrorBox message={error} />}

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Name</TH>
            <TH>Amount</TH>
            <TH>Recurring</TH>
            <TH>Applicable To</TH>
            {canWrite && <TH className="text-right">Actions</TH>}
          </TR>
        </THead>
        <TBody>
          {loading && (
            <TR className="hover:bg-transparent">
              <TD colSpan={5} className="py-10 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </TD>
            </TR>
          )}
          {!loading && rows.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={5} className="py-10 text-center text-muted-foreground">No fee heads configured.</TD>
            </TR>
          )}
          {!loading && rows.map((h) => (
            <TR key={h.id}>
              <TD className="font-medium text-foreground">{h.name}</TD>
              <TD className="font-mono">{money(h.amount)}</TD>
              <TD>
                <Badge variant={h.isRecurring ? 'success' : 'default'}>
                  {h.isRecurring ? 'Yes' : 'No'}
                </Badge>
              </TD>
              <TD className="capitalize">{h.applicableTo}</TD>
              {canWrite && (
                <TD className="text-right">
                  <RowMenu
                    items={[
                      { label: 'Edit', onClick: () => openEdit(h) },
                      { label: 'Delete', onClick: () => setDeleteTarget(h), danger: true },
                    ]}
                  />
                </TD>
              )}
            </TR>
          ))}
        </TBody>
      </Table>

      <FeeHeadFormDialog
        open={formOpen}
        head={editing}
        onClose={() => setFormOpen(false)}
        onSaved={refetch}
      />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        title="Delete Fee Head"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.del(`/fees/heads/${deleteTarget.id}`);
          setDeleteTarget(null);
          refetch();
        }}
      />
    </div>
  );
}

// Fee Head form dialog

interface FeeHeadFormProps {
  open: boolean;
  head: FeeHead | null;
  onClose: () => void;
  onSaved: () => void;
}

function FeeHeadFormDialog({ open, head, onClose, onSaved }: FeeHeadFormProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [applicableTo, setApplicableTo] = useState('all');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate form when editing
  useEffect(() => {
    if (head) {
      setName(head.name);
      setAmount(String(head.amount / 100)); // minor → major for display
      setIsRecurring(head.isRecurring);
      setApplicableTo(head.applicableTo);
      setDisplayOrder(String(head.displayOrder));
    } else {
      setName(''); setAmount(''); setIsRecurring(false); setApplicableTo('all'); setDisplayOrder('0');
    }
    setError(null);
  }, [head, open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name,
        amount: toMinor(amount),
        isRecurring,
        applicableTo,
        displayOrder: Number(displayOrder),
      };
      if (head) {
        await api.patch(`/fees/heads/${head.id}`, payload);
      } else {
        await api.post('/fees/heads', payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not save fee head.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={submit}>
        <DialogHeader
          title={head ? 'Edit Fee Head' : 'New Fee Head'}
          onClose={onClose}
        />
        <DialogBody className="space-y-4 overflow-y-auto max-h-[70vh]">
          {error && <ErrorBox message={error} />}
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Tuition Fee" />
          </Field>
          <Field label="Amount (PKR)">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="e.g. 5000"
            />
          </Field>
          <Field label="Applicable To">
            <Select value={applicableTo} onChange={(e) => setApplicableTo(e.target.value)}>
              <option value="all">All</option>
              <option value="class">Class</option>
              <option value="section">Section</option>
            </Select>
          </Field>
          <Field label="Display Order">
            <Input
              type="number"
              min="0"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Recurring monthly fee
          </label>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {head ? 'Save Changes' : 'Create'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// ─── Invoices tab ─────────────────────────────────────────────────────────────

function InvoicesTab() {
  const { can } = useAuth();
  const canWrite = can('fees:write');
  const canCollect = can('fees:collect');

  const [studentId, setStudentId] = useState('');
  const [status, setStatus] = useState('');
  const [month, setMonth] = useState('');

  const { rows, meta, loading, error, page, setPage, refetch } = useApiList<Invoice>({
    path: '/fees/invoices',
    params: { studentId: studentId || undefined, status: status || undefined, month: month || undefined },
  });

  const { rows: studentList } = useApiList<{ id: string; user: { firstName: string; lastName: string }; admissionNo: string }>({ path: '/students', limit: 1000 });
  const studentOptions = studentList.map(s => ({ value: s.id, label: `${s.user?.firstName || ''} ${s.user?.lastName || ''} (${s.admissionNo})` }));

  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [waiveTarget, setWaiveTarget] = useState<Invoice | null>(null);
  const [newInvOpen, setNewInvOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  // Fetch full invoice detail (with lines + payments)
  async function openDetail(inv: Invoice) {
    setDetailLoading(true);
    try {
      const res = await api.get<Invoice>(`/fees/invoices/${inv.id}`);
      setViewInvoice(res.data);
    } catch {
      setViewInvoice(inv); // fallback to list row data
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters + actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-56">
          <SearchableSelect
            value={studentOptions.find(o => o.value === studentId) || null}
            onChange={(val: any) => setStudentId(val?.value || '')}
            options={studentOptions}
            isClearable
            placeholder="Search student..."
          />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="waived">Waived</option>
          <option value="overdue">Overdue</option>
        </Select>
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-44"
          placeholder="YYYY-MM"
        />
        <div className="ml-auto flex gap-2">
          {canWrite && (
            <>
              <Button variant="outline" onClick={() => setBulkOpen(true)}>
                Bulk Generate
              </Button>
              <Button onClick={() => setNewInvOpen(true)}>
                <Plus className="h-4 w-4" />
                New Invoice
              </Button>
            </>
          )}
        </div>
      </div>

      {error && <ErrorBox message={error} />}
      {detailLoading && (
        <div className="flex justify-center py-4 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Challan</TH>
            <TH>Student</TH>
            <TH>Month</TH>
            <TH>Total</TH>
            <TH>Paid</TH>
            <TH>Outstanding</TH>
            <TH>Status</TH>
            <TH>Due</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {loading && (
            <TR className="hover:bg-transparent">
              <TD colSpan={9} className="py-10 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </TD>
            </TR>
          )}
          {!loading && rows.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={9} className="py-10 text-center text-muted-foreground">No invoices found.</TD>
            </TR>
          )}
          {!loading && rows.map((inv) => (
            <TR key={inv.id}>
              <TD className="font-mono text-xs">{inv.challanNo}</TD>
              <TD className="font-medium text-foreground">{inv.studentName}</TD>
              <TD>{inv.billingMonth}</TD>
              <TD className="font-mono">{money(inv.total)}</TD>
              <TD className="font-mono">{money(inv.paid)}</TD>
              <TD className="font-mono">{money(inv.outstanding)}</TD>
              <TD><Badge variant={statusVariant(inv.status)}>{inv.status}</Badge></TD>
              <TD>{date(inv.dueDate)}</TD>
              <TD className="text-right">
                <RowMenu
                  items={[
                    { label: 'View Details', onClick: () => openDetail(inv) },
                    { label: 'Print Challan', onClick: () => setPrintInvoice(inv) },
                    {
                      label: 'Waive',
                      onClick: () => setWaiveTarget(inv),
                      hidden: !canWrite || inv.status === 'waived' || inv.status === 'paid',
                    },
                  ]}
                />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Pagination meta={meta} page={page} onPage={setPage} noun="invoices" />

      {/* Invoice detail dialog */}
      {viewInvoice && (
        <InvoiceDetailDialog
          open={!!viewInvoice}
          invoice={viewInvoice}
          canCollect={canCollect}
          onClose={() => setViewInvoice(null)}
          onPaid={() => { setViewInvoice(null); refetch(); }}
        />
      )}

      {/* Waive dialog */}
      {waiveTarget && (
        <WaiveDialog
          open={!!waiveTarget}
          invoice={waiveTarget}
          onClose={() => setWaiveTarget(null)}
          onDone={() => { setWaiveTarget(null); refetch(); }}
        />
      )}

      {/* New invoice dialog */}
      <NewInvoiceDialog
        open={newInvOpen}
        onClose={() => setNewInvOpen(false)}
        onSaved={refetch}
      />

      {/* Print invoice modal */}
      {printInvoice && (
        <FeeInvoicePrintModal
          open={!!printInvoice}
          invoiceId={printInvoice.id}
          onClose={() => setPrintInvoice(null)}
        />
      )}

      {/* Bulk generate dialog */}
      <BulkGenerateDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onDone={refetch}
      />
    </div>
  );
}

// Invoice detail dialog

function InvoiceDetailDialog({
  open,
  invoice,
  canCollect,
  onClose,
  onPaid,
}: {
  open: boolean;
  invoice: Invoice;
  canCollect: boolean;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [payOpen, setPayOpen] = useState(false);

  return (
    <Dialog open={open} onClose={onClose} className="max-w-2xl">
      <DialogHeader
        title={`Invoice ${invoice.challanNo}`}
        description={`${invoice.studentName} · ${invoice.billingMonth}`}
        onClose={onClose}
      />
      <DialogBody className="space-y-4 overflow-y-auto max-h-[70vh]">
        {/* Lines */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fee Lines</p>
          {invoice.lines && invoice.lines.length > 0 ? (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Description</TH>
                  <TH className="text-right">Amount</TH>
                </TR>
              </THead>
              <TBody>
                {invoice.lines.map((l) => (
                  <TR key={l.feeHeadId}>
                    <TD>{l.feeHeadName}</TD>
                    <TD className="text-right font-mono">{money(l.amount)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No lines.</p>
          )}
        </div>

        {/* Totals */}
        <div className="rounded-lg border border-border p-3 space-y-1.5 text-sm">
          <SummaryRow label="Subtotal" value={money(invoice.subtotal)} />
          {invoice.discount > 0 && <SummaryRow label="Discount" value={`-${money(invoice.discount)}`} />}
          {invoice.fine > 0 && <SummaryRow label="Fine" value={`+${money(invoice.fine)}`} />}
          <div className="border-t border-slate-100 pt-1.5">
            <SummaryRow label="Total" value={money(invoice.total)} strong />
            <SummaryRow label="Paid" value={money(invoice.paid)} />
            <SummaryRow label="Outstanding" value={money(invoice.outstanding)} strong />
          </div>
        </div>

        {/* Payment history */}
        {invoice.payments && invoice.payments.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payments</p>
            <ul className="space-y-1.5">
              {invoice.payments.map((p: InvoicePayment) => (
                <li key={p.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">{date(p.paidAt)} · {p.method}{p.referenceNo ? ` · ${p.referenceNo}` : ''}</span>
                  <span className="font-mono font-medium">{money(p.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Close</Button>
        {canCollect && invoice.status !== 'paid' && invoice.status !== 'waived' && (
          <Button onClick={() => setPayOpen(true)}>Record Payment</Button>
        )}
      </DialogFooter>

      <PayDialog
        open={payOpen}
        invoiceId={invoice.id}
        onClose={() => setPayOpen(false)}
        onPaid={onPaid}
      />
    </Dialog>
  );
}

// Pay dialog

function PayDialog({
  open,
  invoiceId,
  onClose,
  onPaid,
}: {
  open: boolean;
  invoiceId: string;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'bank' | 'online'>('cash');
  const [referenceNo, setReferenceNo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setAmount(''); setMethod('cash'); setReferenceNo(''); setError(null); }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post(`/fees/invoices/${invoiceId}/pay`, {
        amount: toMinor(amount),
        method,
        referenceNo: referenceNo || undefined,
      });
      onPaid();
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not record payment.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={submit}>
        <DialogHeader title="Record Payment" onClose={onClose} />
        <DialogBody className="space-y-4">
          {error && <ErrorBox message={error} />}
          <Field label="Amount (PKR)">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="e.g. 5000"
            />
          </Field>
          <Field label="Payment Method">
            <Select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="online">Online</option>
            </Select>
          </Field>
          <Field label="Reference No (optional)">
            <Input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder="Cheque / transaction ref" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Record
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// Waive dialog

function WaiveDialog({
  open,
  invoice,
  onClose,
  onDone,
}: {
  open: boolean;
  invoice: Invoice;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setReason(''); setError(null); } }, [open]);

  async function confirm() {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/fees/invoices/${invoice.id}/waive`, { reason: reason || undefined });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not waive invoice.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader title="Waive Invoice" description={`Challan ${invoice.challanNo}`} onClose={onClose} />
      <DialogBody className="space-y-4">
        {error && <ErrorBox message={error} />}
        <p className="text-sm text-muted-foreground">
          Waive outstanding amount of <strong>{money(invoice.outstanding)}</strong>?
        </p>
        <Field label="Reason (optional)">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. scholarship, hardship…" />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="destructive" onClick={confirm} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Waive
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

// New invoice dialog

function NewInvoiceDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [studentId, setStudentId] = useState('');
  const [billingMonth, setBillingMonth] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [discount, setDiscount] = useState('');
  const [fine, setFine] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedHeads, setSelectedHeads] = useState<string[]>([]);
  const [feeHeads, setFeeHeads] = useState<FeeHead[]>([]);
  const [headsLoading, setHeadsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { rows: studentList } = useApiList<{ id: string; user: { firstName: string; lastName: string }; admissionNo: string }>({ path: '/students', limit: 1000 });
  const studentOptions = studentList.map(s => ({ value: s.id, label: `${s.user?.firstName || ''} ${s.user?.lastName || ''} (${s.admissionNo})` }));

  // Load fee heads when dialog opens
  useEffect(() => {
    if (!open) return;
    setStudentId(''); setBillingMonth(''); setDueDate(''); setDiscount(''); setFine(''); setNotes('');
    setSelectedHeads([]); setError(null);
    setHeadsLoading(true);
    api.get<FeeHead[]>('/fees/heads?limit=100')
      .then((r) => setFeeHeads(r.data ?? []))
      .catch(() => setFeeHeads([]))
      .finally(() => setHeadsLoading(false));
  }, [open]);

  function toggleHead(id: string) {
    setSelectedHeads((prev) =>
      prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id]
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/fees/invoices', {
        studentId,
        billingMonth,
        dueDate,
        feeHeadIds: selectedHeads,
        discount: discount ? toMinor(discount) : undefined,
        fine: fine ? toMinor(fine) : undefined,
        notes: notes || undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not create invoice.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-xl">
      <form onSubmit={submit}>
        <DialogHeader title="New Invoice" onClose={onClose} />
        <DialogBody className="space-y-4 overflow-y-auto max-h-[70vh]">
          {error && <ErrorBox message={error} />}
          <Field label="Student">
            <SearchableSelect
              value={studentOptions.find(o => o.value === studentId) || null}
              onChange={(val: any) => setStudentId(val?.value || '')}
              options={studentOptions}
              placeholder="Select student..."
              required
            />
          </Field>
          <Field label="Billing Month">
            <Input type="month" value={billingMonth} onChange={(e) => setBillingMonth(e.target.value)} required />
          </Field>
          <Field label="Due Date">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
          </Field>

          {/* Fee head multi-select checkboxes */}
          <div className="space-y-1.5">
            <Label>Fee Heads</Label>
            {headsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-2 space-y-1">
                {feeHeads.map((h) => (
                  <label key={h.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 px-1 py-0.5 rounded">
                    <input
                      type="checkbox"
                      checked={selectedHeads.includes(h.id)}
                      onChange={() => toggleHead(h.id)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <span className="flex-1">{h.name}</span>
                    <span className="font-mono text-muted-foreground">{money(h.amount)}</span>
                  </label>
                ))}
                {feeHeads.length === 0 && <p className="text-sm text-muted-foreground px-1">No fee heads.</p>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Discount (PKR, optional)">
              <Input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
            </Field>
            <Field label="Fine (PKR, optional)">
              <Input type="number" min="0" step="0.01" value={fine} onChange={(e) => setFine(e.target.value)} placeholder="0" />
            </Field>
          </div>
          <Field label="Notes (optional)">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any remarks…" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// Bulk generate dialog

function BulkGenerateDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [classId, setClassId] = useState('');
  const [billingMonth, setBillingMonth] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedHeads, setSelectedHeads] = useState<string[]>([]);
  const [feeHeads, setFeeHeads] = useState<FeeHead[]>([]);
  const [result, setResult] = useState<{ generated: number; skipped: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { rows: classList } = useApiList<{ id: string; name: string }>({ path: '/academics/classes', limit: 100 });
  const classOptions = classList.map(c => ({ value: c.id, label: c.name }));

  useEffect(() => {
    if (!open) return;
    setClassId(''); setBillingMonth(''); setDueDate(''); setSelectedHeads([]); setResult(null); setError(null);
    api.get<FeeHead[]>('/fees/heads?limit=100')
      .then((r) => setFeeHeads(r.data ?? []))
      .catch(() => setFeeHeads([]));
  }, [open]);

  function toggleHead(id: string) {
    setSelectedHeads((prev) =>
      prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id]
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ generated: number; skipped: number }>('/fees/invoices/bulk-generate', {
        classId,
        billingMonth,
        dueDate,
        feeHeadIds: selectedHeads,
      });
      setResult(res.data);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Bulk generation failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-xl">
      <form onSubmit={submit}>
        <DialogHeader title="Bulk Generate Invoices" onClose={onClose} />
        <DialogBody className="space-y-4 overflow-y-auto max-h-[70vh]">
          {error && <ErrorBox message={error} />}
          {result && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Generated <strong>{result.generated}</strong> invoices, <strong>{result.skipped}</strong> skipped (already exist).
            </div>
          )}
          <Field label="Class">
            <SearchableSelect
              value={classOptions.find(o => o.value === classId) || null}
              onChange={(val: any) => setClassId(val?.value || '')}
              options={classOptions}
              placeholder="Select class..."
              required
            />
          </Field>
          <Field label="Billing Month">
            <Input type="month" value={billingMonth} onChange={(e) => setBillingMonth(e.target.value)} required />
          </Field>
          <Field label="Due Date">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
          </Field>

          <div className="space-y-1.5">
            <Label>Fee Heads</Label>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-2 space-y-1">
              {feeHeads.map((h) => (
                <label key={h.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 px-1 py-0.5 rounded">
                  <input
                    type="checkbox"
                    checked={selectedHeads.includes(h.id)}
                    onChange={() => toggleHead(h.id)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="flex-1">{h.name}</span>
                  <span className="font-mono text-muted-foreground">{money(h.amount)}</span>
                </label>
              ))}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          {!result && (
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Generate
            </Button>
          )}
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// ─── Collection tab ───────────────────────────────────────────────────────────

function CollectionTab() {
  // Default to current month
  const defaultPeriod = new Date().toISOString().slice(0, 7);
  const [period, setPeriod] = useState(defaultPeriod);
  const [groupBy, setGroupBy] = useState<'day' | 'month'>('day');
  const [rows, setRows] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ period, groupBy });
      const res = await api.get<CollectionRow[]>(`/fees/collection-report?${qs}`);
      setRows(res.data ?? []);
    } catch {
      setError('Could not load collection report.');
    } finally {
      setLoading(false);
    }
  }, [period, groupBy]);

  useEffect(() => { load(); }, [load]);

  const total = rows.reduce((s, r) => s + r.totalCollected, 0);
  const totalCount = rows.reduce((s, r) => s + r.paymentCount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Field label="Period" className="flex-row items-center gap-2">
          <Input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-44"
          />
        </Field>
        <Field label="Group By" className="flex-row items-center gap-2">
          <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value as 'day' | 'month')} className="w-32">
            <option value="day">Day</option>
            <option value="month">Month</option>
          </Select>
        </Field>
      </div>

      {/* Summary card */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Collected</p>
            <p className="text-2xl font-semibold text-foreground">{money(total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Payments</p>
            <p className="text-2xl font-semibold text-foreground">{totalCount}</p>
          </CardContent>
        </Card>
      </div>

      {error && <ErrorBox message={error} />}

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Period</TH>
            <TH>Total Collected</TH>
            <TH>Payment Count</TH>
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
              <TD colSpan={3} className="py-10 text-center text-muted-foreground">No collection data.</TD>
            </TR>
          )}
          {!loading && rows.map((r) => (
            <TR key={r.period}>
              <TD>{r.period}</TD>
              <TD className="font-mono">{money(r.totalCollected)}</TD>
              <TD>{r.paymentCount}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

// ─── Defaulters tab ───────────────────────────────────────────────────────────

function DefaultersTab() {
  const { can } = useAuth();
  const [classId, setClassId] = useState('');
  const [remindersOpen, setRemindersOpen] = useState(false);

  const { rows, meta, loading, error, page, setPage } = useApiList<DefaulterRow>({
    path: '/fees/defaulters',
    params: { classId: classId || undefined },
  });

  const { rows: classList } = useApiList<{ id: string; name: string }>({ path: '/academics/classes', limit: 100 });
  const classOptions = classList.map(c => ({ value: c.id, label: c.name }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-56">
          <SearchableSelect
            value={classOptions.find(o => o.value === classId) || null}
            onChange={(val: any) => setClassId(val?.value || '')}
            options={classOptions}
            isClearable
            placeholder="Select class..."
          />
        </div>
        {can('communications:write') && (
          <Button
            variant="outline"
            className="ml-auto"
            onClick={() => setRemindersOpen(true)}
          >
            <Bell className="h-4 w-4" />
            Send Fee Reminders
          </Button>
        )}
      </div>

      {error && <ErrorBox message={error} />}

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Adm No</TH>
            <TH>Student</TH>
            <TH>Invoices</TH>
            <TH>Outstanding</TH>
          </TR>
        </THead>
        <TBody>
          {loading && (
            <TR className="hover:bg-transparent">
              <TD colSpan={4} className="py-10 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </TD>
            </TR>
          )}
          {!loading && rows.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={4} className="py-10 text-center text-muted-foreground">No defaulters found.</TD>
            </TR>
          )}
          {!loading && rows.map((r) => (
            <TR key={r.studentId}>
              <TD className="font-mono text-xs">{r.admissionNo}</TD>
              <TD className="font-medium text-foreground">{r.studentName}</TD>
              <TD>{r.invoiceCount}</TD>
              <TD className="font-mono font-semibold text-red-600">{money(r.totalOutstanding)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Pagination meta={meta} page={page} onPage={setPage} noun="defaulters" />

      <SendRemindersDialog
        open={remindersOpen}
        onClose={() => setRemindersOpen(false)}
      />
    </div>
  );
}

// ─── Send Fee Reminders dialog ────────────────────────────────────────────────

function SendRemindersDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [channel, setChannel] = useState<'sms' | 'whatsapp' | 'email'>('sms');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setChannel('sms'); setSending(false); setResult(null); setError(null); }
  }, [open]);

  async function confirm() {
    setSending(true);
    setError(null);
    try {
      await api.post('/communications/announcements', {
        title: 'Fee Reminder',
        message:
          'Dear Parent, your child has an outstanding fee balance. Please pay at the earliest.',
        channels: [channel],
        targetType: 'all_students',
      });
      setResult(`Fee reminders sent via ${channel === 'whatsapp' ? 'WhatsApp' : channel.toUpperCase()}.`);
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not send reminders.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader title="Send Fee Reminders" onClose={onClose} />
      <DialogBody className="space-y-4">
        {error && <ErrorBox message={error} />}
        {result ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {result}
          </div>
        ) : (
          <>
            <Field label="Channel">
              <Select
                value={channel}
                onChange={(e) => setChannel(e.target.value as typeof channel)}
              >
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
              </Select>
            </Field>
            <p className="text-sm text-muted-foreground">
              Fee reminders will be sent to all defaulters via{' '}
              <strong>{channel === 'whatsapp' ? 'WhatsApp' : channel.toUpperCase()}</strong>.
            </p>
          </>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {result ? 'Close' : 'Cancel'}
        </Button>
        {!result && (
          <Button onClick={confirm} disabled={sending}>
            {sending && <Loader2 className="h-4 w-4 animate-spin" />}
            Send Reminders
          </Button>
        )}
      </DialogFooter>
    </Dialog>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Small field wrapper for label + input. */
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

/** Styled error banner. */
function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}

/** Summary row used in invoice detail. */
function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-mono', strong ? 'font-semibold text-foreground' : 'text-foreground')}>
        {value}
      </span>
    </div>
  );
}

/** Generic confirm delete dialog. */
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
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="destructive" onClick={go} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Delete
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
