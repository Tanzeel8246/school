import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toMinor } from '@/lib/format';
import type { Staff, StaffInput, AcademicSubject, AcademicSection } from '@/lib/dto';
import { STAFF_TYPES } from './constants';
import { useApiList } from '@/hooks/useApiList';
import { SearchableSelect } from '@/components/ui/searchable-select';

interface FormState
  extends Omit<StaffInput, 'baseSalary' | 'experienceYears' | 'leavingDate'> {
  baseSalary: string;
  experienceYears: string;
  leavingDate: string;
  createUser?: boolean;
  username?: string;
  password?: string;
  subjectIds: string[];
  inchargeSectionId: string | null;
}

const EMPTY: FormState = {
  employeeId: '',
  staffType: 'support',
  fullName: '',
  email: '',
  phone: '',
  cnic: '',
  gender: 'male',
  address: '',
  qualification: '',
  experienceYears: '',
  designation: '',
  baseSalary: '',
  joiningDate: '',
  leavingDate: '',
  status: 'active',
  createUser: false,
  username: '',
  password: '',
  subjectIds: [],
  inchargeSectionId: null,
};

function toForm(s: Staff | null): FormState {
  if (!s) return { ...EMPTY };
  return {
    employeeId: s.employeeId ?? '',
    staffType: s.staffType ?? 'support',
    fullName: s.fullName ?? '',
    email: s.email ?? '',
    phone: s.phone ?? '',
    cnic: s.cnic ?? '',
    gender: s.gender ?? 'male',
    address: s.address ?? '',
    qualification: s.qualification ?? '',
    experienceYears: s.experienceYears != null ? String(s.experienceYears) : '',
    designation: s.designation ?? '',
    baseSalary: s.baseSalary != null ? String(s.baseSalary / 100) : '',
    joiningDate: s.joiningDate ?? '',
    leavingDate: s.leavingDate ?? '',
    status: s.status ?? 'active',
    createUser: false,
    username: '',
    password: '',
    subjectIds: s.subjectIds ?? [],
    inchargeSectionId: s.inchargeSectionId ?? null,
  };
}

interface Props {
  open: boolean;
  staff: Staff | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Create / edit a non-teaching staff member. */
export function StaffForm({ open, staff, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(toForm(staff));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { rows: subjects } = useApiList<AcademicSubject>({ path: '/academics/subjects', limit: 500 });
  const { rows: sections } = useApiList<AcademicSection>({ path: '/academics/sections', limit: 500 });

  useEffect(() => {
    if (open) {
      setForm(toForm(staff));
      setError(null);
    }
  }, [open, staff]);

  const set =
    (key: keyof FormState) =>
    (e: { target: { value: string } }) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload: StaffInput = {
      ...form,
      baseSalary: toMinor(form.baseSalary || 0),
      experienceYears: parseInt(form.experienceYears || '0', 10) || 0,
      leavingDate: form.leavingDate || null,
      subjectIds: form.staffType === 'teacher' ? form.subjectIds : undefined,
      inchargeSectionId: form.staffType === 'teacher' ? form.inchargeSectionId : undefined,
    };
    try {
      if (staff) await api.patch<Staff>(`/staff/${staff.id}`, payload);
      else await api.post<Staff>('/staff', payload);
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
          title={staff ? 'Edit staff' : 'New staff'}
          description="Non-teaching staff employment details."
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
            <div className="space-y-1.5">
              <Label>Staff type</Label>
              <Select value={form.staffType} onChange={set('staffType')}>
                {STAFF_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t[0].toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </Select>
            </div>
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
            <Field label="Leaving date" type="date" value={form.leavingDate} onChange={set('leavingDate')} />
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onChange={set('status')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" value={form.address} onChange={set('address')} />
            </div>

            {form.staffType === 'teacher' && (
              <div className="sm:col-span-2 mt-4 border-t border-border pt-4">
                <h3 className="text-lg font-medium text-foreground mb-4">Academic Setup</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Teaching Subjects</Label>
                    <SearchableSelect
                      isMulti
                      menuPortalTarget={document.body}
                      menuPosition="fixed"
                      value={subjects
                        .filter((s) => form.subjectIds.includes(s.id))
                        .map((s) => ({ value: s.id, label: s.name }))}
                      onChange={(vals: any) =>
                        setForm((f) => ({ ...f, subjectIds: vals ? vals.map((v: any) => v.value) : [] }))
                      }
                      options={subjects.map((s) => ({ value: s.id, label: s.name }))}
                      placeholder="Select subjects..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Class In-charge</Label>
                    <SearchableSelect
                      menuPortalTarget={document.body}
                      menuPosition="fixed"
                      value={
                        form.inchargeSectionId
                          ? {
                              value: form.inchargeSectionId,
                              label: sections.find((s) => s.id === form.inchargeSectionId)?.name || 'Unknown',
                            }
                          : null
                      }
                      onChange={(val: any) =>
                        setForm((f) => ({ ...f, inchargeSectionId: val?.value || null }))
                      }
                      options={sections.map((s) => ({ value: s.id, label: s.name }))}
                      placeholder="Select section..."
                      isClearable
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="sm:col-span-2 mt-4 border-t border-border pt-4">
              <h3 className="text-lg font-medium text-foreground mb-4">Login Account</h3>
              {staff && staff.userId && (
                <div className="mb-4 text-sm text-emerald-600 bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
                  This staff member already has a login account. You can update their username or reset their password below.
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
                  {staff && staff.userId ? 'Update Login Account' : 'Create Login Account'}
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
                    label={staff && staff.userId ? 'New Password (leave blank to keep current)' : 'Password'}
                    required={!staff || !staff.userId}
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
            {staff ? 'Save changes' : 'Create staff'}
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
