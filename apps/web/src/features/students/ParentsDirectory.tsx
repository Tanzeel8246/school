import { useState } from 'react';
import { Loader2, Key, Users } from 'lucide-react';
import { useApiList } from '@/hooks/useApiList';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Guardian {
  id: string;
  fullName: string;
  phone: string | null;
  relation: string | null;
  email: string | null;
  username: string | null;
  userId: string | null;
  students: { id: string; name: string; admissionNo: string }[];
}

export function ParentsDirectory() {
  const { rows, loading, error, refetch } = useApiList<Guardian>({ path: '/students/guardians', limit: 500 });
  
  const [resettingFor, setResettingFor] = useState<Guardian | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Parents Directory</h2>
          <p className="text-sm text-muted-foreground">View registered parents/guardians and manage their portal access.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Parent Name</TH>
              <TH>Relation</TH>
              <TH>Contact</TH>
              <TH>Login Details</TH>
              <TH>Children</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {loading && (
              <TR className="hover:bg-transparent">
                <TD colSpan={6} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TD>
              </TR>
            )}
            {!loading && rows.length === 0 && (
              <TR className="hover:bg-transparent">
                <TD colSpan={6} className="py-10 text-center text-muted-foreground">
                  No parents found in the directory.
                </TD>
              </TR>
            )}
            {!loading &&
              rows.map((g) => (
                <TR key={g.id}>
                  <TD className="font-medium text-foreground">{g.fullName}</TD>
                  <TD className="capitalize">{g.relation || '—'}</TD>
                  <TD>
                    <div className="text-sm">{g.phone || '—'}</div>
                    {g.email && <div className="text-xs text-muted-foreground">{g.email}</div>}
                  </TD>
                  <TD>
                    {g.username ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-blue-700/10">
                        <Users className="h-3 w-3" />
                        {g.username}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">No account</span>
                    )}
                  </TD>
                  <TD>
                    {g.students && g.students.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {g.students.map((child) => (
                          <div key={child.id} className="text-xs">
                            <span className="font-medium">{child.name}</span>
                            <span className="text-muted-foreground ml-1">({child.admissionNo})</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TD>
                  <TD className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!g.userId}
                      onClick={() => setResettingFor(g)}
                      className="h-8"
                    >
                      <Key className="mr-1.5 h-3.5 w-3.5" />
                      Reset Password
                    </Button>
                  </TD>
                </TR>
              ))}
          </TBody>
        </Table>
      </div>

      {resettingFor && (
        <ResetPasswordDialog
          guardian={resettingFor}
          onClose={() => setResettingFor(null)}
          onSuccess={() => {
            setResettingFor(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function ResetPasswordDialog({
  guardian,
  onClose,
  onSuccess,
}: {
  guardian: Guardian;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post(`/students/guardians/${guardian.id}/password`, { password });
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? ((err.payload as any)?.message ?? 'Reset failed.') : 'Reset failed.');
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} className="max-w-md">
      <form onSubmit={onSubmit}>
        <DialogHeader title="Reset Password" description={`Set a new password for ${guardian.fullName}'s account.`} onClose={onClose} />
        <DialogBody>
          {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              autoFocus
              required
              minLength={6}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reset Password
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
