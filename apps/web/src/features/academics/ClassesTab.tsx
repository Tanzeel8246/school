import { useState } from 'react';
import { Plus, Loader2, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useApiList } from '@/hooks/useApiList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Pagination } from '@/components/Pagination';
import type { AcademicClass, AcademicSession } from '@/lib/dto';

const EMPTY_FORM = { sessionId: '', name: '', level: '' };

interface AcademicClassWithSession extends AcademicClass {
  sessionName?: string;
}

export function ClassesTab() {
  const { can } = useAuth();
  const canWrite = can('academics:write');

  const { rows: sessions } = useApiList<AcademicSession>({
    path: '/academics/sessions',
    limit: 100,
  });

  const [filterSessionId, setFilterSessionId] = useState('');
  const { rows, meta, loading, error, page, setPage, refetch } =
    useApiList<AcademicClassWithSession>({
      path: '/academics/classes',
      params: { sessionId: filterSessionId || undefined },
      limit: 20,
    });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicClass | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<AcademicClass | null>(null);
  const [deleting, setDeleting] = useState(false);

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, sessionId: filterSessionId });
    setSaveError(null);
    setDialogOpen(true);
  }

  function openEdit(c: AcademicClass) {
    setEditing(c);
    setForm({
      sessionId: c.sessionId,
      name: c.name,
      level: String(c.level ?? ''),
    });
    setSaveError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = { ...form, level: form.level ? Number(form.level) : undefined };
      if (editing) {
        await api.patch(`/academics/classes/${editing.id}`, payload);
      } else {
        await api.post('/academics/classes', payload);
      }
      setDialogOpen(false);
      refetch();
    } catch {
      setSaveError('Failed to save class. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.del(`/academics/classes/${confirmDelete.id}`);
      setConfirmDelete(null);
      refetch();
    } catch {
      // keep dialog for user
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select
          value={filterSessionId}
          onChange={(e) => setFilterSessionId(e.target.value)}
          className="w-52"
        >
          <option value="">All sessions</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        {canWrite && (
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" />
            New Class
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
            <TH>Level</TH>
            <TH>Session</TH>
            {canWrite && <TH className="text-right">Actions</TH>}
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
              <TD colSpan={4} className="py-10 text-center text-muted-foreground">
                No classes found.
              </TD>
            </TR>
          )}
          {!loading &&
            rows.map((c) => (
              <TR key={c.id}>
                <TD className="font-medium text-foreground">{c.name}</TD>
                <TD>{c.level ?? '—'}</TD>
                <TD>
                  {c.sessionName ??
                    sessions.find((s) => s.id === c.sessionId)?.name ??
                    '—'}
                </TD>
                {canWrite && (
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setConfirmDelete(c)}
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

      <Pagination meta={meta} page={page} onPage={setPage} noun="classes" />

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogHeader
          title={editing ? 'Edit Class' : 'New Class'}
          onClose={() => setDialogOpen(false)}
        />
        <DialogBody className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Session</label>
            <Select
              value={form.sessionId}
              onChange={(e) => setForm((f) => ({ ...f, sessionId: e.target.value }))}
            >
              <option value="">Select session…</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Class Name</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Class 5"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Level</label>
            <Input
              type="number"
              min={1}
              value={form.level}
              onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
              placeholder="e.g. 5"
            />
          </div>
          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? 'Save Changes' : 'Create Class'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <DialogHeader
          title="Delete Class"
          description={`Delete "${confirmDelete?.name}"? All sections and subjects in this class will also be affected.`}
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
