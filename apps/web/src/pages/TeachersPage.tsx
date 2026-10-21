import { RoleGate } from '@/components/RoleGate';
import { TeachersPage as TeachersFeature } from '@/features/teachers/TeachersPage';
import { NoAccess } from '@/components/NoAccess';

/** Route page: gates the Teachers feature behind teachers:read. */
export function TeachersPage() {
  return (
    <RoleGate permission="teachers:read" fallback={<NoAccess />}>
      <TeachersFeature />
    </RoleGate>
  );
}
