import { RoleGate } from '@/components/RoleGate';
import { NoAccess } from '@/components/NoAccess';
import { TransportPage as TransportFeature } from '@/features/transport/TransportPage';

/** Thin routing wrapper: guards the Transport feature behind transport:read permission. */
export function TransportPage() {
  return (
    <RoleGate permission="transport:read" fallback={<NoAccess />}>
      <TransportFeature />
    </RoleGate>
  );
}
