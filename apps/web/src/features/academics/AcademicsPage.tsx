import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SessionsTab } from './SessionsTab';
import { ClassesTab } from './ClassesTab';
import { SectionsTab } from './SectionsTab';
import { SubjectsTab } from './SubjectsTab';
import { TimetableTab } from './TimetableTab';

export function AcademicsPage() {
  const { can } = useAuth();
  const canRead = can('academics:read');

  const [tab, setTab] = useState('sessions');

  if (!canRead) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-semibold text-foreground">Access Denied</p>
        <p className="mt-1 text-sm text-muted-foreground">
          You need the academics:read permission to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Academic Setup</h1>
        <p className="text-sm text-muted-foreground">
          Manage sessions, classes, sections, subjects and timetables.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="timetable">Timetable</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions">
          <SessionsTab />
        </TabsContent>
        <TabsContent value="classes">
          <ClassesTab />
        </TabsContent>
        <TabsContent value="sections">
          <SectionsTab />
        </TabsContent>
        <TabsContent value="subjects">
          <SubjectsTab />
        </TabsContent>
        <TabsContent value="timetable">
          <TimetableTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
