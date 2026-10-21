import { useState } from 'react';
import { Plus, Search, Loader2, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useApiList } from '@/hooks/useApiList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Pagination } from '@/components/Pagination';
import type { AcademicSubject, AcademicClass, AcademicSession } from '@/lib/dto';

const EMPTY_FORM = { classId: '', name: '', code: '', isElective: false };

export function SubjectsTab() {
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

  const { rows, meta, loading, error, query, page, setQuery, setPage, refetch } =
    useApiList<AcademicSubject>({
      path: '/academics/subjects',
      params: { classId: filterClassId || undefined },
      limit: 20,
    });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicSubject | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<AcademicSubject | null>(null);
  const [deleting, setDeleting] = useState(false);

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, classId: filterClassId });
    setSaveError(null);
    setDialogOpen(true);
  }

  function openEdit(s: AcademicSubject) {
    setEditing(s);
    setForm({
      classId: s.classId,
      name: s.name,
      code: s.code ?? '',
      isElective: s.isElective,
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
        code: form.code || undefined,
        isElective: form.isElective,
      };
      if (editing) {
        await api.patch(`/academics/subjects/${editing.id}`, payload);
      } else {
        await api.post('/academics/subjects', payload);
      }
      setDialogOpen(false);
      refetch();
    } catch {
      setSaveError('Failed to save subject. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.del(`/academics/subjects/${confirmDelete.id}`);
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
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search subjects…"
              className="pl-9 w-48"
            />
          </div>
        </div>
        {canWrite && (
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" />
            New Subject
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
            <TH>Code</TH>
            <TH>Class</TH>
            <TH>Elective</TH>
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
                No subjects found.
              </TD>
            </TR>
          )}
          {!loading &&
            rows.map((s) => (
              <TR key={s.id}>
                <TD className="font-medium text-foreground">{s.name}</TD>
                <TD className="font-mono text-xs">{s.code ?? '—'}</TD>
                <TD>{classes.find((c) => c.id === s.classId)?.name ?? '—'}</TD>
                <TD>
                  <Badge variant={s.isElective ? 'warning' : 'default'}>
                    {s.isElective ? 'Elective' : 'Core'}
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

      <Pagination meta={meta} page={page} onPage={setPage} noun="subjects" />

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogHeader
          title={editing ? 'Edit Subject' : 'New Subject'}
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
            <label className="text-sm font-medium text-foreground">Subject Name</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Mathematics"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Code (optional)</label>
            <Input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="e.g. MTH101"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isElective}
              onChange={(e) => setForm((f) => ({ ...f, isElective: e.target.checked }))}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium text-foreground">Elective Subject</span>
          </label>
          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? 'Save Changes' : 'Create Subject'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <DialogHeader
          title="Delete Subject"
          description={`Delete "${confirmDelete?.name}"? This cannot be undone.`}
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
