import { useState } from 'react';
import { Plus, Search, Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useApiList } from '@/hooks/useApiList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { RowMenu } from '@/components/RowMenu';
import { Pagination } from '@/components/Pagination';
import { money, statusVariant } from '@/lib/format';
import type { Teacher } from '@/lib/dto';
import { TeacherForm } from './TeacherForm';

/** Teachers module: list + create/edit (incl. subjects) + soft delete. */
export function TeachersPage() {
  const { can } = useAuth();
  const canWrite = can('teachers:write');

  const { rows, meta, loading, error, query, page, setQuery, setPage, refetch } =
    useApiList<Teacher>({ path: '/teachers' });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [deleting, setDeleting] = useState<Teacher | null>(null);
  const [delBusy, setDelBusy] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  async function confirmDelete() {
    if (!deleting) return;
    setDelBusy(true);
    setDelError(null);
    try {
      await api.del(`/teachers/${deleting.id}`);
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
          <h1 className="text-2xl font-semibold text-foreground">Teachers</h1>
          <p className="text-sm text-muted-foreground">Teaching staff and subject assignments.</p>
        </div>
        {canWrite && (
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" />
            New teacher
          </Button>
        )}
      </div>

      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or employee ID…"
          className="pl-9"
        />
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
            <TH>Designation</TH>
            <TH>Base salary</TH>
            <TH>Status</TH>
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
              <TD colSpan={6} className="py-10 text-center text-muted-foreground">
                No teachers found.
              </TD>
            </TR>
          )}
          {!loading &&
            rows.map((t) => (
              <TR key={t.id}>
                <TD className="font-mono text-xs">{t.employeeId}</TD>
                <TD className="font-medium text-foreground">{t.fullName}</TD>
                <TD>{t.designation || '—'}</TD>
                <TD>{money(t.baseSalary)}</TD>
                <TD>
                  <Badge variant={statusVariant(t.status)}>{t.status}</Badge>
                </TD>
                <TD className="text-right">
                  <RowMenu
                    items={[
                      {
                        label: 'Edit',
                        onClick: () => {
                          setEditing(t);
                          setFormOpen(true);
                        },
                        hidden: !canWrite,
                      },
                      {
                        label: 'Delete',
                        onClick: () => {
                          setDelError(null);
                          setDeleting(t);
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

      <Pagination meta={meta} page={page} onPage={setPage} noun="teachers" />

      <TeacherForm
        open={formOpen}
        teacher={editing}
        onClose={() => setFormOpen(false)}
        onSaved={refetch}
      />

      {deleting && (
        <Dialog open={!!deleting} onClose={() => setDeleting(null)}>
          <DialogHeader title="Delete teacher" description={deleting.fullName} onClose={() => setDeleting(null)} />
          <DialogBody className="space-y-3">
            {delError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {delError}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              This deactivates the teacher record. Continue?
            </p>
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
