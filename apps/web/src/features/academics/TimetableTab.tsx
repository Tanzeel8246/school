import { useEffect, useState } from 'react';
import { Plus, Loader2, Trash2, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useApiList } from '@/hooks/useApiList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type {
  AcademicTimetableSlot,
  AcademicSection,
  AcademicClass,
  AcademicSession,
  AcademicSubject,
  Staff,
} from '@/lib/dto';
import { SearchableSelect } from '@/components/ui/searchable-select';

const WEEKDAYS = [
  { num: 1, label: 'Mon' },
  { num: 2, label: 'Tue' },
  { num: 3, label: 'Wed' },
  { num: 4, label: 'Thu' },
  { num: 5, label: 'Fri' },
  { num: 6, label: 'Sat' },
  { num: 7, label: 'Sun' },
];

const MAX_PERIODS = 8;

const EMPTY_FORM = {
  subjectId: '',
  teacherId: '',
  weekday: 1,
  period: 1,
  startTime: '',
  endTime: '',
};

interface SlotDialogState {
  mode: 'add' | 'edit';
  weekday?: number;
  period?: number;
  slot?: AcademicTimetableSlot;
}

function getPeriodTimes(period: number) {
  const times: Record<number, { start: string; end: string }> = {
    1: { start: '08:00', end: '08:45' },
    2: { start: '08:45', end: '09:30' },
    3: { start: '09:30', end: '10:15' },
    4: { start: '10:15', end: '11:00' },
    5: { start: '11:00', end: '11:45' },
    6: { start: '11:45', end: '12:30' },
    7: { start: '12:30', end: '13:15' },
    8: { start: '13:15', end: '14:00' },
  };
  return times[period] || { start: '08:00', end: '08:45' };
}

export function TimetableTab() {
  const { can } = useAuth();
  const canWrite = can('academics:write');

  // Cascading selectors: session → class → section
  const { rows: sessions } = useApiList<AcademicSession>({
    path: '/academics/sessions',
    limit: 100,
  });
  const [selSessionId, setSelSessionId] = useState('');
  const [selClassId, setSelClassId] = useState('');
  const [sectionId, setSectionId] = useState('');

  const { rows: classes } = useApiList<AcademicClass>({
    path: '/academics/classes',
    params: { sessionId: selSessionId || undefined },
    limit: 100,
  });

  const { rows: sections } = useApiList<AcademicSection>({
    path: '/academics/sections',
    params: { classId: selClassId || undefined },
    limit: 100,
  });

  const { rows: subjects } = useApiList<AcademicSubject>({
    path: '/academics/subjects',
    params: { classId: selClassId || undefined },
    limit: 200,
  });

  const { rows: teachers } = useApiList<Staff>({
    path: '/staff',
    params: { staffType: 'teacher' },
    limit: 500,
  });

  // Fetch timetable slots for selected section
  const [slots, setSlots] = useState<AcademicTimetableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  useEffect(() => {
    if (!sectionId) { setSlots([]); return; }
    let cancelled = false;
    setSlotsLoading(true);
    setSlotsError(null);
    api
      .get<AcademicTimetableSlot[]>(`/academics/timetable?sectionId=${sectionId}`)
      .then((res) => {
        if (cancelled) return;
        const body = res.data;
        setSlots(Array.isArray(body) ? body : (body as { data: AcademicTimetableSlot[] }).data ?? []);
      })
      .catch(() => {
        if (!cancelled) setSlotsError('Could not load timetable.');
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => { cancelled = true; };
  }, [sectionId]);

  // Build slot lookup [weekday][period]
  const lookup: Record<number, Record<number, AcademicTimetableSlot>> = {};
  for (const s of slots) {
    if (!lookup[s.weekday]) lookup[s.weekday] = {};
    lookup[s.weekday][s.period] = s;
  }

  const periods = Array.from({ length: MAX_PERIODS }, (_, i) => i + 1);

  // Dialog state
  const [dialogState, setDialogState] = useState<SlotDialogState | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<AcademicTimetableSlot | null>(null);
  const [deleting, setDeleting] = useState(false);

  function openAdd(weekday: number, period: number) {
    const { start, end } = getPeriodTimes(period);
    setDialogState({ mode: 'add', weekday, period });
    setForm({
      ...EMPTY_FORM,
      weekday,
      period,
      startTime: start,
      endTime: end,
    });
    setSelectedWeekdays([weekday]);
    setSaveError(null);
  }

  function openEdit(slot: AcademicTimetableSlot) {
    setDialogState({ mode: 'edit', slot });
    setForm({
      subjectId: slot.subjectId,
      teacherId: slot.teacherId,
      weekday: slot.weekday,
      period: slot.period,
      startTime: slot.startTime,
      endTime: slot.endTime,
    });
    setSelectedWeekdays([slot.weekday]);
    setSaveError(null);
  }

  async function handleSave() {
    if (!sectionId) return;
    
    // Front-end Validation
    if (!form.subjectId) {
      setSaveError('Please select a subject.');
      return;
    }
    if (!form.teacherId) {
      setSaveError('Please select a teacher.');
      return;
    }
    if (!form.startTime || !form.endTime) {
      setSaveError('Please enter start and end times.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      if (dialogState?.mode === 'edit' && dialogState.slot) {
        const payload = {
          sectionId,
          subjectId: form.subjectId,
          teacherId: form.teacherId,
          weekday: form.weekday,
          period: form.period,
          startTime: form.startTime,
          endTime: form.endTime,
        };
        await api.patch(`/academics/timetable/${dialogState.slot.id}`, payload);
      } else {
        if (selectedWeekdays.length === 0) {
          throw new Error('Please select at least one day.');
        }
        const promises = selectedWeekdays.map(async (d) => {
          const payload = {
            sectionId,
            subjectId: form.subjectId,
            teacherId: form.teacherId,
            weekday: d,
            period: form.period,
            startTime: form.startTime,
            endTime: form.endTime,
          };
          const existingSlot = slots.find((s) => s.weekday === d && s.period === form.period);
          if (existingSlot) {
            return api.patch(`/academics/timetable/${existingSlot.id}`, payload);
          } else {
            return api.post('/academics/timetable', payload);
          }
        });
        await Promise.all(promises);
      }
      setDialogState(null);
      const res = await api.get<AcademicTimetableSlot[]>(`/academics/timetable?sectionId=${sectionId}`);
      const body = res.data;
      setSlots(Array.isArray(body) ? body : (body as { data: AcademicTimetableSlot[] }).data ?? []);
    } catch (err: any) {
      setSaveError(err.payload?.error || err.message || 'Failed to save timetable slot.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete || !sectionId) return;
    setDeleting(true);
    try {
      await api.del(`/academics/timetable/${confirmDelete.id}`);
      setConfirmDelete(null);
      const res = await api.get<AcademicTimetableSlot[]>(`/academics/timetable?sectionId=${sectionId}`);
      const body = res.data;
      setSlots(Array.isArray(body) ? body : (body as { data: AcademicTimetableSlot[] }).data ?? []);
    } catch {
      // keep dialog
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Cascading selectors */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Session</label>
          <Select
            value={selSessionId}
            onChange={(e) => { setSelSessionId(e.target.value); setSelClassId(''); setSectionId(''); }}
            className="w-44"
          >
            <option value="">Select session…</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Class</label>
          <Select
            value={selClassId}
            onChange={(e) => { setSelClassId(e.target.value); setSectionId(''); }}
            className="w-44"
            disabled={!selSessionId}
          >
            <option value="">Select class…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Section</label>
          <Select
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            className="w-44"
            disabled={!selClassId}
          >
            <option value="">Select section…</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </div>
      </div>

      {slotsError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {slotsError}
        </div>
      )}

      {!sectionId && (
        <div className="rounded-xl border border-border bg-card py-10 text-center text-sm text-muted-foreground">
          Select a section to view and edit its timetable.
        </div>
      )}

      {sectionId && slotsLoading && (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {sectionId && !slotsLoading && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground w-14">
                  Period
                </th>
                {WEEKDAYS.map((w) => (
                  <th
                    key={w.num}
                    className="px-2 py-2.5 text-left text-xs font-semibold text-muted-foreground min-w-[130px]"
                  >
                    {w.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <tr key={period} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-xs font-semibold text-muted-foreground align-top">
                    P{period}
                  </td>
                  {WEEKDAYS.map((w) => {
                    const slot = lookup[w.num]?.[period];
                    return (
                      <td key={w.num} className="px-2 py-1.5 align-top">
                        {slot ? (
                          <div className="group relative rounded-lg bg-primary/10 border border-primary/20 px-2 py-1.5">
                            <p className="font-medium text-primary text-xs leading-tight">
                              {slot.subjectName}
                            </p>
                            <p className="text-primary/80 text-xs leading-tight mt-0.5">
                              {slot.teacherName}
                            </p>
                            <p className="text-primary/60 text-xs mt-0.5">
                              {slot.startTime}–{slot.endTime}
                            </p>
                            {canWrite && (
                              <div className="absolute right-1 top-1 hidden gap-0.5 group-hover:flex">
                                <button
                                  onClick={() => openEdit(slot)}
                                  className="rounded p-0.5 text-primary/60 hover:bg-indigo-100 hover:text-primary"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => setConfirmDelete(slot)}
                                  className="rounded p-0.5 text-red-400 hover:bg-red-100 hover:text-red-700"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        ) : canWrite ? (
                          <button
                            onClick={() => openAdd(w.num, period)}
                            className={cn(
                              'flex h-14 w-full items-center justify-center rounded-lg border border-dashed border-border text-slate-300 transition-colors hover:border-indigo-300 hover:text-primary/60',
                            )}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={!!dialogState} onClose={() => setDialogState(null)}>
        <DialogHeader
          title={dialogState?.mode === 'edit' ? 'Edit Slot' : 'Add Slot'}
          description={
            dialogState?.mode === 'add'
              ? `Period ${dialogState.period}`
              : undefined
          }
          onClose={() => setDialogState(null)}
        />
        <DialogBody className="space-y-4">
          {dialogState?.mode === 'add' ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Assign to Days</label>
              <div className="flex flex-wrap gap-2 pt-1">
                {WEEKDAYS.map((w) => {
                  const isChecked = selectedWeekdays.includes(w.num);
                  return (
                    <label
                      key={w.num}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors select-none",
                        isChecked
                          ? "bg-primary/10 border-primary text-primary font-medium"
                          : "border-border bg-card text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedWeekdays(selectedWeekdays.filter((num) => num !== w.num));
                          } else {
                            setSelectedWeekdays([...selectedWeekdays, w.num]);
                          }
                        }}
                      />
                      {w.label}
                    </label>
                  );
                })}
              </div>
              <div className="flex gap-3 mt-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedWeekdays([1, 2, 3, 4, 5])}
                  className="text-primary hover:underline"
                >
                  Weekdays (Mon-Fri)
                </button>
                <span className="text-muted-foreground/50">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedWeekdays([1, 2, 3, 4, 5, 6, 7])}
                  className="text-primary hover:underline"
                >
                  All Days
                </button>
                <span className="text-muted-foreground/50">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedWeekdays([])}
                  className="text-muted-foreground hover:underline"
                >
                  Clear All
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Weekday</label>
                <Select
                  value={String(form.weekday)}
                  onChange={(e) => setForm((f) => ({ ...f, weekday: Number(e.target.value) }))}
                >
                  {WEEKDAYS.map((w) => (
                    <option key={w.num} value={w.num}>{w.label}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Period</label>
                <Select
                  value={String(form.period)}
                  onChange={(e) => {
                    const p = Number(e.target.value);
                    const { start, end } = getPeriodTimes(p);
                    setForm((f) => ({ ...f, period: p, startTime: start, endTime: end }));
                  }}
                >
                  {periods.map((p) => (
                    <option key={p} value={p}>Period {p}</option>
                  ))}
                </Select>
              </div>
            </div>
          )}

          {dialogState?.mode === 'add' && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Period</label>
              <Select
                value={String(form.period)}
                onChange={(e) => {
                  const p = Number(e.target.value);
                  const { start, end } = getPeriodTimes(p);
                  setForm((f) => ({ ...f, period: p, startTime: start, endTime: end }));
                }}
              >
                {periods.map((p) => (
                  <option key={p} value={p}>Period {p}</option>
                ))}
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Subject</label>
            <SearchableSelect
              value={subjects.map(s => ({ value: s.id, label: s.name })).find(o => o.value === form.subjectId) || null}
              onChange={(val: any) => setForm((f) => ({ ...f, subjectId: val?.value || '' }))}
              options={subjects.map(s => ({ value: s.id, label: s.name }))}
              placeholder="Select subject…"
              isClearable
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Teacher</label>
            <SearchableSelect
              value={teachers.map(t => ({ value: t.id, label: t.fullName })).find(o => o.value === form.teacherId) || null}
              onChange={(val: any) => setForm((f) => ({ ...f, teacherId: val?.value || '' }))}
              options={teachers.map(t => ({ value: t.id, label: t.fullName }))}
              placeholder="Select teacher…"
              isClearable
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Start Time</label>
              <Input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">End Time</label>
              <Input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              />
            </div>
          </div>
          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogState(null)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {dialogState?.mode === 'edit' ? 'Save Changes' : 'Add Slot'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <DialogHeader
          title="Delete Slot"
          description={`Remove ${confirmDelete?.subjectName} (Period ${confirmDelete?.period}, ${WEEKDAYS.find((w) => w.num === confirmDelete?.weekday)?.label})?`}
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
