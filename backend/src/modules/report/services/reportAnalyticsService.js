const Student    = require('../../student/models/Student');
const Group      = require('../../group/models/Group');
const GroupHistory = require('../../grouping/models/GroupHistory');
const Task       = require('../../task/models/Task');
const Submission = require('../../submission/models/Submission');
const AuditLog    = require('../../auditLog/models/AuditLog');
const { resolveReportScope } = require('./reportAuthScope');
const {
  resolveDailyPeriod, resolveWeeklyPeriod, resolveMonthlyPeriod,
  snapToWeekStart, weekDays, monthlyWeekBreakdown,
} = require('../utils/reportPeriod');
const { BadRequestError } = require('../../../common/errors');

// ── Period resolution from request params ───────────────────────────────────

function resolvePeriod(params) {
  const { reportType } = params;
  if (reportType === 'daily') {
    if (!params.date) throw new BadRequestError('date is required for a daily report');
    return { ...resolveDailyPeriod(params.date), reportType };
  }
  if (reportType === 'weekly') {
    if (!params.weekStart) throw new BadRequestError('weekStart is required for a weekly report');
    return { ...resolveWeeklyPeriod(params.weekStart), reportType };
  }
  if (reportType === 'monthly') {
    if (!params.year || !params.month) throw new BadRequestError('year and month are required for a monthly report');
    return { ...resolveMonthlyPeriod(params.year, params.month), reportType };
  }
  throw new BadRequestError('reportType must be one of: daily, weekly, monthly');
}

const inRange = (date, start, end) => date && date >= start && date <= end;

// ── Group generation vs regeneration ─────────────────────────────────────────
// There is no distinguishing field between the two anywhere in the schema
// (both call sites emit the identical 'groups.generated' event — see
// groupService.js generate()/regenerate()). The only way to tell them apart
// from existing data: order every distinct generationId per offering by
// GroupHistory.generatedAt (an immutable, never-soft-deleted record) — the
// first one ever for that offering is a generation, every later one is a
// regeneration. This has to be computed over the offering's FULL history,
// not just the report period, since a generation from last month makes THIS
// period's run a regeneration even if this is the only run visible in-period.
function classifyGenerationEvents(groupHistoryAllTime) {
  const byOffering = new Map(); // offeringId -> Map<generationId, generatedAt>
  for (const gh of groupHistoryAllTime) {
    const oid = String(gh.courseOfferingId);
    if (!byOffering.has(oid)) byOffering.set(oid, new Map());
    const gens = byOffering.get(oid);
    const gid = String(gh.generationId);
    if (!gens.has(gid) || gh.generatedAt < gens.get(gid)) {
      gens.set(gid, gh.generatedAt);
    }
  }
  const events = [];
  for (const [offeringId, gens] of byOffering) {
    const sorted = [...gens.entries()].sort((a, b) => a[1] - b[1]);
    sorted.forEach(([generationId, generatedAt], idx) => {
      events.push({ offeringId, generationId, generatedAt, isRegeneration: idx > 0 });
    });
  }
  return events;
}

// ── Students restored — the only student-lifecycle event with NO timestamp
// of its own on the Student document (restore() just clears deletedAt back
// to null, indistinguishable afterward from "never removed"). The audit log
// is the only source of truth, and it has to be combined from two places:
// individual restores (STUDENT_RESTORED, entityId = studentId) and bulk
// cohort restores (COHORT_ROSTER_RESTORED, entityId = cohortId, count in
// changes.studentsRestored) — see studentService.restore/restoreByCohort.
async function countStudentsRestoredInPeriod(cohortIds, start, end) {
  const [individual, bulk] = await Promise.all([
    AuditLog.find({ action: 'STUDENT_RESTORED', timestamp: { $gte: start, $lte: end } }, 'entityId').lean(),
    AuditLog.find(
      { action: 'COHORT_ROSTER_RESTORED', entityId: { $in: cohortIds }, timestamp: { $gte: start, $lte: end } },
      'changes',
    ).lean(),
  ]);

  let individualCount = 0;
  if (individual.length > 0) {
    // Scope by the student's CURRENT cohort — historical cohort-at-time-of-
    // restore isn't tracked, so a student later transferred elsewhere may be
    // slightly mis-scoped. Acceptable: this only affects the rare individual
    // restore immediately followed by a cohort transfer.
    const ids = individual.map((a) => a.entityId);
    const students = await Student.find({ _id: { $in: ids } }, 'cohortId').lean();
    const cohortIdSet = new Set(cohortIds.map(String));
    individualCount = students.filter((s) => cohortIdSet.has(String(s.cohortId))).length;
  }
  const bulkCount = bulk.reduce((sum, a) => sum + (a.changes?.studentsRestored ?? 0), 0);
  return individualCount + bulkCount;
}

// ── Main report ──────────────────────────────────────────────────────────────

async function getAnalyticsReport(params, context) {
  const period = resolvePeriod(params);
  const { start, end, reportType } = period;

  const scope = await resolveReportScope(context, {
    courseOfferingId: params.courseOfferingId,
    cohortId:         params.cohortId,
  });
  const { offerings, courseOfferingIds, cohortIds } = scope;

  const meta = {
    reportType,
    periodStart: start,
    periodEnd:   end,
    generatedAt: new Date(),
    scope: {
      courseOfferingIds: courseOfferingIds.map(String),
      cohortIds,
      offerings: offerings.map((o) => ({
        _id:      o._id,
        course:   o.courseId,
        cohort:   o.cohortId,
        semester: o.semesterId,
      })),
    },
  };

  if (cohortIds.length === 0) {
    return buildEmptyReport(meta, period);
  }

  const now = new Date();

  // ── Fetch every raw dataset the report's sections need, once ──────────────
  const [
    allStudentsInScope,   // includes soft-deleted — needed for added/removed/current split
    activeGroups,         // current active groups, RAW memberIds (no populate -> no null-slot risk)
    groupHistoryAllTime,  // full history for these offerings, for generate/regenerate classification
    tasksInScope,
  ] = await Promise.all([
    Student.find({ cohortId: { $in: cohortIds } })
      .includeSoftDeleted()
      .select('_id fullName cohortId averageScore createdAt deletedAt')
      .lean(),
    Group.find({ courseOfferingId: { $in: courseOfferingIds }, status: 'active', deletedAt: null })
      .select('_id name code memberIds leaderId courseOfferingId generatedAt generationId')
      .lean(),
    GroupHistory.find({ courseOfferingId: { $in: courseOfferingIds } })
      .select('_id courseOfferingId generationId generatedAt memberIds leaderId groupSize')
      .lean(),
    Task.find({ courseOfferingId: { $in: courseOfferingIds }, deletedAt: null })
      .select('_id courseOfferingId title deadline status submissionType createdAt')
      .lean(),
  ]);

  const taskIds = tasksInScope.map((t) => t._id);
  const submissionsInScope = taskIds.length > 0
    ? await Submission.find({ taskId: { $in: taskIds }, deletedAt: null })
        .select('taskId groupId submittedBy status grade gradedAt submittedAt memberGrades createdAt')
        .lean()
    : [];

  const activeStudents = allStudentsInScope.filter((s) => !s.deletedAt);
  const activeStudentIds = new Set(activeStudents.map((s) => String(s._id)));
  const taskById = new Map(tasksInScope.map((t) => [String(t._id), t]));

  const studentsRestoredInPeriod = await countStudentsRestoredInPeriod(cohortIds, start, end);

  const studentsAddedInPeriod = allStudentsInScope.filter((s) => inRange(s.createdAt, start, end)).length;
  const studentsRemovedInPeriod = allStudentsInScope.filter((s) => s.deletedAt && inRange(s.deletedAt, start, end)).length;

  // ── Group formation ─────────────────────────────────────────────────────
  const assignedStudentIds = new Set();
  let emptyGroupCount = 0;
  const groupActiveMembers = new Map(); // groupId -> active member id array
  for (const g of activeGroups) {
    const active = (g.memberIds ?? []).filter((id) => activeStudentIds.has(String(id)));
    groupActiveMembers.set(String(g._id), active);
    if (active.length === 0) emptyGroupCount++;
    for (const id of active) assignedStudentIds.add(String(id));
  }
  const avgGroupSize = activeGroups.length > 0
    ? Math.round((activeGroups.reduce((sum, g) => sum + groupActiveMembers.get(String(g._id)).length, 0) / activeGroups.length) * 10) / 10
    : 0;

  const generationEvents = classifyGenerationEvents(groupHistoryAllTime);
  const eventsInPeriod = generationEvents.filter((e) => inRange(e.generatedAt, start, end));
  const groupsGeneratedInPeriod   = eventsInPeriod.filter((e) => !e.isRegeneration).length;
  const groupsRegeneratedInPeriod = eventsInPeriod.filter((e) => e.isRegeneration).length;

  // ── Task activity ────────────────────────────────────────────────────────
  const tasksCreatedInPeriod = tasksInScope.filter((t) => inRange(t.createdAt, start, end)).length;
  const tasksDueInPeriod     = tasksInScope.filter((t) => inRange(t.deadline, start, end)).length;
  // Status on the Task document is only refreshed lazily when a task list is
  // fetched (taskRepository.closeExpiredByOffering runs from taskService.list
  // only) — so a task past its deadline can still read status:'open' in the
  // DB. Derive open/overdue from the deadline itself instead, same as
  // dashboardService.getInstructorStats already does.
  const openTasksNow    = tasksInScope.filter((t) => !t.deadline || t.deadline >= now).length;
  const overdueTasksNow = tasksInScope.filter((t) => t.deadline && t.deadline < now).length;
  // "Closed in period" is a best-effort proxy (deadline fell in-period AND
  // has already passed) — there is no task-closed event or timestamp at all
  // to report this precisely.
  const tasksEffectivelyClosedInPeriod = tasksInScope.filter(
    (t) => t.deadline && inRange(t.deadline, start, end) && t.deadline < now,
  ).length;

  // ── Submission + review activity ────────────────────────────────────────
  // "Submitted" is an activity metric: submissions whose submittedAt falls in
  // the period. "late" can't be read off status alone — a late submission
  // that gets graded becomes status:'reviewed' and loses the late marker
  // (submissionService.grade()) — so lateness is always recomputed by
  // comparing submittedAt to the task's deadline.
  const submissionsInPeriod = submissionsInScope.filter((s) => inRange(s.submittedAt, start, end));
  const lateInPeriod = submissionsInPeriod.filter((s) => {
    const task = taskById.get(String(s.taskId));
    return task?.deadline && s.submittedAt > task.deadline;
  }).length;
  const onTimeInPeriod = submissionsInPeriod.length - lateInPeriod;

  // Expected/missing is computed per task whose deadline fell in this period
  // (i.e. tasks that were "due" this period) — expected participant count
  // depends on the task's own submissionType: one per active group for
  // group-mode tasks, one per active student in that offering's cohort for
  // individual-mode tasks. "Submitted"/"missing" here reflect whether that
  // participant has EVER submitted (as of now), not just within the period —
  // this answers "did this period's due tasks get done", not a submission
  // timestamp count (that's submissionsInPeriod above).
  const cohortIdByOffering = new Map(offerings.map((o) => [String(o._id), String(o.cohortId?._id ?? o.cohortId)]));
  const activeStudentIdsByCohort = new Map();
  for (const s of activeStudents) {
    const key = String(s.cohortId);
    if (!activeStudentIdsByCohort.has(key)) activeStudentIdsByCohort.set(key, []);
    activeStudentIdsByCohort.get(key).push(String(s._id));
  }
  const activeGroupIdsByOffering = new Map();
  for (const g of activeGroups) {
    const key = String(g.courseOfferingId);
    if (!activeGroupIdsByOffering.has(key)) activeGroupIdsByOffering.set(key, []);
    activeGroupIdsByOffering.get(key).push(String(g._id));
  }
  const submittedGroupIdsByTask = new Map();
  const submittedStudentIdsByTask = new Map();
  for (const s of submissionsInScope) {
    if (!['submitted', 'late', 'reviewed'].includes(s.status)) continue;
    const tid = String(s.taskId);
    if (!submittedGroupIdsByTask.has(tid)) submittedGroupIdsByTask.set(tid, new Set());
    if (s.groupId) submittedGroupIdsByTask.get(tid).add(String(s.groupId));
    if (!submittedStudentIdsByTask.has(tid)) submittedStudentIdsByTask.set(tid, new Set());
    if (s.submittedBy) submittedStudentIdsByTask.get(tid).add(String(s.submittedBy));
  }

  let expectedSubmissions = 0;
  let missingSubmissions  = 0;
  for (const t of tasksInScope) {
    if (!inRange(t.deadline, start, end)) continue;
    const oid = String(t.courseOfferingId);
    if (t.submissionType === 'individual') {
      const cohortId = cohortIdByOffering.get(oid);
      const expected = (activeStudentIdsByCohort.get(cohortId) ?? []).length;
      const submitted = submittedStudentIdsByTask.get(String(t._id))?.size ?? 0;
      expectedSubmissions += expected;
      missingSubmissions  += Math.max(0, expected - submitted);
    } else {
      const expected = (activeGroupIdsByOffering.get(oid) ?? []).length;
      const submitted = submittedGroupIdsByTask.get(String(t._id))?.size ?? 0;
      expectedSubmissions += expected;
      missingSubmissions  += Math.max(0, expected - submitted);
    }
  }

  const reviewsCompletedInPeriod = submissionsInScope.filter((s) => inRange(s.gradedAt, start, end)).length;
  const reviewsPendingNow = submissionsInScope.filter((s) => ['submitted', 'late'].includes(s.status)).length;
  const reviewCompletionRate = submissionsInPeriod.length > 0
    ? Math.round((reviewsCompletedInPeriod / submissionsInPeriod.length) * 1000) / 10
    : null;

  // ── Group performance / grades ──────────────────────────────────────────
  // "Existing grading logic" for a group is a group-mode task's
  // Submission.grade (reportService.js's gradeAndStatus is the canonical
  // precedent for this resolution rule). Ungraded submissions are excluded
  // from the average rather than counted as 0 — this is a performance
  // average, not the full mark-sheet export's roster convention.
  const gradedSubmissions = submissionsInScope.filter((s) => s.status === 'reviewed' && s.grade != null);
  const overallAverageGrade = gradedSubmissions.length > 0
    ? Math.round((gradedSubmissions.reduce((sum, s) => sum + s.grade, 0) / gradedSubmissions.length) * 10) / 10
    : null;

  const gradesByGroup = new Map(); // groupId -> [grades]
  for (const s of gradedSubmissions) {
    const task = taskById.get(String(s.taskId));
    if (task?.submissionType !== 'group' || !s.groupId) continue;
    const gid = String(s.groupId);
    if (!gradesByGroup.has(gid)) gradesByGroup.set(gid, []);
    gradesByGroup.get(gid).push(s.grade);
  }
  const groupById = new Map(activeGroups.map((g) => [String(g._id), g]));
  // A graded submission can belong to a group that's since been archived
  // (regenerated away) — historical reporting must still show its real name
  // rather than "Unknown group", so look up whichever graded group ids
  // aren't already in the active set.
  const missingGroupIds = [...gradesByGroup.keys()].filter((gid) => !groupById.has(gid));
  if (missingGroupIds.length > 0) {
    const archivedGroups = await Group.find({ _id: { $in: missingGroupIds } })
      .includeSoftDeleted()
      .select('_id name code')
      .lean();
    for (const g of archivedGroups) groupById.set(String(g._id), g);
  }
  let avgGroupGrade = null;
  let highestGroup = null;
  let lowestGroup = null;
  if (gradesByGroup.size > 0) {
    const groupAverages = [...gradesByGroup.entries()].map(([gid, grades]) => ({
      groupId: gid,
      name: groupById.get(gid)?.name ?? groupById.get(gid)?.code ?? 'Removed group',
      average: Math.round((grades.reduce((a, b) => a + b, 0) / grades.length) * 10) / 10,
    }));
    avgGroupGrade = Math.round((groupAverages.reduce((s, g) => s + g.average, 0) / groupAverages.length) * 10) / 10;
    highestGroup = groupAverages.reduce((a, b) => (b.average > a.average ? b : a));
    lowestGroup  = groupAverages.reduce((a, b) => (b.average < a.average ? b : a));
  }

  // ── Period breakdown (weekly: Sat-Wed days; monthly: Sat-Wed weeks) ──────
  let periodBreakdown = null;
  if (reportType === 'weekly') {
    const days = weekDays(snapToWeekStart(start.toISOString()));
    periodBreakdown = days.map(({ label, date }) => {
      const dayStart = date;
      const dayEnd = new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1);
      return buildBreakdownRow(label, dayStart, dayEnd, {
        allStudentsInScope, generationEvents, tasksInScope, submissionsInScope,
      });
    });
  } else if (reportType === 'monthly') {
    const weeks = monthlyWeekBreakdown(start, end);
    periodBreakdown = weeks.map(({ weekStart, start: wStart, end: wEnd }) => {
      const label = `Week of ${weekStart.toISOString().slice(0, 10)}`;
      return buildBreakdownRow(label, wStart, wEnd, {
        allStudentsInScope, generationEvents, tasksInScope, submissionsInScope,
      });
    });
  }

  return {
    meta,
    overview: {
      current: {
        activeStudents: activeStudents.length,
        activeCohorts: cohortIds.length,
        activeGroups: activeGroups.length,
        studentsAssigned: assignedStudentIds.size,
        studentsUnassigned: Math.max(0, activeStudents.length - assignedStudentIds.size),
        openTasks: openTasksNow,
        pendingReviews: reviewsPendingNow,
        overallAverageGrade,
      },
      period: {
        studentsAdded: studentsAddedInPeriod,
        studentsRemoved: studentsRemovedInPeriod,
        studentsRestored: studentsRestoredInPeriod,
        tasksCreated: tasksCreatedInPeriod,
        submissionsReceived: submissionsInPeriod.length,
        reviewsCompleted: reviewsCompletedInPeriod,
        groupsGenerated: groupsGeneratedInPeriod,
        groupsRegenerated: groupsRegeneratedInPeriod,
      },
    },
    studentActivity: {
      current: {
        activeStudents: activeStudents.length,
        assigned: assignedStudentIds.size,
        unassigned: Math.max(0, activeStudents.length - assignedStudentIds.size),
      },
      period: {
        added: studentsAddedInPeriod,
        removed: studentsRemovedInPeriod,
        restored: studentsRestoredInPeriod,
      },
    },
    groupFormation: {
      groupsGenerated: groupsGeneratedInPeriod,
      groupsRegenerated: groupsRegeneratedInPeriod,
      activeGroups: activeGroups.length,
      emptyGroups: emptyGroupCount,
      studentsAssigned: assignedStudentIds.size,
      studentsUnassigned: Math.max(0, activeStudents.length - assignedStudentIds.size),
      avgGroupSize,
      avgGroupGrade,
      highestPerformingGroup: highestGroup,
      lowestPerformingGroup: lowestGroup,
    },
    taskActivity: {
      tasksCreated: tasksCreatedInPeriod,
      tasksDue: tasksDueInPeriod,
      tasksEffectivelyClosed: tasksEffectivelyClosedInPeriod,
      openTasksNow,
      overdueTasksNow,
    },
    submissionActivity: {
      submitted: submissionsInPeriod.length,
      onTime: onTimeInPeriod,
      late: lateInPeriod,
      expected: expectedSubmissions,
      missing: missingSubmissions,
    },
    reviewActivity: {
      submissionsReceived: submissionsInPeriod.length,
      reviewsCompleted: reviewsCompletedInPeriod,
      reviewsPending: reviewsPendingNow,
      completionRatePercent: reviewCompletionRate,
    },
    groupPerformance: {
      overallAverageGrade,
      avgGroupGrade,
      highestPerformingGroup: highestGroup,
      lowestPerformingGroup: lowestGroup,
      gradedSubmissionsCount: gradedSubmissions.length,
    },
    periodBreakdown,
  };
}

function buildBreakdownRow(label, start, end, ctx) {
  const { allStudentsInScope, generationEvents, tasksInScope, submissionsInScope } = ctx;
  const added   = allStudentsInScope.filter((s) => inRange(s.createdAt, start, end)).length;
  const removed = allStudentsInScope.filter((s) => s.deletedAt && inRange(s.deletedAt, start, end)).length;
  const evts    = generationEvents.filter((e) => inRange(e.generatedAt, start, end));
  const generated   = evts.filter((e) => !e.isRegeneration).length;
  const regenerated = evts.filter((e) => e.isRegeneration).length;
  const tasksCreated = tasksInScope.filter((t) => inRange(t.createdAt, start, end)).length;
  const subs = submissionsInScope.filter((s) => inRange(s.submittedAt, start, end));
  const reviews = submissionsInScope.filter((s) => inRange(s.gradedAt, start, end));
  const graded = reviews.filter((s) => s.grade != null);
  const avgGrade = graded.length > 0
    ? Math.round((graded.reduce((sum, s) => sum + s.grade, 0) / graded.length) * 10) / 10
    : null;

  return {
    label,
    date: start,
    studentsAdded: added,
    studentsRemoved: removed,
    groupsGenerated: generated,
    groupsRegenerated: regenerated,
    tasksCreated,
    submissions: subs.length,
    reviews: reviews.length,
    averageGrade: avgGrade,
  };
}

function buildEmptyReport(meta, period) {
  return {
    meta,
    overview: {
      current: { activeStudents: 0, activeCohorts: 0, activeGroups: 0, studentsAssigned: 0, studentsUnassigned: 0, openTasks: 0, pendingReviews: 0, overallAverageGrade: null },
      period:  { studentsAdded: 0, studentsRemoved: 0, studentsRestored: 0, tasksCreated: 0, submissionsReceived: 0, reviewsCompleted: 0, groupsGenerated: 0, groupsRegenerated: 0 },
    },
    studentActivity:   { current: { activeStudents: 0, assigned: 0, unassigned: 0 }, period: { added: 0, removed: 0, restored: 0 } },
    groupFormation:    { groupsGenerated: 0, groupsRegenerated: 0, activeGroups: 0, emptyGroups: 0, studentsAssigned: 0, studentsUnassigned: 0, avgGroupSize: 0, avgGroupGrade: null, highestPerformingGroup: null, lowestPerformingGroup: null },
    taskActivity:      { tasksCreated: 0, tasksDue: 0, tasksEffectivelyClosed: 0, openTasksNow: 0, overdueTasksNow: 0 },
    submissionActivity:{ submitted: 0, onTime: 0, late: 0, expected: 0, missing: 0 },
    reviewActivity:    { submissionsReceived: 0, reviewsCompleted: 0, reviewsPending: 0, completionRatePercent: null },
    groupPerformance:  { overallAverageGrade: null, avgGroupGrade: null, highestPerformingGroup: null, lowestPerformingGroup: null, gradedSubmissionsCount: 0 },
    periodBreakdown: period.reportType === 'daily' ? null : [],
  };
}

module.exports = { getAnalyticsReport, resolvePeriod, classifyGenerationEvents };
