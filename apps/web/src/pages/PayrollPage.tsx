import { RoleGate } from '@/components/RoleGate';
import { NoAccess } from '@/components/NoAccess';
import { PayrollPage as PayrollFeature } from '@/features/payroll/PayrollPage';

/** Thin routing wrapper: guards the Payroll feature behind payroll:read permission. */
export function PayrollPage() {
  return (
    <RoleGate permission="payroll:read" fallback={<NoAccess />}>
      <PayrollFeature />
    </RoleGate>
  );
}
