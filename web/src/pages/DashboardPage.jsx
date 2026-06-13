import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Building2, Layers, BookOpen, Calendar, Users, Users2,
  BarChart2, Loader2, Crown, UserCheck, ClipboardList,
  Clock, AlertTriangle, AlertCircle,
} from 'lucide-react';
import { selectCurrentUser, selectRole } from '@/features/auth/authSlice';
import { useGetFacultiesQuery }   from '@/features/faculty/facultyApi';
import { useGetDepartmentsQuery } from '@/features/department/departmentApi';
import { useGetCoursesQuery }     from '@/features/course/courseApi';
import { useGetSemestersQuery }   from '@/features/semester/semesterApi';
import { useGetMyWorkspacesQuery } from '@/features/workspace/workspaceApi';
import { Badge } from '@/components/ui/badge';
import { useGetClassesQuery }     from '@/features/class/classApi';
import {
  useGetDashboardStatsQuery,
  useGetInstructorDashboardStatsQuery,
} from '@/features/dashboard/dashboardApi';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

// ── Submission breakdown ──────────────────────────────────────────────────────

const SUB_STATUS = [
  { key: 'draft',     label: 'Draft',     color: 'text-ink-500',           bg: 'bg-ink-100'        },
  { key: 'submitted', label: 'Submitted', color: 'text-just-blue-700',     bg: 'bg-just-blue-50'   },
  { key: 'late',      label: 'Late',      color: 'text-[var(--fg-warning)]', bg: 'bg-[var(--surface-warning)]' },
  { key: 'reviewed',  label: 'Reviewed',  color: 'text-success',           bg: 'bg-success/10'     },
];

function SubmissionBreakdown({ stats }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {SUB_STATUS.map(({ key, label, color, bg }) => (
        <div key={key} className={cn('rounded-lg px-3 py-3 text-center', bg)}>
          <p className={cn('text-2xl font-bold leading-none', color)}>
            {stats?.[key] ?? 0}
          </p>
          <p className={cn('text-[11px] font-semibold mt-1 uppercase tracking-wide', color)}>
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Recent activity ───────────────────────────────────────────────────────────

const ACTION_COLORS = {
  GROUP_GENERATED:   'bg-just-blue-100 text-just-blue-700',
  TASK_CREATED:      'bg-amber-100 text-amber-700',
  SUBMISSION_GRADED: 'bg-success/15 text-success',
  PASSWORD_RESET:    'bg-ink-100 text-ink-600',
};

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function RecentActivity({ entries }) {
  if (!entries?.length) {
    return <p className="text-sm text-ink-400 py-4 text-center">No recent activity.</p>;
  }
  return (
    <div className="divide-y divide-border">
      {entries.map((entry) => (
        <div key={entry._id} className="flex items-center gap-3 py-2.5">
          <span className={cn(
            'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap',
            ACTION_COLORS[entry.action] ?? 'bg-ink-100 text-ink-600',
          )}>
            {entry.action.replace(/_/g, ' ')}
          </span>
          <span className="flex-1 text-sm text-ink-700 truncate min-w-0">
            {entry.actorId?.fullName ?? '—'}
            <span className="text-ink-400 font-normal"> · {entry.entityKind}</span>
          </span>
          <span className="shrink-0 text-xs text-ink-400">{timeAgo(entry.timestamp)}</span>
        </div>
      ))}
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
  const { data: dash,             isLoading: lDash } = useGetDashboardStatsQuery();

  const semesterMap  = useMemo(() => Object.fromEntries(semesters.map((s) => [s._id, s])), [semesters]);
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

      {/* Row 1 — Academic structure */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
        <StatCard icon={Building2} label="Faculties"   count={lF   ? null : faculties.length}   to="/faculties"   iconBg="var(--just-blue-50)"   iconColor="var(--just-blue-600)" />
        <StatCard icon={Layers}    label="Departments" count={lD   ? null : departments.length} to="/departments" iconBg="var(--just-blue-50)"   iconColor="var(--just-blue-600)" />
        <StatCard icon={BookOpen}  label="Courses"     count={lC   ? null : courses.length}     to="/courses"     iconBg="rgba(18,138,71,0.08)" iconColor="var(--just-green-600)" />
        <StatCard icon={Calendar}  label="Semesters"   count={lS   ? null : semesters.length}   to="/semesters"   iconBg="rgba(232,197,71,0.12)" iconColor="var(--just-gold-400)" />
        <StatCard icon={Users}     label="Classes"     count={lCl  ? null : classes.length}     to="/classes"     iconBg="var(--just-blue-50)"   iconColor="var(--just-blue-600)" />
      </div>

      {/* Row 2 — Live stats from dashboard API */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard icon={UserCheck}     label="Active Users"    count={lDash ? null : dash?.counts?.users}        iconBg="rgba(18,138,71,0.08)"  iconColor="var(--just-green-600)" />
        <StatCard icon={Users2}        label="Students"        count={lDash ? null : dash?.counts?.students}     iconBg="var(--just-blue-50)"   iconColor="var(--just-blue-600)" />
        <StatCard icon={Users2}        label="Active Groups"   count={lDash ? null : dash?.counts?.activeGroups} iconBg="rgba(232,197,71,0.12)" iconColor="var(--just-gold-500)" />
        <StatCard icon={ClipboardList} label="Submissions"     count={lDash ? null : dash?.counts?.submissions}  iconBg="rgba(18,138,71,0.08)"  iconColor="var(--just-green-600)" />
      </div>

      {/* Submission breakdown + Recent activity — two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

        {/* Submission status breakdown */}
        <div>
          <h3 className="text-ink-800 mb-3" style={{ fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
            Submissions by Status
          </h3>
          {lDash ? (
            <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-ink-300" /></div>
          ) : (
            <SubmissionBreakdown stats={dash?.submissions} />
          )}
        </div>

        {/* Recent activity */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-ink-800" style={{ fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
              Recent Activity
            </h3>
            <Link to="/audit" className="text-xs text-just-blue-600 hover:underline">
              View all →
            </Link>
          </div>
          <div className="rounded-lg border border-border bg-white shadow-xs px-4 py-1">
            {lDash
              ? <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-ink-300" /></div>
              : <RecentActivity entries={dash?.recentActivity} />
            }
          </div>
        </div>
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
          <Button size="sm" asChild><Link to="/classes">Create first class</Link></Button>
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
                      {semester ? `${semester.name} · ${semester.year}` : <span className="text-ink-300 text-xs">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-just-blue-600" asChild>
                          <Link to={`/classes/${cls._id}/students`}><Users size={12} /> Students</Link>
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-just-blue-600" asChild>
                          <Link to={`/classes/${cls._id}/groups`}><Users2 size={12} /> Groups</Link>
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
  const { data: dash, isLoading } = useGetInstructorDashboardStatsQuery();
  const counts         = dash?.counts         ?? {};
  const classSummaries = dash?.classSummaries ?? [];

  return (
    <div className="max-w-5xl">
      <p className="eyebrow mb-2">Overview</p>
      <h2 className="text-ink-900 mb-1">
        Welcome back, {user?.fullName?.split(' ')[0] ?? 'there'}
      </h2>
      <p className="text-ink-500 mb-8" style={{ fontSize: 'var(--fs-small)' }}>
        Manage your classes, tasks, and student groups from here.
      </p>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Users}
          label="My Classes"
          count={isLoading ? null : counts.classes}
          iconBg="var(--just-blue-50)"
          iconColor="var(--just-blue-600)"
        />
        <StatCard
          icon={Users2}
          label="My Students"
          count={isLoading ? null : counts.students}
          iconBg="var(--just-blue-50)"
          iconColor="var(--just-blue-600)"
        />
        <StatCard
          icon={Users2}
          label="Active Groups"
          count={isLoading ? null : counts.activeGroups}
          iconBg="rgba(232,197,71,0.12)"
          iconColor="var(--just-gold-500)"
        />
        <StatCard
          icon={ClipboardList}
          label="Pending Reviews"
          count={isLoading ? null : counts.pendingReviews}
          iconBg={counts.pendingReviews > 0 ? 'rgba(217,119,6,0.1)' : 'rgba(0,0,0,0.04)'}
          iconColor={counts.pendingReviews > 0 ? 'rgb(180,83,9)' : 'var(--ink-400)'}
        />
      </div>

      {/* Tasks overview banner */}
      <div className="flex items-center gap-4 mb-8 px-4 py-3 rounded-lg border border-border bg-white shadow-xs flex-wrap">
        <span className="text-sm font-semibold text-ink-700 shrink-0">Tasks</span>
        <div className="flex gap-3 flex-wrap">
          <span className={cn(
            'inline-flex items-center gap-1.5 text-xs font-medium rounded px-2 py-1',
            'bg-just-blue-50 text-just-blue-700',
          )}>
            <ClipboardList size={11} />
            {isLoading ? '—' : counts.openTasks ?? 0} open
          </span>
          <span className={cn(
            'inline-flex items-center gap-1.5 text-xs font-medium rounded px-2 py-1',
            counts.dueSoon > 0 ? 'bg-amber-100 text-amber-700' : 'bg-ink-100 text-ink-500',
          )}>
            <Clock size={11} />
            {isLoading ? '—' : counts.dueSoon ?? 0} due this week
          </span>
          <span className={cn(
            'inline-flex items-center gap-1.5 text-xs font-medium rounded px-2 py-1',
            counts.overdue > 0 ? 'bg-red-100 text-red-700' : 'bg-ink-100 text-ink-500',
          )}>
            <AlertTriangle size={11} />
            {isLoading ? '—' : counts.overdue ?? 0} overdue
          </span>
        </div>
      </div>

      {/* Class cards */}
      <h3 className="text-ink-800 mb-3" style={{ fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
        My Classes
      </h3>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 size={20} className="animate-spin text-ink-300" />
        </div>
      ) : classSummaries.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-10 text-center">
          <p className="text-sm text-ink-400">No classes assigned to you yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {classSummaries.map((cls) => (
            <div
              key={String(cls._id)}
              className="rounded-lg border border-border bg-white shadow-xs p-5 flex flex-col"
            >
              {/* Header */}
              <div className="flex-1 mb-3">
                <p className="font-semibold text-ink-800 text-base leading-snug mb-0.5">
                  {cls.name}
                </p>
                {cls.semester && (
                  <p className="text-xs text-ink-400 mb-1">
                    {cls.semester.name} · {cls.semester.year}
                  </p>
                )}
                {cls.courses.map((c) => (
                  <p key={String(c._id ?? c)} className="text-sm text-ink-500">
                    {c.code && <span className="font-mono text-xs text-ink-400 mr-1">{c.code}</span>}
                    {c.name}
                  </p>
                ))}
              </div>

              {/* Per-class counts */}
              <div className="flex items-center gap-2 text-xs text-ink-500 mb-3">
                <span>{cls.students} student{cls.students !== 1 ? 's' : ''}</span>
                <span className="text-ink-300">·</span>
                <span>{cls.activeGroups} group{cls.activeGroups !== 1 ? 's' : ''}</span>
              </div>

              {/* Task / review chips */}
              {(cls.openTasks > 0 || cls.pendingReviews > 0) && (
                <div className="flex gap-2 flex-wrap mb-3">
                  {cls.openTasks > 0 && (
                    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium bg-just-blue-50 text-just-blue-700">
                      <ClipboardList size={10} /> {cls.openTasks} open task{cls.openTasks !== 1 ? 's' : ''}
                    </span>
                  )}
                  {cls.pendingReviews > 0 && (
                    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium bg-amber-100 text-amber-700">
                      <AlertCircle size={10} /> {cls.pendingReviews} to review
                    </span>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-1.5 flex-wrap pt-3 border-t border-border">
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
                  <Link to={`/classes/${cls._id}/students`}><Users size={12} /> Students</Link>
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
                  <Link to={`/classes/${cls._id}/groups`}><Users2 size={12} /> Groups</Link>
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
                  <Link to={`/classes/${cls._id}/tasks`}><ClipboardList size={12} /> Tasks</Link>
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
                  <Link to={`/classes/${cls._id}/scores`}><BarChart2 size={12} /> Scores</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Student dashboard helpers ─────────────────────────────────────────────────

function initials(name) {
  const parts = (name ?? '').trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (parts[0]?.[0] ?? '?').toUpperCase();
}

const AVATAR_PALETTE = [
  'bg-just-blue-100 text-just-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];

function avatarColor(name) {
  let h = 0;
  for (const c of name ?? '') h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

// ── Student dashboard ─────────────────────────────────────────────────────────

function StudentDashboard({ user }) {
  const { data: workspaces = [], isLoading } = useGetMyWorkspacesQuery();

  const totalTasks   = workspaces.reduce((s, ws) => s + (ws.taskSummary?.total   ?? 0), 0);
  const totalDone    = workspaces.reduce((s, ws) => s + (ws.taskSummary?.done    ?? 0), 0);
  const totalPending = workspaces.reduce((s, ws) => s + (ws.taskSummary?.pending ?? 0), 0);
  const totalDueSoon = workspaces.reduce((s, ws) => s + (ws.taskSummary?.dueSoon ?? 0), 0);

  return (
    <div className="max-w-4xl">
      <p className="eyebrow mb-2">My Groups</p>
      <h2 className="text-ink-900 mb-1">
        Welcome, {user?.fullName?.split(' ')[0] ?? 'there'}
      </h2>
      <p className="text-ink-500 mb-8" style={{ fontSize: 'var(--fs-small)' }}>
        Your active group workspaces and task progress.
      </p>

      {/* Stats row */}
      {!isLoading && workspaces.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={Users2}
            label="My Groups"
            count={workspaces.length}
            iconBg="var(--just-blue-50)"
            iconColor="var(--just-blue-600)"
          />
          <StatCard
            icon={ClipboardList}
            label="Total Tasks"
            count={totalTasks}
            iconBg="var(--just-blue-50)"
            iconColor="var(--just-blue-600)"
          />
          <StatCard
            icon={UserCheck}
            label="Completed"
            count={totalDone}
            iconBg="rgba(18,138,71,0.08)"
            iconColor="var(--just-green-600)"
          />
          <StatCard
            icon={Clock}
            label="Due This Week"
            count={totalDueSoon}
            iconBg={totalDueSoon > 0 ? 'rgba(217,119,6,0.1)' : 'rgba(0,0,0,0.04)'}
            iconColor={totalDueSoon > 0 ? 'rgb(180,83,9)' : 'var(--ink-400)'}
          />
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={22} className="animate-spin text-ink-300" />
        </div>
      ) : workspaces.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-12 text-center">
          <Users2 size={32} className="mx-auto text-ink-200 mb-3" />
          <p className="text-sm text-ink-500 font-medium">Not in a group yet</p>
          <p className="text-xs text-ink-300 mt-1">Check back after your instructor generates groups.</p>
        </div>
      ) : (
        <>
          <h3 className="text-ink-800 mb-3" style={{ fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
            My Workspaces
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workspaces.map((ws) => {
              const group    = ws.groupId;
              const cls      = group?.classId;
              const course   = group?.courseId;
              const semester = cls?.semesterId;
              const leaderId = String(group?.leaderId?._id ?? group?.leaderId);
              const members  = group?.memberIds ?? [];
              const summary  = ws.taskSummary ?? { total: 0, done: 0, pending: 0, dueSoon: 0 };
              const pct      = summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0;
              const MAX_SHOWN = 4;
              const shown    = members.slice(0, MAX_SHOWN);
              const overflow = members.length - MAX_SHOWN;

              return (
                <div
                  key={ws._id}
                  className="rounded-lg border border-border bg-white shadow-xs p-5 flex flex-col gap-4"
                >
                  {/* Header */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <p className="font-semibold text-ink-800 text-base leading-snug">
                        {group?.name ?? '—'}
                      </p>
                      {summary.dueSoon > 0 && (
                        <span className="inline-flex items-center gap-1 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 uppercase tracking-wide">
                          <Clock size={9} /> {summary.dueSoon} due soon
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-400">
                      {cls?.name ?? '—'}
                      {semester && <> · {semester.name} {semester.year}</>}
                    </p>
                    {course && (
                      <p className="text-xs text-ink-500 mt-0.5">
                        {course.code && <span className="font-mono text-ink-400 mr-1">{course.code}</span>}
                        {course.name}
                      </p>
                    )}
                  </div>

                  {/* Task progress */}
                  {summary.total > 0 ? (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-ink-500 font-medium">Tasks</span>
                        <span className="text-xs text-ink-500">
                          <span className={cn('font-semibold', pct === 100 ? 'text-success' : 'text-ink-800')}>
                            {summary.done}
                          </span>
                          /{summary.total} done
                          {summary.pending > 0 && (
                            <span className="text-ink-400"> · {summary.pending} pending</span>
                          )}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-ink-100 overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            pct === 100 ? 'bg-success' : 'bg-just-blue-500',
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-ink-300">No tasks assigned yet.</p>
                  )}

                  {/* Member avatars */}
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {shown.map((m) => {
                        const isLeader = String(m._id) === leaderId;
                        return (
                          <div
                            key={m._id}
                            title={`${m.fullName}${isLeader ? ' (leader)' : ''}`}
                            className={cn(
                              'flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold border-2 border-white',
                              avatarColor(m.fullName),
                              isLeader && 'ring-2 ring-offset-1 ring-amber-300',
                            )}
                          >
                            {initials(m.fullName)}
                          </div>
                        );
                      })}
                      {overflow > 0 && (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-ink-100 text-[11px] font-semibold text-ink-500">
                          +{overflow}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-ink-400">
                      {members.length} member{members.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* CTA */}
                  <Button size="sm" className="w-full mt-auto" asChild>
                    <Link to={`/workspaces/${ws._id}`}>Open Workspace →</Link>
                  </Button>
                </div>
              );
            })}
          </div>
        </>
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
