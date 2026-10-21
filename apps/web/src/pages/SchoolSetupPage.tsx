import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImageUploader } from '@/components/ImageUploader';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface School {
  id?: string;
  name: string;
  address?: string;
  timezone?: string;
  logoUrl?: string;
}

type Notice = { kind: 'success' | 'error'; text: string } | null;

export function SchoolSetupPage() {
  const { can } = useAuth();
  const hasAccess = can('settings:manage');

  const [form, setForm] = useState<School>({ name: '', address: '', timezone: '', logoUrl: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const set = (key: keyof School) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  // Load the current school to prefill the form (only if permitted).
  useEffect(() => {
    if (!hasAccess) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<School>('/schools/current');
        if (cancelled) return;
        const s = res.data;
        setForm({
          name: s.name ?? '',
          address: s.address ?? '',
          timezone: s.timezone ?? '',
          logoUrl: s.logoUrl ?? '',
        });
      } catch {
        if (!cancelled) setNotice({ kind: 'error', text: 'Could not load school details.' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasAccess]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      // PATCH /schools/current via the typed client.
      const res = await api.patch<School>('/schools/current', form);
      const s = res.data;
      setForm({
        name: s.name ?? '',
        address: s.address ?? '',
        timezone: s.timezone ?? '',
        logoUrl: s.logoUrl ?? '',
      });
      setNotice({ kind: 'success', text: 'School settings saved.' });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? ((err.payload as { message?: string })?.message ?? 'Save failed.')
          : 'Save failed.';
      setNotice({ kind: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  }

  // Access gate
  if (!hasAccess) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <ShieldAlert className="h-6 w-6" />
          </span>
          <h2 className="text-lg font-semibold text-foreground">No access</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            You don't have permission to manage school settings. Contact an administrator if you
            think this is a mistake.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">School Setup</h1>
        <p className="text-sm text-muted-foreground">Manage your school's profile and preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>School profile</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 w-full animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              {notice && (
                <div
                  className={
                    notice.kind === 'success'
                      ? 'rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700'
                      : 'rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'
                  }
                >
                  {notice.text}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="name">School name</Label>
                <Input id="name" required value={form.name} onChange={set('name')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={form.address ?? ''}
                  onChange={set('address')}
                  placeholder="123 Education Lane"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  value={form.timezone ?? ''}
                  onChange={set('timezone')}
                  placeholder="Asia/Kolkata"
                />
              </div>

              <div className="space-y-1.5">
                <ImageUploader value={form.logoUrl ?? ''} onChange={(url) => setForm(f => ({ ...f, logoUrl: url }))} label="School Logo" />
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save changes
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
