import { useState } from 'react';
import { Plus, Search, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useApiList } from '@/hooks/useApiList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { RowMenu } from '@/components/RowMenu';
import { Pagination } from '@/components/Pagination';
import { statusVariant } from '@/lib/format';
import type { Student } from '@/lib/dto';
import { StudentForm } from './StudentForm';
import { StudentActionDialog, StudentHistoryDialog, type LifecycleAction } from './StudentActions';

// Must match the backend students status enum (active|suspended|transferred|left|alumni).
const STATUS_OPTIONS = ['', 'active', 'suspended', 'transferred', 'left', 'alumni'];

/** Students module: searchable, paginated table with full CRUD + lifecycle actions. */
export function StudentsPage() {
  const { can } = useAuth();
  const canWrite = can('students:write');

  const [status, setStatus] = useState('');
  const { rows, meta, loading, error, query, page, setQuery, setPage, refetch } =
    useApiList<Student>({ path: '/students', params: { status } });

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [historyFor, setHistoryFor] = useState<Student | null>(null);
  const [action, setAction] = useState<{ student: Student; action: LifecycleAction } | null>(null);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (s: Student) => {
    setEditing(s);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Students</h1>
          <p className="text-sm text-muted-foreground">Manage admissions, records and lifecycle.</p>
        </div>
        {canWrite && (
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" />
            New student
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or admission no…"
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-44"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s ? s[0].toUpperCase() + s.slice(1) : 'All statuses'}
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
            <TH>Adm No</TH>
            <TH>Roll</TH>
            <TH>Name</TH>
            <TH>Section</TH>
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
                No students found.
              </TD>
            </TR>
          )}
          {!loading &&
            rows.map((s) => (
              <TR key={s.id}>
                <TD className="font-mono text-xs">{s.admissionNo}</TD>
                <TD>{s.rollNo ?? '—'}</TD>
                <TD className="font-medium text-foreground">{s.fullName}</TD>
                <TD>
                  {s.sectionName 
                    ? `${s.className ? s.className + ' - ' : ''}${s.sectionName}` 
                    : <span className="font-mono text-xs text-muted-foreground">{s.sectionId || '—'}</span>}
                </TD>
                <TD>
                  <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                </TD>
                <TD className="text-right">
                  <RowMenu
                    items={[
                      { label: 'Edit', onClick: () => openEdit(s), hidden: !canWrite },
                      { label: 'History', onClick: () => setHistoryFor(s) },
                      {
                        label: 'Promote',
                        onClick: () => setAction({ student: s, action: 'promote' }),
                        hidden: !canWrite,
                      },
                      {
                        label: 'Transfer',
                        onClick: () => setAction({ student: s, action: 'transfer' }),
                        hidden: !canWrite,
                      },
                      {
                        label: 'Suspend',
                        onClick: () => setAction({ student: s, action: 'suspend' }),
                        hidden: !canWrite,
                      },
                      {
                        label: 'Reinstate',
                        onClick: () => setAction({ student: s, action: 'reinstate' }),
                        hidden: !canWrite,
                      },
                      {
                        label: 'Delete',
                        onClick: () => setAction({ student: s, action: 'delete' }),
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

      <Pagination meta={meta} page={page} onPage={setPage} noun="students" />

      {/* Dialogs */}
      <StudentForm
        open={formOpen}
        student={editing}
        onClose={() => setFormOpen(false)}
        onSaved={refetch}
      />
      {historyFor && (
        <StudentHistoryDialog
          open={!!historyFor}
          student={historyFor}
          onClose={() => setHistoryFor(null)}
        />
      )}
      {action && (
        <StudentActionDialog
          open={!!action}
          action={action.action}
          student={action.student}
          onClose={() => setAction(null)}
          onDone={refetch}
        />
      )}
    </div>
  );
}
