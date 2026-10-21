/**
 * InventoryPage — 4 tabs: Items | Purchase Orders | Low Stock | Transactions
 */
import { useEffect, useState } from 'react';
import { Package, Plus, Loader2, Search, AlertTriangle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useApiList } from '@/hooks/useApiList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
// Card/CardContent not used in this page
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { RowMenu } from '@/components/RowMenu';
import { Pagination } from '@/components/Pagination';
import { money, toMinor, date } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
  InventoryCategory, InventoryItem,
  PurchaseOrder, PoLine, StockTransaction,
} from '@/lib/dto';

// ─── Tab bar ──────────────────────────────────────────────────────────────────

type Tab = 'items' | 'orders' | 'lowstock' | 'transactions';

const TABS: { id: Tab; label: string }[] = [
  { id: 'items', label: 'Items' },
  { id: 'orders', label: 'Purchase Orders' },
  { id: 'lowstock', label: 'Low Stock' },
  { id: 'transactions', label: 'Transactions' },
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

export function InventoryPage() {
  const [tab, setTab] = useState<Tab>('items');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Package className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Inventory</h1>
          <p className="text-sm text-muted-foreground">Manage items, purchase orders, stock levels and transactions.</p>
        </div>
      </div>

      <TabBar active={tab} onChange={setTab} />

      {tab === 'items' && <ItemsTab />}
      {tab === 'orders' && <OrdersTab />}
      {tab === 'lowstock' && <LowStockTab />}
      {tab === 'transactions' && <TransactionsTab />}
    </div>
  );
}

// ─── Items tab ────────────────────────────────────────────────────────────────

function ItemsTab() {
  const { can } = useAuth();
  const canWrite = can('inventory:write');

  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<InventoryCategory[]>([]);

  const { rows, meta, loading, error, query, page, setQuery, setPage, refetch } = useApiList<InventoryItem>({
    path: '/inventory/items',
    params: { categoryId: categoryId || undefined },
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const [stockOutItem, setStockOutItem] = useState<InventoryItem | null>(null);

  useEffect(() => {
    api.get<InventoryCategory[]>('/inventory/categories?limit=100')
      .then((r) => setCategories(r.data ?? []))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search items…" className="pl-9 w-56" />
        </div>
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-44">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <div className="ml-auto">
          {canWrite && (
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" />
              New Item
            </Button>
          )}
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Name</TH>
            <TH>SKU</TH>
            <TH>Category</TH>
            <TH>Unit</TH>
            <TH>In Stock</TH>
            <TH>Reorder</TH>
            <TH>Unit Cost</TH>
            <TH>Status</TH>
            <TH className="text-right">Actions</TH>
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
              <TD colSpan={9} className="py-8 text-center text-muted-foreground">No items found. Add your first item.</TD>
            </TR>
          )}
          {!loading && rows.map((item) => (
            <TR key={item.id}>
              <TD className="font-medium text-foreground">{item.name}</TD>
              <TD className="font-mono text-xs">{item.sku ?? '—'}</TD>
              <TD>{item.categoryName ?? '—'}</TD>
              <TD>{item.unit}</TD>
              <TD className={cn('font-medium', item.isLowStock ? 'text-red-600' : 'text-foreground')}>
                {item.quantityInStock}
              </TD>
              <TD>{item.reorderLevel}</TD>
              <TD className="font-mono">{money(item.unitCost)}</TD>
              <TD>
                {item.isLowStock ? (
                  <Badge variant="destructive">Low Stock</Badge>
                ) : (
                  <Badge variant="success">OK</Badge>
                )}
              </TD>
              <TD className="text-right">
                <RowMenu items={[
                  { label: 'Edit', onClick: () => { setEditing(item); setFormOpen(true); }, hidden: !canWrite },
                  { label: 'Stock Out', onClick: () => setStockOutItem(item), hidden: !canWrite },
                  { label: 'Delete', onClick: () => setDeleteTarget(item), danger: true, hidden: !canWrite },
                ]} />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Pagination meta={meta} page={page} onPage={setPage} noun="items" />

      <ItemFormDialog open={formOpen} item={editing} categories={categories} onClose={() => setFormOpen(false)} onSaved={refetch} />

      {stockOutItem && (
        <StockOutDialog item={stockOutItem} onClose={() => setStockOutItem(null)} onDone={() => { setStockOutItem(null); refetch(); }} />
      )}

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        title="Delete Item"
        message={`Delete "${deleteTarget?.name}"?`}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.del(`/inventory/items/${deleteTarget.id}`);
          setDeleteTarget(null);
          refetch();
        }}
      />
    </div>
  );
}

function ItemFormDialog({ open, item, categories, onClose, onSaved }: {
  open: boolean; item: InventoryItem | null; categories: InventoryCategory[];
  onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unit, setUnit] = useState('');
  const [quantityInStock, setQuantityInStock] = useState('0');
  const [reorderLevel, setReorderLevel] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setName(item.name); setSku(item.sku ?? ''); setCategoryId(item.categoryId ?? '');
      setUnit(item.unit); setQuantityInStock(String(item.quantityInStock));
      setReorderLevel(String(item.reorderLevel)); setUnitCost(String(item.unitCost / 100));
      setLocation(item.location ?? '');
    } else {
      setName(''); setSku(''); setCategoryId(''); setUnit('');
      setQuantityInStock('0'); setReorderLevel(''); setUnitCost(''); setLocation('');
    }
    setError(null);
  }, [item, open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const payload = {
        name, sku: sku || undefined, categoryId: categoryId || undefined,
        unit, quantityInStock: Number(quantityInStock),
        reorderLevel: Number(reorderLevel), unitCost: toMinor(unitCost),
        location: location || undefined,
      };
      if (item) await api.patch(`/inventory/items/${item.id}`, payload);
      else await api.post('/inventory/items', payload);
      onSaved(); onClose();
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not save item.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={submit}>
        <DialogHeader title={item ? 'Edit Item' : 'New Item'} onClose={onClose} />
        <DialogBody className="space-y-4 overflow-y-auto max-h-[70vh]">
          {error && <ErrorBox message={error} />}
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Item name" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU (optional)"><Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU code" /></Field>
            <Field label="Category">
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">No category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Unit"><Input value={unit} onChange={(e) => setUnit(e.target.value)} required placeholder="e.g. pcs, kg, litre" /></Field>
            <Field label="Unit Cost (PKR)"><Input type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} required placeholder="e.g. 150" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Qty in Stock"><Input type="number" min="0" value={quantityInStock} onChange={(e) => setQuantityInStock(e.target.value)} /></Field>
            <Field label="Reorder Level"><Input type="number" min="0" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} /></Field>
          </div>
          <Field label="Location (optional)"><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Store Room A" /></Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {item ? 'Save Changes' : 'Create'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function StockOutDialog({ item, onClose, onDone }: { item: InventoryItem; onClose: () => void; onDone: () => void }) {
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      await api.post('/inventory/stock-out', { itemId: item.id, quantity: Number(quantity), notes: notes || undefined });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not process stock out.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose}>
      <form onSubmit={submit}>
        <DialogHeader title="Stock Out" description={item.name} onClose={onClose} />
        <DialogBody className="space-y-4">
          {error && <ErrorBox message={error} />}
          <p className="text-sm text-muted-foreground">Current stock: <strong>{item.quantityInStock} {item.unit}</strong></p>
          <Field label="Quantity to Issue">
            <Input type="number" min="1" max={item.quantityInStock} value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          </Field>
          <Field label="Notes (optional)">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason / destination…" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// ─── Purchase Orders tab ──────────────────────────────────────────────────────

const PO_STATUS_VARIANT: Record<string, 'default' | 'warning' | 'success' | 'destructive'> = {
  draft: 'default',
  ordered: 'warning',
  received: 'success',
  cancelled: 'destructive',
};

function OrdersTab() {
  const { can } = useAuth();
  const canManage = can('inventory:manage');

  const [status, setStatus] = useState('');

  const { rows, meta, loading, error, page, setPage, refetch } = useApiList<PurchaseOrder>({
    path: '/inventory/orders',
    params: { status: status || undefined },
  });

  const [newOpen, setNewOpen] = useState(false);
  const [viewOrder, setViewOrder] = useState<PurchaseOrder | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  async function openDetail(po: PurchaseOrder) {
    setViewLoading(true);
    try {
      const res = await api.get<PurchaseOrder>(`/inventory/orders/${po.id}`);
      setViewOrder(res.data);
    } catch {
      setViewOrder(po);
    } finally {
      setViewLoading(false);
    }
  }

  async function updateStatus(id: string, s: PurchaseOrder['status']) {
    try {
      await api.patch(`/inventory/orders/${id}/status`, { status: s });
      refetch();
    } catch {
      // ignore
    }
  }

  async function receiveOrder(id: string) {
    try {
      await api.patch(`/inventory/orders/${id}/receive`, {});
      refetch();
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="ordered">Ordered</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </Select>
        <div className="ml-auto">
          {canManage && (
            <Button onClick={() => setNewOpen(true)}>
              <Plus className="h-4 w-4" />
              New PO
            </Button>
          )}
        </div>
      </div>

      {error && <ErrorBox message={error} />}
      {viewLoading && <div className="flex justify-center py-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>}

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>PO No</TH>
            <TH>Vendor</TH>
            <TH>Order Date</TH>
            <TH>Lines</TH>
            <TH>Total</TH>
            <TH>Status</TH>
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
              <TD colSpan={7} className="py-8 text-center text-muted-foreground">No purchase orders found.</TD>
            </TR>
          )}
          {!loading && rows.map((po) => (
            <TR key={po.id}>
              <TD className="font-mono text-xs">{po.poNo}</TD>
              <TD className="font-medium text-foreground">{po.vendorName}</TD>
              <TD>{date(po.orderDate)}</TD>
              <TD>{po.lineCount}</TD>
              <TD className="font-mono">{money(po.totalAmount)}</TD>
              <TD><Badge variant={PO_STATUS_VARIANT[po.status] ?? 'default'}>{po.status}</Badge></TD>
              <TD className="text-right">
                <RowMenu items={[
                  { label: 'View', onClick: () => openDetail(po) },
                  { label: 'Mark Ordered', onClick: () => updateStatus(po.id, 'ordered'), hidden: !canManage || po.status !== 'draft' },
                  { label: 'Receive', onClick: () => receiveOrder(po.id), hidden: !canManage || po.status !== 'ordered' },
                  { label: 'Cancel', onClick: () => updateStatus(po.id, 'cancelled'), danger: true, hidden: !canManage || po.status === 'received' || po.status === 'cancelled' },
                ]} />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Pagination meta={meta} page={page} onPage={setPage} noun="orders" />

      <NewPoDialog open={newOpen} onClose={() => setNewOpen(false)} onSaved={refetch} />

      {viewOrder && (
        <PoDetailDialog order={viewOrder} onClose={() => setViewOrder(null)} />
      )}
    </div>
  );
}

function NewPoDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [vendorId, setVendorId] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Array<{ itemId: string; quantity: string; unitCost: string }>>([
    { itemId: '', quantity: '', unitCost: '' }
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setVendorId(''); setExpectedDelivery(''); setNotes('');
      setLines([{ itemId: '', quantity: '', unitCost: '' }]);
      setError(null);
    }
  }, [open]);

  function updateLine(idx: number, field: keyof typeof lines[0], val: string) {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l));
  }

  function addLine() { setLines((prev) => [...prev, { itemId: '', quantity: '', unitCost: '' }]); }
  function removeLine(idx: number) { setLines((prev) => prev.filter((_, i) => i !== idx)); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      await api.post('/inventory/orders', {
        vendorId, expectedDelivery: expectedDelivery || undefined,
        notes: notes || undefined,
        lines: lines.map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity), unitCost: toMinor(l.unitCost) })),
      });
      onSaved(); onClose();
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not create purchase order.');
    } finally {
      setSaving(false);
    }
  }

  const lineTotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * toMinor(l.unitCost), 0);

  return (
    <Dialog open={open} onClose={onClose} className="max-w-2xl">
      <form onSubmit={submit}>
        <DialogHeader title="New Purchase Order" onClose={onClose} />
        <DialogBody className="space-y-4 overflow-y-auto max-h-[70vh]">
          {error && <ErrorBox message={error} />}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vendor ID"><Input value={vendorId} onChange={(e) => setVendorId(e.target.value)} required placeholder="Vendor UUID" /></Field>
            <Field label="Expected Delivery"><Input type="date" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} /></Field>
          </div>
          <Field label="Notes (optional)"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}><Plus className="h-3 w-3" /> Add Line</Button>
            </div>
            {lines.map((l, idx) => (
              <div key={idx} className="grid grid-cols-7 gap-2 items-end">
                <div className="col-span-3">
                  {idx === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Item ID</Label>}
                  <Input value={l.itemId} onChange={(e) => updateLine(idx, 'itemId', e.target.value)} required placeholder="Item UUID" />
                </div>
                <div className="col-span-1">
                  {idx === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Qty</Label>}
                  <Input type="number" min="1" value={l.quantity} onChange={(e) => updateLine(idx, 'quantity', e.target.value)} required />
                </div>
                <div className="col-span-2">
                  {idx === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Unit Cost (PKR)</Label>}
                  <Input type="number" min="0" step="0.01" value={l.unitCost} onChange={(e) => updateLine(idx, 'unitCost', e.target.value)} required placeholder="0" />
                </div>
                <div className="col-span-1 flex justify-end">
                  {lines.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(idx)} className="text-red-500">✕</Button>
                  )}
                </div>
              </div>
            ))}
            <p className="text-right text-sm font-medium text-foreground">Total: {money(lineTotal)}</p>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Create PO
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function PoDetailDialog({ order, onClose }: { order: PurchaseOrder; onClose: () => void }) {
  const lines: PoLine[] = order.lines ?? [];

  return (
    <Dialog open onClose={onClose} className="max-w-2xl">
      <DialogHeader
        title={`PO — ${order.poNo}`}
        description={`${order.vendorName} · ${date(order.orderDate)}`}
        onClose={onClose}
      />
      <DialogBody className="space-y-4 overflow-y-auto max-h-[65vh]">
        <div className="flex items-center gap-3">
          <Badge variant={PO_STATUS_VARIANT[order.status] ?? 'default'}>{order.status}</Badge>
          {order.expectedDelivery && <span className="text-sm text-muted-foreground">Expected: {date(order.expectedDelivery)}</span>}
        </div>
        {order.notes && <p className="text-sm text-muted-foreground rounded-lg bg-muted/50 px-3 py-2">{order.notes}</p>}

        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Item</TH>
              <TH>Qty</TH>
              <TH>Unit Cost</TH>
              <TH className="text-right">Total</TH>
            </TR>
          </THead>
          <TBody>
            {lines.length === 0 && (
              <TR className="hover:bg-transparent">
                <TD colSpan={4} className="py-4 text-center text-muted-foreground">No line items.</TD>
              </TR>
            )}
            {lines.map((l) => (
              <TR key={l.id}>
                <TD className="font-medium">{l.itemName}</TD>
                <TD>{l.quantity}</TD>
                <TD className="font-mono">{money(l.unitCost)}</TD>
                <TD className="text-right font-mono">{money(l.total)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>

        <div className="rounded-lg border border-border px-4 py-3 text-right">
          <span className="text-sm font-semibold text-foreground">Grand Total: {money(order.totalAmount)}</span>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </DialogFooter>
    </Dialog>
  );
}

// ─── Low Stock tab ────────────────────────────────────────────────────────────

function LowStockTab() {
  const { rows, meta, loading, error, page, setPage } = useApiList<InventoryItem>({
    path: '/inventory/low-stock',
  });

  return (
    <div className="space-y-4">
      {rows.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <p className="text-sm font-medium text-amber-800">
            {meta?.total ?? rows.length} item{(meta?.total ?? rows.length) !== 1 ? 's' : ''} need reordering
          </p>
        </div>
      )}

      {error && <ErrorBox message={error} />}

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Name</TH>
            <TH>Category</TH>
            <TH>Unit</TH>
            <TH>In Stock</TH>
            <TH>Reorder Level</TH>
            <TH>Unit Cost</TH>
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
              <TD colSpan={6} className="py-8 text-center text-muted-foreground">All items are above reorder levels.</TD>
            </TR>
          )}
          {!loading && rows.map((item) => (
            <TR key={item.id}>
              <TD className="font-medium text-foreground">{item.name}</TD>
              <TD>{item.categoryName ?? '—'}</TD>
              <TD>{item.unit}</TD>
              <TD className="font-medium text-red-600">{item.quantityInStock}</TD>
              <TD>{item.reorderLevel}</TD>
              <TD className="font-mono">{money(item.unitCost)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Pagination meta={meta} page={page} onPage={setPage} noun="items" />
    </div>
  );
}

// ─── Transactions tab ─────────────────────────────────────────────────────────

const TXN_TYPE_STYLES: Record<string, string> = {
  in: 'bg-emerald-50 text-emerald-700',
  out: 'bg-red-50 text-red-700',
  adjustment: 'bg-orange-50 text-orange-700',
};

function TransactionsTab() {
  const [itemId, setItemId] = useState('');
  const [txnType, setTxnType] = useState('');

  const { rows, meta, loading, error, page, setPage } = useApiList<StockTransaction>({
    path: '/inventory/transactions',
    params: { itemId: itemId || undefined, txnType: txnType || undefined },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={itemId} onChange={(e) => setItemId(e.target.value)} placeholder="Item ID…" className="pl-9 w-48" />
        </div>
        <Select value={txnType} onChange={(e) => setTxnType(e.target.value)} className="w-40">
          <option value="">All types</option>
          <option value="in">In</option>
          <option value="out">Out</option>
          <option value="adjustment">Adjustment</option>
        </Select>
      </div>

      {error && <ErrorBox message={error} />}

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Item</TH>
            <TH>Type</TH>
            <TH>Quantity</TH>
            <TH>Reference</TH>
            <TH>Notes</TH>
            <TH>Date</TH>
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
              <TD colSpan={6} className="py-8 text-center text-muted-foreground">No transactions found.</TD>
            </TR>
          )}
          {!loading && rows.map((t) => (
            <TR key={t.id}>
              <TD className="font-medium text-foreground">{t.itemName}</TD>
              <TD>
                <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', TXN_TYPE_STYLES[t.txnType] ?? 'bg-muted text-foreground')}>
                  {t.txnType}
                </span>
              </TD>
              <TD className="font-medium">{t.quantity}</TD>
              <TD className="text-muted-foreground text-xs">{t.referenceType ?? '—'}</TD>
              <TD className="text-muted-foreground text-sm max-w-48 truncate">{t.notes ?? '—'}</TD>
              <TD className="text-muted-foreground text-sm">{date(t.txnAt)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Pagination meta={meta} page={page} onPage={setPage} noun="transactions" />
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

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
          Delete
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

