import { useState } from 'react';
import { RoleGate } from '@/components/RoleGate';
import { StudentsPage as StudentsFeature } from '@/features/students/StudentsPage';
import { ParentsDirectory } from '@/features/students/ParentsDirectory';
import { NoAccess } from '@/components/NoAccess';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';

/** Route page: gates the Students feature behind students:read. */
export function StudentsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('students');
  const isTeacher = user?.role === 'teacher';
  
  return (
    <RoleGate permission="students:read" fallback={<NoAccess />}>
      {isTeacher ? (
        <StudentsFeature />
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="parents">Parents Directory</TabsTrigger>
          </TabsList>
          <TabsContent value="students">
            <StudentsFeature />
          </TabsContent>
          <TabsContent value="parents">
            <ParentsDirectory />
          </TabsContent>
        </Tabs>
      )}
    </RoleGate>
  );
}
