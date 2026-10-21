/**
 * PayrollPage — tabbed: Salary Structures | Payslips | Run Payroll
 * All money displayed via money(), all API sends use toMinor().
 */
import { useEffect, useState } from 'react';
import { Plus, Loader2, Trash2, Wallet } from 'lucide-react';
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
import { RowMenu } from '@/components/RowMenu';
import { Pagination } from '@/components/Pagination';
import { money, toMinor, date, statusVariant } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { SalaryStructure, SalaryComponent, FullPayslip } from '@/lib/dto';
import { PayslipPrintModal } from './PayslipPrintModal';

// ─── Tab bar ──────────────────────────────────────────────────────────────────

type Tab = 'structures' | 'payslips' | 'run';

const TABS: { id: Tab; label: string }[] = [
  { id: 'structures', label: 'Salary Structures' },
  { id: 'payslips', label: 'Payslips' },
  { id: 'run', label: 'Run Payroll' },
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

export function PayrollPage() {
  const [tab, setTab] = useState<Tab>('structures');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Wallet className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Payroll</h1>
          <p className="text-sm text-muted-foreground">Salary structures, payslips and payroll runs.</p>
        </div>
      </div>

      <TabBar active={tab} onChange={setTab} />

      {tab === 'structures' && <StructuresTab />}
      {tab === 'payslips' && <PayslipsTab />}
      {tab === 'run' && <RunPayrollTab />}
    </div>
  );
}

// ─── Salary Structures tab ────────────────────────────────────────────────────

function StructuresTab() {
  const { can } = useAuth();
  const canManage = can('payroll:manage');

  const { rows, loading, error, refetch } = useApiList<SalaryStructure>({
    path: '/payroll/structures',
    limit: 50,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SalaryStructure | null>(null);
  const [viewDetail, setViewDetail] = useState<SalaryStructure | null>(null);

  async function openView(s: SalaryStructure) {
    try {
      const res = await api.get<SalaryStructure>(`/payroll/structures/${s.id}`);
      setViewDetail(res.data);
    } catch {
      setViewDetail(s);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canManage && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" />
            New Structure
          </Button>
        )}
      </div>

      {error && <ErrorBox message={error} />}

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Staff</TH>
            <TH>Name</TH>
            <TH>Effective From</TH>
            <TH>Components</TH>
            <TH>Allowances</TH>
            <TH>Deductions</TH>
            <TH className="text-right">Actions</TH>
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
              <TD colSpan={7} className="py-10 text-center text-muted-foreground">No structures found.</TD>
            </TR>
          )}
          {!loading && rows.map((s) => {
            const comps = s.components || [];
            const allowances = comps
              .filter((c) => c.componentType === 'allowance')
              .reduce((sum, c) => sum + c.amount, 0);
            const deductions = comps
              .filter((c) => c.componentType === 'deduction')
              .reduce((sum, c) => sum + c.amount, 0);
            return (
                <TR key={s.id}>
                <TD className="font-medium text-foreground">{s.staffName}</TD>
                <TD>{s.name}</TD>
                <TD>{date(s.effectiveFrom)}</TD>
                <TD>{comps.length}</TD>
                <TD className="font-mono text-emerald-600">{money(allowances)}</TD>
                <TD className="font-mono text-red-600">{money(deductions)}</TD>
                <TD className="text-right">
                  <RowMenu
                    items={[
                      { label: 'View', onClick: () => openView(s) },
                      {
                        label: 'Edit',
                        onClick: () => { setEditing(s); setFormOpen(true); },
                        hidden: !canManage,
                      },
                    ]}
                  />
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>

      <StructureFormDialog
        open={formOpen}
        structure={editing}
        onClose={() => setFormOpen(false)}
        onSaved={refetch}
      />

      {viewDetail && (
        <StructureDetailDialog
          open={!!viewDetail}
          structure={viewDetail}
          onClose={() => setViewDetail(null)}
        />
      )}
    </div>
  );
}

// Structure detail dialog

function StructureDetailDialog({
  open,
  structure,
  onClose,
}: {
  open: boolean;
  structure: SalaryStructure;
  onClose: () => void;
}) {
  const allowances = structure.components
    .filter((c) => c.componentType === 'allowance')
    .reduce((s, c) => s + c.amount, 0);
  const deductions = structure.components
    .filter((c) => c.componentType === 'deduction')
    .reduce((s, c) => s + c.amount, 0);

  return (
    <Dialog open={open} onClose={onClose} className="max-w-xl">
      <DialogHeader
        title={structure.name}
        description={`${structure.staffName} · Effective ${date(structure.effectiveFrom)}`}
        onClose={onClose}
      />
      <DialogBody className="space-y-4 overflow-y-auto max-h-[70vh]">
        {structure.components.length > 0 ? (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Component</TH>
                <TH>Type</TH>
                <TH className="text-right">Amount</TH>
                <TH>%?</TH>
              </TR>
            </THead>
            <TBody>
              {structure.components.map((c) => (
                <TR key={c.id}>
                  <TD>{c.name}</TD>
                  <TD>
                    <Badge variant={c.componentType === 'allowance' ? 'success' : 'destructive'}>
                      {c.componentType}
                    </Badge>
                  </TD>
                  <TD className="text-right font-mono">{money(c.amount)}</TD>
                  <TD>{c.isPercentage ? 'Yes' : 'No'}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No components.</p>
        )}

        {/* Summary */}
        <div className="rounded-lg border border-border p-3 space-y-1.5 text-sm">
          <SummaryRow label="Total Allowances" value={money(allowances)} />
          <SummaryRow label="Total Deductions" value={money(deductions)} />
          <div className="border-t border-slate-100 pt-1.5">
            <SummaryRow label="Net (Allowances − Deductions)" value={money(allowances - deductions)} strong />
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </DialogFooter>
    </Dialog>
  );
}

// Structure form dialog with dynamic component rows

interface DraftComponent {
  name: string;
  componentType: 'allowance' | 'deduction';
  amount: string; // PKR as string for input
  isPercentage: boolean;
}

function emptyComponent(): DraftComponent {
  return { name: '', componentType: 'allowance', amount: '', isPercentage: false };
}

function StructureFormDialog({
  open,
  structure,
  onClose,
  onSaved,
}: {
  open: boolean;
  structure: SalaryStructure | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [staffId, setStaffId] = useState('');
  const [name, setName] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [components, setComponents] = useState<DraftComponent[]>([emptyComponent()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { rows: staffList } = useApiList<{ id: string; fullName: string; employeeId: string }>({ path: '/staff', limit: 1000 });
  const staffOptions = staffList.map(s => ({ value: s.id, label: `${s.fullName} (${s.employeeId})` }));

  useEffect(() => {
    if (structure) {
      setStaffId(structure.staffId);
      setName(structure.name);
      setEffectiveFrom(structure.effectiveFrom.slice(0, 10));
      setComponents(
        structure.components.map((c) => ({
          name: c.name,
          componentType: c.componentType,
          amount: String(c.amount / 100), // minor → major
          isPercentage: c.isPercentage,
        })),
      );
    } else {
      setStaffId(''); setName(''); setEffectiveFrom('');
      setComponents([emptyComponent()]);
    }
    setError(null);
  }, [structure, open]);

  function updateComp(idx: number, field: keyof DraftComponent, value: string | boolean) {
    setComponents((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c))
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        staffId,
        name,
        effectiveFrom,
        components: components
          .filter((c) => c.name)
          .map((c) => ({
            name: c.name,
            componentType: c.componentType,
            amount: toMinor(c.amount),
            isPercentage: c.isPercentage,
          })),
      };
      if (structure) {
        await api.patch(`/payroll/structures/${structure.id}`, payload);
      } else {
        await api.post('/payroll/structures', payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not save structure.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-2xl">
      <form onSubmit={submit}>
        <DialogHeader title={structure ? 'Edit Structure' : 'New Salary Structure'} onClose={onClose} />
        <DialogBody className="space-y-4 overflow-y-auto max-h-[75vh]">
          {error && <ErrorBox message={error} />}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Staff">
              <SearchableSelect
                value={staffOptions.find(o => o.value === staffId) || null}
                onChange={(val: any) => setStaffId(val?.value || '')}
                options={staffOptions}
                isDisabled={!!structure}
                placeholder="Select staff..."
                required
              />
            </Field>
            <Field label="Structure Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Standard 2024" />
            </Field>
          </div>
          <Field label="Effective From">
            <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required className="w-48" />
          </Field>

          {/* Components */}
          <div className="space-y-2">
            <Label>Components</Label>
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
              <span className="col-span-3">Name</span>
              <span className="col-span-2">Type</span>
              <span className="col-span-3">Amount (PKR)</span>
              <span className="col-span-3">Is %?</span>
              <span className="col-span-1" />
            </div>
            {components.map((c, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-3">
                  <Input
                    value={c.name}
                    onChange={(e) => updateComp(i, 'name', e.target.value)}
                    placeholder="e.g. HRA"
                    className="text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <Select
                    value={c.componentType}
                    onChange={(e) => updateComp(i, 'componentType', e.target.value)}
                    className="text-xs"
                  >
                    <option value="allowance">Allowance</option>
                    <option value="deduction">Deduction</option>
                  </Select>
                </div>
                <div className="col-span-3">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={c.amount}
                    onChange={(e) => updateComp(i, 'amount', e.target.value)}
                    placeholder="0"
                    className="text-xs"
                  />
                </div>
                <div className="col-span-3 flex items-center gap-2 px-1">
                  <input
                    type="checkbox"
                    checked={c.isPercentage}
                    onChange={(e) => updateComp(i, 'isPercentage', e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="text-xs text-muted-foreground">Percentage</span>
                </div>
                <div className="col-span-1 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setComponents((prev) => prev.filter((_, j) => j !== i))}
                    disabled={components.length <= 1}
                    className="p-1 text-muted-foreground hover:text-red-500 disabled:opacity-30"
                    aria-label="Remove component"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setComponents((p) => [...p, emptyComponent()])}>
              <Plus className="h-4 w-4" />
              Add Component
            </Button>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {structure ? 'Save Changes' : 'Create'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// ─── Payslips tab ─────────────────────────────────────────────────────────────

function PayslipsTab() {
  const { can } = useAuth();
  const canRun = can('payroll:run');

  const [period, setPeriod] = useState('');
  const [staffId, setStaffId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { rows, meta, loading, error, page, setPage, refetch } = useApiList<FullPayslip>({
    path: '/payroll/payslips',
    params: {
      period: period || undefined,
      staffId: staffId || undefined,
      status: statusFilter || undefined,
    },
  });

  const { rows: staffList } = useApiList<{ id: string; fullName: string; employeeId: string }>({ path: '/staff', limit: 1000 });
  const staffOptions = staffList.map(s => ({ value: s.id, label: `${s.fullName} (${s.employeeId})` }));

  const [viewSlip, setViewSlip] = useState<FullPayslip | null>(null);
  const [printSlip, setPrintSlip] = useState<FullPayslip | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function openDetail(p: FullPayslip) {
    setDetailLoading(true);
    try {
      const res = await api.get<FullPayslip>(`/payroll/payslips/${p.id}`);
      setViewSlip(res.data);
    } catch {
      setViewSlip(p);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="w-44"
          placeholder="YYYY-MM"
        />
        <div className="w-56">
          <SearchableSelect
            value={staffOptions.find(o => o.value === staffId) || null}
            onChange={(val: any) => setStaffId(val?.value || '')}
            options={staffOptions}
            isClearable
            placeholder="Search staff..."
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-36">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="approved">Approved</option>
          <option value="final">Final</option>
        </Select>
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
            <TH>Staff</TH>
            <TH>Period</TH>
            <TH>Base</TH>
            <TH>Allowances</TH>
            <TH>Deductions</TH>
            <TH>Bonus</TH>
            <TH>Net Salary</TH>
            <TH>Status</TH>
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
              <TD colSpan={9} className="py-10 text-center text-muted-foreground">No payslips found.</TD>
            </TR>
          )}
          {!loading && rows.map((p) => (
            <TR key={p.id}>
              <TD className="font-medium text-foreground">{p.staffName}</TD>
              <TD>{p.periodMonth}</TD>
              <TD className="font-mono">{money(p.baseSalary)}</TD>
              <TD className="font-mono text-emerald-600">{money(p.allowances)}</TD>
              <TD className="font-mono text-red-600">{money(p.deductions)}</TD>
              <TD className="font-mono">{money(p.bonus)}</TD>
              <TD className="font-mono font-semibold">{money(p.netSalary)}</TD>
              <TD><Badge variant={statusVariant(p.status)}>{p.status}</Badge></TD>
              <TD className="text-right">
                <RowMenu
                  items={[
                    { label: 'View Details', onClick: () => openDetail(p) },
                    { label: 'Print Slip', onClick: () => setPrintSlip(p) },
                  ]}
                />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Pagination meta={meta} page={page} onPage={setPage} noun="payslips" />

      {viewSlip && (
        <PayslipDetailDialog
          open={!!viewSlip}
          payslip={viewSlip}
          canFinalize={canRun}
          onClose={() => setViewSlip(null)}
          onFinalized={() => { setViewSlip(null); refetch(); }}
        />
      )}

      {printSlip && (
        <PayslipPrintModal
          open={!!printSlip}
          payslipId={printSlip.id}
          onClose={() => setPrintSlip(null)}
        />
      )}
    </div>
  );
}

// Payslip detail dialog

function PayslipDetailDialog({
  open,
  payslip,
  canFinalize,
  onClose,
  onFinalized,
}: {
  open: boolean;
  payslip: FullPayslip;
  canFinalize: boolean;
  onClose: () => void;
  onFinalized: () => void;
}) {
  const [finalizing, setFinalizing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setApproving(true);
    setError(null);
    try {
      await api.patch(`/payroll/payslips/${payslip.id}/approve`, {});
      onFinalized(); // Trigger a refetch
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not approve payslip.');
    } finally {
      setApproving(false);
    }
  }

  async function finalize() {
    setFinalizing(true);
    setError(null);
    try {
      await api.patch(`/payroll/payslips/${payslip.id}/finalize`, {});
      onFinalized();
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not finalize payslip.');
    } finally {
      setFinalizing(false);
    }
  }

  // Net = base + allowances - deductions + bonus
  const computed = payslip.baseSalary + payslip.allowances - payslip.deductions + payslip.bonus;

  return (
    <Dialog open={open} onClose={onClose} className="max-w-xl">
      <DialogHeader
        title={`Payslip — ${payslip.staffName}`}
        description={`Period: ${payslip.periodMonth}`}
        onClose={onClose}
      />
      <DialogBody className="space-y-4 overflow-y-auto max-h-[70vh]">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Badge variant={statusVariant(payslip.status)}>{payslip.status}</Badge>
        </div>

        {payslip.components && payslip.components.length > 0 && (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Component</TH>
                <TH>Type</TH>
                <TH className="text-right">Amount</TH>
              </TR>
            </THead>
            <TBody>
              {payslip.components.map((c: SalaryComponent) => (
                <TR key={c.id}>
                  <TD>{c.name}</TD>
                  <TD>
                    <Badge variant={c.componentType === 'allowance' ? 'success' : 'destructive'}>
                      {c.componentType}
                    </Badge>
                  </TD>
                  <TD className="text-right font-mono">{money(c.amount)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}

        {/* Footer summary */}
        <div className="rounded-lg border border-border p-3 space-y-1.5 text-sm">
          <SummaryRow label="Base Salary" value={money(payslip.baseSalary)} />
          <SummaryRow label="+ Allowances" value={money(payslip.allowances)} />
          <SummaryRow label="− Deductions" value={money(payslip.deductions)} />
          {payslip.bonus > 0 && <SummaryRow label="+ Bonus" value={money(payslip.bonus)} />}
          <div className="border-t border-slate-100 pt-1.5">
            <SummaryRow label="Net Salary" value={money(computed)} strong />
          </div>
        </div>

        {error && <ErrorBox message={error} />}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Close</Button>
        {canFinalize && payslip.status === 'draft' && (
          <Button onClick={approve} disabled={approving}>
            {approving && <Loader2 className="h-4 w-4 animate-spin" />}
            Approve
          </Button>
        )}
        {canFinalize && payslip.status === 'approved' && (
          <Button onClick={finalize} disabled={finalizing} variant="default" className="bg-emerald-600 hover:bg-emerald-700">
            {finalizing && <Loader2 className="h-4 w-4 animate-spin" />}
            Finalize
          </Button>
        )}
      </DialogFooter>
    </Dialog>
  );
}

// ─── Run Payroll tab ──────────────────────────────────────────────────────────

function RunPayrollTab() {
  const { can } = useAuth();
  const canRun = can('payroll:run');

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [period, setPeriod] = useState(currentMonth);
  const [bonusAmount, setBonusAmount] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ generated: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canRun) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-8 text-center text-sm text-amber-700">
        You don't have permission to run payroll.
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.post<{ generated: number; skipped: number }>('/payroll/run', {
        period,
        bonusAmount: bonusAmount ? toMinor(bonusAmount) : undefined,
      });
      setResult(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Payroll run failed.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      {/* Warning banner */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        <strong>Warning:</strong> Running payroll will create <em>draft</em> payslips for all active
        staff. Existing payslips for the selected period will be skipped.
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-4">
            <Field label="Period (YYYY-MM)">
              <Input
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                required
              />
            </Field>
            <Field label="Bonus Amount (PKR, optional)">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={bonusAmount}
                onChange={(e) => setBonusAmount(e.target.value)}
                placeholder="0"
              />
            </Field>

            {error && <ErrorBox message={error} />}

            {result && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Payroll run complete. Generated <strong>{result.generated}</strong> payslips,{' '}
                <strong>{result.skipped}</strong> skipped (already exist).
              </div>
            )}

            <Button type="submit" disabled={running} className="w-full">
              {running && <Loader2 className="h-4 w-4 animate-spin" />}
              Run Payroll for {period}
            </Button>
          </form>
        </CardContent>
      </Card>
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
