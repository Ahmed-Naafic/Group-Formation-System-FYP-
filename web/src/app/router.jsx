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
import TasksPage               from '@/features/task/TasksPage';
import TaskSubmissionsPage     from '@/features/task/TaskSubmissionsPage';
import NotificationsPage       from '@/features/notification/NotificationsPage';
import AuditLogPage            from '@/features/auditLog/AuditLogPage';
import ReportsPage             from '@/features/report/ReportsPage';

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

      // ── Classes (legacy — removed in Step 10) ──────────────────────────
      {
        path: '/classes',
        element: <ProtectedRoute roles={['admin', 'instructor']}><ClassesPage /></ProtectedRoute>,
        handle: { title: 'Classes' },
      },

      // ── Students (scoped by class — rewired to cohort in Step 9) ────────
      {
        path: '/classes/:classId/students',
        element: <ProtectedRoute roles={['admin', 'instructor']}><StudentsPage /></ProtectedRoute>,
        handle: { title: 'Students' },
      },
      {
        path: '/classes/:classId/students/upload',
        element: <ProtectedRoute roles={['admin']}><BulkUploadPage /></ProtectedRoute>,
        handle: { title: 'Upload Students' },
      },
      {
        path: '/students/:id',
        element: <ProtectedRoute roles={['admin', 'instructor']}><StudentDetailPage /></ProtectedRoute>,
        handle: { title: 'Student' },
      },

      // ── Groups (rewired to courseOfferingId in Step 9) ──────────────────
      {
        path: '/classes/:classId/groups',
        element: <ProtectedRoute roles={['admin', 'instructor']}><GroupsPage /></ProtectedRoute>,
        handle: { title: 'Groups' },
      },
      {
        path: '/groups/:id',
        element: <ProtectedRoute roles={['admin', 'instructor']}><GroupDetailPage /></ProtectedRoute>,
        handle: { title: 'Group' },
      },

      // ── Tasks & Submissions ─────────────────────────────────────────────
      {
        path: '/classes/:classId/tasks',
        element: <ProtectedRoute roles={['admin', 'instructor']}><TasksPage /></ProtectedRoute>,
        handle: { title: 'Tasks' },
      },
      {
        path: '/tasks/:taskId/submissions',
        element: <ProtectedRoute roles={['admin', 'instructor']}><TaskSubmissionsPage /></ProtectedRoute>,
        handle: { title: 'Submissions' },
      },

      // ── Scores (rewired to cohort in Step 9) ────────────────────────────
      {
        path: '/classes/:classId/scores',
        element: <ProtectedRoute roles={['admin', 'instructor']}><ScoresPage /></ProtectedRoute>,
        handle: { title: 'Scores' },
      },

      // ── Settings ────────────────────────────────────────────────────────
      {
        path: '/settings/performance',
        element: <ProtectedRoute roles={['admin']}><PerformanceSettingsPage /></ProtectedRoute>,
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
        path: '/instructors',
        element: <ProtectedRoute roles={['admin']}><InstructorsPage /></ProtectedRoute>,
        handle: { title: 'Instructors' },
      },

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
