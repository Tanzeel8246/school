/**
 * AccountingPage — tabbed: Chart of Accounts | Journal Entries | Reports
 * All money displayed via money(), all API sends use toMinor().
 */
import { useCallback, useEffect, useState, useMemo } from 'react';
import { Plus, Loader2, Trash2, BookOpen } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useApiList } from '@/hooks/useApiList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { RowMenu } from '@/components/RowMenu';
import { Pagination } from '@/components/Pagination';
import { money, toMinor, date, statusVariant } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
  Account,
  JournalEntry,
  JournalLine,
  TrialBalanceRow,
  PLReport,
  BalanceSheet,
  CashBook,
} from '@/lib/dto';

// ─── Tab bar ──────────────────────────────────────────────────────────────────

type Tab = 'accounts' | 'journals' | 'reports';

const TABS: { id: Tab; label: string }[] = [
  { id: 'accounts', label: 'Chart of Accounts' },
  { id: 'journals', label: 'Journal Entries' },
  { id: 'reports', label: 'Reports' },
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

// ─── Export bar ───────────────────────────────────────────────────────────────

interface ExportBarProps {
  path: string;       // e.g. '/accounting/reports/trial-balance?asOf=2025-06-01'
  reportName: string; // for aria labels
}

function ExportBar({ path, reportName }: ExportBarProps) {
  const [loading, setLoading] = useState<'pdf' | 'xlsx' | 'csv' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(fmt: 'pdf' | 'xlsx' | 'csv') {
    setLoading(fmt);
    setError(null);
    try {
      const sep = path.includes('?') ? '&' : '?';
      await api.download(`${path}${sep}format=${fmt}`);
    } catch {
      setError('Download failed — check browser console.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {(['pdf', 'xlsx', 'csv'] as const).map((fmt) => (
        <Button
          key={fmt}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => download(fmt)}
          disabled={loading !== null}
          aria-label={`Export ${reportName} as ${fmt.toUpperCase()}`}
        >
          {loading === fmt
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : fmt.toUpperCase()
          }
        </Button>
      ))}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function AccountingPage() {
  const [tab, setTab] = useState<Tab>('accounts');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BookOpen className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Accounting</h1>
          <p className="text-sm text-muted-foreground">Chart of accounts, journal entries and financial reports.</p>
        </div>
      </div>

      <TabBar active={tab} onChange={setTab} />

      {tab === 'accounts' && <AccountsTab />}
      {tab === 'journals' && <JournalsTab />}
      {tab === 'reports' && <ReportsTab />}
    </div>
  );
}

// ─── Chart of Accounts tab ────────────────────────────────────────────────────

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const;
type AccountType = (typeof ACCOUNT_TYPES)[number];

const TYPE_BADGE_VARIANT: Record<AccountType, 'default' | 'success' | 'warning' | 'destructive'> = {
  asset: 'success',
  liability: 'warning',
  equity: 'default',
  revenue: 'success',
  expense: 'destructive',
};

function AccountsTab() {
  const { can } = useAuth();
  const canPost = can('accounting:post');

  const [typeFilter, setTypeFilter] = useState('');

  const { rows, loading, error, refetch } = useApiList<Account>({
    path: '/accounting/accounts',
    params: { type: typeFilter || undefined },
    limit: 100,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);

  // Sort by code client-side (API may not guarantee order)
  const sorted = [...rows].sort((a, b) => a.code.localeCompare(b.code));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-44">
          <option value="">All types</option>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>
          ))}
        </Select>
        {canPost && (
          <Button className="ml-auto" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" />
            New Account
          </Button>
        )}
      </div>

      {error && <ErrorBox message={error} />}

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Code</TH>
            <TH>Name</TH>
            <TH>Type</TH>
            <TH>Balance</TH>
            {canPost && <TH className="text-right">Actions</TH>}
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
          {!loading && sorted.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={5} className="py-10 text-center text-muted-foreground">No accounts found.</TD>
            </TR>
          )}
          {!loading && sorted.map((a) => (
            <TR key={a.id}>
              <TD className="font-mono text-xs">{a.code}</TD>
              <TD className="font-medium text-foreground">{a.name}</TD>
              <TD>
                <Badge variant={TYPE_BADGE_VARIANT[a.type as AccountType] ?? 'default'}>
                  {a.type}
                </Badge>
              </TD>
              <TD className="font-mono">{money(a.balance)}</TD>
              {canPost && (
                <TD className="text-right">
                  <RowMenu
                    items={[
                      {
                        label: 'Edit',
                        onClick: () => { setEditing(a); setFormOpen(true); },
                        // System accounts can't be deleted but can be renamed
                      },
                      {
                        label: 'Delete',
                        onClick: () => setDeleteTarget(a),
                        danger: true,
                        hidden: a.isSystem, // prevent deleting system accounts
                      },
                    ]}
                  />
                </TD>
              )}
            </TR>
          ))}
        </TBody>
      </Table>

      <AccountFormDialog
        open={formOpen}
        account={editing}
        onClose={() => setFormOpen(false)}
        onSaved={refetch}
      />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        title="Delete Account"
        message={`Delete account "${deleteTarget?.name}"? This cannot be undone.`}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.del(`/accounting/accounts/${deleteTarget.id}`);
          setDeleteTarget(null);
          refetch();
        }}
      />
    </div>
  );
}

function AccountFormDialog({
  open,
  account,
  onClose,
  onSaved,
}: {
  open: boolean;
  account: Account | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('asset');
  const [parentId, setParentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (account) {
      setCode(account.code);
      setName(account.name);
      setType(account.type as AccountType);
      setParentId(account.parentId ?? '');
    } else {
      setCode(''); setName(''); setType('asset'); setParentId('');
    }
    setError(null);
  }, [account, open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (account) {
        // Edit: only name and parentId are mutable
        await api.patch(`/accounting/accounts/${account.id}`, {
          name,
          parentId: parentId || undefined,
        });
      } else {
        await api.post('/accounting/accounts', {
          code,
          name,
          type,
          parentId: parentId || undefined,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not save account.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={submit}>
        <DialogHeader title={account ? 'Edit Account' : 'New Account'} onClose={onClose} />
        <DialogBody className="space-y-4 overflow-y-auto max-h-[70vh]">
          {error && <ErrorBox message={error} />}
          {!account && (
            <Field label="Code">
              <Input value={code} onChange={(e) => setCode(e.target.value)} required placeholder="e.g. 1100" />
            </Field>
          )}
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Cash in Hand" />
          </Field>
          {!account && (
            <Field label="Type">
              <Select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Parent Account ID (optional)">
            <Input
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              placeholder="UUID of parent account"
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {account ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// ─── Journal Entries tab ──────────────────────────────────────────────────────

function JournalsTab() {
  const { can } = useAuth();
  const canPost = can('accounting:post');

  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);

  const { rows, meta, loading, error, page, setPage, refetch } = useApiList<JournalEntry>({
    path: '/accounting/journals',
    params: { from, to },
  });

  const [viewEntry, setViewEntry] = useState<JournalEntry | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<JournalEntry | null>(null);

  async function openDetail(j: JournalEntry) {
    try {
      const res = await api.get<JournalEntry>(`/accounting/journals/${j.id}`);
      setViewEntry(res.data);
    } catch {
      setViewEntry(j);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Field label="From" className="flex-row items-center gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
        </Field>
        <Field label="To" className="flex-row items-center gap-2">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
        </Field>
        {canPost && (
          <Button className="ml-auto" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" />
            New Journal
          </Button>
        )}
      </div>

      {error && <ErrorBox message={error} />}

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Ref</TH>
            <TH>Description</TH>
            <TH>Date</TH>
            <TH>Status</TH>
            <TH>Total Debit</TH>
            <TH className="text-right">Actions</TH>
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
              <TD colSpan={6} className="py-10 text-center text-muted-foreground">No journal entries found.</TD>
            </TR>
          )}
          {!loading && rows.map((j) => {
            // Sum debit lines for the list view (lines may not be present on list response)
            const totalDebit = j.lines?.reduce((s, l) => s + l.debit, 0) ?? 0;
            return (
              <TR key={j.id}>
                <TD className="font-mono text-xs">{j.refNo}</TD>
                <TD className="max-w-xs truncate">{j.description}</TD>
                <TD>{date(j.entryDate)}</TD>
                <TD><Badge variant={statusVariant(j.status)}>{j.status}</Badge></TD>
                <TD className="font-mono">{totalDebit > 0 ? money(totalDebit) : '—'}</TD>
                <TD className="text-right">
                  <RowMenu
                    items={[
                      { label: 'View', onClick: () => openDetail(j) },
                      {
                        label: 'Delete',
                        onClick: () => setDeleteTarget(j),
                        danger: true,
                        hidden: !canPost,
                      },
                    ]}
                  />
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>

      <Pagination meta={meta} page={page} onPage={setPage} noun="entries" />

      {/* Detail dialog */}
      {viewEntry && (
        <JournalDetailDialog
          open={!!viewEntry}
          entry={viewEntry}
          onClose={() => setViewEntry(null)}
        />
      )}

      {/* New journal dialog */}
      <NewJournalDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onSaved={refetch}
      />

      {/* Delete confirm */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        title="Delete Journal Entry"
        message={`Delete entry "${deleteTarget?.refNo}"? This will mark it as reversed.`}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.del(`/accounting/journals/${deleteTarget.id}`);
          setDeleteTarget(null);
          refetch();
        }}
      />
    </div>
  );
}

function JournalDetailDialog({
  open,
  entry,
  onClose,
}: {
  open: boolean;
  entry: JournalEntry;
  onClose: () => void;
}) {
  const totalDebit = entry.lines?.reduce((s, l) => s + l.debit, 0) ?? 0;
  const totalCredit = entry.lines?.reduce((s, l) => s + l.credit, 0) ?? 0;

  return (
    <Dialog open={open} onClose={onClose} className="max-w-2xl">
      <DialogHeader
        title={`Journal ${entry.refNo}`}
        description={`${date(entry.entryDate)} · ${entry.description}`}
        onClose={onClose}
      />
      <DialogBody className="space-y-4 overflow-y-auto max-h-[70vh]">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Status:</span>
          <Badge variant={statusVariant(entry.status)}>{entry.status}</Badge>
        </div>

        {entry.lines && entry.lines.length > 0 ? (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Account</TH>
                <TH>Description</TH>
                <TH className="text-right">Debit</TH>
                <TH className="text-right">Credit</TH>
              </TR>
            </THead>
            <TBody>
              {entry.lines.map((l: JournalLine) => (
                <TR key={l.id}>
                  <TD>{l.accountName}</TD>
                  <TD className="text-muted-foreground text-xs">{l.description ?? '—'}</TD>
                  <TD className="text-right font-mono">{l.debit > 0 ? money(l.debit) : '—'}</TD>
                  <TD className="text-right font-mono">{l.credit > 0 ? money(l.credit) : '—'}</TD>
                </TR>
              ))}
              {/* Totals row */}
              <TR className="bg-muted/50 font-medium">
                <TD colSpan={2} className="text-foreground">Totals</TD>
                <TD className="text-right font-mono">{money(totalDebit)}</TD>
                <TD className="text-right font-mono">{money(totalCredit)}</TD>
              </TR>
            </TBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No lines available.</p>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </DialogFooter>
    </Dialog>
  );
}

// New journal form (dynamic line rows)

interface DraftLine {
  accountId: string;
  debit: string;
  credit: string;
  description: string;
}

function emptyLine(): DraftLine {
  return { accountId: '', debit: '', credit: '', description: '' };
}

function NewJournalDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [description, setDescription] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDescription('');
      setEntryDate(new Date().toISOString().slice(0, 10));
      setLines([emptyLine(), emptyLine()]);
      setError(null);
    }
  }, [open]);

  function updateLine(idx: number, field: keyof DraftLine, value: string) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  // Real-time balance check: sum(debit) must equal sum(credit)
  const sumDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const sumCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const balanced = Math.abs(sumDebit - sumCredit) < 0.001;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!balanced) { setError('Journal is unbalanced: debits must equal credits.'); return; }
    setSaving(true);
    setError(null);
    try {
      await api.post('/accounting/journals', {
        description,
        entryDate,
        lines: lines
          .filter((l) => l.accountId)
          .map((l) => ({
            accountId: l.accountId,
            debit: toMinor(l.debit),
            credit: toMinor(l.credit),
            description: l.description || undefined,
          })),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not post journal.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-3xl">
      <form onSubmit={submit}>
        <DialogHeader title="New Journal Entry" onClose={onClose} />
        <DialogBody className="space-y-4 overflow-y-auto max-h-[75vh]">
          {error && <ErrorBox message={error} />}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Description">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} required placeholder="Transaction description" />
            </Field>
            <Field label="Entry Date">
              <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
            </Field>
          </div>

          {/* Balance indicator */}
          <div className={cn(
            'flex items-center justify-between rounded-lg px-3 py-2 text-sm',
            balanced ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700',
          )}>
            <span>Debit: <strong className="font-mono">{sumDebit.toFixed(2)}</strong></span>
            <span>Credit: <strong className="font-mono">{sumCredit.toFixed(2)}</strong></span>
            <span className="font-medium">{balanced ? 'Balanced ✓' : 'Unbalanced!'}</span>
          </div>

          {/* Line rows */}
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
              <span className="col-span-3">Account ID</span>
              <span className="col-span-2">Debit (PKR)</span>
              <span className="col-span-2">Credit (PKR)</span>
              <span className="col-span-4">Description</span>
              <span className="col-span-1" />
            </div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-3">
                  <Input
                    value={l.accountId}
                    onChange={(e) => updateLine(i, 'accountId', e.target.value)}
                    placeholder="Account ID"
                    className="text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={l.debit}
                    onChange={(e) => updateLine(i, 'debit', e.target.value)}
                    placeholder="0"
                    className="text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={l.credit}
                    onChange={(e) => updateLine(i, 'credit', e.target.value)}
                    placeholder="0"
                    className="text-xs"
                  />
                </div>
                <div className="col-span-4">
                  <Input
                    value={l.description}
                    onChange={(e) => updateLine(i, 'description', e.target.value)}
                    placeholder="Optional note"
                    className="text-xs"
                  />
                </div>
                <div className="col-span-1 flex justify-center">
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    disabled={lines.length <= 2}
                    className="p-1 text-muted-foreground hover:text-red-500 disabled:opacity-30"
                    aria-label="Remove line"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-4 w-4" />
              Add Line
            </Button>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving || !balanced}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Post
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// ─── Reports tab ──────────────────────────────────────────────────────────────

type ReportType = 'trial-balance' | 'pl' | 'balance-sheet' | 'cash-book' | 'general-ledger';

const REPORT_TABS: { id: ReportType; label: string }[] = [
  { id: 'trial-balance', label: 'Trial Balance' },
  { id: 'pl',            label: 'P&L' },
  { id: 'balance-sheet', label: 'Balance Sheet' },
  { id: 'cash-book',     label: 'Cash Book' },
  { id: 'general-ledger', label: 'General Ledger' },
];

function ReportsTab() {
  const [reportType, setReportType] = useState<ReportType>('trial-balance');

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="flex gap-2 flex-wrap">
        {REPORT_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setReportType(t.id)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              reportType === t.id
                ? 'bg-primary text-white'
                : 'bg-muted text-muted-foreground hover:bg-slate-200',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {reportType === 'trial-balance' && <TrialBalanceReport />}
      {reportType === 'pl' && <PLReportPanel />}
      {reportType === 'balance-sheet' && <BalanceSheetReport />}
      {reportType === 'cash-book' && <CashBookReport />}
      {reportType === 'general-ledger' && <GeneralLedgerReport />}
    </div>
  );
}

function TrialBalanceReport() {
  const defaultDate = new Date().toISOString().slice(0, 10);
  const [asOf, setAsOf] = useState(defaultDate);
  const [rows, setRows] = useState<TrialBalanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ accounts: TrialBalanceRow[] }>(`/accounting/reports/trial-balance?asOf=${asOf}`);
      setRows(res.data?.accounts ?? []);
    } catch {
      setError('Could not load trial balance.');
    } finally {
      setLoading(false);
    }
  }, [asOf]);

  useEffect(() => { load(); }, [load]);

  const totalDebit = rows.reduce((s, r) => s + r.totalDebit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.totalCredit, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <Field label="As Of">
          <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="w-44" />
        </Field>
      </div>

      <div className="flex justify-end">
        <ExportBar path={`/accounting/reports/trial-balance?asOf=${asOf}`} reportName="Trial Balance" />
      </div>

      {error && <ErrorBox message={error} />}
      {loading ? (
        <div className="flex justify-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Code</TH>
              <TH>Name</TH>
              <TH>Type</TH>
              <TH className="text-right">Debit</TH>
              <TH className="text-right">Credit</TH>
            </TR>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <TR className="hover:bg-transparent">
                <TD colSpan={5} className="py-10 text-center text-muted-foreground">No data.</TD>
              </TR>
            ) : (
              <>
                {rows.map((r) => (
                  <TR key={r.code}>
                    <TD className="font-mono text-xs">{r.code}</TD>
                    <TD>{r.name}</TD>
                    <TD className="capitalize text-muted-foreground">{r.type}</TD>
                    <TD className="text-right font-mono">{r.totalDebit > 0 ? money(r.totalDebit) : '—'}</TD>
                    <TD className="text-right font-mono">{r.totalCredit > 0 ? money(r.totalCredit) : '—'}</TD>
                  </TR>
                ))}
                {/* Totals */}
                <TR className="bg-muted/50 font-semibold hover:bg-muted/50">
                  <TD colSpan={3} className="text-foreground">Totals</TD>
                  <TD className="text-right font-mono">{money(totalDebit)}</TD>
                  <TD className="text-right font-mono">{money(totalCredit)}</TD>
                </TR>
              </>
            )}
          </TBody>
        </Table>
      )}
    </div>
  );
}

function PLReportPanel() {
  const defaultFrom = new Date().toISOString().slice(0, 7) + '-01';
  const defaultTo = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [data, setData] = useState<PLReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<PLReport>(`/accounting/reports/pl?from=${from}&to=${to}`);
      setData(res.data);
    } catch {
      setError('Could not load P&L report.');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="From">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
        </Field>
        <Field label="To">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
        </Field>
      </div>

      <div className="flex justify-end">
        <ExportBar path={`/accounting/reports/pl?from=${from}&to=${to}`} reportName="P&L" />
      </div>

      {error && <ErrorBox message={error} />}
      {loading ? (
        <div className="flex justify-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : data ? (
        <div className="space-y-6">
          {/* Revenue */}
          <ReportSection
            title="Revenue"
            rows={data.revenue.map((r) => ({ name: r.name, amount: r.amount }))}
            total={data.totalRevenue}
            totalLabel="Total Revenue"
          />
          {/* Expenses */}
          <ReportSection
            title="Expenses"
            rows={data.expenses.map((r) => ({ name: r.name, amount: r.amount }))}
            total={data.totalExpenses}
            totalLabel="Total Expenses"
          />
          {/* Net Income */}
          <Card>
            <CardContent className="pt-4 flex items-center justify-between">
              <span className="font-semibold text-foreground">Net Income</span>
              <span className={cn(
                'text-xl font-bold font-mono',
                data.netIncome >= 0 ? 'text-emerald-600' : 'text-red-600',
              )}>
                {money(data.netIncome)}
              </span>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function BalanceSheetReport() {
  const defaultDate = new Date().toISOString().slice(0, 10);
  const [asOf, setAsOf] = useState(defaultDate);
  const [data, setData] = useState<BalanceSheet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<BalanceSheet>(`/accounting/reports/balance-sheet?asOf=${asOf}`);
      setData(res.data);
    } catch {
      setError('Could not load balance sheet.');
    } finally {
      setLoading(false);
    }
  }, [asOf]);

  useEffect(() => { load(); }, [load]);

  // Assets = Liabilities + Equity check
  const balanced = data
    ? Math.abs(data.totalAssets - (data.totalLiabilities + data.totalEquity)) < 1
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <Field label="As Of">
          <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="w-44" />
        </Field>
      </div>

      <div className="flex justify-end">
        <ExportBar path={`/accounting/reports/balance-sheet?asOf=${asOf}`} reportName="Balance Sheet" />
      </div>

      {error && <ErrorBox message={error} />}
      {loading ? (
        <div className="flex justify-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : data ? (
        <div className="space-y-6">
          <ReportSection
            title="Assets"
            rows={data.assets.map((r) => ({ name: r.name, amount: r.balance }))}
            total={data.totalAssets}
            totalLabel="Total Assets"
          />
          <ReportSection
            title="Liabilities"
            rows={data.liabilities.map((r) => ({ name: r.name, amount: r.balance }))}
            total={data.totalLiabilities}
            totalLabel="Total Liabilities"
          />
          <ReportSection
            title="Equity"
            rows={data.equity.map((r) => ({ name: r.name, amount: r.balance }))}
            total={data.totalEquity}
            totalLabel="Total Equity"
          />
          {/* Balance check */}
          <div className={cn(
            'rounded-lg px-4 py-3 text-sm font-medium',
            balanced ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
          )}>
            {balanced
              ? `Balance check: Assets (${money(data.totalAssets)}) = Liabilities + Equity (${money(data.totalLiabilities + data.totalEquity)}) ✓`
              : `Balance check FAILED: Assets ${money(data.totalAssets)} ≠ L+E ${money(data.totalLiabilities + data.totalEquity)}`}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CashBookReport() {
  const [accountId, setAccountId] = useState('');
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<CashBook | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      if (accountId) params.set('accountId', accountId);
      const res = await api.get<CashBook>(`/accounting/reports/cash-book?${params}`);
      setData(res.data);
    } catch { setError('Could not load cash book.'); }
    finally { setLoading(false); }
  }, [accountId, from, to]);

  useEffect(() => { load(); }, [load]);

  const exportPath = useMemo(() => {
    const params = new URLSearchParams({ from, to });
    if (accountId) params.set('accountId', accountId);
    return `/accounting/reports/cash-book?${params}`;
  }, [accountId, from, to]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Account ID (optional)">
          <Input
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="UUID — leave blank for all asset accounts"
            className="w-72"
          />
        </Field>
        <Field label="From">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
        </Field>
        <Field label="To">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
        </Field>
      </div>

      {/* Export bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          {data ? `${data.lines.length} transactions · Opening: ${money(data.openingBalance)} · Closing: ${money(data.closingBalance)}` : ''}
        </p>
        <ExportBar path={exportPath} reportName="Cash Book" />
      </div>

      {error && <ErrorBox message={error} />}

      {loading ? (
        <div className="flex justify-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : data ? (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Opening Balance', value: money(data.openingBalance) },
              { label: 'Total Debits',    value: money(data.totalDebit) },
              { label: 'Total Credits',   value: money(data.totalCredit) },
              { label: 'Closing Balance', value: money(data.closingBalance) },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-lg border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
                <p className="font-mono font-semibold text-foreground">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Transaction table */}
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Date</TH>
                  <TH>Ref</TH>
                  <TH>Description</TH>
                  <TH>Account</TH>
                  <TH className="text-right">Debit</TH>
                  <TH className="text-right">Credit</TH>
                  <TH className="text-right">Balance</TH>
                </TR>
              </THead>
              <TBody>
                {/* Opening row */}
                <TR className="bg-muted/50 font-medium hover:bg-muted/50">
                  <TD colSpan={6} className="text-muted-foreground">Opening Balance ({data.from})</TD>
                  <TD className="text-right font-mono">{money(data.openingBalance)}</TD>
                </TR>
                {data.lines.length === 0 && (
                  <TR className="hover:bg-transparent">
                    <TD colSpan={7} className="py-8 text-center text-muted-foreground">
                      No transactions in this period.
                    </TD>
                  </TR>
                )}
                {data.lines.map((l, i) => (
                  <TR key={i}>
                    <TD>{date(l.entryDate)}</TD>
                    <TD className="font-mono text-xs">{l.refNo}</TD>
                    <TD className="max-w-xs truncate text-muted-foreground">{l.description ?? '—'}</TD>
                    <TD className="text-muted-foreground text-xs">{l.accountCode} {l.accountName}</TD>
                    <TD className="text-right font-mono">
                      {l.debit > 0 ? money(l.debit) : <span className="text-slate-300">—</span>}
                    </TD>
                    <TD className="text-right font-mono">
                      {l.credit > 0 ? money(l.credit) : <span className="text-slate-300">—</span>}
                    </TD>
                    <TD className={cn(
                      "text-right font-mono font-medium",
                      l.runningBalance >= 0 ? "text-emerald-700" : "text-red-600"
                    )}>
                      {money(l.runningBalance)}
                    </TD>
                  </TR>
                ))}
                {/* Closing row */}
                <TR className="bg-muted/50 font-semibold hover:bg-muted/50">
                  <TD colSpan={6}>Closing Balance ({data.to})</TD>
                  <TD className={cn(
                    "text-right font-mono",
                    data.closingBalance >= 0 ? "text-emerald-700" : "text-red-600"
                  )}>
                    {money(data.closingBalance)}
                  </TD>
                </TR>
              </TBody>
            </Table>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Reusable report section (Revenue / Expenses / Assets / etc.) */
function ReportSection({
  title,
  rows,
  total,
  totalLabel,
}: {
  title: string;
  rows: { name: string; amount: number }[];
  total: number;
  totalLabel: string;
}) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="bg-muted/50 px-4 py-2.5 text-sm font-semibold text-foreground border-b border-border">
        {title}
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center justify-between px-4 py-2 text-sm">
            <span className="text-muted-foreground">{r.name}</span>
            <span className="font-mono text-foreground">{money(r.amount)}</span>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="px-4 py-4 text-sm text-muted-foreground">No entries.</p>
        )}
        <div className="flex items-center justify-between px-4 py-2.5 text-sm font-semibold bg-muted/50">
          <span>{totalLabel}</span>
          <span className="font-mono">{money(total)}</span>
        </div>
      </div>
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
          Confirm
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function GeneralLedgerReport() {
  const [accountId, setAccountId] = useState('');
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);

  // Fetch accounts list for dropdown
  useEffect(() => {
    async function loadAccounts() {
      try {
        const res = await api.get<{ data: any[] }>('/accounting/accounts?limit=1000');
        const sorted = (res.data?.data ?? []).sort((a: any, b: any) => a.code.localeCompare(b.code));
        setAccounts(sorted);
        if (sorted.length > 0 && !accountId) {
          setAccountId(sorted[0].id);
        }
      } catch (err) {
        console.error('Failed to load accounts for Ledger', err);
      }
    }
    loadAccounts();
  }, []);

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ from, to, accountId });
      const res = await api.get<any>(`/accounting/reports/general-ledger?${params}`);
      setData(res.data);
    } catch { setError('Could not load general ledger.'); }
    finally { setLoading(false); }
  }, [accountId, from, to]);

  useEffect(() => { load(); }, [load]);

  const exportPath = useMemo(() => {
    if (!accountId) return '';
    const params = new URLSearchParams({ from, to, accountId });
    return `/accounting/reports/general-ledger?${params}`;
  }, [accountId, from, to]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Select Account">
          <Select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-72"
          >
            <option value="">-- Choose Account --</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.code} — {acc.name} ({acc.type.toUpperCase()})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="From">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
        </Field>
        <Field label="To">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
        </Field>
      </div>

      {/* Export bar */}
      {accountId && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-muted-foreground">
            {data ? `${data.lines.length} transactions · Opening: ${money(data.openingBalance)} · Closing: ${money(data.closingBalance)}` : ''}
          </p>
          <ExportBar path={exportPath} reportName="General Ledger" />
        </div>
      )}

      {error && <ErrorBox message={error} />}

      {!accountId ? (
        <div className="text-center py-8 text-muted-foreground">Please select an account.</div>
      ) : loading ? (
        <div className="flex justify-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : data ? (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Opening Balance', value: money(data.openingBalance) },
              { label: 'Total Debits',    value: money(data.totalDebit) },
              { label: 'Total Credits',   value: money(data.totalCredit) },
              { label: 'Closing Balance', value: money(data.closingBalance) },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-lg border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
                <p className="font-mono font-semibold text-foreground">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Transaction table */}
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Date</TH>
                  <TH>Ref</TH>
                  <TH>Description</TH>
                  <TH className="text-right">Debit</TH>
                  <TH className="text-right">Credit</TH>
                  <TH className="text-right">Balance</TH>
                </TR>
              </THead>
              <TBody>
                {/* Opening row */}
                <TR className="bg-muted/50 font-medium hover:bg-muted/50">
                  <TD colSpan={5} className="text-muted-foreground">Opening Balance ({data.from})</TD>
                  <TD className="text-right font-mono">{money(data.openingBalance)}</TD>
                </TR>
                {data.lines.length === 0 && (
                  <TR className="hover:bg-transparent">
                    <TD colSpan={6} className="py-8 text-center text-muted-foreground">
                      No transactions in this period.
                    </TD>
                  </TR>
                )}
                {data.lines.map((l: any, i: number) => (
                  <TR key={i}>
                    <TD>{date(l.entryDate)}</TD>
                    <TD className="font-mono text-xs">{l.refNo}</TD>
                    <TD className="max-w-xs truncate text-muted-foreground">{l.description ?? '—'}</TD>
                    <TD className="text-right font-mono">
                      {l.debit > 0 ? money(l.debit) : <span className="text-slate-300">—</span>}
                    </TD>
                    <TD className="text-right font-mono">
                      {l.credit > 0 ? money(l.credit) : <span className="text-slate-300">—</span>}
                    </TD>
                    <TD className={cn(
                      "text-right font-mono font-medium",
                      l.runningBalance >= 0 ? "text-emerald-700" : "text-red-600"
                    )}>
                      {money(l.runningBalance)}
                    </TD>
                  </TR>
                ))}
                {/* Closing row */}
                <TR className="bg-muted/50 font-semibold hover:bg-muted/50">
                  <TD colSpan={5}>Closing Balance ({data.to})</TD>
                  <TD className={cn(
                    "text-right font-mono",
                    data.closingBalance >= 0 ? "text-emerald-700" : "text-red-600"
                  )}>
                    {money(data.closingBalance)}
                  </TD>
                </TR>
              </TBody>
            </Table>
          </div>
        </>
      ) : null}
    </div>
  );
}
