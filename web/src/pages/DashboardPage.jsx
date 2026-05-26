import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Building2, Layers, BookOpen, Calendar, Users, Users2,
  BarChart2, Loader2, Crown,
} from 'lucide-react';
import { selectCurrentUser, selectRole } from '@/features/auth/authSlice';
import { useGetFacultiesQuery }   from '@/features/faculty/facultyApi';
import { useGetDepartmentsQuery } from '@/features/department/departmentApi';
import { useGetCoursesQuery }     from '@/features/course/courseApi';
import { useGetSemestersQuery }   from '@/features/semester/semesterApi';
import { useGetMyWorkspacesQuery } from '@/features/workspace/workspaceApi';
import { Badge } from '@/components/ui/badge';
import { useGetClassesQuery }     from '@/features/class/classApi';
import { useGetCourseAssignmentsQuery } from '@/features/courseAssignment/courseAssignmentApi';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';

// ── Shared stat card ──────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, count, to, iconBg, iconColor }) {
  return (
    <div className="rounded-lg border border-border bg-white p-5 shadow-xs">
      <div className="flex items-start justify-between mb-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-md shrink-0"
          style={{ background: iconBg }}
        >
          <Icon size={18} strokeWidth={1.75} style={{ color: iconColor }} />
        </div>
        {to && (
          <Link to={to} className="text-xs text-just-blue-600 hover:underline mt-0.5 shrink-0">
            View all →
          </Link>
        )}
      </div>
      <p className="text-2xl font-bold text-ink-900 leading-none">
        {count != null ? count : <span className="text-ink-300 text-xl">—</span>}
      </p>
      <p className="text-sm text-ink-500 mt-1">{label}</p>
    </div>
  );
}

// ── Admin dashboard ───────────────────────────────────────────────────────────

function AdminDashboard({ user }) {
  const { data: faculties   = [], isLoading: lF  } = useGetFacultiesQuery();
  const { data: departments = [], isLoading: lD  } = useGetDepartmentsQuery();
  const { data: courses     = [], isLoading: lC  } = useGetCoursesQuery();
  const { data: semesters   = [], isLoading: lS  } = useGetSemestersQuery();
  const { data: classes     = [], isLoading: lCl } = useGetClassesQuery();

  const semesterMap = useMemo(() => Object.fromEntries(semesters.map((s) => [s._id, s])), [semesters]);

  const recentClasses = classes.slice(0, 8);

  return (
    <div className="max-w-5xl">
      <p className="eyebrow mb-2">Overview</p>
      <h2 className="text-ink-900 mb-1">
        Welcome back, {user?.fullName?.split(' ')[0] ?? 'there'}
      </h2>
      <p className="text-ink-500 mb-8" style={{ fontSize: 'var(--fs-small)' }}>
        System overview — all figures are live from the database.
      </p>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <StatCard
          icon={Building2}  label="Faculties"
          count={lF  ? null : faculties.length}   to="/faculties"
          iconBg="var(--just-blue-50)"    iconColor="var(--just-blue-600)"
        />
        <StatCard
          icon={Layers}     label="Departments"
          count={lD  ? null : departments.length} to="/departments"
          iconBg="var(--just-blue-50)"    iconColor="var(--just-blue-600)"
        />
        <StatCard
          icon={BookOpen}   label="Courses"
          count={lC  ? null : courses.length}     to="/courses"
          iconBg="rgba(18,138,71,0.08)"   iconColor="var(--just-green-600)"
        />
        <StatCard
          icon={Calendar}   label="Semesters"
          count={lS  ? null : semesters.length}   to="/semesters"
          iconBg="rgba(232,197,71,0.12)"  iconColor="var(--just-gold-400)"
        />
        <StatCard
          icon={Users}      label="Classes"
          count={lCl ? null : classes.length}     to="/classes"
          iconBg="var(--just-blue-50)"    iconColor="var(--just-blue-600)"
        />
      </div>

      {/* Classes table */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-ink-800" style={{ fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
          Classes
        </h3>
        {classes.length > 0 && (
          <Button variant="ghost" size="sm" asChild className="text-xs text-just-blue-600 -mr-2">
            <Link to="/classes">All classes →</Link>
          </Button>
        )}
      </div>

      {lCl ? (
        <div className="flex justify-center py-10 rounded-lg border border-border bg-white">
          <Loader2 size={20} className="animate-spin text-ink-300" />
        </div>
      ) : classes.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-10 text-center">
          <p className="text-sm text-ink-400 mb-3">No classes yet.</p>
          <Button size="sm" asChild>
            <Link to="/classes">Create first class</Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-white shadow-xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead>Courses</TableHead>
                <TableHead>Semester</TableHead>
                <TableHead className="w-36" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentClasses.map((cls) => {
                const semester = semesterMap[cls.semesterId];
                return (
                  <TableRow key={cls._id}>
                    <TableCell className="font-medium text-ink-800">{cls.name}</TableCell>
                    <TableCell>
                      {cls.courseIds?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {cls.courseIds.map((c) => (
                            <span key={c._id ?? c} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs bg-ink-100 text-ink-700">
                              {c.code && <span className="font-mono text-ink-400">{c.code}</span>}
                              {c.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-ink-300 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-ink-500">
                      {semester
                        ? `${semester.name} · ${semester.year}`
                        : <span className="text-ink-300 text-xs">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 text-xs gap-1 text-just-blue-600"
                          asChild
                        >
                          <Link to={`/classes/${cls._id}/students`}>
                            <Users size={12} /> Students
                          </Link>
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 text-xs gap-1 text-just-blue-600"
                          asChild
                        >
                          <Link to={`/classes/${cls._id}/groups`}>
                            <Users2 size={12} /> Groups
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {classes.length > 8 && (
            <div className="px-4 py-2.5 border-t border-border bg-ink-50/30 text-right">
              <Link to="/classes" className="text-xs text-just-blue-600 hover:underline">
                +{classes.length - 8} more →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Instructor dashboard ──────────────────────────────────────────────────────

const CATEGORY_VARIANT = { HIGH: 'success', MEDIUM: 'default', LOW: 'destructive' };

function InstructorDashboard({ user }) {
  const { data: assignments = [], isLoading } = useGetCourseAssignmentsQuery();
  const { data: semesters   = [] }            = useGetSemestersQuery();

  const semesterMap = useMemo(() => Object.fromEntries(semesters.map((s) => [s._id, s])), [semesters]);

  // Group assignments by class — each class can have multiple assigned courses
  const myClasses = useMemo(() => {
    const classMap = new Map();
    assignments.forEach((a) => {
      const cls = a.classId;
      if (!cls) return;
      const cid = String(cls._id ?? cls);
      if (!classMap.has(cid)) {
        classMap.set(cid, {
          _id:        cid,
          name:       cls.name,
          semesterId: cls.semesterId,
          courses:    [],
        });
      }
      if (a.courseId) classMap.get(cid).courses.push(a.courseId);
    });
    return [...classMap.values()];
  }, [assignments]);

  return (
    <div className="max-w-5xl">
      <p className="eyebrow mb-2">Overview</p>
      <h2 className="text-ink-900 mb-1">
        Welcome back, {user?.fullName?.split(' ')[0] ?? 'there'}
      </h2>
      <p className="text-ink-500 mb-8" style={{ fontSize: 'var(--fs-small)' }}>
        Manage your classes, scores, and student groups from here.
      </p>

      {/* My classes count */}
      <div className="mb-6 w-40">
        <StatCard
          icon={Users}
          label="My Classes"
          count={isLoading ? null : myClasses.length}
          iconBg="var(--just-blue-50)"
          iconColor="var(--just-blue-600)"
        />
      </div>

      <h3 className="text-ink-800 mb-3" style={{ fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
        My Classes
      </h3>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 size={20} className="animate-spin text-ink-300" />
        </div>
      ) : myClasses.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-10 text-center">
          <p className="text-sm text-ink-400">No classes assigned to you yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {myClasses.map((cls) => {
            const semester = semesterMap[cls.semesterId];
            return (
              <div
                key={cls._id}
                className="rounded-lg border border-border bg-white shadow-xs p-5 flex flex-col"
              >
                <div className="flex-1 mb-3">
                  <p className="font-semibold text-ink-800 text-base leading-snug mb-1">
                    {cls.name}
                  </p>
                  {cls.courses.map((c) => (
                    <p key={String(c._id ?? c)} className="text-sm text-ink-500">
                      {c.code && <span className="font-mono text-xs text-ink-400 mr-1">{c.code}</span>}
                      {c.name}
                    </p>
                  ))}
                  {semester && (
                    <p className="text-xs text-ink-400 mt-0.5">
                      {semester.name} · {semester.year}
                    </p>
                  )}
                </div>

                <div className="flex gap-1.5 flex-wrap pt-3 border-t border-border">
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
                    <Link to={`/classes/${cls._id}/students`}>
                      <Users size={12} /> Students
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
                    <Link to={`/classes/${cls._id}/scores`}>
                      <BarChart2 size={12} /> Scores
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
                    <Link to={`/classes/${cls._id}/groups`}>
                      <Users2 size={12} /> Groups
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Student dashboard ─────────────────────────────────────────────────────────

function StudentDashboard({ user }) {
  const { data: workspaces = [], isLoading } = useGetMyWorkspacesQuery();

  return (
    <div className="max-w-4xl">
      <p className="eyebrow mb-2">My Groups</p>
      <h2 className="text-ink-900 mb-1">
        Welcome, {user?.fullName?.split(' ')[0] ?? 'there'}
      </h2>
      <p className="text-ink-500 mb-8" style={{ fontSize: 'var(--fs-small)' }}>
        Your active group workspaces are listed below.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={22} className="animate-spin text-ink-300" />
        </div>
      ) : workspaces.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-12 text-center">
          <p className="text-sm text-ink-400">You have not been assigned to any group yet.</p>
          <p className="text-xs text-ink-300 mt-1">Check back after your instructor generates groups.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workspaces.map((ws) => {
            const group    = ws.groupId;
            const cls      = group?.classId;
            const course   = group?.courseId;
            const semester = cls?.semesterId;
            const leaderId = String(group?.leaderId?._id ?? group?.leaderId);

            return (
              <div
                key={ws._id}
                className="rounded-lg border border-border bg-white shadow-xs p-5 flex flex-col"
              >
                {/* Header */}
                <div className="mb-3">
                  <p className="text-xs text-ink-400 mb-0.5">
                    {cls?.name ?? '—'}
                    {semester && <> · {semester.name} {semester.year}</>}
                  </p>
                  <p className="font-semibold text-ink-800 text-base leading-snug">
                    {group?.name ?? '—'}
                  </p>
                  {course && (
                    <p className="text-sm text-ink-500 mt-0.5">
                      {course.code && <span className="font-mono text-xs text-ink-400 mr-1">{course.code}</span>}
                      {course.name}
                    </p>
                  )}
                </div>

                {/* Members */}
                <div className="flex-1 divide-y divide-border border-t border-border mt-2 pt-2">
                  {group?.memberIds?.map((m) => {
                    const isLeader = String(m._id) === leaderId;
                    return (
                      <div key={m._id} className="flex items-center gap-2 py-1.5 text-sm">
                        <span className="w-4 shrink-0 flex items-center">
                          {isLeader && <Crown size={11} style={{ color: 'var(--just-gold-400)' }} />}
                        </span>
                        <span className="flex-1 text-ink-800 truncate">{m.fullName}</span>
                        <Badge
                          variant={CATEGORY_VARIANT[m.performanceCategory] ?? 'secondary'}
                          className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                        >
                          {m.performanceCategory ?? 'UNG'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>

                {/* Link */}
                <div className="pt-3 mt-3 border-t border-border">
                  <Link
                    to={`/workspaces/${ws._id}`}
                    className="text-sm font-medium text-just-blue-600 hover:text-just-blue-700 hover:underline transition-colors"
                  >
                    Open workspace →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const user = useSelector(selectCurrentUser);
  const role = useSelector(selectRole);

  if (role === 'admin')      return <AdminDashboard user={user} />;
  if (role === 'instructor') return <InstructorDashboard user={user} />;
  return <StudentDashboard user={user} />;
}
