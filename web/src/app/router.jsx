import { createBrowserRouter, Navigate } from 'react-router-dom';
import ProtectedRoute        from '@/components/auth/ProtectedRoute';
import AppShell              from '@/components/layout/AppShell';
import LoginPage             from '@/features/auth/LoginPage';
import ChangePasswordPage    from '@/features/auth/ChangePasswordPage';
import DashboardPage         from '@/pages/DashboardPage';
import FacultiesPage         from '@/features/faculty/FacultiesPage';
import DepartmentsPage       from '@/features/department/DepartmentsPage';
import CoursesPage           from '@/features/course/CoursesPage';
import AcademicYearsPage     from '@/features/academicYear/AcademicYearsPage';
import SemestersPage         from '@/features/semester/SemestersPage';
import CohortsPage           from '@/features/cohort/CohortsPage';
import CourseOfferingsPage   from '@/features/courseOffering/CourseOfferingsPage';
import StudentsPage          from '@/features/student/StudentsPage';
import BulkUploadPage        from '@/features/student/BulkUploadPage';
import StudentDetailPage     from '@/features/student/StudentDetailPage';
import ScoresPage              from '@/features/performance/ScoresPage';
import PerformanceSettingsPage from '@/features/performance/PerformanceSettingsPage';
import GroupsPage              from '@/features/group/GroupsPage';
import GroupDetailPage         from '@/features/group/GroupDetailPage';
import GroupHistoryPage        from '@/features/group/GroupHistoryPage';
import UserManagementPage      from '@/features/user/UserManagementPage';
import WorkspaceDetailPage     from '@/features/workspace/WorkspaceDetailPage';
import TasksPage               from '@/features/task/TasksPage';
import TaskSubmissionsPage     from '@/features/task/TaskSubmissionsPage';
import NotificationsPage       from '@/features/notification/NotificationsPage';
import AuditLogPage            from '@/features/auditLog/AuditLogPage';
import ReportsPage             from '@/features/report/ReportsPage';
import AttendancePage          from '@/features/attendance/AttendancePage';

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
      { index: true, element: <DashboardPage />, handle: { title: 'Dashboard' } },

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
        path: '/academic-years',
        element: <ProtectedRoute roles={['admin']}><AcademicYearsPage /></ProtectedRoute>,
        handle: { title: 'Academic Years' },
      },
      {
        path: '/semesters',
        element: <ProtectedRoute roles={['admin']}><SemestersPage /></ProtectedRoute>,
        handle: { title: 'Semesters' },
      },

      // ── Operations (admin + instructor) ────────────────────────────────
      {
        path: '/cohorts',
        element: <ProtectedRoute roles={['admin', 'instructor']}><CohortsPage /></ProtectedRoute>,
        handle: { title: 'Cohorts' },
      },
      {
        path: '/course-offerings',
        element: <ProtectedRoute roles={['admin', 'instructor']}><CourseOfferingsPage /></ProtectedRoute>,
        handle: { title: 'Course Offerings' },
      },

      // ── Students (cohort-scoped) ────────────────────────────────────────
      {
        path: '/cohorts/:cohortId/students',
        element: <ProtectedRoute roles={['admin', 'instructor']}><StudentsPage /></ProtectedRoute>,
        handle: { title: 'Students' },
      },
      {
        path: '/cohorts/:cohortId/students/upload',
        element: <ProtectedRoute roles={['admin']}><BulkUploadPage /></ProtectedRoute>,
        handle: { title: 'Upload Students' },
      },
      {
        path: '/students/:id',
        element: <ProtectedRoute roles={['admin', 'instructor']}><StudentDetailPage /></ProtectedRoute>,
        handle: { title: 'Student' },
      },

      // ── Attendance (offering-scoped) ───────────────────────────────────
      {
        path: '/course-offerings/:offeringId/attendance',
        element: <ProtectedRoute roles={['admin', 'instructor']}><AttendancePage /></ProtectedRoute>,
        handle: { title: 'Attendance' },
      },

      // ── Groups (offering-scoped) ────────────────────────────────────────
      {
        path: '/course-offerings/:offeringId/groups',
        element: <ProtectedRoute roles={['admin', 'instructor']}><GroupsPage /></ProtectedRoute>,
        handle: { title: 'Groups' },
      },
      {
        path: '/groups/:id',
        element: <ProtectedRoute roles={['admin', 'instructor']}><GroupDetailPage /></ProtectedRoute>,
        handle: { title: 'Group' },
      },

      // ── Group History (offering-scoped, read-only) ──────────────────────
      {
        path: '/course-offerings/:offeringId/history',
        element: <ProtectedRoute roles={['admin', 'instructor']}><GroupHistoryPage /></ProtectedRoute>,
        handle: { title: 'Group History' },
      },

      // ── Tasks (offering-scoped) ─────────────────────────────────────────
      {
        path: '/course-offerings/:offeringId/tasks',
        element: <ProtectedRoute roles={['admin', 'instructor']}><TasksPage /></ProtectedRoute>,
        handle: { title: 'Tasks' },
      },
      {
        path: '/tasks/:taskId/submissions',
        element: <ProtectedRoute roles={['admin', 'instructor']}><TaskSubmissionsPage /></ProtectedRoute>,
        handle: { title: 'Submissions' },
      },

      // ── Scores (cohort-scoped) ──────────────────────────────────────────
      {
        path: '/cohorts/:cohortId/scores',
        element: <ProtectedRoute roles={['admin', 'instructor']}><ScoresPage /></ProtectedRoute>,
        handle: { title: 'Scores' },
      },

      // ── Settings ────────────────────────────────────────────────────────
      {
        path: '/settings/performance',
        element: <ProtectedRoute roles={['admin', 'instructor']}><PerformanceSettingsPage /></ProtectedRoute>,
        handle: { title: 'Performance Settings' },
      },
      {
        path: '/reports',
        element: <ProtectedRoute roles={['admin', 'instructor']}><ReportsPage /></ProtectedRoute>,
        handle: { title: 'Reports' },
      },
      {
        path: '/audit',
        element: <ProtectedRoute roles={['admin']}><AuditLogPage /></ProtectedRoute>,
        handle: { title: 'Audit Log' },
      },

      // ── Users ────────────────────────────────────────────────────────────
      {
        path: '/users',
        element: <ProtectedRoute roles={['admin']}><UserManagementPage /></ProtectedRoute>,
        handle: { title: 'User Management' },
      },
      { path: '/instructors', element: <Navigate to="/users" replace /> },

      // ── Notifications ─────────────────────────────────────────────────
      {
        path: '/notifications',
        element: <NotificationsPage />,
        handle: { title: 'Notifications' },
      },

      // ── Workspaces ─────────────────────────────────────────────────────
      {
        path: '/workspaces/:id',
        element: <ProtectedRoute roles={['admin', 'instructor', 'student']}><WorkspaceDetailPage /></ProtectedRoute>,
        handle: { title: 'Workspace' },
      },
    ],
  },

  { path: '*', element: <Navigate to="/" replace /> },
]);
