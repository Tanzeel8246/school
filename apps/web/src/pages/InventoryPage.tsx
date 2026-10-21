import { RoleGate } from '@/components/RoleGate';
import { NoAccess } from '@/components/NoAccess';
import { InventoryPage as InventoryFeature } from '@/features/inventory/InventoryPage';

/** Thin routing wrapper: guards the Inventory feature behind inventory:read permission. */
export function InventoryPage() {
  return (
    <RoleGate permission="inventory:read" fallback={<NoAccess />}>
      <InventoryFeature />
    </RoleGate>
  );
}
