import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ImageUploader } from '@/components/ImageUploader';
import type { Student, StudentInput as BaseStudentInput } from '@/lib/dto';
import { useApiList } from '@/hooks/useApiList';

type StudentInput = BaseStudentInput & {
  createUser?: boolean;
  username?: string;
  password?: string;
  parentMode?: 'none' | 'new' | 'existing';
  parentFullName?: string;
  parentRelation?: string;
  parentCnic?: string;
  parentPhone?: string;
  parentUsername?: string;
  parentPassword?: string;
  existingGuardianId?: string;
};

const EMPTY: StudentInput = {
  admissionNo: '',
  rollNo: '',
  fullName: '',
  fatherName: '',
  motherName: '',
  cnicBform: '',
  dob: '',
  gender: 'male',
  bloodGroup: '',
  religion: '',
  address: '',
  mobile: '',
  emergencyContact: '',
  previousSchool: '',
  admissionDate: '',
  sectionId: '',
  status: 'active',
  photoUrl: '',
  createUser: false,
  username: '',
  password: '',
  parentMode: 'none',
  parentFullName: '',
  parentRelation: '',
  parentCnic: '',
  parentPhone: '',
  parentUsername: '',
  parentPassword: '',
  existingGuardianId: '',
};

/** Normalize a (possibly partial) Student into a full editable form state. */
function toForm(s: Student | null): StudentInput {
  if (!s) return { ...EMPTY };
  return {
    admissionNo: s.admissionNo ?? '',
    rollNo: s.rollNo ?? '',
    fullName: s.fullName ?? '',
    fatherName: s.fatherName ?? '',
    motherName: s.motherName ?? '',
    cnicBform: s.cnicBform ?? '',
    dob: s.dob ?? '',
    gender: s.gender ?? 'male',
    bloodGroup: s.bloodGroup ?? '',
    religion: s.religion ?? '',
    address: s.address ?? '',
    mobile: s.mobile ?? '',
    emergencyContact: s.emergencyContact ?? '',
    previousSchool: s.previousSchool ?? '',
    admissionDate: s.admissionDate ?? '',
    sectionId: s.sectionId ?? '',
    status: s.status ?? 'active',
    photoUrl: s.photoUrl ?? '',
    createUser: false,
    username: '',
    password: '',
    parentMode: 'none',
    parentFullName: '',
    parentRelation: '',
    parentCnic: '',
    parentPhone: '',
    parentUsername: '',
    parentPassword: '',
    existingGuardianId: '',
  };
}

interface Props {
  open: boolean;
  /** When set, the dialog edits this student; otherwise it creates a new one. */
  student: Student | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Create / edit a student via a full-field form Dialog. */
export function StudentForm({ open, student, onClose, onSaved }: Props) {
  const [form, setForm] = useState<StudentInput>(toForm(student));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(toForm(student));
      setError(null);
    }
  }, [open, student]);

  // Fetch sections for the dropdown
  const { rows: sections, loading: loadingSections } = useApiList<{ id: string, name: string, className?: string }>({ path: '/sections' });

  const set =
    (key: keyof StudentInput) =>
    (e: { target: { value: string } }) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: any = { ...form };
      if (!payload.dob) delete payload.dob;
      if (!payload.admissionDate) delete payload.admissionDate;
      if (!payload.sectionId) delete payload.sectionId;
      if (!payload.photoUrl) delete payload.photoUrl;

      if (payload.parentMode === 'new') {
        payload.parentUsername = payload.admissionNo;
        payload.parentPassword = payload.admissionNo;
      }

      if (student) await api.patch<Student>(`/students/${student.id}`, payload);
      else await api.post<Student>('/students', payload);
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
    <Dialog open={open} onClose={onClose} className="max-w-3xl">
      <form onSubmit={onSubmit}>
        <DialogHeader
          title={student ? 'Edit student' : 'New student'}
          description="Enter the student's admission and personal details."
          onClose={onClose}
        />
        <DialogBody className="max-h-[65vh] overflow-y-auto">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Admission no" required value={form.admissionNo} onChange={set('admissionNo')} />
            <Field label="Roll no" value={form.rollNo ?? ''} onChange={set('rollNo')} />
            <Field label="Full name" required value={form.fullName} onChange={set('fullName')} />
            <Field label="Father name" value={form.fatherName} onChange={set('fatherName')} />
            <Field label="Mother name" value={form.motherName} onChange={set('motherName')} />
            <Field label="CNIC / B-Form" value={form.cnicBform} onChange={set('cnicBform')} />
            <Field label="Date of birth" type="date" value={form.dob} onChange={set('dob')} />
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select value={form.gender} onChange={set('gender')}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <Field label="Blood group" value={form.bloodGroup} onChange={set('bloodGroup')} />
            <Field label="Religion" value={form.religion} onChange={set('religion')} />
            <Field label="Mobile" value={form.mobile} onChange={set('mobile')} />
            <Field label="Emergency contact" value={form.emergencyContact} onChange={set('emergencyContact')} />
            <Field label="Previous school" value={form.previousSchool} onChange={set('previousSchool')} />
            <Field label="Admission date" type="date" value={form.admissionDate} onChange={set('admissionDate')} />
            <div className="space-y-1.5">
              <Label>Section</Label>
              <Select value={form.sectionId} onChange={set('sectionId')} disabled={loadingSections}>
                <option value="">Select a section...</option>
                {sections.map(sec => (
                  <option key={sec.id} value={sec.id}>
                    {sec.className ? `${sec.className} - ` : ''}{sec.name}
                  </option>
                ))}
              </Select>
            </div>
            <ImageUploader value={form.photoUrl || ''} onChange={(url) => setForm(f => ({ ...f, photoUrl: url }))} label="Student Photo" />
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" value={form.address} onChange={set('address')} />
            </div>

            <div className="sm:col-span-2 mt-4 border-t pt-4">
              <h3 className="text-lg font-medium text-foreground mb-4">Login Account</h3>
              {student && student.userId && (
                <div className="mb-4 text-sm text-emerald-500 bg-emerald-500/10 p-2.5 rounded border border-emerald-500/20">
                  This student already has a login account. You can update their username or reset their password below.
                </div>
              )}
              <div className="flex items-center space-x-2 mb-4">
                <input
                  type="checkbox"
                  id="createUser"
                  checked={form.createUser}
                  onChange={(e) => setForm((f) => ({ ...f, createUser: !!e.target.checked }))}
                  className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
                <Label htmlFor="createUser" className="font-normal cursor-pointer">
                  {student && student.userId ? 'Update Login Account' : 'Create Login Account'}
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
                    label={student && student.userId ? 'New Password (leave blank to keep current)' : 'Password'}
                    required={!student || !student.userId}
                    type="text" // using text so admin can see what they set
                    value={form.password || ''}
                    onChange={set('password')}
                  />
                </div>
              )}
            </div>

            <div className="sm:col-span-2 mt-4 border-t pt-4">
              <h3 className="text-lg font-medium text-foreground mb-4">Parent / Guardian Details</h3>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-4">
                  <Label className="flex items-center gap-2 cursor-pointer font-normal">
                    <input type="radio" name="parentMode" value="none" checked={form.parentMode === 'none'} onChange={() => setForm((f) => ({ ...f, parentMode: 'none' }))} className="text-primary focus:ring-primary" />
                    No Parent Link
                  </Label>
                  <Label className="flex items-center gap-2 cursor-pointer font-normal">
                    <input type="radio" name="parentMode" value="existing" checked={form.parentMode === 'existing'} onChange={() => setForm((f) => ({ ...f, parentMode: 'existing' }))} className="text-primary focus:ring-primary" />
                    Link Existing Parent
                  </Label>
                  <Label className="flex items-center gap-2 cursor-pointer font-normal">
                    <input type="radio" name="parentMode" value="new" checked={form.parentMode === 'new'} onChange={() => setForm((f) => ({ ...f, parentMode: 'new' }))} className="text-primary focus:ring-primary" />
                    Create New Parent
                  </Label>
                </div>

                {form.parentMode === 'existing' && (
                  <div className="p-4 bg-muted/30 rounded-lg border border-border">
                    <GuardianSelect value={form.existingGuardianId || ''} onChange={(id) => setForm((f) => ({ ...f, existingGuardianId: id }))} />
                  </div>
                )}

                {form.parentMode === 'new' && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 p-4 bg-muted/30 rounded-lg border border-border">
                    <Field label="Parent Full Name" required value={form.parentFullName || ''} onChange={set('parentFullName')} />
                    <div className="space-y-1.5">
                      <Label>Relation</Label>
                      <Select value={form.parentRelation || ''} onChange={set('parentRelation')}>
                        <option value="">Select Relation...</option>
                        <option value="father">Father</option>
                        <option value="mother">Mother</option>
                        <option value="guardian">Guardian</option>
                      </Select>
                    </div>
                    <Field label="Parent CNIC" value={form.parentCnic || ''} onChange={set('parentCnic')} />
                    <Field label="Parent Phone" value={form.parentPhone || ''} onChange={set('parentPhone')} />
                    <p className="text-xs text-blue-500 sm:col-span-2 mt-2 bg-blue-500/10 p-2.5 rounded border border-blue-500/20">
                      Parent login account will be automatically created. The login credentials will be:
                      <br />
                      <strong>Username:</strong> Student's Admission Number
                      <br />
                      <strong>Password:</strong> Student's Admission Number
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {student ? 'Save changes' : 'Create student'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

/** Small labelled input used throughout the form grid. */
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

function GuardianSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [guardians, setGuardians] = useState<{ id: string; fullName: string; phone: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ id: string; fullName: string; phone: string | null }[]>('/students/guardians')
      .then(res => setGuardians(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-sm text-muted-foreground">Loading guardians...</div>;

  return (
    <div className="space-y-1.5">
      <Label>Select Guardian <span className="text-red-500">*</span></Label>
      <Select value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="">-- Choose existing parent/guardian --</option>
        {guardians.map(g => (
          <option key={g.id} value={g.id}>
            {g.fullName} {g.phone ? `(${g.phone})` : ''}
          </option>
        ))}
      </Select>
    </div>
  );
}
