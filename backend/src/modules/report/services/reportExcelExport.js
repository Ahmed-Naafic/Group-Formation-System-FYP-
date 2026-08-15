const ExcelJS = require('exceljs');

// Same palette the existing group/grades exports already use
// (report/services/reportService.js) — kept consistent rather than
// inventing a second style.
const C_GREEN    = 'FF1D6F42';
const C_WHITE    = 'FFFFFFFF';
const C_LT_GREEN = 'FFC6EFCE';
const C_DK_GREEN = 'FF276221';

function styleTitle(cell) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_GREEN } };
  cell.font = { name: 'Arial', size: 13, bold: true, color: { argb: C_WHITE } };
}
function styleSectionHeader(cell) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_LT_GREEN } };
  cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: C_DK_GREEN } };
}
function styleLabel(cell) {
  cell.font = { name: 'Arial', size: 10, bold: true };
}

function fmt(value) {
  if (value === null || value === undefined) return '—';
  return value;
}

function addMetricRows(ws, pairs) {
  for (const [label, value] of pairs) {
    const row = ws.addRow([label, fmt(value)]);
    styleLabel(row.getCell(1));
  }
}

function periodLabel(meta) {
  const s = meta.periodStart.toISOString().slice(0, 10);
  const e = meta.periodEnd.toISOString().slice(0, 10);
  return `${meta.reportType[0].toUpperCase()}${meta.reportType.slice(1)} report — ${s} to ${e}`;
}

function buildAnalyticsExcel(report) {
  const { meta, overview, studentActivity, groupFormation, taskActivity, submissionActivity, reviewActivity, groupPerformance, periodBreakdown } = report;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'JUST Group Formation System';
  wb.created = new Date();

  // ── Overview ──────────────────────────────────────────────────────────────
  const ov = wb.addWorksheet('Overview');
  ov.getColumn(1).width = 28;
  ov.getColumn(2).width = 20;
  const titleRow = ov.addRow([periodLabel(meta)]);
  styleTitle(titleRow.getCell(1));
  ov.mergeCells(`A${titleRow.number}:B${titleRow.number}`);
  ov.addRow([]);
  const curHdr = ov.addRow(['Current Snapshot', '']);
  styleSectionHeader(curHdr.getCell(1)); styleSectionHeader(curHdr.getCell(2));
  addMetricRows(ov, [
    ['Active Students',        overview.current.activeStudents],
    ['Active Cohorts',         overview.current.activeCohorts],
    ['Active Groups',          overview.current.activeGroups],
    ['Students Assigned',      overview.current.studentsAssigned],
    ['Students Unassigned',    overview.current.studentsUnassigned],
    ['Open Tasks',             overview.current.openTasks],
    ['Pending Reviews',        overview.current.pendingReviews],
    ['Overall Average Grade',  overview.current.overallAverageGrade],
  ]);
  ov.addRow([]);
  const perHdr = ov.addRow(['Period Activity', '']);
  styleSectionHeader(perHdr.getCell(1)); styleSectionHeader(perHdr.getCell(2));
  addMetricRows(ov, [
    ['Students Added',       overview.period.studentsAdded],
    ['Students Removed',     overview.period.studentsRemoved],
    ['Students Restored',    overview.period.studentsRestored],
    ['Tasks Created',        overview.period.tasksCreated],
    ['Submissions Received', overview.period.submissionsReceived],
    ['Reviews Completed',    overview.period.reviewsCompleted],
    ['Groups Generated',     overview.period.groupsGenerated],
    ['Groups Regenerated',   overview.period.groupsRegenerated],
  ]);

  // ── Student Activity ─────────────────────────────────────────────────────
  const sa = wb.addWorksheet('Student Activity');
  sa.getColumn(1).width = 24; sa.getColumn(2).width = 16;
  const saHdr1 = sa.addRow(['Current Snapshot', '']); styleSectionHeader(saHdr1.getCell(1)); styleSectionHeader(saHdr1.getCell(2));
  addMetricRows(sa, [
    ['Active Students', studentActivity.current.activeStudents],
    ['Assigned',        studentActivity.current.assigned],
    ['Unassigned',       studentActivity.current.unassigned],
  ]);
  sa.addRow([]);
  const saHdr2 = sa.addRow(['Period Activity', '']); styleSectionHeader(saHdr2.getCell(1)); styleSectionHeader(saHdr2.getCell(2));
  addMetricRows(sa, [
    ['Added',    studentActivity.period.added],
    ['Removed',  studentActivity.period.removed],
    ['Restored', studentActivity.period.restored],
  ]);

  // ── Group Formation Metrics (aggregated only — no groups list) ───────────
  const gf = wb.addWorksheet('Group Formation');
  gf.getColumn(1).width = 26; gf.getColumn(2).width = 34;
  addMetricRows(gf, [
    ['Groups Generated',        groupFormation.groupsGenerated],
    ['Groups Regenerated',      groupFormation.groupsRegenerated],
    ['Active Groups',           groupFormation.activeGroups],
    ['Empty/Inactive Groups',   groupFormation.emptyGroups],
    ['Students Assigned',       groupFormation.studentsAssigned],
    ['Students Unassigned',     groupFormation.studentsUnassigned],
    ['Average Group Size',      groupFormation.avgGroupSize],
    ['Average Group Grade',     groupFormation.avgGroupGrade],
    ['Highest-Performing Group', groupFormation.highestPerformingGroup
      ? `${groupFormation.highestPerformingGroup.name} (${groupFormation.highestPerformingGroup.average})` : '—'],
    ['Lowest-Performing Group', groupFormation.lowestPerformingGroup
      ? `${groupFormation.lowestPerformingGroup.name} (${groupFormation.lowestPerformingGroup.average})` : '—'],
  ]);

  // ── Task Activity ─────────────────────────────────────────────────────────
  const ta = wb.addWorksheet('Task Activity');
  ta.getColumn(1).width = 24; ta.getColumn(2).width = 16;
  addMetricRows(ta, [
    ['Tasks Created',           taskActivity.tasksCreated],
    ['Tasks Due (in period)',   taskActivity.tasksDue],
    ['Tasks Effectively Closed', taskActivity.tasksEffectivelyClosed],
    ['Open Tasks (now)',        taskActivity.openTasksNow],
    ['Overdue Tasks (now)',     taskActivity.overdueTasksNow],
  ]);

  // ── Submission Activity ──────────────────────────────────────────────────
  const sub = wb.addWorksheet('Submission Activity');
  sub.getColumn(1).width = 24; sub.getColumn(2).width = 16;
  addMetricRows(sub, [
    ['Submitted (in period)', submissionActivity.submitted],
    ['On Time',               submissionActivity.onTime],
    ['Late',                  submissionActivity.late],
    ['Expected (tasks due in period)', submissionActivity.expected],
    ['Missing',                submissionActivity.missing],
  ]);

  // ── Review Activity ───────────────────────────────────────────────────────
  const rv = wb.addWorksheet('Review Activity');
  rv.getColumn(1).width = 26; rv.getColumn(2).width = 16;
  addMetricRows(rv, [
    ['Submissions Received',       reviewActivity.submissionsReceived],
    ['Reviews Completed',          reviewActivity.reviewsCompleted],
    ['Reviews Pending (now)',      reviewActivity.reviewsPending],
    ['Completion Rate (period) %', reviewActivity.completionRatePercent],
  ]);

  // ── Group Performance ─────────────────────────────────────────────────────
  const gp = wb.addWorksheet('Group Performance');
  gp.getColumn(1).width = 26; gp.getColumn(2).width = 34;
  addMetricRows(gp, [
    ['Overall Average Grade',   groupPerformance.overallAverageGrade],
    ['Average Group Grade',     groupPerformance.avgGroupGrade],
    ['Graded Submissions',      groupPerformance.gradedSubmissionsCount],
    ['Highest-Performing Group', groupPerformance.highestPerformingGroup
      ? `${groupPerformance.highestPerformingGroup.name} (${groupPerformance.highestPerformingGroup.average})` : '—'],
    ['Lowest-Performing Group', groupPerformance.lowestPerformingGroup
      ? `${groupPerformance.lowestPerformingGroup.name} (${groupPerformance.lowestPerformingGroup.average})` : '—'],
  ]);

  // ── Period Breakdown ──────────────────────────────────────────────────────
  if (periodBreakdown && periodBreakdown.length > 0) {
    const pb = wb.addWorksheet('Period Breakdown');
    const cols = [
      { header: meta.reportType === 'weekly' ? 'Day' : 'Week', key: 'label', width: 22 },
      { header: 'Students Added',   key: 'studentsAdded',   width: 14 },
      { header: 'Students Removed', key: 'studentsRemoved', width: 14 },
      { header: 'Groups Generated', key: 'groupsGenerated', width: 14 },
      { header: 'Groups Regenerated', key: 'groupsRegenerated', width: 16 },
      { header: 'Tasks Created',    key: 'tasksCreated',    width: 12 },
      { header: 'Submissions',      key: 'submissions',     width: 12 },
      { header: 'Reviews',          key: 'reviews',          width: 10 },
      { header: 'Average Grade',    key: 'averageGrade',     width: 12 },
    ];
    pb.columns = cols;
    const hRow = pb.getRow(1);
    cols.forEach((c, i) => styleSectionHeader(hRow.getCell(i + 1)));
    for (const row of periodBreakdown) {
      pb.addRow({ ...row, averageGrade: fmt(row.averageGrade) });
    }
  }

  return wb;
}

module.exports = { buildAnalyticsExcel };
