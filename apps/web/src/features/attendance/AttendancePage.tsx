import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MarkAttendance } from './MarkAttendance';
import { AttendanceReport } from './AttendanceReport';

export function AttendancePage() {
  const { can } = useAuth();
  const canMark = can('attendance:mark');
  const canRead = can('students:read');

  const [tab, setTab] = useState(canMark ? 'mark' : 'report');

  if (!canMark && !canRead) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-semibold text-foreground">Access Denied</p>
        <p className="mt-1 text-sm text-muted-foreground">
          You need attendance:mark or students:read permission to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Attendance</h1>
        <p className="text-sm text-muted-foreground">Mark daily attendance and view reports.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {canMark && <TabsTrigger value="mark">Mark Attendance</TabsTrigger>}
          <TabsTrigger value="report">Attendance Report</TabsTrigger>
        </TabsList>

        {canMark && (
          <TabsContent value="mark">
            <MarkAttendance />
          </TabsContent>
        )}
        <TabsContent value="report">
          <AttendanceReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
