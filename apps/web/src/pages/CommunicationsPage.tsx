import { RoleGate } from '@/components/RoleGate';
import { NoAccess } from '@/components/NoAccess';
import { CommunicationsPage as CommunicationsFeature } from '@/features/communications/CommunicationsPage';

/** Thin routing wrapper: gates the Communications feature behind communications:read permission. */
export function CommunicationsPage() {
  return (
    <RoleGate permission="communications:read" fallback={<NoAccess />}>
      <CommunicationsFeature />
    </RoleGate>
  );
}
