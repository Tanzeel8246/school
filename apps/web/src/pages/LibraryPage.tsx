import { RoleGate } from '@/components/RoleGate';
import { NoAccess } from '@/components/NoAccess';
import { LibraryPage as LibraryFeature } from '@/features/library/LibraryPage';

/** Thin routing wrapper: guards the Library feature behind library:read permission. */
export function LibraryPage() {
  return (
    <RoleGate permission="library:read" fallback={<NoAccess />}>
      <LibraryFeature />
    </RoleGate>
  );
}
