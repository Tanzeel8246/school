import { useState } from 'react';
import { Plus, Search, Loader2, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useApiList } from '@/hooks/useApiList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Pagination } from '@/components/Pagination';
import { date } from '@/lib/format';
import type { AcademicSession } from '@/lib/dto';

const EMPTY_FORM = { name: '', startDate: '', endDate: '', isActive: false };

export function SessionsTab() {
  const { can } = useAuth();
  const canWrite = can('academics:write');

  const { rows, meta, loading, error, query, page, setQuery, setPage, refetch } =
    useApiList<AcademicSession>({ path: '/academics/sessions', limit: 20 });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicSession | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<AcademicSession | null>(null);
  const [deleting, setDeleting] = useState(false);

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSaveError(null);
    setDialogOpen(true);
  }

  function openEdit(s: AcademicSession) {
    setEditing(s);
    setForm({
      name: s.name,
      startDate: s.startDate?.slice(0, 10) ?? '',
      endDate: s.endDate?.slice(0, 10) ?? '',
      isActive: s.isActive,
    });
    setSaveError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      if (editing) {
        await api.patch(`/academics/sessions/${editing.id}`, form);
      } else {
        await api.post('/academics/sessions', form);
      }
      setDialogOpen(false);
      refetch();
    } catch {
      setSaveError('Failed to save session. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.del(`/academics/sessions/${confirmDelete.id}`);
      setConfirmDelete(null);
      refetch();
    } catch {
      // ignore — keep dialog open for user to see
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sessions…"
            className="pl-9"
          />
        </div>
        {canWrite && (
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" />
            New Session
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Name</TH>
            <TH>Start Date</TH>
            <TH>End Date</TH>
            <TH>Active</TH>
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
              <TD colSpan={5} className="py-10 text-center text-muted-foreground">
                No sessions found.
              </TD>
            </TR>
          )}
          {!loading &&
            rows.map((s) => (
              <TR key={s.id}>
                <TD className="font-medium text-foreground">{s.name}</TD>
                <TD>{date(s.startDate)}</TD>
                <TD>{date(s.endDate)}</TD>
                <TD>
                  <Badge variant={s.isActive ? 'success' : 'default'}>
                    {s.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TD>
                {canWrite && (
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setConfirmDelete(s)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TD>
                )}
              </TR>
            ))}
        </TBody>
      </Table>

      <Pagination meta={meta} page={page} onPage={setPage} noun="sessions" />

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogHeader
          title={editing ? 'Edit Session' : 'New Session'}
          onClose={() => setDialogOpen(false)}
        />
        <DialogBody className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Name</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. 2024-2025"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Start Date</label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">End Date</label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium text-foreground">Mark as Active Session</span>
          </label>
          {saveError && (
            <p className="text-sm text-red-600">{saveError}</p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? 'Save Changes' : 'Create Session'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <DialogHeader
          title="Delete Session"
          description={`Are you sure you want to delete "${confirmDelete?.name}"? This cannot be undone.`}
          onClose={() => setConfirmDelete(null)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmDelete(null)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
