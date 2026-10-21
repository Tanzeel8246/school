import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { NoAccess } from '@/components/NoAccess';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { StudentsReport } from './StudentsReport';
import { AttendanceReport } from './AttendanceReport';
import { FeesReport } from './FeesReport';
import { PayrollReport } from './PayrollReport';
import { AccountingReport } from './AccountingReport';

type TabValue = 'students' | 'attendance' | 'fees' | 'payroll' | 'accounting';

const TABS: { value: TabValue; label: string }[] = [
  { value: 'students', label: 'Students' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'fees', label: 'Fees' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'accounting', label: 'Accounting' },
];

/** Reports & Export hub — tabbed view of all report types. */
export function ReportsPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<TabValue>('students');

  if (!can('reports:read')) {
    return <NoAccess />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Reports &amp; Export</h1>
        <p className="text-sm text-muted-foreground">
          Filter, preview and download school-wide reports as PDF, Excel or CSV.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="students">
          <StudentsReport />
        </TabsContent>
        <TabsContent value="attendance">
          <AttendanceReport />
        </TabsContent>
        <TabsContent value="fees">
          <FeesReport />
        </TabsContent>
        <TabsContent value="payroll">
          <PayrollReport />
        </TabsContent>
        <TabsContent value="accounting">
          <AccountingReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
