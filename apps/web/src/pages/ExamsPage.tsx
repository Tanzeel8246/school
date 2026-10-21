import { RoleGate } from '@/components/RoleGate';
import { NoAccess } from '@/components/NoAccess';
import { ExamsPage as ExamsFeature } from '@/features/exams/ExamsPage';

/** Thin routing wrapper: gates the Exams feature behind results:read permission. */
export function ExamsPage() {
  return (
    <RoleGate permission="results:read" fallback={<NoAccess />}>
      <ExamsFeature />
    </RoleGate>
  );
}
