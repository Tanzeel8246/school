import { RoleGate } from '@/components/RoleGate';
import { StaffPage as StaffFeature } from '@/features/staff/StaffPage';
import { NoAccess } from '@/components/NoAccess';

/** Route page: gates the Staff feature behind staff:read. */
export function StaffPage() {
  return (
    <RoleGate permission="staff:read" fallback={<NoAccess />}>
      <StaffFeature />
    </RoleGate>
  );
}
