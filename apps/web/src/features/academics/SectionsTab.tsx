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
import type { AcademicSection, AcademicClass, AcademicSession, Staff } from '@/lib/dto';
import { SearchableSelect } from '@/components/ui/searchable-select';

const EMPTY_FORM = { classId: '', name: '', capacity: '', teacherId: '' };

export function SectionsTab() {
  const { can } = useAuth();
  const canWrite = can('academics:write');

  const { rows: sessions } = useApiList<AcademicSession>({
    path: '/academics/sessions',
    limit: 100,
  });

  const [filterSessionId, setFilterSessionId] = useState('');
  const [filterClassId, setFilterClassId] = useState('');

  const { rows: classes } = useApiList<AcademicClass>({
    path: '/academics/classes',
    params: { sessionId: filterSessionId || undefined },
    limit: 100,
  });

  const { rows, meta, loading, error, page, setPage, refetch } =
    useApiList<AcademicSection>({
      path: '/academics/sections',
      params: { classId: filterClassId || undefined },
      limit: 20,
    });

  const { rows: teachers } = useApiList<Staff>({
    path: '/staff',
    params: { staffType: 'teacher' },
    limit: 100,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicSection | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<AcademicSection | null>(null);
  const [deleting, setDeleting] = useState(false);

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, classId: filterClassId });
    setSaveError(null);
    setDialogOpen(true);
  }

  function openEdit(s: AcademicSection) {
    setEditing(s);
    setForm({
      classId: s.classId,
      name: s.name,
      capacity: s.capacity ? String(s.capacity) : '',
      teacherId: s.teacherId ?? '',
    });
    setSaveError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        classId: form.classId,
        name: form.name,
        capacity: form.capacity ? Number(form.capacity) : undefined,
        teacherId: form.teacherId || undefined,
      };
      if (editing) {
        await api.patch(`/academics/sections/${editing.id}`, payload);
      } else {
        await api.post('/academics/sections', payload);
      }
      setDialogOpen(false);
      refetch();
    } catch {
      setSaveError('Failed to save section. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.del(`/academics/sections/${confirmDelete.id}`);
      setConfirmDelete(null);
      refetch();
    } catch {
      // keep dialog
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Select
            value={filterSessionId}
            onChange={(e) => { setFilterSessionId(e.target.value); setFilterClassId(''); }}
            className="w-44"
          >
            <option value="">All sessions</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
          <Select
            value={filterClassId}
            onChange={(e) => setFilterClassId(e.target.value)}
            className="w-44"
          >
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
        {canWrite && (
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" />
            New Section
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
            <TH>Class</TH>
            <TH>Capacity</TH>
            <TH>Teacher</TH>
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
                No sections found.
              </TD>
            </TR>
          )}
          {!loading &&
            rows.map((s) => (
              <TR key={s.id}>
                <TD className="font-medium text-foreground">{s.name}</TD>
                <TD>{classes.find((c) => c.id === s.classId)?.name ?? '—'}</TD>
                <TD>{s.capacity ?? '—'}</TD>
                <TD>{s.teacherName ?? (s.teacherId ? s.teacherId : '—')}</TD>
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

      <Pagination meta={meta} page={page} onPage={setPage} noun="sections" />

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogHeader
          title={editing ? 'Edit Section' : 'New Section'}
          onClose={() => setDialogOpen(false)}
        />
        <DialogBody className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Class</label>
            <Select
              value={form.classId}
              onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}
            >
              <option value="">Select class…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Section Name</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. A, B, Red"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Capacity (optional)</label>
            <Input
              type="number"
              min={1}
              value={form.capacity}
              onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
              placeholder="e.g. 40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Class Teacher (optional)</label>
            <SearchableSelect
              value={teachers.map(t => ({ value: t.id, label: t.fullName })).find(o => o.value === form.teacherId) || null}
              onChange={(val: any) => setForm((f) => ({ ...f, teacherId: val?.value || '' }))}
              options={teachers.map(t => ({ value: t.id, label: t.fullName }))}
              placeholder="Select class teacher…"
              isClearable
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
            {editing ? 'Save Changes' : 'Create Section'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <DialogHeader
          title="Delete Section"
          description={`Delete section "${confirmDelete?.name}"? This cannot be undone.`}
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
