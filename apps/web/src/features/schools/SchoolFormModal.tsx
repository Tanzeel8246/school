import { FormEvent, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImageUploader } from '@/components/ImageUploader';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';

export interface School {
  id: string;
  name: string;
  code: string;
  address?: string;
  timezone?: string;
  logoUrl?: string;
  subscription_status?: string;
  createdAt: string;
}

interface SchoolFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Pass an existing school to edit, or null to create. */
  school: School | null;
}

export function SchoolFormModal({ open, onClose, onSaved, school }: SchoolFormModalProps) {
  const isEditing = !!school;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    code: '',
    address: '',
    timezone: '',
    logoUrl: '',
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: school?.name ?? '',
        code: school?.code ?? '',
        address: school?.address ?? '',
        timezone: school?.timezone ?? '',
        logoUrl: school?.logoUrl ?? '',
      });
      setError(null);
    }
  }, [open, school]);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (isEditing) {
        // Exclude 'code' from update as per schema (updateSchoolSchema)
        const { code, ...updateData } = form;
        await api.patch(`/schools/${school.id}`, updateData);
      } else {
        await api.post('/schools', form);
      }
      onSaved();
      onClose();
    } catch (err) {
      const msg = err instanceof ApiError ? (err.payload as { message?: string })?.message : null;
      setError(msg || 'Failed to save school.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={onSubmit}>
        <DialogHeader
          title={isEditing ? 'Edit School' : 'Add New School'}
          description={isEditing ? 'Update the details for this school.' : 'Register a new tenant school.'}
          onClose={onClose}
        />
        <DialogBody className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="s_name">School Name</Label>
            <Input id="s_name" required value={form.name} onChange={set('name')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="s_code">School Code</Label>
            <Input 
              id="s_code" 
              required={!isEditing} 
              disabled={isEditing} 
              value={form.code} 
              onChange={set('code')} 
              placeholder="e.g. DPS" 
            />
            {isEditing && <p className="text-xs text-muted-foreground">Code cannot be changed.</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="s_address">Address (Optional)</Label>
            <Input id="s_address" value={form.address} onChange={set('address')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="s_timezone">Timezone (Optional)</Label>
            <Input id="s_timezone" value={form.timezone} onChange={set('timezone')} placeholder="Asia/Karachi" />
          </div>

          <div className="space-y-1.5">
            <ImageUploader value={form.logoUrl ?? ''} onChange={(url) => setForm(f => ({ ...f, logoUrl: url }))} label="Logo URL (Optional)" />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Save Changes' : 'Create School'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
