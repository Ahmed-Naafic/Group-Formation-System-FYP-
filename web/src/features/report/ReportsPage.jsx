import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Loader2, FileSpreadsheet, FileText, Users, Users2, ClipboardList,
  CheckCircle2, BarChart2, Crown, TrendingDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { useGetCourseOfferingsQuery } from '@/features/courseOffering/courseOfferingApi';
import { useGetCohortsQuery } from '@/features/cohort/cohortApi';
import { useLazyGetAnalyticsReportQuery } from './reportApi';
import { selectCurrentToken } from '@/features/auth/authSlice';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000').trim();
const ALL = '__all__';

// Mirrors backend reportPeriod.js's snapToWeekStart exactly — Thu/Fri snap
// FORWARD to the next Saturday since neither is part of any reporting week.
function snapToWeekStart(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay();
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (day === 6) {
    // already Saturday
  } else if (day <= 3) {
    start.setUTCDate(start.getUTCDate() - (day + 1));
  } else {
    start.setUTCDate(start.getUTCDate() + (6 - day));
  }
  return start.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Shared presentational bits ───────────────────────────────────────────────

function StatTile({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <p className="text-2xl font-bold text-ink-900 leading-none tracking-tight">
        {value != null ? value : <span className="text-ink-300 text-xl">—</span>}
      </p>
      <p className="text-xs text-ink-500 mt-1.5">{label}</p>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="rounded-2xl border border-border bg-white shadow-xs p-6 mb-5">
      <h3 className="text-ink-800 mb-4 flex items-center gap-2" style={{ fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
        {Icon && <Icon size={16} className="text-just-blue-600" />}
        {title}
      </h3>
      {children}
    </div>
  );
}

function GroupCallout({ label, group, tone }) {
  return (
    <div className={cn(
      'rounded-xl border p-4',
      tone === 'high' ? 'border-success/30 bg-success/5' : 'border-danger/30 bg-danger/5',
    )}>
      <p className={cn('text-xs font-semibold uppercase tracking-wide mb-1', tone === 'high' ? 'text-success' : 'text-danger')}>
        {label}
      </p>
      {group ? (
        <>
          <p className="text-sm font-medium text-ink-800 truncate">{group.name}</p>
          <p className="text-xs text-ink-500">Average grade: {group.average}</p>
        </>
      ) : (
        <p className="text-xs text-ink-400">No graded groups in this period.</p>
      )}
    </div>
  );
}

// ── Filters ───────────────────────────────────────────────────────────────────

function ReportFilters({
  reportType, setReportType, date, setDate, weekStart, setWeekStart,
  year, setYear, month, setMonth, courseOfferingId, setCourseOfferingId,
  cohortId, setCohortId, offerings, cohorts, onGenerate, isFetching,
  downloading, onExport, hasReport,
}) {
  return (
    <div className="rounded-2xl border border-border bg-white shadow-xs p-6 mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div className="space-y-1.5">
          <Label>Report Type</Label>
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly (Sat–Wed)</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {reportType === 'daily' && (
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        )}

        {reportType === 'weekly' && (
          <div className="space-y-1.5">
            <Label>Week</Label>
            <Input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(snapToWeekStart(e.target.value))}
            />
            <p className="text-[11px] text-ink-400">
              {fmtDate(weekStart)} – {fmtDate(addDays(weekStart, 4))} (Sat–Wed)
            </p>
          </div>
        )}

        {reportType === 'monthly' && (
          <div className="space-y-1.5">
            <Label>Month</Label>
            <Input
              type="month"
              value={`${year}-${String(month).padStart(2, '0')}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-');
                setYear(Number(y));
                setMonth(Number(m));
              }}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Course Offering</Label>
          <Select value={courseOfferingId || ALL} onValueChange={(v) => setCourseOfferingId(v === ALL ? '' : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All authorized offerings</SelectItem>
              {offerings.map((o) => (
                <SelectItem key={o._id} value={String(o._id)}>
                  {o.courseId?.name ?? '—'} — {o.cohortId?.name ?? '—'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Cohort</Label>
          <Select value={cohortId || ALL} onValueChange={(v) => setCohortId(v === ALL ? '' : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All authorized cohorts</SelectItem>
              {cohorts.map((c) => (
                <SelectItem key={c._id} value={String(c._id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={onGenerate} disabled={isFetching}>
          {isFetching && <Loader2 size={14} className="animate-spin" />}
          Generate Report
        </Button>
        <Button
          variant="outline"
          disabled={!hasReport || !!downloading}
          onClick={() => onExport('excel')}
        >
          {downloading === 'excel' ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
          Export Excel
        </Button>
        <Button
          variant="outline"
          disabled={!hasReport || !!downloading}
          onClick={() => onExport('pdf')}
        >
          {downloading === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
          Export PDF
        </Button>
      </div>
    </div>
  );
}

// ── Report body ───────────────────────────────────────────────────────────────

function ReportBody({ report }) {
  const { overview, studentActivity, groupFormation, taskActivity, submissionActivity, reviewActivity, groupPerformance, periodBreakdown, meta } = report;

  return (
    <>
      <div className="mb-5 flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="eyebrow mb-1">
            {meta.reportType[0].toUpperCase() + meta.reportType.slice(1)} Report
          </p>
          <h3 className="text-ink-900">
            {fmtDate(meta.periodStart)} – {fmtDate(meta.periodEnd)}
          </h3>
        </div>
        <p className="text-xs text-ink-400">
          {meta.scope.offerings.length} course offering{meta.scope.offerings.length !== 1 ? 's' : ''} in scope
        </p>
      </div>

      {/* Overview — current snapshot vs period activity, explicitly separated */}
      <Section title="Overview — Current Snapshot" icon={BarChart2}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="Active Students" value={overview.current.activeStudents} />
          <StatTile label="Active Cohorts" value={overview.current.activeCohorts} />
          <StatTile label="Active Groups" value={overview.current.activeGroups} />
          <StatTile label="Students Assigned" value={overview.current.studentsAssigned} />
          <StatTile label="Students Unassigned" value={overview.current.studentsUnassigned} />
          <StatTile label="Open Tasks" value={overview.current.openTasks} />
          <StatTile label="Pending Reviews" value={overview.current.pendingReviews} />
          <StatTile label="Overall Avg Grade" value={overview.current.overallAverageGrade} />
        </div>
      </Section>

      <Section title="Overview — Period Activity">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="Students Added" value={overview.period.studentsAdded} />
          <StatTile label="Students Removed" value={overview.period.studentsRemoved} />
          <StatTile label="Students Restored" value={overview.period.studentsRestored} />
          <StatTile label="Tasks Created" value={overview.period.tasksCreated} />
          <StatTile label="Submissions Received" value={overview.period.submissionsReceived} />
          <StatTile label="Reviews Completed" value={overview.period.reviewsCompleted} />
          <StatTile label="Groups Generated" value={overview.period.groupsGenerated} />
          <StatTile label="Groups Regenerated" value={overview.period.groupsRegenerated} />
        </div>
      </Section>

      {/* Student Activity */}
      <Section title="Student Activity" icon={Users}>
        <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Current</p>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatTile label="Active" value={studentActivity.current.activeStudents} />
          <StatTile label="Assigned" value={studentActivity.current.assigned} />
          <StatTile label="Unassigned" value={studentActivity.current.unassigned} />
        </div>
        <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Period Activity</p>
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Added" value={studentActivity.period.added} />
          <StatTile label="Removed" value={studentActivity.period.removed} />
          <StatTile label="Restored" value={studentActivity.period.restored} />
        </div>
      </Section>

      {/* Group Formation Metrics — aggregated only, no groups list (see Groups page) */}
      <Section title="Group Formation Metrics" icon={Users2}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatTile label="Groups Generated" value={groupFormation.groupsGenerated} />
          <StatTile label="Groups Regenerated" value={groupFormation.groupsRegenerated} />
          <StatTile label="Active Groups" value={groupFormation.activeGroups} />
          <StatTile label="Empty/Inactive Groups" value={groupFormation.emptyGroups} />
          <StatTile label="Students Assigned" value={groupFormation.studentsAssigned} />
          <StatTile label="Students Unassigned" value={groupFormation.studentsUnassigned} />
          <StatTile label="Avg Group Size" value={groupFormation.avgGroupSize} />
          <StatTile label="Avg Group Grade" value={groupFormation.avgGroupGrade} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <GroupCallout label="Highest-Performing Group" group={groupFormation.highestPerformingGroup} tone="high" />
          <GroupCallout label="Lowest-Performing Group" group={groupFormation.lowestPerformingGroup} tone="low" />
        </div>
        <p className="text-[11px] text-ink-400 mt-3">
          For individual group membership and management, use the Groups page.
        </p>
      </Section>

      {/* Task Activity */}
      <Section title="Task Activity" icon={ClipboardList}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="Tasks Created" value={taskActivity.tasksCreated} />
          <StatTile label="Tasks Due (period)" value={taskActivity.tasksDue} />
          <StatTile label="Open Tasks (now)" value={taskActivity.openTasksNow} />
          <StatTile label="Overdue Tasks (now)" value={taskActivity.overdueTasksNow} />
        </div>
      </Section>

      {/* Submission Activity */}
      <Section title="Submission Activity" icon={CheckCircle2}>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatTile label="Submitted" value={submissionActivity.submitted} />
          <StatTile label="On Time" value={submissionActivity.onTime} />
          <StatTile label="Late" value={submissionActivity.late} />
          <StatTile label="Expected (due this period)" value={submissionActivity.expected} />
          <StatTile label="Missing" value={submissionActivity.missing} />
        </div>
      </Section>

      {/* Review Activity */}
      <Section title="Review Activity" icon={Crown}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="Submissions Received" value={reviewActivity.submissionsReceived} />
          <StatTile label="Reviews Completed" value={reviewActivity.reviewsCompleted} />
          <StatTile label="Reviews Pending (now)" value={reviewActivity.reviewsPending} />
          <StatTile
            label="Completion Rate"
            value={reviewActivity.completionRatePercent != null ? `${reviewActivity.completionRatePercent}%` : null}
          />
        </div>
      </Section>

      {/* Group Performance / Grades */}
      <Section title="Group Performance / Grades" icon={TrendingDown}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <StatTile label="Overall Avg Grade" value={groupPerformance.overallAverageGrade} />
          <StatTile label="Avg Group Grade" value={groupPerformance.avgGroupGrade} />
          <StatTile label="Graded Submissions" value={groupPerformance.gradedSubmissionsCount} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <GroupCallout label="Highest-Performing Group" group={groupPerformance.highestPerformingGroup} tone="high" />
          <GroupCallout label="Lowest-Performing Group" group={groupPerformance.lowestPerformingGroup} tone="low" />
        </div>
      </Section>

      {/* Period Breakdown — daily rows (weekly) or weekly rows (monthly) */}
      {periodBreakdown && periodBreakdown.length > 0 && (
        <Section title={meta.reportType === 'weekly' ? 'Daily Breakdown (Sat–Wed)' : 'Weekly Breakdown (Sat–Wed)'}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{meta.reportType === 'weekly' ? 'Day' : 'Week'}</TableHead>
                  <TableHead className="text-right">Students Added</TableHead>
                  <TableHead className="text-right">Students Removed</TableHead>
                  <TableHead className="text-right">Groups Generated</TableHead>
                  <TableHead className="text-right">Groups Regenerated</TableHead>
                  <TableHead className="text-right">Tasks</TableHead>
                  <TableHead className="text-right">Submissions</TableHead>
                  <TableHead className="text-right">Reviews</TableHead>
                  <TableHead className="text-right">Avg Grade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periodBreakdown.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="font-medium text-ink-800">{row.label}</TableCell>
                    <TableCell className="text-right text-ink-500">{row.studentsAdded}</TableCell>
                    <TableCell className="text-right text-ink-500">{row.studentsRemoved}</TableCell>
                    <TableCell className="text-right text-ink-500">{row.groupsGenerated}</TableCell>
                    <TableCell className="text-right text-ink-500">{row.groupsRegenerated}</TableCell>
                    <TableCell className="text-right text-ink-500">{row.tasksCreated}</TableCell>
                    <TableCell className="text-right text-ink-500">{row.submissions}</TableCell>
                    <TableCell className="text-right text-ink-500">{row.reviews}</TableCell>
                    <TableCell className="text-right text-ink-500">{row.averageGrade ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Section>
      )}
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const token = useSelector(selectCurrentToken);

  const { data: offerings = [] } = useGetCourseOfferingsQuery();
  const { data: cohorts   = [] } = useGetCohortsQuery();

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  const [reportType, setReportType]             = useState('monthly');
  const [date, setDate]                         = useState(today);
  const [weekStart, setWeekStart]               = useState(() => snapToWeekStart(today));
  const [year, setYear]                         = useState(now.getFullYear());
  const [month, setMonth]                       = useState(now.getMonth() + 1);
  const [courseOfferingId, setCourseOfferingId] = useState('');
  const [cohortId, setCohortId]                 = useState('');
  const [downloading, setDownloading]           = useState(null);

  // Excel export card (existing feature, untouched)
  const [selectedOfferingId, setSelectedOfferingId] = useState('');
  const [downloadingGroupList, setDownloadingGroupList] = useState(false);

  const [trigger, { data: report, isFetching, error }] = useLazyGetAnalyticsReportQuery();

  function buildParams() {
    const params = { reportType };
    if (reportType === 'daily') params.date = date;
    if (reportType === 'weekly') params.weekStart = weekStart;
    if (reportType === 'monthly') { params.year = year; params.month = month; }
    if (courseOfferingId) params.courseOfferingId = courseOfferingId;
    if (cohortId) params.cohortId = cohortId;
    return params;
  }

  function handleGenerate() {
    trigger(buildParams());
  }

  async function handleExport(format) {
    setDownloading(format);
    try {
      const params = new URLSearchParams(buildParams());
      const res = await fetch(`${API_BASE}/api/reports/analytics/${format}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? 'Export failed');
      }
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `report-${reportType}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      toast.error(err.message ?? 'Export failed');
    } finally {
      setDownloading(null);
    }
  }

  async function downloadGroupList() {
    setDownloadingGroupList(true);
    try {
      const res = await fetch(`${API_BASE}/api/reports/groups/formatted?courseOfferingId=${selectedOfferingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? 'Download failed');
      }
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'group_list.xlsx';
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      toast.error(err.message ?? 'Download failed');
    } finally {
      setDownloadingGroupList(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <p className="eyebrow mb-1">Analytics</p>
        <h2 className="text-ink-900 mb-1">Reports</h2>
        <p className="text-ink-500" style={{ fontSize: 'var(--fs-small)' }}>
          Period activity and performance analytics. For detailed group membership and management, use the Groups page.
        </p>
      </div>

      <ReportFilters
        reportType={reportType} setReportType={setReportType}
        date={date} setDate={setDate}
        weekStart={weekStart} setWeekStart={setWeekStart}
        year={year} setYear={setYear} month={month} setMonth={setMonth}
        courseOfferingId={courseOfferingId} setCourseOfferingId={setCourseOfferingId}
        cohortId={cohortId} setCohortId={setCohortId}
        offerings={offerings} cohorts={cohorts}
        onGenerate={handleGenerate} isFetching={isFetching}
        downloading={downloading} onExport={handleExport}
        hasReport={!!report}
      />

      {isFetching && !report && (
        <div className="flex justify-center py-16">
          <Loader2 size={22} className="animate-spin text-ink-300" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-6">
          <p className="text-sm text-red-700">{error?.data?.error?.message ?? 'Failed to load report.'}</p>
        </div>
      )}

      {report && <ReportBody report={report} />}

      {!report && !isFetching && !error && (
        <div className="rounded-2xl border border-border bg-white p-12 text-center mb-6">
          <BarChart2 size={28} className="mx-auto text-ink-200 mb-3" />
          <p className="text-sm text-ink-400">Choose a report type and period, then click "Generate Report".</p>
        </div>
      )}

      {/* ── Existing group-list export (unrelated feature, unchanged) ──────── */}
      <div className="rounded-lg border border-border bg-white shadow-xs p-5 max-w-lg">
        <p className="text-sm font-medium text-ink-800 mb-1">Group List (Excel)</p>
        <p className="text-xs text-ink-400 mb-4">
          Styled export with one sheet per group: coloured headers, leader highlighted,
          alternating rows. Names and roles only — no scores or attendance.
        </p>
        <div className="space-y-3">
          <Select value={selectedOfferingId} onValueChange={setSelectedOfferingId}>
            <SelectTrigger>
              <SelectValue placeholder="Select an offering…" />
            </SelectTrigger>
            <SelectContent>
              {offerings.map((o) => (
                <SelectItem key={o._id} value={String(o._id)}>
                  {o.courseId?.name ?? '—'}
                  {' — '}
                  {o.cohortId?.name ?? '—'}
                  {o.semesterId?.name ? ` (${o.semesterId.name})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={downloadGroupList} disabled={!selectedOfferingId || downloadingGroupList}>
            {downloadingGroupList ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
            Download group list (Excel)
          </Button>
        </div>
      </div>
    </div>
  );
}
