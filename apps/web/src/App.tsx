import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { SchoolSetupPage } from '@/pages/SchoolSetupPage';
import { StudentsPage } from '@/pages/StudentsPage';
import { TeachersPage } from '@/pages/TeachersPage';
import { StaffPage } from '@/pages/StaffPage';
import { FeesPage } from '@/pages/FeesPage';
import { AccountingPage } from '@/pages/AccountingPage';
import { PayrollPage } from '@/pages/PayrollPage';
import { ExamsPage } from '@/pages/ExamsPage';
import { LibraryPage } from '@/pages/LibraryPage';
import { TransportPage } from '@/pages/TransportPage';
import { HostelPage } from '@/pages/HostelPage';
import { InventoryPage } from '@/pages/InventoryPage';
import { CommunicationsPage } from '@/pages/CommunicationsPage';
import { ReportsPageRoute } from '@/pages/ReportsPage';
import { ParentPortalPage } from '@/pages/ParentPortalPage';
import { AttendancePage } from '@/pages/AttendancePage';
import { AcademicsPage } from '@/pages/AcademicsPage';
import { SecuritySettingsPage } from '@/pages/SecuritySettingsPage';
import { TwoFaChallengePage } from '@/pages/TwoFaChallengePage';
import { SchoolsPage } from '@/pages/SchoolsPage';
import { BillingPage } from '@/pages/BillingPage';
import { SubscriptionRequestsPage } from '@/pages/admin/SubscriptionRequestsPage';
import { NotFound } from '@/pages/NotFound';

/** Sends '/' to the dashboard when authenticated, otherwise to login. */
function RootRedirect() {
  const { user, bootstrapping } = useAuth();
  if (bootstrapping) return null; // ProtectedRoute handles the visible loader elsewhere
  return <Navigate to={user ? '/dashboard' : '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* 2FA flows — public (no app shell) */}
      <Route path="/2fa/challenge" element={<TwoFaChallengePage />} />

      {/* Protected app shell */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/teachers" element={<TeachersPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/fees" element={<FeesPage />} />
        <Route path="/accounting" element={<AccountingPage />} />
        <Route path="/payroll" element={<PayrollPage />} />
        <Route path="/exams" element={<ExamsPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/transport" element={<TransportPage />} />
        <Route path="/hostel" element={<HostelPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/communications" element={<CommunicationsPage />} />
        <Route path="/reports" element={<ReportsPageRoute />} />
        <Route path="/parent" element={<ParentPortalPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/academics" element={<AcademicsPage />} />
        <Route path="/school-setup" element={<SchoolSetupPage />} />
        <Route path="/schools" element={<SchoolsPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/admin/requests" element={<SubscriptionRequestsPage />} />
        <Route path="/settings/security" element={<SecuritySettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Root redirect */}
      <Route path="/" element={<RootRedirect />} />
    </Routes>
  );
}
