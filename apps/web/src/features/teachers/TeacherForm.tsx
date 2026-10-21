import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { toMinor } from '@/lib/format';
import type { Teacher, TeacherInput, Subject } from '@/lib/dto';
import { useApiList } from '@/hooks/useApiList';

interface FormState extends Omit<TeacherInput, 'baseSalary' | 'experienceYears'> {
  baseSalary: string; // rupees, as typed
  experienceYears: string;
  createUser?: boolean;
  username?: string;
  password?: string;
}

const EMPTY: FormState = {
  employeeId: '',
  fullName: '',
  email: '',
  phone: '',
  cnic: '',
  gender: 'male',
  qualification: '',
  experienceYears: '',
  designation: '',
  baseSalary: '',
  joiningDate: '',
  status: 'active',
  createUser: false,
  username: '',
  password: '',
};

function toForm(t: Teacher | null): FormState {
  if (!t) return { ...EMPTY };
  return {
    employeeId: t.employeeId ?? '',
    fullName: t.fullName ?? '',
    email: t.email ?? '',
    phone: t.phone ?? '',
    cnic: t.cnic ?? '',
    gender: t.gender ?? 'male',
    qualification: t.qualification ?? '',
    experienceYears: t.experienceYears != null ? String(t.experienceYears) : '',
    designation: t.designation ?? '',
    baseSalary: t.baseSalary != null ? String(t.baseSalary / 100) : '',
    joiningDate: t.joiningDate ?? '',
    status: t.status ?? 'active',
    createUser: false,
    username: '',
    password: '',
  };
}

interface Props {
  open: boolean;
  teacher: Teacher | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Create / edit a teacher. On edit, loads currently-assigned subjects via
 * GET /teachers/:id/subjects to prefill a comma-separated subject-id editor,
 * and persists changes through PUT /teachers/:id/subjects.
 */
export function TeacherForm({ open, teacher, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(toForm(teacher));
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { rows: allSubjects, loading: loadingSubjects } = useApiList<Subject>({
    path: '/academics/subjects',
    limit: 200,
  });

  useEffect(() => {
    if (!open) return;
    setForm(toForm(teacher));
    setError(null);
    setSubjectIds([]);
    // Prefill subjects from payload or fetch them for an existing teacher.
    if (teacher) {
      if (teacher.subjects?.length) {
        setSubjectIds(teacher.subjects.map((s) => s.id));
      } else {
        api
          .get<Subject[]>(`/teachers/${teacher.id}/subjects`)
          .then((res) => setSubjectIds((res.data ?? []).map((s) => s.id)))
          .catch(() => undefined);
      }
    }
  }, [open, teacher]);

  const set =
    (key: keyof FormState) =>
    (e: { target: { value: string } }) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload: TeacherInput = {
      ...form,
      baseSalary: toMinor(form.baseSalary || 0),
      experienceYears: parseInt(form.experienceYears || '0', 10) || 0,
    };
    const ids = subjectIds;
    try {
      let id = teacher?.id;
      if (teacher) await api.patch<Teacher>(`/teachers/${teacher.id}`, payload);
      else {
        const res = await api.post<Teacher>('/teachers', payload);
        id = res.data.id;
      }
      // Sync subject assignments (best-effort for new teachers if id is known).
      if (id) await api.put(`/teachers/${id}/subjects`, { subjectIds: ids }).catch(() => undefined);
      onSaved();
      onClose();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? ((err.payload as { message?: string })?.message ?? 'Save failed.')
          : 'Save failed.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-2xl">
      <form onSubmit={onSubmit}>
        <DialogHeader
          title={teacher ? 'Edit teacher' : 'New teacher'}
          description="Employment details and subject assignments."
          onClose={onClose}
        />
        <DialogBody className="max-h-[65vh] overflow-y-auto">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Employee ID" required value={form.employeeId} onChange={set('employeeId')} />
            <Field label="Full name" required value={form.fullName} onChange={set('fullName')} />
            <Field label="Email" type="email" value={form.email} onChange={set('email')} />
            <Field label="Phone" value={form.phone} onChange={set('phone')} />
            <Field label="CNIC" value={form.cnic} onChange={set('cnic')} />
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select value={form.gender} onChange={set('gender')}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <Field label="Qualification" value={form.qualification} onChange={set('qualification')} />
            <Field
              label="Experience (years)"
              type="number"
              value={form.experienceYears}
              onChange={set('experienceYears')}
            />
            <Field label="Designation" value={form.designation} onChange={set('designation')} />
            <Field
              label="Base salary (Rs.)"
              type="number"
              value={form.baseSalary}
              onChange={set('baseSalary')}
            />
            <Field label="Joining date" type="date" value={form.joiningDate} onChange={set('joiningDate')} />
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onChange={set('status')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="subjects">Assigned Subjects</Label>
              {loadingSubjects ? (
                <div className="flex items-center text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading subjects...
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 max-h-48 overflow-y-auto rounded-md border border-border p-3 bg-muted/30">
                  {allSubjects.map((sub) => (
                    <label key={sub.id} className="flex items-start space-x-2 text-sm text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={subjectIds.includes(sub.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSubjectIds((prev) => [...prev, sub.id]);
                          } else {
                            setSubjectIds((prev) => prev.filter((id) => id !== sub.id));
                          }
                        }}
                        className="mt-0.5 rounded border-border text-primary focus:ring-primary"
                      />
                      <span className="leading-tight">
                        {sub.name} {sub.code ? <span className="block text-xs text-muted-foreground">{sub.code}</span> : ''}
                      </span>
                    </label>
                  ))}
                  {allSubjects.length === 0 && (
                    <span className="text-sm text-muted-foreground col-span-full">No subjects found.</span>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Saved via the subject-assignment endpoint when you submit.
              </p>
            </div>

            <div className="sm:col-span-2 mt-4 border-t border-border pt-4">
              <h3 className="text-lg font-medium text-foreground mb-4">Login Account</h3>
              {teacher && teacher.userId && (
                <div className="mb-4 text-sm text-emerald-600 bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
                  This teacher already has a login account. You can update their username or reset their password below.
                </div>
              )}
              <div className="flex items-center space-x-2 mb-4">
                <input
                  type="checkbox"
                  id="createUser"
                  checked={form.createUser}
                  onChange={(e) => setForm((f) => ({ ...f, createUser: !!e.target.checked }))}
                  className="rounded border-border text-primary focus:ring-primary cursor-pointer bg-background"
                />
                <Label htmlFor="createUser" className="font-normal cursor-pointer">
                  {teacher && teacher.userId ? 'Update Login Account' : 'Create Login Account'}
                </Label>
              </div>

              {form.createUser && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 p-4 bg-muted/30 rounded-lg border border-border">
                  <Field
                    label="Username"
                    required
                    value={form.username || ''}
                    onChange={set('username')}
                  />
                  <Field
                    label={teacher && teacher.userId ? 'New Password (leave blank to keep current)' : 'Password'}
                    required={!teacher || !teacher.userId}
                    type="text" // using text so admin can see what they set
                    value={form.password || ''}
                    onChange={set('password')}
                  />
                </div>
              )}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {teacher ? 'Save changes' : 'Create teacher'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
}: {
  label: string;
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </Label>
      <Input type={type} value={value} onChange={onChange} required={required} />
    </div>
  );
}
