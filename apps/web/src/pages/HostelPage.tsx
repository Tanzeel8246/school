import { RoleGate } from '@/components/RoleGate';
import { NoAccess } from '@/components/NoAccess';
import { HostelPage as HostelFeature } from '@/features/hostel/HostelPage';

/** Thin routing wrapper: guards the Hostel feature behind hostel:read permission. */
export function HostelPage() {
  return (
    <RoleGate permission="hostel:read" fallback={<NoAccess />}>
      <HostelFeature />
    </RoleGate>
  );
}
