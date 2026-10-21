import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { SchoolsList } from '@/features/schools/SchoolsList';

export function SchoolsPage() {
  const { can } = useAuth();
  
  // This page requires the 'schools:read' permission (super_admin)
  if (!can('schools:read')) {
    return (
      <Card className="mx-auto max-w-lg mt-12">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <ShieldAlert className="h-6 w-6" />
          </span>
          <h2 className="text-lg font-semibold text-foreground">Access Denied</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            You do not have permission to view or manage schools. This area is restricted to Super Administrators.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SchoolsList />
    </div>
  );
}
