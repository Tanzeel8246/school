import { RoleGate } from '@/components/RoleGate';
import { NoAccess } from '@/components/NoAccess';
import { FeesPage as FeesFeature } from '@/features/fees/FeesPage';

/** Thin routing wrapper: guards the Fees feature behind fees:read permission. */
export function FeesPage() {
  return (
    <RoleGate permission="fees:read" fallback={<NoAccess />}>
      <FeesFeature />
    </RoleGate>
  );
}
