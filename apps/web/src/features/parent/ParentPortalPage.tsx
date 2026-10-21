import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { Select } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { statusVariant } from '@/lib/format';
import type { ChildSummary } from '@/lib/dto';
import { ChildAttendance } from './ChildAttendance';
import { ChildFees } from './ChildFees';
import { ChildResults } from './ChildResults';
import { ChildTimetable } from './ChildTimetable';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ParentPortalPage() {
  const { user, can } = useAuth();

  // Gate: must be parent role OR have students:read
  const isParent = user?.role === 'parent';
  const canRead = can('students:read');

  const [children, setChildren] = useState<ChildSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [tab, setTab] = useState('attendance');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password reset state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword) {
      setResetError('Password is required.');
      return;
    }
    if (newPassword.length < 6) {
      setResetError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }
    setResetting(true);
    setResetError(null);
    setResetSuccess(null);
    try {
      await api.post('/parent/change-password', { password: newPassword });
      setResetSuccess('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowChangePassword(false);
        setResetSuccess(null);
      }, 2000);
    } catch (err: any) {
      const msg = err?.payload?.message || err?.message || 'Failed to change password.';
      setResetError(msg);
    } finally {
      setResetting(false);
    }
  }

  useEffect(() => {
    if (!isParent && !canRead) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<ChildSummary[]>('/parent/children')
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setChildren(list);
        if (list.length > 0) setSelectedId(list[0].id);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load children list.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isParent, canRead]);

  if (!isParent && !canRead) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-semibold text-foreground">Access Denied</p>
        <p className="mt-1 text-sm text-muted-foreground">
          You need the Parent role or students:read permission to view this page.
        </p>
      </div>
    );
  }

  const selectedChild = children.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Parent Portal</h1>
          <p className="text-sm text-muted-foreground">View attendance, fees, results and timetable.</p>
        </div>
        <Button onClick={() => setShowChangePassword(true)} variant="outline">
          Change Password
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {!loading && children.length === 0 && !error && (
        <div className="rounded-xl border border-border bg-card py-10 text-center text-sm text-muted-foreground">
          No children found for your account.
        </div>
      )}

      {!loading && children.length > 0 && (
        <>
          {/* Child selector — show tabs if 2–5 children, select otherwise */}
          {children.length === 1 ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div>
                <p className="font-semibold text-foreground">{children[0].fullName}</p>
                <p className="text-sm text-muted-foreground">
                  {children[0].className ?? ''}
                  {children[0].sectionName ? ` · ${children[0].sectionName}` : ''}
                  {' · '}
                  <span className="font-mono text-xs">{children[0].admissionNo}</span>
                </p>
              </div>
              <Badge
                className="ml-auto"
                variant={statusVariant(children[0].status)}
              >
                {children[0].status}
              </Badge>
            </div>
          ) : children.length <= 5 ? (
            <div className="flex flex-wrap gap-2">
              {children.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                    c.id === selectedId
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-foreground hover:bg-muted/50'
                  }`}
                >
                  <span className="block font-semibold">{c.fullName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {c.className ?? ''}{c.sectionName ? ` · ${c.sectionName}` : ''}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <Select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-72"
            >
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} — {c.className ?? ''}{c.sectionName ? ` · ${c.sectionName}` : ''}
                </option>
              ))}
            </Select>
          )}

          {/* Selected child detail header */}
          {selectedChild && children.length > 1 && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex-1">
                <p className="font-semibold text-foreground">{selectedChild.fullName}</p>
                <p className="text-sm text-muted-foreground">
                  Adm: <span className="font-mono text-xs">{selectedChild.admissionNo}</span>
                  {selectedChild.rollNo ? ` · Roll: ${selectedChild.rollNo}` : ''}
                </p>
              </div>
              <Badge variant={statusVariant(selectedChild.status)}>{selectedChild.status}</Badge>
            </div>
          )}

          {/* 4 tabs per child */}
          {selectedId && (
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="attendance">Attendance</TabsTrigger>
                <TabsTrigger value="fees">Fees</TabsTrigger>
                <TabsTrigger value="results">Results</TabsTrigger>
                <TabsTrigger value="timetable">Timetable</TabsTrigger>
              </TabsList>

              <TabsContent value="attendance">
                <ChildAttendance studentId={selectedId} />
              </TabsContent>
              <TabsContent value="fees">
                <ChildFees studentId={selectedId} />
              </TabsContent>
              <TabsContent value="results">
                <ChildResults studentId={selectedId} />
              </TabsContent>
              <TabsContent value="timetable">
                <ChildTimetable studentId={selectedId} />
              </TabsContent>
            </Tabs>
          )}
        </>
      )}

      {showChangePassword && (
        <Dialog open={showChangePassword} onClose={() => { if (!resetting) setShowChangePassword(false); }} className="max-w-md">
          <form onSubmit={handleResetPassword}>
            <DialogHeader
              title="Change Password"
              description="Enter a new password for your account."
              onClose={() => setShowChangePassword(false)}
            />
            <DialogBody className="space-y-4">
              {resetError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {resetError}
                </div>
              )}
              {resetSuccess && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                  {resetSuccess}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="bg-background text-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="bg-background text-foreground"
                />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowChangePassword(false)} disabled={resetting}>
                Cancel
              </Button>
              <Button type="submit" disabled={resetting}>
                {resetting && <Loader2 className="mr-2 h-4 w-4 animate-spin inline-block" />}
                Update Password
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
      )}
    </div>
  );
}
