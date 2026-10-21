/**
 * TransportPage — 4 tabs: Vehicles | Routes | Students | Overview
 */
import { useCallback, useEffect, useState } from 'react';
import { Bus, Plus, Loader2, Search } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useApiList } from '@/hooks/useApiList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Card, CardContent } from '@/components/ui/card';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { RowMenu } from '@/components/RowMenu';
import { Pagination } from '@/components/Pagination';
import { money, toMinor, date } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Vehicle, TransportRoute, StudentTransport, RouteStop } from '@/lib/dto';

// ─── Tab bar ──────────────────────────────────────────────────────────────────

type Tab = 'vehicles' | 'routes' | 'students' | 'overview';

const TABS: { id: Tab; label: string }[] = [
  { id: 'vehicles', label: 'Vehicles' },
  { id: 'routes', label: 'Routes' },
  { id: 'students', label: 'Students' },
  { id: 'overview', label: 'Overview' },
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

export function TransportPage() {
  const [tab, setTab] = useState<Tab>('vehicles');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Bus className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Transport</h1>
          <p className="text-sm text-muted-foreground">Manage vehicles, routes, stops and student transport assignments.</p>
        </div>
      </div>

      <TabBar active={tab} onChange={setTab} />

      {tab === 'vehicles' && <VehiclesTab />}
      {tab === 'routes' && <RoutesTab />}
      {tab === 'students' && <StudentsTab />}
      {tab === 'overview' && <OverviewTab />}
    </div>
  );
}

// ─── Vehicle type badge helper ─────────────────────────────────────────────────

const VEHICLE_TYPE_STYLES: Record<string, string> = {
  bus: 'bg-primary/10 text-primary',
  van: 'bg-teal-50 text-teal-700',
  car: 'bg-muted text-foreground',
  minibus: 'bg-primary/10 text-primary',
};

function VehicleTypeBadge({ type }: { type: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', VEHICLE_TYPE_STYLES[type] ?? 'bg-muted text-foreground')}>
      {type}
    </span>
  );
}

// ─── Vehicles tab ─────────────────────────────────────────────────────────────

function VehiclesTab() {
  const { can } = useAuth();
  const canWrite = can('transport:write');

  const { rows, meta, loading, error, page, setPage, refetch } = useApiList<Vehicle>({
    path: '/transport/vehicles',
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canWrite && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" />
            New Vehicle
          </Button>
        )}
      </div>

      {error && <ErrorBox message={error} />}

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Reg No</TH>
            <TH>Type</TH>
            <TH>Make / Model</TH>
            <TH>Capacity</TH>
            <TH>Driver</TH>
            <TH>Active</TH>
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
              <TD colSpan={7} className="py-8 text-center text-muted-foreground">No vehicles registered.</TD>
            </TR>
          )}
          {!loading && rows.map((v) => (
            <TR key={v.id}>
              <TD className="font-mono font-medium">{v.regNo}</TD>
              <TD><VehicleTypeBadge type={v.vehicleType} /></TD>
              <TD>{[v.make, v.model].filter(Boolean).join(' ') || '—'}</TD>
              <TD>{v.capacity}</TD>
              <TD>{v.driverName ?? '—'}</TD>
              <TD><Badge variant={v.isActive ? 'success' : 'default'}>{v.isActive ? 'Active' : 'Inactive'}</Badge></TD>
              {canWrite && (
                <TD className="text-right">
                  <RowMenu items={[
                    { label: 'Edit', onClick: () => { setEditing(v); setFormOpen(true); } },
                    { label: 'Delete', onClick: () => setDeleteTarget(v), danger: true },
                  ]} />
                </TD>
              )}
            </TR>
          ))}
        </TBody>
      </Table>

      <Pagination meta={meta} page={page} onPage={setPage} noun="vehicles" />

      <VehicleFormDialog open={formOpen} vehicle={editing} onClose={() => setFormOpen(false)} onSaved={refetch} />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        title="Delete Vehicle"
        message={`Delete vehicle "${deleteTarget?.regNo}"?`}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.del(`/transport/vehicles/${deleteTarget.id}`);
          setDeleteTarget(null);
          refetch();
        }}
      />
    </div>
  );
}

function VehicleFormDialog({ open, vehicle, onClose, onSaved }: {
  open: boolean; vehicle: Vehicle | null; onClose: () => void; onSaved: () => void;
}) {
  const [regNo, setRegNo] = useState('');
  const [vehicleType, setVehicleType] = useState<Vehicle['vehicleType']>('bus');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [capacity, setCapacity] = useState('');
  const [driverId, setDriverId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { rows: staffList } = useApiList<{ id: string; fullName: string; employeeId: string }>({ path: '/staff', limit: 1000 });
  const staffOptions = staffList.map(s => ({ value: s.id, label: `${s.fullName} (${s.employeeId})` }));

  useEffect(() => {
    if (vehicle) {
      setRegNo(vehicle.regNo); setVehicleType(vehicle.vehicleType);
      setMake(vehicle.make ?? ''); setModel(vehicle.model ?? '');
      setCapacity(String(vehicle.capacity)); setDriverId(vehicle.driverId ?? '');
      setIsActive(vehicle.isActive);
    } else {
      setRegNo(''); setVehicleType('bus'); setMake(''); setModel('');
      setCapacity(''); setDriverId(''); setIsActive(true);
    }
    setError(null);
  }, [vehicle, open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const payload = {
        regNo, vehicleType, make: make || undefined, model: model || undefined,
        capacity: Number(capacity), driverId: driverId || undefined, isActive,
      };
      if (vehicle) await api.patch(`/transport/vehicles/${vehicle.id}`, payload);
      else await api.post('/transport/vehicles', payload);
      onSaved(); onClose();
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not save vehicle.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={submit}>
        <DialogHeader title={vehicle ? 'Edit Vehicle' : 'New Vehicle'} onClose={onClose} />
        <DialogBody className="space-y-4 overflow-y-auto max-h-[70vh]">
          {error && <ErrorBox message={error} />}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Registration No"><Input value={regNo} onChange={(e) => setRegNo(e.target.value)} required placeholder="ABC-123" /></Field>
            <Field label="Type">
              <Select value={vehicleType} onChange={(e) => setVehicleType(e.target.value as Vehicle['vehicleType'])}>
                <option value="bus">Bus</option>
                <option value="van">Van</option>
                <option value="car">Car</option>
                <option value="minibus">Minibus</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Make"><Input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Toyota" /></Field>
            <Field label="Model"><Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Coaster" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Capacity"><Input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} required placeholder="40" /></Field>
            <Field label="Driver Staff">
              <SearchableSelect
                value={staffOptions.find(o => o.value === driverId) || null}
                onChange={(val: any) => setDriverId(val?.value || '')}
                options={staffOptions}
                isClearable
                placeholder="Select driver..."
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-border accent-primary" />
            Active
          </label>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {vehicle ? 'Save Changes' : 'Create'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// ─── Routes tab ───────────────────────────────────────────────────────────────

function RoutesTab() {
  const { can } = useAuth();
  const canWrite = can('transport:write');

  const { rows, meta, loading, error, page, setPage, refetch } = useApiList<TransportRoute>({
    path: '/transport/routes',
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TransportRoute | null>(null);
  const [stopsRoute, setStopsRoute] = useState<TransportRoute | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TransportRoute | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canWrite && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" />
            New Route
          </Button>
        )}
      </div>

      {error && <ErrorBox message={error} />}

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Name</TH>
            <TH>Vehicle</TH>
            <TH>Monthly Fee</TH>
            <TH>Stops</TH>
            <TH>Students</TH>
            <TH>Active</TH>
            <TH className="text-right">Actions</TH>
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
              <TD colSpan={7} className="py-8 text-center text-muted-foreground">No routes defined. Add your first route.</TD>
            </TR>
          )}
          {!loading && rows.map((r) => (
            <TR key={r.id}>
              <TD className="font-medium text-foreground">{r.name}</TD>
              <TD className="font-mono text-xs">{r.vehicleRegNo ?? '—'}</TD>
              <TD className="font-mono">{money(r.monthlyFee)}</TD>
              <TD>{r.stopCount}</TD>
              <TD>{r.studentCount}</TD>
              <TD><Badge variant={r.isActive ? 'success' : 'default'}>{r.isActive ? 'Active' : 'Inactive'}</Badge></TD>
              <TD className="text-right">
                <RowMenu items={[
                  { label: 'Manage Stops', onClick: () => setStopsRoute(r) },
                  { label: 'Edit', onClick: () => { setEditing(r); setFormOpen(true); }, hidden: !canWrite },
                  { label: 'Delete', onClick: () => setDeleteTarget(r), danger: true, hidden: !canWrite },
                ]} />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Pagination meta={meta} page={page} onPage={setPage} noun="routes" />

      <RouteFormDialog open={formOpen} route={editing} onClose={() => setFormOpen(false)} onSaved={refetch} />

      {stopsRoute && (
        <StopsDialog route={stopsRoute} canWrite={canWrite} onClose={() => setStopsRoute(null)} />
      )}

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        title="Delete Route"
        message={`Delete route "${deleteTarget?.name}"?`}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.del(`/transport/routes/${deleteTarget.id}`);
          setDeleteTarget(null);
          refetch();
        }}
      />
    </div>
  );
}

function RouteFormDialog({ open, route, onClose, onSaved }: {
  open: boolean; route: TransportRoute | null; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [monthlyFee, setMonthlyFee] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { rows: vehicleList } = useApiList<{ id: string; regNo: string; vehicleType: string }>({ path: '/transport/vehicles', limit: 500 });
  const vehicleOptions = vehicleList.map(v => ({ value: v.id, label: `${v.regNo} (${v.vehicleType})` }));

  useEffect(() => {
    if (route) {
      setName(route.name); setDescription(route.description ?? '');
      setVehicleId(route.vehicleId ?? ''); setMonthlyFee(String(route.monthlyFee / 100));
    } else {
      setName(''); setDescription(''); setVehicleId(''); setMonthlyFee('');
    }
    setError(null);
  }, [route, open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const payload = {
        name, description: description || undefined,
        vehicleId: vehicleId || undefined, monthlyFee: toMinor(monthlyFee),
      };
      if (route) await api.patch(`/transport/routes/${route.id}`, payload);
      else await api.post('/transport/routes', payload);
      onSaved(); onClose();
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not save route.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={submit}>
        <DialogHeader title={route ? 'Edit Route' : 'New Route'} onClose={onClose} />
        <DialogBody className="space-y-4">
          {error && <ErrorBox message={error} />}
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Route name" /></Field>
          <Field label="Description"><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vehicle">
              <SearchableSelect
                value={vehicleOptions.find(o => o.value === vehicleId) || null}
                onChange={(val: any) => setVehicleId(val?.value || '')}
                options={vehicleOptions}
                isClearable
                placeholder="Select vehicle..."
              />
            </Field>
            <Field label="Monthly Fee (PKR)"><Input type="number" min="0" step="0.01" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} required placeholder="e.g. 2000" /></Field>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {route ? 'Save Changes' : 'Create'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function StopsDialog({ route, canWrite, onClose }: { route: TransportRoute; canWrite: boolean; onClose: () => void }) {
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [stopName, setStopName] = useState('');
  const [stopOrder, setStopOrder] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [dropTime, setDropTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get<RouteStop[]>(`/transport/routes/${route.id}/stops`)
      .then((r) => setStops((r.data ?? []).sort((a, b) => a.stopOrder - b.stopOrder)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [route.id]);

  useEffect(() => { load(); }, [load]);

  async function addStop(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      await api.post(`/transport/routes/${route.id}/stops`, {
        name: stopName, stopOrder: Number(stopOrder),
        pickupTime: pickupTime || undefined, dropTime: dropTime || undefined,
      });
      setStopName(''); setStopOrder(''); setPickupTime(''); setDropTime('');
      setAddOpen(false); load();
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not add stop.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteStop(stopId: string) {
    try {
      await api.del(`/transport/routes/${route.id}/stops/${stopId}`);
      load();
    } catch {
      setError('Could not delete stop.');
    }
  }

  return (
    <Dialog open onClose={onClose} className="max-w-2xl">
      <DialogHeader title={`Stops — ${route.name}`} onClose={onClose} />
      <DialogBody className="space-y-4 overflow-y-auto max-h-[60vh]">
        {error && <ErrorBox message={error} />}
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>#</TH>
                <TH>Stop Name</TH>
                <TH>Pickup</TH>
                <TH>Drop</TH>
                {canWrite && <TH className="text-right">Actions</TH>}
              </TR>
            </THead>
            <TBody>
              {stops.length === 0 && (
                <TR className="hover:bg-transparent">
                  <TD colSpan={5} className="py-6 text-center text-muted-foreground">No stops added yet.</TD>
                </TR>
              )}
              {stops.map((s) => (
                <TR key={s.id}>
                  <TD>{s.stopOrder}</TD>
                  <TD className="font-medium">{s.name}</TD>
                  <TD>{s.pickupTime ?? '—'}</TD>
                  <TD>{s.dropTime ?? '—'}</TD>
                  {canWrite && (
                    <TD className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => deleteStop(s.id)} className="text-red-600 hover:text-red-700">Delete</Button>
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        )}

        {canWrite && (
          addOpen ? (
            <form onSubmit={addStop} className="space-y-3 rounded-lg border border-border p-3">
              <p className="text-sm font-medium text-foreground">Add Stop</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Stop Name"><Input value={stopName} onChange={(e) => setStopName(e.target.value)} required placeholder="Stop name" /></Field>
                <Field label="Order"><Input type="number" min="1" value={stopOrder} onChange={(e) => setStopOrder(e.target.value)} required /></Field>
                <Field label="Pickup Time"><Input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} /></Field>
                <Field label="Drop Time"><Input type="time" value={dropTime} onChange={(e) => setDropTime(e.target.value)} /></Field>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={saving}>
                  {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                  Add Stop
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
              </div>
            </form>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Stop
            </Button>
          )
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </DialogFooter>
    </Dialog>
  );
}

// ─── Students tab ─────────────────────────────────────────────────────────────

function StudentsTab() {
  const { can } = useAuth();
  const canWrite = can('transport:write');

  const [routeId, setRouteId] = useState('');
  const [isActive, setIsActive] = useState('');

  const { rows, meta, loading, error, page, setPage, refetch } = useApiList<StudentTransport>({
    path: '/transport/students',
    params: { routeId: routeId || undefined, isActive: isActive || undefined },
  });

  const [assignOpen, setAssignOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudentTransport | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={routeId} onChange={(e) => setRouteId(e.target.value)} placeholder="Route ID…" className="pl-9 w-48" />
        </div>
        <Select value={isActive} onChange={(e) => setIsActive(e.target.value)} className="w-36">
          <option value="">All students</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </Select>
        <div className="ml-auto">
          {canWrite && (
            <Button onClick={() => setAssignOpen(true)}>
              <Plus className="h-4 w-4" />
              Assign Student
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
            <TH>Route</TH>
            <TH>Stop</TH>
            <TH>Monthly Fee</TH>
            <TH>Valid From</TH>
            <TH>Active</TH>
            {canWrite && <TH className="text-right">Actions</TH>}
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
              <TD colSpan={8} className="py-8 text-center text-muted-foreground">No students assigned to transport.</TD>
            </TR>
          )}
          {!loading && rows.map((s) => (
            <TR key={s.id}>
              <TD className="font-medium text-foreground">{s.studentName}</TD>
              <TD className="font-mono text-xs">{s.admissionNo}</TD>
              <TD>{s.routeName}</TD>
              <TD>{s.stopName ?? '—'}</TD>
              <TD className="font-mono">{money(s.monthlyFee)}</TD>
              <TD>{date(s.validFrom)}</TD>
              <TD><Badge variant={s.isActive ? 'success' : 'default'}>{s.isActive ? 'Active' : 'Inactive'}</Badge></TD>
              {canWrite && (
                <TD className="text-right">
                  <RowMenu items={[
                    { label: 'Deactivate', onClick: () => setDeleteTarget(s), danger: true },
                  ]} />
                </TD>
              )}
            </TR>
          ))}
        </TBody>
      </Table>

      <Pagination meta={meta} page={page} onPage={setPage} noun="students" />

      <AssignStudentDialog open={assignOpen} onClose={() => setAssignOpen(false)} onSaved={refetch} />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        title="Deactivate Transport"
        message={`Remove ${deleteTarget?.studentName} from transport assignment?`}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.del(`/transport/students/${deleteTarget.id}`);
          setDeleteTarget(null);
          refetch();
        }}
      />
    </div>
  );
}

function AssignStudentDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [studentId, setStudentId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [stopId, setStopId] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { rows: studentList } = useApiList<{ id: string; user: { firstName: string; lastName: string }; admissionNo: string }>({ path: '/students', limit: 1000 });
  const studentOptions = studentList.map(s => ({ value: s.id, label: `${s.user?.firstName || ''} ${s.user?.lastName || ''} (${s.admissionNo})` }));

  const { rows: routeList } = useApiList<{ id: string; name: string }>({ path: '/transport/routes', limit: 200 });
  const routeOptions = routeList.map(r => ({ value: r.id, label: r.name }));

  const [stopOptions, setStopOptions] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    if (routeId) {
      api.get<RouteStop[]>(`/transport/routes/${routeId}/stops`)
        .then(res => setStopOptions((res.data ?? []).sort((a, b) => a.stopOrder - b.stopOrder).map(s => ({ value: s.id, label: s.name }))))
        .catch(() => setStopOptions([]));
    } else {
      setStopOptions([]);
    }
  }, [routeId]);

  useEffect(() => {
    if (open) { setStudentId(''); setRouteId(''); setStopId(''); setValidFrom(''); setValidTo(''); setError(null); }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      await api.post('/transport/students', {
        studentId, routeId, stopId: stopId || undefined,
        validFrom: validFrom || undefined, validTo: validTo || undefined,
      });
      onSaved(); onClose();
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not assign student.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={submit}>
        <DialogHeader title="Assign Student to Transport" onClose={onClose} />
        <DialogBody className="space-y-4">
          {error && <ErrorBox message={error} />}
          <Field label="Student">
            <SearchableSelect
              value={studentOptions.find(o => o.value === studentId) || null}
              onChange={(val: any) => setStudentId(val?.value || '')}
              options={studentOptions}
              placeholder="Select student..."
              required
            />
          </Field>
          <Field label="Route">
            <SearchableSelect
              value={routeOptions.find(o => o.value === routeId) || null}
              onChange={(val: any) => { setRouteId(val?.value || ''); setStopId(''); }}
              options={routeOptions}
              placeholder="Select route..."
              required
            />
          </Field>
          <Field label="Stop (optional)">
            <SearchableSelect
              value={stopOptions.find(o => o.value === stopId) || null}
              onChange={(val: any) => setStopId(val?.value || '')}
              options={stopOptions}
              isDisabled={!routeId || stopOptions.length === 0}
              placeholder={!routeId ? "Select route first..." : "Select stop..."}
              isClearable
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valid From"><Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} /></Field>
            <Field label="Valid To (optional)"><Input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} /></Field>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Assign
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const [vehicles, setVehicles] = useState<{ total: number }>({ total: 0 });
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [students, setStudents] = useState<{ total: number }>({ total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    Promise.all([
      api.get<Vehicle[]>('/transport/vehicles?limit=1'),
      api.get<TransportRoute[]>('/transport/routes?limit=100'),
      api.get<StudentTransport[]>('/transport/students?isActive=true&limit=1'),
    ]).then(([v, r, s]) => {
      setVehicles({ total: v.meta?.total ?? (v.data ?? []).length });
      setRoutes(r.data ?? []);
      setStudents({ total: s.meta?.total ?? (s.data ?? []).length });
    }).catch(() => setError('Could not load overview data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      {error && <ErrorBox message={error} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Total Vehicles" value={vehicles.total} />
        <KpiCard label="Active Routes" value={routes.filter((r) => r.isActive).length} />
        <KpiCard label="Assigned Students" value={students.total} />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Active Routes</p>
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Route</TH>
              <TH>Vehicle</TH>
              <TH>Stops</TH>
              <TH>Students</TH>
              <TH>Monthly Fee</TH>
            </TR>
          </THead>
          <TBody>
            {routes.filter((r) => r.isActive).length === 0 && (
              <TR className="hover:bg-transparent">
                <TD colSpan={5} className="py-6 text-center text-muted-foreground">No active routes.</TD>
              </TR>
            )}
            {routes.filter((r) => r.isActive).map((r) => (
              <TR key={r.id}>
                <TD className="font-medium">{r.name}</TD>
                <TD className="font-mono text-xs">{r.vehicleRegNo ?? '—'}</TD>
                <TD>{r.stopCount}</TD>
                <TD>{r.studentCount}</TD>
                <TD className="font-mono">{money(r.monthlyFee)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
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

