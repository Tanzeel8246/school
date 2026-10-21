/**
 * ExamsPage — tabbed: Exams | Marks Entry | Results | Analysis
 * Gate: results:read to view; exams:write / exams:manage / exams:enter_marks for sub-actions.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Loader2,
  Search,
  ClipboardList,
  Printer,
  Trash2,
} from 'lucide-react';
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
import { date } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
  Exam,
  MarksRoster,
  MarksEntry,
  StudentResult,
  ClassAnalysis,
  SubjectAnalysis,
} from '@/lib/dto';
import { ResultCardModal } from './ResultCardModal';

// ─── Local grade preview (client-side only, server computes real grade) ───────

function previewGrade(obtained: number, total: number): string {
  if (total === 0) return '—';
  const pct = (obtained / total) * 100;
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C+';
  if (pct >= 40) return 'C';
  if (pct >= 33) return 'D';
  return 'F';
}

// ─── Badge colour helpers ─────────────────────────────────────────────────────

const EXAM_TYPE_CLASS: Record<string, string> = {
  monthly: 'bg-primary/10 text-primary',
  midterm: 'bg-primary/10 text-primary',
  final: 'bg-purple-50 text-purple-700',
  quarterly: 'bg-teal-50 text-teal-700',
  annual: 'bg-rose-50 text-rose-700',
};

const GRADE_CLASS: Record<string, string> = {
  'A+': 'bg-emerald-50 text-emerald-700',
  A: 'bg-green-50 text-green-700',
  'B+': 'bg-sky-50 text-sky-700',
  B: 'bg-primary/10 text-primary',
  'C+': 'bg-yellow-50 text-yellow-700',
  C: 'bg-amber-50 text-amber-700',
  D: 'bg-orange-50 text-orange-700',
  F: 'bg-red-50 text-red-700',
};

function ExamTypeBadge({ type }: { type: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
        EXAM_TYPE_CLASS[type] ?? 'bg-muted text-foreground',
      )}
    >
      {type}
    </span>
  );
}

function GradeBadge({ grade }: { grade: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        GRADE_CLASS[grade] ?? 'bg-muted text-foreground',
      )}
    >
      {grade}
    </span>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

type Tab = 'exams' | 'marks' | 'results' | 'analysis';

const TABS: { id: Tab; label: string }[] = [
  { id: 'exams', label: 'Exams' },
  { id: 'marks', label: 'Marks Entry' },
  { id: 'results', label: 'Results' },
  { id: 'analysis', label: 'Analysis' },
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

export function ExamsPage() {
  const [tab, setTab] = useState<Tab>('exams');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ClipboardList className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Examinations</h1>
          <p className="text-sm text-muted-foreground">
            Manage exams, enter marks, view results and analyse performance.
          </p>
        </div>
      </div>

      <TabBar active={tab} onChange={setTab} />

      {tab === 'exams' && <ExamsTab />}
      {tab === 'marks' && <MarksEntryTab />}
      {tab === 'results' && <ResultsTab />}
      {tab === 'analysis' && <AnalysisTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — Exams
// ═══════════════════════════════════════════════════════════════════════════════

function ExamsTab() {
  const { can } = useAuth();
  const canWrite = can('exams:write');
  const canManage = can('exams:manage');

  const [examTypeFilter, setExamTypeFilter] = useState('');

  const { rows, meta, loading, error, query, page, setQuery, setPage, refetch } =
    useApiList<Exam>({
      path: '/exams',
      params: { examType: examTypeFilter || undefined },
    });

  const [formOpen, setFormOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [subjectsTarget, setSubjectsTarget] = useState<Exam | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Exam | null>(null);
  const [confirmPublish, setConfirmPublish] = useState<{ exam: Exam; action: 'publish' | 'unpublish' } | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);

  async function togglePublish() {
    if (!confirmPublish) return;
    setPublishBusy(true);
    try {
      const { exam, action } = confirmPublish;
      await api.post(`/exams/${exam.id}/${action}`, {});
      // Fire-and-forget: notify all students when an exam is published
      if (action === 'publish') {
        api
          .post('/communications/announcements', {
            title: `Results Published: ${exam.name}`,
            message: `Results for ${exam.name} have been published. Login to EduCore to view your result card.`,
            channels: ['sms'],
            targetType: 'all_students',
          })
          .catch(() => undefined);
      }
      setConfirmPublish(null);
      refetch();
    } catch {
      // leave dialog open with no change
    } finally {
      setPublishBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exams…"
            className="pl-9 w-52"
          />
        </div>
        <Select
          value={examTypeFilter}
          onChange={(e) => setExamTypeFilter(e.target.value)}
          className="w-44"
        >
          <option value="">All types</option>
          <option value="monthly">Monthly</option>
          <option value="midterm">Midterm</option>
          <option value="quarterly">Quarterly</option>
          <option value="final">Final</option>
          <option value="annual">Annual</option>
        </Select>
        {canWrite && (
          <Button className="ml-auto" onClick={() => { setEditingExam(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" />
            New Exam
          </Button>
        )}
      </div>

      {error && <ErrorBox message={error} />}

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Name</TH>
            <TH>Type</TH>
            <TH>Class</TH>
            <TH>Start</TH>
            <TH>End</TH>
            <TH>Subjects</TH>
            <TH>Status</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {loading && (
            <TR className="hover:bg-transparent">
              <TD colSpan={8} className="py-10 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </TD>
            </TR>
          )}
          {!loading && rows.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={8} className="py-10 text-center text-muted-foreground">
                No exams found.
              </TD>
            </TR>
          )}
          {!loading &&
            rows.map((exam) => (
              <TR key={exam.id}>
                <TD className="font-medium text-foreground">{exam.name}</TD>
                <TD>
                  <ExamTypeBadge type={exam.examType} />
                </TD>
                <TD className="text-muted-foreground">{exam.className ?? '—'}</TD>
                <TD>{date(exam.startDate)}</TD>
                <TD>{date(exam.endDate)}</TD>
                <TD>{exam.subjects?.length ?? 0}</TD>
                <TD>
                  <Badge variant={exam.isPublished ? 'success' : 'warning'}>
                    {exam.isPublished ? 'Published' : 'Draft'}
                  </Badge>
                </TD>
                <TD className="text-right">
                  <RowMenu
                    items={[
                      {
                        label: 'Edit',
                        onClick: () => { setEditingExam(exam); setFormOpen(true); },
                        hidden: !canWrite,
                      },
                      {
                        label: 'Manage Subjects',
                        onClick: () => setSubjectsTarget(exam),
                        hidden: !canWrite,
                      },
                      {
                        label: exam.isPublished ? 'Unpublish' : 'Publish',
                        onClick: () =>
                          setConfirmPublish({
                            exam,
                            action: exam.isPublished ? 'unpublish' : 'publish',
                          }),
                        hidden: !canManage,
                      },
                      {
                        label: 'Delete',
                        onClick: () => setDeleteTarget(exam),
                        danger: true,
                        hidden: !canWrite || exam.isPublished,
                      },
                    ]}
                  />
                </TD>
              </TR>
            ))}
        </TBody>
      </Table>

      <Pagination meta={meta} page={page} onPage={setPage} noun="exams" />

      {/* Dialogs */}
      <ExamFormDialog
        open={formOpen}
        exam={editingExam}
        onClose={() => setFormOpen(false)}
        onSaved={refetch}
      />

      {subjectsTarget && (
        <SubjectsDialog
          open={!!subjectsTarget}
          exam={subjectsTarget}
          onClose={() => setSubjectsTarget(null)}
          onSaved={refetch}
        />
      )}

      <ConfirmDialog
        open={!!confirmPublish}
        title={confirmPublish?.action === 'publish' ? 'Publish Exam' : 'Unpublish Exam'}
        message={
          confirmPublish?.action === 'publish'
            ? `Publish "${confirmPublish.exam.name}"? Results will become visible to permitted users.`
            : `Unpublish "${confirmPublish?.exam.name}"? It will revert to Draft status.`
        }
        confirmLabel={confirmPublish?.action === 'publish' ? 'Publish' : 'Unpublish'}
        busy={publishBusy}
        onClose={() => setConfirmPublish(null)}
        onConfirm={togglePublish}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Exam"
        message={`Permanently delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        busy={false}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.del(`/exams/${deleteTarget.id}`);
          setDeleteTarget(null);
          refetch();
        }}
      />
    </div>
  );
}

// ─── ExamFormDialog ───────────────────────────────────────────────────────────

interface DraftSubjectRow {
  subjectId: string;
  totalMarks: string;
  passingMarks: string;
}

function emptySubjectRow(): DraftSubjectRow {
  return { subjectId: '', totalMarks: '', passingMarks: '' };
}

function ExamFormDialog({
  open,
  exam,
  onClose,
  onSaved,
}: {
  open: boolean;
  exam: Exam | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [examType, setExamType] = useState<Exam['examType']>('monthly');
  const [classId, setClassId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [subjects, setSubjects] = useState<DraftSubjectRow[]>([emptySubjectRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (exam) {
      setName(exam.name);
      setExamType(exam.examType);
      setClassId(exam.classId ?? '');
      setSessionId(exam.sessionId ?? '');
      setStartDate(exam.startDate ?? '');
      setEndDate(exam.endDate ?? '');
      setSubjects([emptySubjectRow()]);
    } else {
      setName('');
      setExamType('monthly');
      setClassId('');
      setSessionId('');
      setStartDate('');
      setEndDate('');
      setSubjects([emptySubjectRow()]);
    }
    setError(null);
  }, [exam, open]);

  function updateSubject(idx: number, field: keyof DraftSubjectRow, value: string) {
    setSubjects((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name,
        examType,
        classId: classId || undefined,
        sessionId: sessionId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };

      if (exam) {
        await api.patch(`/exams/${exam.id}`, payload);
      } else {
        // Include subjects on create
        const validSubjects = subjects.filter((s) => s.subjectId.trim());
        payload.subjects = validSubjects.map((s) => ({
          subjectId: s.subjectId.trim(),
          totalMarks: Number(s.totalMarks) || 100,
          passingMarks: Number(s.passingMarks) || 33,
        }));
        await api.post('/exams', payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not save exam.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-2xl">
      <form onSubmit={submit}>
        <DialogHeader title={exam ? 'Edit Exam' : 'New Exam'} onClose={onClose} />
        <DialogBody className="space-y-4 overflow-y-auto max-h-[75vh]">
          {error && <ErrorBox message={error} />}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Name" className="col-span-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Mid-Term Exam 2024"
              />
            </Field>

            <Field label="Exam Type">
              <Select
                value={examType}
                onChange={(e) => setExamType(e.target.value as Exam['examType'])}
              >
                <option value="monthly">Monthly</option>
                <option value="midterm">Midterm</option>
                <option value="quarterly">Quarterly</option>
                <option value="final">Final</option>
                <option value="annual">Annual</option>
              </Select>
            </Field>

            <Field label="Class ID (optional)">
              <Input
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                placeholder="Class UUID"
              />
            </Field>

            <Field label="Session ID (optional)">
              <Input
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                placeholder="Session UUID"
              />
            </Field>

            <Field label="Start Date (optional)">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>

            <Field label="End Date (optional)">
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Field>
          </div>

          {/* Subjects — only shown on create */}
          {!exam && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Subjects{' '}
                <span className="text-muted-foreground font-normal text-xs">
                  (you can also add/edit later via Manage Subjects)
                </span>
              </p>

              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                <span className="col-span-5">Subject ID</span>
                <span className="col-span-3">Total Marks</span>
                <span className="col-span-3">Passing Marks</span>
                <span className="col-span-1" />
              </div>

              {subjects.map((s, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <Input
                      value={s.subjectId}
                      onChange={(e) => updateSubject(i, 'subjectId', e.target.value)}
                      placeholder="Subject UUID"
                      className="text-xs"
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      min="1"
                      value={s.totalMarks}
                      onChange={(e) => updateSubject(i, 'totalMarks', e.target.value)}
                      placeholder="100"
                      className="text-xs"
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      min="0"
                      value={s.passingMarks}
                      onChange={(e) => updateSubject(i, 'passingMarks', e.target.value)}
                      placeholder="33"
                      className="text-xs"
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setSubjects((prev) => prev.filter((_, idx) => idx !== i))}
                      disabled={subjects.length <= 1}
                      className="p-1 text-muted-foreground hover:text-red-500 disabled:opacity-30"
                      aria-label="Remove subject"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSubjects((prev) => [...prev, emptySubjectRow()])}
              >
                <Plus className="h-4 w-4" />
                Add subject row
              </Button>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {exam ? 'Save Changes' : 'Create'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// ─── SubjectsDialog ───────────────────────────────────────────────────────────

function SubjectsDialog({
  open,
  exam,
  onClose,
  onSaved,
}: {
  open: boolean;
  exam: Exam;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<DraftSubjectRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      if (exam.subjects && exam.subjects.length > 0) {
        setRows(
          exam.subjects.map((s) => ({
            subjectId: s.subjectId,
            totalMarks: String(s.totalMarks),
            passingMarks: String(s.passingMarks),
          })),
        );
      } else {
        setRows([emptySubjectRow()]);
      }
    }
  }, [open, exam]);

  function update(idx: number, field: keyof DraftSubjectRow, value: string) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const validRows = rows.filter((r) => r.subjectId.trim());
      await api.patch(`/exams/${exam.id}/subjects`, {
        subjects: validRows.map((r) => ({
          subjectId: r.subjectId.trim(),
          totalMarks: Number(r.totalMarks) || 100,
          passingMarks: Number(r.passingMarks) || 33,
        })),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not save subjects.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-2xl">
      <form onSubmit={submit}>
        <DialogHeader
          title="Manage Subjects"
          description={exam.name}
          onClose={onClose}
        />
        <DialogBody className="space-y-4 overflow-y-auto max-h-[70vh]">
          {error && <ErrorBox message={error} />}

          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
            <span className="col-span-5">Subject ID</span>
            <span className="col-span-3">Total Marks</span>
            <span className="col-span-3">Passing Marks</span>
            <span className="col-span-1" />
          </div>

          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-5">
                <Input
                  value={r.subjectId}
                  onChange={(e) => update(i, 'subjectId', e.target.value)}
                  placeholder="Subject UUID"
                  className="text-xs"
                />
              </div>
              <div className="col-span-3">
                <Input
                  type="number"
                  min="1"
                  value={r.totalMarks}
                  onChange={(e) => update(i, 'totalMarks', e.target.value)}
                  placeholder="100"
                  className="text-xs"
                />
              </div>
              <div className="col-span-3">
                <Input
                  type="number"
                  min="0"
                  value={r.passingMarks}
                  onChange={(e) => update(i, 'passingMarks', e.target.value)}
                  placeholder="33"
                  className="text-xs"
                />
              </div>
              <div className="col-span-1 flex justify-center">
                <button
                  type="button"
                  onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={rows.length <= 1}
                  className="p-1 text-muted-foreground hover:text-red-500 disabled:opacity-30"
                  aria-label="Remove subject"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRows((prev) => [...prev, emptySubjectRow()])}
          >
            <Plus className="h-4 w-4" />
            Add subject row
          </Button>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Subjects
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — Marks Entry
// ═══════════════════════════════════════════════════════════════════════════════

interface DraftEntry {
  studentId: string;
  studentName: string;
  admissionNo: string;
  rollNo: string | null;
  marks: string;
  isAbsent: boolean;
}

function MarksEntryTab() {
  const { can } = useAuth();
  if (!can('exams:enter_marks')) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-700">
        You need the <strong>exams:enter_marks</strong> permission to enter marks.
      </div>
    );
  }

  return <MarksEntryInner />;
}

function MarksEntryInner() {
  // Step 1: choose exam
  const { rows: allExams, loading: examsLoading } = useApiList<Exam>({
    path: '/exams',
    limit: 100,
  });

  const [selectedExamId, setSelectedExamId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');

  const selectedExam = allExams.find((e) => e.id === selectedExamId) ?? null;
  const selectedSubject = selectedExam?.subjects.find((s) => s.subjectId === selectedSubjectId) ?? null;

  // Roster state
  const [roster, setRoster] = useState<DraftEntry[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [rosterLoaded, setRosterLoaded] = useState(false);

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reset roster when selections change
  useEffect(() => {
    setRoster([]);
    setRosterLoaded(false);
    setRosterError(null);
    setSaveMsg(null);
    setSaveError(null);
  }, [selectedExamId, sectionId, selectedSubjectId]);

  async function loadRoster() {
    if (!selectedExamId || !sectionId || !selectedSubjectId) return;
    setRosterLoading(true);
    setRosterError(null);
    setSaveMsg(null);
    setSaveError(null);
    try {
      const qs = new URLSearchParams({ sectionId, subjectId: selectedSubjectId });
      const res = await api.get<MarksRoster>(`/exams/${selectedExamId}/marks?${qs}`);
      const data = res.data;
      setRoster(
        (data.entries ?? []).map((e: MarksEntry) => ({
          studentId: e.studentId,
          studentName: e.studentName,
          admissionNo: e.admissionNo,
          rollNo: e.rollNo,
          marks: e.marksObtained != null ? String(e.marksObtained) : '',
          isAbsent: e.isAbsent,
        })),
      );
      setRosterLoaded(true);
    } catch {
      setRosterError('Could not load marks roster. Check exam, section and subject IDs.');
    } finally {
      setRosterLoading(false);
    }
  }

  function updateEntry(idx: number, field: 'marks' | 'isAbsent', value: string | boolean) {
    setRoster((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        if (field === 'isAbsent') {
          return { ...r, isAbsent: value as boolean, marks: value ? '0' : r.marks };
        }
        return { ...r, marks: value as string };
      }),
    );
  }

  const totalMarks = selectedSubject?.totalMarks ?? 100;

  function isInvalid(marks: string): boolean {
    const n = Number(marks);
    return marks !== '' && (isNaN(n) || n < 0 || n > totalMarks);
  }

  async function saveMarks() {
    if (!selectedExamId || !sectionId || !selectedSubjectId) return;
    setSaving(true);
    setSaveMsg(null);
    setSaveError(null);
    try {
      const entries = roster.map((r) => ({
        studentId: r.studentId,
        marksObtained: r.isAbsent ? 0 : Number(r.marks) || 0,
        isAbsent: r.isAbsent,
      }));
      await api.post(`/exams/${selectedExamId}/marks`, {
        sectionId,
        subjectId: selectedSubjectId,
        entries,
      });
      setSaveMsg(`${entries.length} marks saved successfully.`);
    } catch (err) {
      setSaveError(err instanceof ApiError ? `Error ${err.status}` : 'Could not save marks.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Step controls */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Exam">
          {examsLoading ? (
            <div className="flex h-10 items-center pl-3 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
            </div>
          ) : (
            <Select
              value={selectedExamId}
              onChange={(e) => {
                setSelectedExamId(e.target.value);
                setSelectedSubjectId('');
              }}
            >
              <option value="">Select exam…</option>
              {allExams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name} ({ex.examType})
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Section ID">
          <Input
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            placeholder="Section UUID"
          />
        </Field>

        <Field label="Subject">
          <Select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            disabled={!selectedExam || selectedExam.subjects.length === 0}
          >
            <option value="">Select subject…</option>
            {(selectedExam?.subjects ?? []).map((s) => (
              <option key={s.subjectId} value={s.subjectId}>
                {s.subjectName || s.subjectId}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex items-end">
          <Button
            onClick={loadRoster}
            disabled={!selectedExamId || !sectionId || !selectedSubjectId || rosterLoading}
            className="w-full"
          >
            {rosterLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Load Roster
          </Button>
        </div>
      </div>

      {rosterError && <ErrorBox message={rosterError} />}

      {/* Marks grid */}
      {rosterLoaded && (
        <div className="space-y-3">
          {selectedSubject && (
            <p className="text-sm text-muted-foreground">
              Subject:{' '}
              <strong className="text-foreground">
                {selectedSubject.subjectName || selectedSubject.subjectId}
              </strong>{' '}
              &mdash; Out of{' '}
              <strong className="text-foreground">{selectedSubject.totalMarks}</strong>
            </p>
          )}

          {saveMsg && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {saveMsg}
            </div>
          )}
          {saveError && <ErrorBox message={saveError} />}

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground w-16">Roll</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground w-24">Adm No</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Name</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                    Marks / {totalMarks}
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground w-16">Grade</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground w-16">Absent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roster.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground text-sm">
                      No students in roster.
                    </td>
                  </tr>
                )}
                {roster.map((entry, idx) => {
                  const invalid = !entry.isAbsent && isInvalid(entry.marks);
                  const grade = entry.isAbsent
                    ? '—'
                    : previewGrade(Number(entry.marks) || 0, totalMarks);
                  return (
                    <tr key={entry.studentId} className="hover:bg-muted/50">
                      <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">
                        {entry.rollNo ?? '—'}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">
                        {entry.admissionNo}
                      </td>
                      <td className="px-3 py-1.5 text-foreground font-medium">
                        {entry.studentName}
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          type="number"
                          min="0"
                          max={totalMarks}
                          step="0.5"
                          value={entry.isAbsent ? '' : entry.marks}
                          onChange={(e) => updateEntry(idx, 'marks', e.target.value)}
                          disabled={entry.isAbsent}
                          className={cn(
                            'h-7 w-20 px-2 py-0 text-xs',
                            entry.isAbsent && 'bg-muted text-muted-foreground',
                            invalid && 'border-red-400 focus-visible:ring-red-400',
                          )}
                          tabIndex={0}
                        />
                        {invalid && (
                          <p className="text-xs text-red-500 mt-0.5">0–{totalMarks}</p>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {entry.isAbsent ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-muted text-muted-foreground">
                            —
                          </span>
                        ) : (
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                              GRADE_CLASS[grade] ?? 'bg-muted text-muted-foreground',
                            )}
                          >
                            {grade}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={entry.isAbsent}
                          onChange={(e) => updateEntry(idx, 'isAbsent', e.target.checked)}
                          className="h-4 w-4 rounded border-border accent-primary"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveMarks} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Marks
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — Results
// ═══════════════════════════════════════════════════════════════════════════════

function ResultsTab() {
  const { rows: allExams, loading: examsLoading } = useApiList<Exam>({
    path: '/exams',
    limit: 100,
  });

  const [selectedExamId, setSelectedExamId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [results, setResults] = useState<StudentResult[]>([]);
  const [resultsMeta, setResultsMeta] = useState<{ total: number; totalPages: number; page: number; limit: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(1);

  // For result card modal
  const [cardStudent, setCardStudent] = useState<{ examId: string; studentId: string } | null>(null);

  const selectedExam = allExams.find((e) => e.id === selectedExamId) ?? null;

  async function loadResults(p = 1) {
    if (!selectedExamId || !sectionId) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ sectionId, page: String(p), limit: '30' });
      const res = await api.get<StudentResult[]>(`/exams/${selectedExamId}/results?${qs}`);
      setResults(res.data ?? []);
      setResultsMeta(res.meta ?? null);
      setPage(p);
      setLoaded(true);
    } catch {
      setError('Could not load results.');
    } finally {
      setLoading(false);
    }
  }

  // Derive dynamic subject columns from first result
  const subjectCols: { subjectId: string; subjectName: string }[] =
    results[0]?.subjectResults.map((sr) => ({
      subjectId: sr.subjectId,
      subjectName: sr.subjectName,
    })) ?? [];

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Exam">
          {examsLoading ? (
            <div className="flex h-10 items-center pl-3 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
            </div>
          ) : (
            <Select
              value={selectedExamId}
              onChange={(e) => { setSelectedExamId(e.target.value); setLoaded(false); }}
              className="w-56"
            >
              <option value="">Select exam…</option>
              {allExams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Section ID">
          <Input
            value={sectionId}
            onChange={(e) => { setSectionId(e.target.value); setLoaded(false); }}
            placeholder="Section UUID"
            className="w-44"
          />
        </Field>

        <Button
          onClick={() => loadResults(1)}
          disabled={!selectedExamId || !sectionId || loading}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Load Results
        </Button>

        {loaded && (
          <Button variant="outline" onClick={() => window.print()} className="ml-auto">
            <Printer className="h-4 w-4" />
            Print Results
          </Button>
        )}
      </div>

      {error && <ErrorBox message={error} />}

      {loaded && (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Pos</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Roll</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Student</th>
                  {subjectCols.map((sc) => (
                    <th
                      key={sc.subjectId}
                      className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground truncate max-w-[80px]"
                      title={sc.subjectName}
                    >
                      {sc.subjectName.length > 8
                        ? sc.subjectName.slice(0, 7) + '…'
                        : sc.subjectName}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Total</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">%</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Grade</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">GPA</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.length === 0 && (
                  <tr>
                    <td
                      colSpan={7 + subjectCols.length}
                      className="py-8 text-center text-muted-foreground text-sm"
                    >
                      No results found.
                    </td>
                  </tr>
                )}
                {results.map((r) => (
                  <tr
                    key={r.studentId}
                    className="hover:bg-primary/10 cursor-pointer"
                    onClick={() =>
                      setCardStudent({ examId: selectedExamId, studentId: r.studentId })
                    }
                    title="Click to view result card"
                  >
                    <td className="px-3 py-2 font-medium text-foreground text-xs">
                      {ordinal(r.position)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.rollNo ?? '—'}</td>
                    <td className="px-3 py-2 font-medium text-foreground">{r.studentName}</td>
                    {subjectCols.map((sc) => {
                      const sr = r.subjectResults.find((x) => x.subjectId === sc.subjectId);
                      return (
                        <td key={sc.subjectId} className="px-3 py-2 text-center text-xs text-muted-foreground">
                          {sr ? (sr.isAbsent ? 'AB' : sr.marksObtained) : '—'}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right text-xs font-mono text-foreground">
                      {r.totalObtained}/{r.totalMarks}
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-mono">
                      {r.percentage.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-center">
                      <GradeBadge grade={r.grade} />
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-mono text-foreground">
                      {r.gpa.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Badge variant={r.isPassed ? 'success' : 'destructive'}>
                        {r.isPassed ? 'Pass' : 'Fail'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {resultsMeta && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{resultsMeta.total} students</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => loadResults(page - 1)}
                >
                  Prev
                </Button>
                <span className="px-2">
                  {page} / {resultsMeta.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= resultsMeta.totalPages}
                  onClick={() => loadResults(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {cardStudent && (
        <ResultCardModal
          open={!!cardStudent}
          examId={cardStudent.examId}
          studentId={cardStudent.studentId}
          examName={selectedExam?.name ?? ''}
          onClose={() => setCardStudent(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4 — Analysis
// ═══════════════════════════════════════════════════════════════════════════════

function AnalysisTab() {
  const { rows: allExams, loading: examsLoading } = useApiList<Exam>({
    path: '/exams',
    limit: 100,
  });

  const [selectedExamId, setSelectedExamId] = useState('');
  const [sectionId, setSectionId] = useState('');

  // Class analysis
  const [classAnalysis, setClassAnalysis] = useState<ClassAnalysis | null>(null);
  const [classLoading, setClassLoading] = useState(false);
  const [classError, setClassError] = useState<string | null>(null);

  // Subject analysis
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [subjectAnalysis, setSubjectAnalysis] = useState<SubjectAnalysis | null>(null);
  const [subjectLoading, setSubjectLoading] = useState(false);
  const [subjectError, setSubjectError] = useState<string | null>(null);

  const selectedExam = allExams.find((e) => e.id === selectedExamId) ?? null;

  async function loadAnalysis() {
    if (!selectedExamId) return;
    setClassLoading(true);
    setClassError(null);
    setClassAnalysis(null);
    try {
      const qs = sectionId ? `?sectionId=${sectionId}` : '';
      const res = await api.get<ClassAnalysis>(`/exams/${selectedExamId}/analysis/class${qs}`);
      setClassAnalysis(res.data);
    } catch {
      setClassError('Could not load class analysis.');
    } finally {
      setClassLoading(false);
    }
  }

  const loadSubjectAnalysis = useCallback(async (subjectId: string) => {
    if (!selectedExamId || !subjectId) return;
    setSubjectLoading(true);
    setSubjectError(null);
    setSubjectAnalysis(null);
    try {
      const res = await api.get<SubjectAnalysis>(
        `/exams/${selectedExamId}/analysis/subject/${subjectId}`,
      );
      setSubjectAnalysis(res.data);
    } catch {
      setSubjectError('Could not load subject analysis.');
    } finally {
      setSubjectLoading(false);
    }
  }, [selectedExamId]);

  useEffect(() => {
    if (selectedSubjectId) {
      loadSubjectAnalysis(selectedSubjectId);
    }
  }, [selectedSubjectId, loadSubjectAnalysis]);

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Exam">
          {examsLoading ? (
            <div className="flex h-10 items-center pl-3 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
            </div>
          ) : (
            <Select
              value={selectedExamId}
              onChange={(e) => {
                setSelectedExamId(e.target.value);
                setClassAnalysis(null);
                setSubjectAnalysis(null);
                setSelectedSubjectId('');
              }}
              className="w-56"
            >
              <option value="">Select exam…</option>
              {allExams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Section ID (optional)">
          <Input
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            placeholder="Section UUID"
            className="w-44"
          />
        </Field>

        <Button
          onClick={loadAnalysis}
          disabled={!selectedExamId || classLoading}
        >
          {classLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          Load Analysis
        </Button>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Panel A — Class Overview */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">Class Overview</h2>

          {classError && <ErrorBox message={classError} />}
          {classLoading && (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {classAnalysis && (
            <div className="space-y-4">
              {/* KPI cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <KpiCard label="Total Students" value={classAnalysis.totalStudents} />
                <KpiCard label="Appeared" value={classAnalysis.appeared} />
                <KpiCard label="Passed" value={classAnalysis.passed} />
                <KpiCard label="Failed" value={classAnalysis.failed} />
                <KpiCard label="Pass %" value={`${classAnalysis.passPercent.toFixed(1)}%`} />
                <KpiCard label="Class Avg %" value={`${classAnalysis.classAverage.toFixed(1)}%`} />
              </div>

              {/* Grade distribution */}
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="bg-muted/50 px-4 py-2.5 text-sm font-semibold text-foreground border-b border-border">
                  Grade Distribution
                </div>
                <div className="divide-y divide-slate-100">
                  {classAnalysis.gradeDistribution.map((g) => {
                    const pct =
                      classAnalysis.appeared > 0
                        ? ((g.count / classAnalysis.appeared) * 100).toFixed(1)
                        : '0';
                    return (
                      <div key={g.grade} className="flex items-center gap-3 px-4 py-2">
                        <GradeBadge grade={g.grade} />
                        <div className="flex-1">
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary/60"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground w-16 text-right">
                          {g.count} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                  {classAnalysis.gradeDistribution.length === 0 && (
                    <p className="px-4 py-3 text-sm text-muted-foreground">No data.</p>
                  )}
                </div>
              </div>

              {/* Top students */}
              {classAnalysis.topStudents.length > 0 && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2.5 text-sm font-semibold text-foreground border-b border-border">
                    Top Students
                  </div>
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs text-muted-foreground">Pos</th>
                        <th className="px-4 py-2 text-left text-xs text-muted-foreground">Name</th>
                        <th className="px-4 py-2 text-right text-xs text-muted-foreground">%</th>
                        <th className="px-4 py-2 text-center text-xs text-muted-foreground">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {classAnalysis.topStudents.map((s) => (
                        <tr key={s.studentId} className="hover:bg-muted/50">
                          <td className="px-4 py-1.5 text-xs text-muted-foreground">{s.position}</td>
                          <td className="px-4 py-1.5 font-medium text-foreground">{s.studentName}</td>
                          <td className="px-4 py-1.5 text-right text-xs font-mono">
                            {s.percentage.toFixed(1)}%
                          </td>
                          <td className="px-4 py-1.5 text-center">
                            <GradeBadge grade={s.grade} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {!classAnalysis && !classLoading && !classError && (
            <p className="text-sm text-muted-foreground">Select an exam and click Load Analysis.</p>
          )}
        </div>

        {/* Panel B — Subject Analysis */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">Subject Analysis</h2>

          <Field label="Subject">
            <Select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              disabled={!selectedExam || selectedExam.subjects.length === 0}
            >
              <option value="">Select subject…</option>
              {(selectedExam?.subjects ?? []).map((s) => (
                <option key={s.subjectId} value={s.subjectId}>
                  {s.subjectName || s.subjectId}
                </option>
              ))}
            </Select>
          </Field>

          {subjectError && <ErrorBox message={subjectError} />}
          {subjectLoading && (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {subjectAnalysis && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <KpiCard label="Appeared" value={subjectAnalysis.appeared} />
                <KpiCard label="Passed" value={subjectAnalysis.passed} />
                <KpiCard label="Failed" value={subjectAnalysis.failed} />
                <KpiCard label="Highest" value={subjectAnalysis.highest} />
                <KpiCard label="Lowest" value={subjectAnalysis.lowest} />
                <KpiCard label="Average" value={subjectAnalysis.average.toFixed(1)} />
                <KpiCard label="Pass %" value={`${subjectAnalysis.passPercent.toFixed(1)}%`} className="col-span-2 sm:col-span-1" />
              </div>

              {/* Grade distribution */}
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="bg-muted/50 px-4 py-2.5 text-sm font-semibold text-foreground border-b border-border">
                  Grade Distribution
                </div>
                <div className="divide-y divide-slate-100">
                  {subjectAnalysis.gradeDistribution.map((g) => {
                    const pct =
                      subjectAnalysis.appeared > 0
                        ? ((g.count / subjectAnalysis.appeared) * 100).toFixed(1)
                        : '0';
                    return (
                      <div key={g.grade} className="flex items-center gap-3 px-4 py-2">
                        <GradeBadge grade={g.grade} />
                        <div className="flex-1">
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary/60"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground w-16 text-right">
                          {g.count} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                  {subjectAnalysis.gradeDistribution.length === 0 && (
                    <p className="px-4 py-3 text-sm text-muted-foreground">No data.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {!subjectAnalysis && !subjectLoading && !subjectError && (
            <p className="text-sm text-muted-foreground">Select a subject to see analysis.</p>
          )}
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

function KpiCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold text-foreground mt-0.5">{value}</p>
      </CardContent>
    </Card>
  );
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  variant = 'default',
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  variant?: 'default' | 'destructive';
  busy: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setErr(null);
    try {
      await onConfirm();
    } catch {
      setErr('Operation failed. Please try again.');
    }
  }

  // Reset error when dialog reopens
  useEffect(() => { if (open) setErr(null); }, [open]);

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader title={title} onClose={onClose} />
      <DialogBody className="space-y-3">
        {err && <ErrorBox message={err} />}
        <p className="text-sm text-muted-foreground">{message}</p>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button variant={variant} onClick={go} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
