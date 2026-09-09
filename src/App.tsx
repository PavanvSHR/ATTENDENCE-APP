import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { NotificationsPage } from "@/features/notifications/pages/NotificationsPage";

const AdminDashboardPage = lazy(() => import("@/features/admin/pages/AdminDashboardPage").then((m) => ({ default: m.AdminDashboardPage })));
const DepartmentsPage = lazy(() => import("@/features/admin/pages/DepartmentsPage").then((m) => ({ default: m.DepartmentsPage })));
const ClassesPage = lazy(() => import("@/features/admin/pages/ClassesPage").then((m) => ({ default: m.ClassesPage })));
const TeachersPage = lazy(() => import("@/features/admin/pages/TeachersPage").then((m) => ({ default: m.TeachersPage })));
const StudentsPage = lazy(() => import("@/features/admin/pages/StudentsPage").then((m) => ({ default: m.StudentsPage })));
const ClassRepresentativesPage = lazy(() =>
  import("@/features/admin/pages/ClassRepresentativesPage").then((m) => ({ default: m.ClassRepresentativesPage }))
);
const SettingsPolicyPage = lazy(() => import("@/features/admin/pages/SettingsPolicyPage").then((m) => ({ default: m.SettingsPolicyPage })));

const TeacherDashboardPage = lazy(() =>
  import("@/features/attendance/pages/TeacherDashboardPage").then((m) => ({ default: m.TeacherDashboardPage }))
);
const CreateSessionPage = lazy(() => import("@/features/attendance/pages/CreateSessionPage").then((m) => ({ default: m.CreateSessionPage })));
const LiveSessionPage = lazy(() => import("@/features/attendance/pages/LiveSessionPage").then((m) => ({ default: m.LiveSessionPage })));

const StudentDashboardPage = lazy(() =>
  import("@/features/attendance/pages/StudentDashboardPage").then((m) => ({ default: m.StudentDashboardPage }))
);
const StudentAttendancePage = lazy(() =>
  import("@/features/attendance/pages/StudentAttendancePage").then((m) => ({ default: m.StudentAttendancePage }))
);

const ReportsPage = lazy(() => import("@/features/reports/pages/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const AuditLogPage = lazy(() => import("@/features/audit/pages/AuditLogPage").then((m) => ({ default: m.AuditLogPage })));
const PrivacyPolicyPage = lazy(() => import("@/features/settings/pages/PrivacyPolicyPage").then((m) => ({ default: m.PrivacyPolicyPage })));
const ConsentPage = lazy(() => import("@/features/settings/pages/ConsentPage").then((m) => ({ default: m.ConsentPage })));

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingSpinner label="Loading page..." />}>{children}</Suspense>;
}

// Sign-in has been removed: every route below is reachable by anyone, with
// no auth or role gate. See src/auth/AuthContext.tsx for the fixed identity
// this app now runs as.
export function App() {
  return (
    <Routes>
      <Route
        path="/privacy-policy"
        element={
          <Lazy>
            <PrivacyPolicyPage />
          </Lazy>
        }
      />
      <Route
        path="/consent"
        element={
          <Lazy>
            <ConsentPage />
          </Lazy>
        }
      />

      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/notifications" element={<NotificationsPage />} />

        <Route
          path="/admin"
          element={
            <Lazy>
              <AdminDashboardPage />
            </Lazy>
          }
        />
        <Route
          path="/admin/departments"
          element={
            <Lazy>
              <DepartmentsPage />
            </Lazy>
          }
        />
        <Route
          path="/admin/classes"
          element={
            <Lazy>
              <ClassesPage />
            </Lazy>
          }
        />
        <Route
          path="/admin/teachers"
          element={
            <Lazy>
              <TeachersPage />
            </Lazy>
          }
        />
        <Route
          path="/admin/students"
          element={
            <Lazy>
              <StudentsPage />
            </Lazy>
          }
        />
        <Route
          path="/admin/class-representatives"
          element={
            <Lazy>
              <ClassRepresentativesPage />
            </Lazy>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <Lazy>
              <SettingsPolicyPage />
            </Lazy>
          }
        />
        <Route
          path="/audit-log"
          element={
            <Lazy>
              <AuditLogPage />
            </Lazy>
          }
        />

        <Route
          path="/reports"
          element={
            <Lazy>
              <ReportsPage />
            </Lazy>
          }
        />

        <Route
          path="/teacher"
          element={
            <Lazy>
              <TeacherDashboardPage />
            </Lazy>
          }
        />
        <Route
          path="/teacher/sessions/new"
          element={
            <Lazy>
              <CreateSessionPage />
            </Lazy>
          }
        />
        <Route
          path="/teacher/sessions/:sessionId"
          element={
            <Lazy>
              <LiveSessionPage />
            </Lazy>
          }
        />

        <Route
          path="/student"
          element={
            <Lazy>
              <StudentDashboardPage />
            </Lazy>
          }
        />
        <Route
          path="/student/attendance"
          element={
            <Lazy>
              <StudentAttendancePage />
            </Lazy>
          }
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
