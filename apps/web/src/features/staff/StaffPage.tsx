import { useState } from 'react';
import { Plus, Search, Loader2, Play } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useApiList } from '@/hooks/useApiList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { RowMenu } from '@/components/RowMenu';
import { Pagination } from '@/components/Pagination';
import { money, statusVariant } from '@/lib/format';
import type { Staff } from '@/lib/dto';
import { STAFF_TYPES } from './constants';
import { StaffForm } from './StaffForm';
import { StaffDetail } from './StaffDetail';
import { LeavesPanel } from './LeavesPanel';
import { RunPayrollDialog } from './RunPayrollDialog';

/** Staff module: directory + detail (attendance/payroll), leaves, payroll run. */
export function StaffPage() {
  const { can } = useAuth();
  const canWrite = can('staff:write');
  const canRunPayroll = can('payroll:run');

  const [staffType, setStaffType] = useState('');
  const { rows, meta, loading, error, query, page, setQuery, setPage, refetch } =
    useApiList<Staff>({ path: '/staff', params: { staffType } });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [detail, setDetail] = useState<Staff | null>(null);
  const [deleting, setDeleting] = useState<Staff | null>(null);
  const [delBusy, setDelBusy] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);
  const [payrollOpen, setPayrollOpen] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setDelBusy(true);
    setDelError(null);
    try {
      await api.del(`/staff/${deleting.id}`);
      setDeleting(null);
      refetch();
    } catch (err) {
      setDelError(err instanceof ApiError ? 'Delete failed.' : 'Delete failed.');
    } finally {
      setDelBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Staff</h1>
          <p className="text-sm text-muted-foreground">Non-teaching staff, attendance, leaves and payroll.</p>
        </div>
        <div className="flex items-center gap-2">
          {canRunPayroll && (
            <Button variant="outline" onClick={() => setPayrollOpen(true)}>
              <Play className="h-4 w-4" />
              Run payroll
            </Button>
          )}
          {canWrite && (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              New staff
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or employee ID…"
            className="pl-9"
          />
        </div>
        <Select value={staffType} onChange={(e) => setStaffType(e.target.value)} className="w-44">
          <option value="">All types</option>
          {STAFF_TYPES.map((t) => (
            <option key={t} value={t}>
              {t[0].toUpperCase() + t.slice(1)}
            </option>
          ))}
        </Select>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Emp ID</TH>
            <TH>Name</TH>
            <TH>Type</TH>
            <TH>Designation</TH>
            <TH>Base salary</TH>
            <TH>Status</TH>
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
              <TD colSpan={7} className="py-10 text-center text-muted-foreground">
                No staff found.
              </TD>
            </TR>
          )}
          {!loading &&
            rows.map((s) => (
              <TR key={s.id}>
                <TD className="font-mono text-xs">{s.employeeId}</TD>
                <TD className="font-medium text-foreground">{s.fullName}</TD>
                <TD className="capitalize">{s.staffType}</TD>
                <TD>{s.designation || '—'}</TD>
                <TD>{money(s.baseSalary)}</TD>
                <TD>
                  <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                </TD>
                <TD className="text-right">
                  <RowMenu
                    items={[
                      { label: 'View detail', onClick: () => setDetail(s) },
                      {
                        label: 'Edit',
                        onClick: () => {
                          setEditing(s);
                          setFormOpen(true);
                        },
                        hidden: !canWrite,
                      },
                      {
                        label: 'Delete',
                        onClick: () => {
                          setDelError(null);
                          setDeleting(s);
                        },
                        danger: true,
                        hidden: !canWrite,
                      },
                    ]}
                  />
                </TD>
              </TR>
            ))}
        </TBody>
      </Table>
      </div>

      <Pagination meta={meta} page={page} onPage={setPage} noun="staff" />

      {/* Leaves section */}
      <LeavesPanel />

      {/* Dialogs */}
      <StaffForm
        open={formOpen}
        staff={editing}
        onClose={() => setFormOpen(false)}
        onSaved={refetch}
      />
      {detail && <StaffDetail open={!!detail} staff={detail} onClose={() => setDetail(null)} />}
      <RunPayrollDialog open={payrollOpen} onClose={() => setPayrollOpen(false)} />

      {deleting && (
        <Dialog open={!!deleting} onClose={() => setDeleting(null)}>
          <DialogHeader
            title="Delete staff"
            description={deleting.fullName}
            onClose={() => setDeleting(null)}
          />
          <DialogBody className="space-y-3">
            {delError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {delError}
              </div>
            )}
            <p className="text-sm text-muted-foreground">This deactivates the staff record. Continue?</p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={delBusy} onClick={confirmDelete}>
              {delBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </Dialog>
      )}
    </div>
  );
}
