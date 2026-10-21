import { ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

/** Standard "no permission" placeholder, matching SchoolSetupPage's gate. */
export function NoAccess({ message }: { message?: string }) {
  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <ShieldAlert className="h-6 w-6" />
        </span>
        <h2 className="text-lg font-semibold text-foreground">No access</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {message ?? "You don't have permission to view this section. Contact an administrator if you think this is a mistake."}
        </p>
      </CardContent>
    </Card>
  );
}
