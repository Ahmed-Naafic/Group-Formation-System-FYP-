import { createBrowserRouter, Navigate } from 'react-router-dom';
import ProtectedRoute        from '@/components/auth/ProtectedRoute';
import AppShell              from '@/components/layout/AppShell';
import LoginPage             from '@/features/auth/LoginPage';
import ChangePasswordPage    from '@/features/auth/ChangePasswordPage';
import DashboardPage         from '@/pages/DashboardPage';
import FacultiesPage         from '@/features/faculty/FacultiesPage';
import DepartmentsPage       from '@/features/department/DepartmentsPage';
import CoursesPage           from '@/features/course/CoursesPage';
import SemestersPage         from '@/features/semester/SemestersPage';
import ClassesPage           from '@/features/class/ClassesPage';
import StudentsPage          from '@/features/student/StudentsPage';
import BulkUploadPage        from '@/features/student/BulkUploadPage';
import StudentDetailPage     from '@/features/student/StudentDetailPage';
import ScoresPage              from '@/features/performance/ScoresPage';
import PerformanceSettingsPage from '@/features/performance/PerformanceSettingsPage';
import GroupsPage              from '@/features/group/GroupsPage';
import GroupDetailPage         from '@/features/group/GroupDetailPage';
import InstructorsPage         from '@/features/courseAssignment/InstructorsPage';
import WorkspaceDetailPage     from '@/features/workspace/WorkspaceDetailPage';

function ComingSoon({ title }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="eyebrow mb-2">{title}</p>
      <p className="text-ink-400 text-sm">This section will be available in a future phase.</p>
    </div>
  );
}

export const router = createBrowserRouter([
  // ── Public ─────────────────────────────────────────────────────────────
  { path: '/login',           element: <LoginPage /> },
  { path: '/change-password', element: <ChangePasswordPage /> },

  // ── Protected — AppShell wraps all authenticated pages ─────────────────
  {
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      // Dashboard
      {
        index: true,
        element: <DashboardPage />,
        handle: { title: 'Dashboard' },
      },

      // ── Academic Structure (admin) ──────────────────────────────────────
      {
        path: '/faculties',
        element: <ProtectedRoute roles={['admin']}><FacultiesPage /></ProtectedRoute>,
        handle: { title: 'Faculties' },
      },
      {
        path: '/departments',
        element: <ProtectedRoute roles={['admin']}><DepartmentsPage /></ProtectedRoute>,
        handle: { title: 'Departments' },
      },
      {
        path: '/courses',
        element: <ProtectedRoute roles={['admin']}><CoursesPage /></ProtectedRoute>,
        handle: { title: 'Courses' },
      },
      {
        path: '/semesters',
        element: <ProtectedRoute roles={['admin']}><SemestersPage /></ProtectedRoute>,
        handle: { title: 'Semesters' },
      },

      // ── Classes (admin + instructor) ────────────────────────────────────
      {
        path: '/classes',
        element: <ClassesPage />,
        handle: { title: 'Classes' },
      },

      // ── Students (admin + instructor, scoped by class) ──────────────────
      {
        path: '/classes/:classId/students',
        element: <StudentsPage />,
        handle: { title: 'Students' },
      },
      {
        path: '/classes/:classId/students/upload',
        element: <ProtectedRoute roles={['admin']}><BulkUploadPage /></ProtectedRoute>,
        handle: { title: 'Upload Students' },
      },
      {
        path: '/students/:id',
        element: <StudentDetailPage />,
        handle: { title: 'Student' },
      },

      // ── Groups (admin + instructor, scoped by class) ──────────────────
      {
        path: '/classes/:classId/groups',
        element: <GroupsPage />,
        handle: { title: 'Groups' },
      },
      {
        path: '/groups/:id',
        element: <GroupDetailPage />,
        handle: { title: 'Group' },
      },

      // ── Scores & Attendance (admin + instructor, scoped by class) ──────
      {
        path: '/classes/:classId/scores',
        element: <ScoresPage />,
        handle: { title: 'Scores' },
      },

      // ── Settings (admin) ───────────────────────────────────────────────
      {
        path: '/settings/performance',
        element: <ProtectedRoute roles={['admin']}><PerformanceSettingsPage /></ProtectedRoute>,
        handle: { title: 'Performance Settings' },
      },

      // ── Instructor assignments (admin) ─────────────────────────────────
      {
        path: '/instructors',
        element: <ProtectedRoute roles={['admin']}><InstructorsPage /></ProtectedRoute>,
        handle: { title: 'Instructors' },
      },

      // ── Student workspaces ─────────────────────────────────────────────
      {
        path: '/workspaces',
        element: <ProtectedRoute roles={['student']}><DashboardPage /></ProtectedRoute>,
        handle: { title: 'My Groups' },
      },
      {
        path: '/workspaces/:id',
        element: <ProtectedRoute roles={['admin', 'instructor', 'student']}><WorkspaceDetailPage /></ProtectedRoute>,
        handle: { title: 'Workspace' },
      },
    ],
  },

  // ── Catch-all ───────────────────────────────────────────────────────────
  { path: '*', element: <Navigate to="/" replace /> },
]);
