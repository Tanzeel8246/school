/**
 * HostelPage — 4 tabs: Hostels | Allocations | Mess Menu | Summary
 */
import { useCallback, useEffect, useState } from 'react';
import { Building2, Plus, Loader2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { RowMenu } from '@/components/RowMenu';
import { Pagination } from '@/components/Pagination';
import { money, toMinor, date } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Hostel, HostelRoom, HostelAllocation, MessMenu } from '@/lib/dto';

// ─── Tab bar ──────────────────────────────────────────────────────────────────

type Tab = 'hostels' | 'allocations' | 'mess' | 'summary';

const TABS: { id: Tab; label: string }[] = [
  { id: 'hostels', label: 'Hostels' },
  { id: 'allocations', label: 'Allocations' },
  { id: 'mess', label: 'Mess Menu' },
  { id: 'summary', label: 'Summary' },
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

// Hostel type badge
const HOSTEL_TYPE_STYLES: Record<string, string> = {
  boys: 'bg-primary/10 text-primary',
  girls: 'bg-pink-50 text-pink-700',
  mixed: 'bg-purple-50 text-purple-700',
};

function HostelTypeBadge({ type }: { type: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', HOSTEL_TYPE_STYLES[type] ?? 'bg-muted text-foreground')}>
      {type}
    </span>
  );
}

export function HostelPage() {
  const [tab, setTab] = useState<Tab>('hostels');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Building2 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Hostel</h1>
          <p className="text-sm text-muted-foreground">Manage hostels, rooms, allocations and mess menu.</p>
        </div>
      </div>

      <TabBar active={tab} onChange={setTab} />

      {tab === 'hostels' && <HostelsTab />}
      {tab === 'allocations' && <AllocationsTab />}
      {tab === 'mess' && <MessMenuTab />}
      {tab === 'summary' && <SummaryTab />}
    </div>
  );
}

// ─── Hostels tab ──────────────────────────────────────────────────────────────

function HostelsTab() {
  const { can } = useAuth();
  const canWrite = can('hostel:write');

  const { rows, meta, loading, error, page, setPage, refetch } = useApiList<Hostel>({
    path: '/hostel/hostels',
    limit: 20,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Hostel | null>(null);
  const [roomsHostel, setRoomsHostel] = useState<Hostel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Hostel | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canWrite && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" />
            New Hostel
          </Button>
        )}
      </div>

      {error && <ErrorBox message={error} />}

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Name</TH>
            <TH>Type</TH>
            <TH>Capacity</TH>
            <TH>Occupied</TH>
            <TH>Occupancy</TH>
            <TH>Warden</TH>
            {canWrite && <TH className="text-right">Actions</TH>}
          </TR>
        </THead>
        <TBody>
          {loading && (
            <TR className="hover:bg-transparent">
              <TD colSpan={7} className="py-10 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </TD>
            </TR>
          )}
          {!loading && rows.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={7} className="py-8 text-center text-muted-foreground">No hostels found. Add your first hostel.</TD>
            </TR>
          )}
          {!loading && rows.map((h) => {
            const pct = h.totalCapacity > 0 ? Math.round((h.occupiedCount / h.totalCapacity) * 100) : 0;
            return (
              <TR key={h.id}>
                <TD className="font-medium text-foreground">{h.name}</TD>
                <TD><HostelTypeBadge type={h.hostelType} /></TD>
                <TD>{h.totalCapacity}</TD>
                <TD>{h.occupiedCount}</TD>
                <TD>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 rounded-full bg-muted">
                      <div className={cn('h-full rounded-full', pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{pct}%</span>
                  </div>
                </TD>
                <TD>{h.wardenName ?? '—'}</TD>
                {canWrite && (
                  <TD className="text-right">
                    <RowMenu items={[
                      { label: 'View Rooms', onClick: () => setRoomsHostel(h) },
                      { label: 'Edit', onClick: () => { setEditing(h); setFormOpen(true); } },
                      { label: 'Delete', onClick: () => setDeleteTarget(h), danger: true },
                    ]} />
                  </TD>
                )}
              </TR>
            );
          })}
        </TBody>
      </Table>

      <Pagination meta={meta} page={page} onPage={setPage} noun="hostels" />

      <HostelFormDialog open={formOpen} hostel={editing} onClose={() => setFormOpen(false)} onSaved={refetch} />

      {roomsHostel && (
        <RoomsPanel hostel={roomsHostel} canWrite={canWrite} onClose={() => setRoomsHostel(null)} />
      )}

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        title="Delete Hostel"
        message={`Delete hostel "${deleteTarget?.name}"?`}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.del(`/hostel/hostels/${deleteTarget.id}`);
          setDeleteTarget(null);
          refetch();
        }}
      />
    </div>
  );
}

function HostelFormDialog({ open, hostel, onClose, onSaved }: {
  open: boolean; hostel: Hostel | null; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [hostelType, setHostelType] = useState<'boys' | 'girls' | 'mixed'>('boys');
  const [address, setAddress] = useState('');
  const [wardenId, setWardenId] = useState('');
  const [totalCapacity, setTotalCapacity] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hostel) {
      setName(hostel.name); setHostelType(hostel.hostelType);
      setAddress(hostel.address ?? ''); setWardenId(hostel.wardenId ?? '');
      setTotalCapacity(String(hostel.totalCapacity));
    } else {
      setName(''); setHostelType('boys'); setAddress(''); setWardenId(''); setTotalCapacity('');
    }
    setError(null);
  }, [hostel, open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const payload = { name, hostelType, address: address || undefined, wardenId: wardenId || undefined, totalCapacity: Number(totalCapacity) };
      if (hostel) await api.patch(`/hostel/hostels/${hostel.id}`, payload);
      else await api.post('/hostel/hostels', payload);
      onSaved(); onClose();
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not save hostel.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={submit}>
        <DialogHeader title={hostel ? 'Edit Hostel' : 'New Hostel'} onClose={onClose} />
        <DialogBody className="space-y-4">
          {error && <ErrorBox message={error} />}
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Hostel name" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={hostelType} onChange={(e) => setHostelType(e.target.value as 'boys' | 'girls' | 'mixed')}>
                <option value="boys">Boys</option>
                <option value="girls">Girls</option>
                <option value="mixed">Mixed</option>
              </Select>
            </Field>
            <Field label="Total Capacity"><Input type="number" min="1" value={totalCapacity} onChange={(e) => setTotalCapacity(e.target.value)} required /></Field>
          </div>
          <Field label="Address"><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Hostel address" /></Field>
          <Field label="Warden Staff ID"><Input value={wardenId} onChange={(e) => setWardenId(e.target.value)} placeholder="Staff UUID" /></Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {hostel ? 'Save Changes' : 'Create'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function RoomsPanel({ hostel, canWrite, onClose }: { hostel: Hostel; canWrite: boolean; onClose: () => void }) {
  const [rooms, setRooms] = useState<HostelRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [roomFormOpen, setRoomFormOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<HostelRoom | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get<HostelRoom[]>(`/hostel/hostels/${hostel.id}/rooms?limit=100`)
      .then((r) => setRooms(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [hostel.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <Dialog open onClose={onClose} className="max-w-3xl">
      <DialogHeader title={`Rooms — ${hostel.name}`} onClose={onClose} />
      <DialogBody className="space-y-4 overflow-y-auto max-h-[65vh]">
        {error && <ErrorBox message={error} />}
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Room No</TH>
                <TH>Type</TH>
                <TH>Floor</TH>
                <TH>Capacity</TH>
                <TH>Occupied</TH>
                <TH>Monthly Fee</TH>
                <TH>Active</TH>
                {canWrite && <TH className="text-right">Actions</TH>}
              </TR>
            </THead>
            <TBody>
              {rooms.length === 0 && (
                <TR className="hover:bg-transparent">
                  <TD colSpan={8} className="py-6 text-center text-muted-foreground">No rooms added yet.</TD>
                </TR>
              )}
              {rooms.map((r) => (
                <TR key={r.id}>
                  <TD className="font-mono font-medium">{r.roomNo}</TD>
                  <TD className="capitalize">{r.roomType}</TD>
                  <TD>{r.floor}</TD>
                  <TD>{r.capacity}</TD>
                  <TD>{r.occupied}</TD>
                  <TD className="font-mono">{money(r.monthlyFee)}</TD>
                  <TD><Badge variant={r.isActive ? 'success' : 'default'}>{r.isActive ? 'Active' : 'Inactive'}</Badge></TD>
                  {canWrite && (
                    <TD className="text-right">
                      <RowMenu items={[
                        { label: 'Edit', onClick: () => { setEditingRoom(r); setRoomFormOpen(true); } },
                      ]} />
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        {canWrite && (
          <Button variant="outline" size="sm" onClick={() => { setEditingRoom(null); setRoomFormOpen(true); }}>
            <Plus className="h-4 w-4" />
            Add Room
          </Button>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </DialogFooter>

      <RoomFormDialog
        open={roomFormOpen}
        room={editingRoom}
        hostelId={hostel.id}
        onClose={() => setRoomFormOpen(false)}
        onSaved={() => { setRoomFormOpen(false); load(); }}
        onError={(msg) => setError(msg)}
      />
    </Dialog>
  );
}

function RoomFormDialog({ open, room, hostelId, onClose, onSaved, onError }: {
  open: boolean; room: HostelRoom | null; hostelId: string;
  onClose: () => void; onSaved: () => void; onError: (msg: string) => void;
}) {
  const [roomNo, setRoomNo] = useState('');
  const [roomType, setRoomType] = useState<HostelRoom['roomType']>('double');
  const [floor, setFloor] = useState('0');
  const [capacity, setCapacity] = useState('');
  const [monthlyFee, setMonthlyFee] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (room) {
      setRoomNo(room.roomNo); setRoomType(room.roomType);
      setFloor(String(room.floor)); setCapacity(String(room.capacity));
      setMonthlyFee(String(room.monthlyFee / 100));
    } else {
      setRoomNo(''); setRoomType('double'); setFloor('0'); setCapacity(''); setMonthlyFee('');
    }
    setError(null);
  }, [room, open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const payload = { roomNo, roomType, floor: Number(floor), capacity: Number(capacity), monthlyFee: toMinor(monthlyFee) };
      if (room) await api.patch(`/hostel/rooms/${room.id}`, payload);
      else await api.post(`/hostel/hostels/${hostelId}/rooms`, payload);
      onSaved();
    } catch (err) {
      const msg = err instanceof ApiError ? `Error ${err.status}` : 'Could not save room.';
      setError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={submit}>
        <DialogHeader title={room ? 'Edit Room' : 'Add Room'} onClose={onClose} />
        <DialogBody className="space-y-4">
          {error && <ErrorBox message={error} />}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Room No"><Input value={roomNo} onChange={(e) => setRoomNo(e.target.value)} required placeholder="e.g. 101" /></Field>
            <Field label="Type">
              <Select value={roomType} onChange={(e) => setRoomType(e.target.value as HostelRoom['roomType'])}>
                <option value="single">Single</option>
                <option value="double">Double</option>
                <option value="triple">Triple</option>
                <option value="dormitory">Dormitory</option>
              </Select>
            </Field>
            <Field label="Floor"><Input type="number" min="0" value={floor} onChange={(e) => setFloor(e.target.value)} /></Field>
            <Field label="Capacity"><Input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} required /></Field>
          </div>
          <Field label="Monthly Fee (PKR)"><Input type="number" min="0" step="0.01" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} required placeholder="e.g. 3000" /></Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {room ? 'Save' : 'Add Room'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// ─── Allocations tab ──────────────────────────────────────────────────────────

function AllocationsTab() {
  const { can } = useAuth();
  const canWrite = can('hostel:write');

  const [hostelId, setHostelId] = useState('');
  const [status, setStatus] = useState('');

  const { rows, meta, loading, error, page, setPage, refetch } = useApiList<HostelAllocation>({
    path: '/hostel/allocations',
    params: { hostelId: hostelId || undefined, status: status || undefined },
  });

  const [newOpen, setNewOpen] = useState(false);
  const [vacateTarget, setVacateTarget] = useState<HostelAllocation | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input value={hostelId} onChange={(e) => setHostelId(e.target.value)} placeholder="Hostel ID…" className="w-48" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="vacated">Vacated</option>
          <option value="expired">Expired</option>
        </Select>
        <div className="ml-auto">
          {canWrite && (
            <Button onClick={() => setNewOpen(true)}>
              <Plus className="h-4 w-4" />
              New Allocation
            </Button>
          )}
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Student</TH>
            <TH>Adm No</TH>
            <TH>Hostel</TH>
            <TH>Room</TH>
            <TH>Bed</TH>
            <TH>From</TH>
            <TH>Monthly Fee</TH>
            <TH>Status</TH>
            {canWrite && <TH className="text-right">Actions</TH>}
          </TR>
        </THead>
        <TBody>
          {loading && (
            <TR className="hover:bg-transparent">
              <TD colSpan={9} className="py-10 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </TD>
            </TR>
          )}
          {!loading && rows.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={9} className="py-8 text-center text-muted-foreground">No allocations found.</TD>
            </TR>
          )}
          {!loading && rows.map((a) => (
            <TR key={a.id}>
              <TD className="font-medium text-foreground">{a.studentName}</TD>
              <TD className="font-mono text-xs">{a.admissionNo}</TD>
              <TD>{a.hostelName}</TD>
              <TD>{a.roomNo}</TD>
              <TD>{a.bedNo ?? '—'}</TD>
              <TD>{date(a.allocatedFrom)}</TD>
              <TD className="font-mono">{money(a.monthlyFee)}</TD>
              <TD>
                <Badge variant={a.status === 'active' ? 'success' : a.status === 'vacated' ? 'default' : 'warning'}>
                  {a.status}
                </Badge>
              </TD>
              {canWrite && (
                <TD className="text-right">
                  <RowMenu items={[
                    { label: 'Vacate', onClick: () => setVacateTarget(a), danger: true, hidden: a.status !== 'active' },
                  ]} />
                </TD>
              )}
            </TR>
          ))}
        </TBody>
      </Table>

      <Pagination meta={meta} page={page} onPage={setPage} noun="allocations" />

      <AllocationDialog open={newOpen} onClose={() => setNewOpen(false)} onSaved={refetch} />

      {vacateTarget && (
        <VacateDialog allocation={vacateTarget} onClose={() => setVacateTarget(null)} onDone={() => { setVacateTarget(null); refetch(); }} />
      )}
    </div>
  );
}

function AllocationDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [studentId, setStudentId] = useState('');
  const [hostelId, setHostelId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [bedNo, setBedNo] = useState('');
  const [allocatedFrom, setAllocatedFrom] = useState('');
  const [monthlyFee, setMonthlyFee] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStudentId(''); setHostelId(''); setRoomId(''); setBedNo('');
      setAllocatedFrom(''); setMonthlyFee(''); setNotes(''); setError(null);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      await api.post('/hostel/allocations', {
        studentId, hostelId, roomId,
        bedNo: bedNo || undefined,
        allocatedFrom: allocatedFrom || undefined,
        monthlyFee: toMinor(monthlyFee),
        notes: notes || undefined,
      });
      onSaved(); onClose();
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not create allocation.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={submit}>
        <DialogHeader title="New Allocation" onClose={onClose} />
        <DialogBody className="space-y-4 overflow-y-auto max-h-[70vh]">
          {error && <ErrorBox message={error} />}
          <Field label="Student ID"><Input value={studentId} onChange={(e) => setStudentId(e.target.value)} required placeholder="Student UUID" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hostel ID"><Input value={hostelId} onChange={(e) => setHostelId(e.target.value)} required placeholder="Hostel UUID" /></Field>
            <Field label="Room ID"><Input value={roomId} onChange={(e) => setRoomId(e.target.value)} required placeholder="Room UUID" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bed No (optional)"><Input value={bedNo} onChange={(e) => setBedNo(e.target.value)} placeholder="e.g. B1" /></Field>
            <Field label="Allocated From"><Input type="date" value={allocatedFrom} onChange={(e) => setAllocatedFrom(e.target.value)} /></Field>
          </div>
          <Field label="Monthly Fee (PKR)"><Input type="number" min="0" step="0.01" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} required placeholder="e.g. 3000" /></Field>
          <Field label="Notes (optional)"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Allocate
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function VacateDialog({ allocation, onClose, onDone }: { allocation: HostelAllocation; onClose: () => void; onDone: () => void }) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      await api.patch(`/hostel/allocations/${allocation.id}/vacate`, { notes: notes || undefined });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not vacate.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose}>
      <form onSubmit={submit}>
        <DialogHeader title="Vacate Room" description={`${allocation.studentName} — ${allocation.hostelName} / ${allocation.roomNo}`} onClose={onClose} />
        <DialogBody className="space-y-4">
          {error && <ErrorBox message={error} />}
          <p className="text-sm text-muted-foreground">Mark this allocation as vacated?</p>
          <Field label="Notes (optional)"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for vacating…" /></Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="destructive" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Vacate
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// ─── Mess Menu tab ────────────────────────────────────────────────────────────

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEALS: Array<MessMenu['mealType']> = ['breakfast', 'lunch', 'dinner', 'snack'];

type MenuGrid = Record<number, Record<string, string>>;

function MessMenuTab() {
  const { can } = useAuth();
  const canWrite = can('hostel:write');

  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState('');
  const [menuData, setMenuData] = useState<MessMenu[]>([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Hostel[]>('/hostel/hostels?limit=100')
      .then((r) => {
        const h = r.data ?? [];
        setHostels(h);
        if (h.length > 0 && !selectedHostelId) setSelectedHostelId(h[0].id);
      })
      .catch(() => {});
  }, []);// eslint-disable-line

  useEffect(() => {
    if (!selectedHostelId) return;
    setLoading(true); setError(null);
    api.get<MessMenu[]>(`/hostel/mess?hostelId=${selectedHostelId}`)
      .then((r) => setMenuData(r.data ?? []))
      .catch(() => setError('Could not load mess menu.'))
      .finally(() => setLoading(false));
  }, [selectedHostelId]);

  // Build grid: grid[dayOfWeek][mealType] = menuItems
  const grid: MenuGrid = {};
  for (let d = 0; d < 7; d++) {
    grid[d] = {};
    for (const m of MEALS) {
      const entry = menuData.find((x) => x.dayOfWeek === d && x.mealType === m);
      grid[d][m] = entry?.menuItems ?? '';
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedHostelId} onChange={(e) => setSelectedHostelId(e.target.value)} className="w-56">
          <option value="">Select hostel…</option>
          {hostels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </Select>
        {canWrite && selectedHostelId && (
          <Button onClick={() => setEditOpen(true)}>Edit Menu</Button>
        )}
      </div>

      {error && <ErrorBox message={error} />}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : selectedHostelId ? (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-border bg-muted/50 px-3 py-2 text-left font-semibold text-foreground">Day</th>
                {MEALS.map((m) => (
                  <th key={m} className="border border-border bg-muted/50 px-3 py-2 text-left font-semibold text-foreground capitalize">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day, idx) => (
                <tr key={day} className="hover:bg-muted/50">
                  <td className="border border-border px-3 py-2 font-medium text-foreground">{day}</td>
                  {MEALS.map((m) => (
                    <td key={m} className="border border-border px-3 py-2 text-muted-foreground">
                      {grid[idx][m] ? (
                        <span title={grid[idx][m]}>{grid[idx][m].length > 40 ? grid[idx][m].slice(0, 40) + '…' : grid[idx][m]}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">Select a hostel to view the menu.</p>
      )}

      {editOpen && selectedHostelId && (
        <MessMenuEditDialog
          hostelId={selectedHostelId}
          currentGrid={grid}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            // reload
            setLoading(true);
            api.get<MessMenu[]>(`/hostel/mess?hostelId=${selectedHostelId}`)
              .then((r) => setMenuData(r.data ?? []))
              .catch(() => {})
              .finally(() => setLoading(false));
          }}
        />
      )}
    </div>
  );
}

function MessMenuEditDialog({ hostelId, currentGrid, onClose, onSaved }: {
  hostelId: string; currentGrid: MenuGrid; onClose: () => void; onSaved: () => void;
}) {
  const [grid, setGrid] = useState<MenuGrid>(() => {
    const g: MenuGrid = {};
    for (let d = 0; d < 7; d++) {
      g[d] = {};
      for (const m of MEALS) g[d][m] = currentGrid[d]?.[m] ?? '';
    }
    return g;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(day: number, meal: string, val: string) {
    setGrid((prev) => ({ ...prev, [day]: { ...prev[day], [meal]: val } }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    const menu: Array<{ dayOfWeek: number; mealType: string; menuItems: string }> = [];
    for (let d = 0; d < 7; d++) {
      for (const m of MEALS) {
        if (grid[d][m]) menu.push({ dayOfWeek: d, mealType: m, menuItems: grid[d][m] });
      }
    }
    try {
      await api.put('/hostel/mess', { hostelId, menu });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not save menu.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} className="max-w-4xl">
      <form onSubmit={submit}>
        <DialogHeader title="Edit Mess Menu" onClose={onClose} />
        <DialogBody className="overflow-y-auto max-h-[70vh] space-y-4">
          {error && <ErrorBox message={error} />}
          {DAYS.map((day, idx) => (
            <div key={day}>
              <p className="mb-2 text-sm font-semibold text-foreground">{day}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {MEALS.map((m) => (
                  <Field key={m} label={m.charAt(0).toUpperCase() + m.slice(1)}>
                    <Textarea
                      value={grid[idx][m]}
                      onChange={(e) => update(idx, m, e.target.value)}
                      placeholder="Menu items…"
                      className="min-h-[60px] text-sm"
                    />
                  </Field>
                ))}
              </div>
            </div>
          ))}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Menu
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// ─── Summary tab ──────────────────────────────────────────────────────────────

function SummaryTab() {
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    api.get<Hostel[]>('/hostel/hostels?limit=100')
      .then((r) => setHostels(r.data ?? []))
      .catch(() => setError('Could not load hostel data.'))
      .finally(() => setLoading(false));
  }, []);

  const totalCapacity = hostels.reduce((s, h) => s + h.totalCapacity, 0);
  const totalOccupied = hostels.reduce((s, h) => s + h.occupiedCount, 0);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      {error && <ErrorBox message={error} />}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total Hostels" value={hostels.length} />
        <KpiCard label="Total Capacity" value={totalCapacity} />
        <KpiCard label="Occupied Beds" value={totalOccupied} />
        <KpiCard label="Available Beds" value={totalCapacity - totalOccupied} />
      </div>

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Hostel</TH>
            <TH>Type</TH>
            <TH>Capacity</TH>
            <TH>Occupied</TH>
            <TH>Occupancy</TH>
          </TR>
        </THead>
        <TBody>
          {hostels.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={5} className="py-6 text-center text-muted-foreground">No hostels found.</TD>
            </TR>
          )}
          {hostels.map((h) => {
            const pct = h.totalCapacity > 0 ? Math.round((h.occupiedCount / h.totalCapacity) * 100) : 0;
            return (
              <TR key={h.id}>
                <TD className="font-medium text-foreground">{h.name}</TD>
                <TD><HostelTypeBadge type={h.hostelType} /></TD>
                <TD>{h.totalCapacity}</TD>
                <TD>{h.occupiedCount}</TD>
                <TD>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-28 rounded-full bg-muted">
                      <div className={cn('h-full rounded-full', pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{pct}%</span>
                  </div>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function KpiCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>
  );
}

function ConfirmDeleteDialog({ open, title, message, onClose, onConfirm }: {
  open: boolean; title: string; message: string;
  onClose: () => void; onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true); setError(null);
    try { await onConfirm(); } catch { setError('Operation failed.'); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader title={title} onClose={onClose} />
      <DialogBody>
        {error && <ErrorBox message={error} />}
        <p className="text-sm text-muted-foreground">{message}</p>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="destructive" onClick={go} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Confirm
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
