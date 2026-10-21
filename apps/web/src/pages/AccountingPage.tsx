import { RoleGate } from '@/components/RoleGate';
import { NoAccess } from '@/components/NoAccess';
import { AccountingPage as AccountingFeature } from '@/features/accounting/AccountingPage';

/** Thin routing wrapper: guards the Accounting feature behind accounting:read permission. */
export function AccountingPage() {
  return (
    <RoleGate permission="accounting:read" fallback={<NoAccess />}>
      <AccountingFeature />
    </RoleGate>
  );
}
