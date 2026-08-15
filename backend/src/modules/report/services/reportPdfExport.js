const PDFDocument = require('pdfkit');

const GREEN = '#1D6F42';
const DARK  = '#1A1A1A';
const MUTED = '#666666';

function fmt(value) {
  if (value === null || value === undefined) return '—';
  return String(value);
}

function periodLabel(meta) {
  const s = meta.periodStart.toISOString().slice(0, 10);
  const e = meta.periodEnd.toISOString().slice(0, 10);
  return `${meta.reportType[0].toUpperCase()}${meta.reportType.slice(1)} report — ${s} to ${e}`;
}

function sectionTitle(doc, text) {
  doc.moveDown(0.8);
  doc.fontSize(13).fillColor(GREEN).font('Helvetica-Bold').text(text);
  doc.moveDown(0.3);
  doc.fillColor(DARK).font('Helvetica');
}

function metricRow(doc, label, value) {
  const y = doc.y;
  doc.fontSize(10).font('Helvetica-Bold').fillColor(DARK).text(label, 50, y, { continued: false, width: 260 });
  doc.fontSize(10).font('Helvetica').fillColor(DARK).text(fmt(value), 320, y);
}

function groupLabel(g) {
  return g ? `${g.name} (${g.average})` : '—';
}

// Builds a PDFDocument (not yet ended) for the given analytics report DTO —
// the exact same DTO the web view and Excel export both consume, per the
// "one calculation, three outputs" requirement. Caller pipes it to the
// response and calls doc.end().
function buildAnalyticsPdf(report) {
  const { meta, overview, studentActivity, groupFormation, taskActivity, submissionActivity, reviewActivity, groupPerformance, periodBreakdown } = report;

  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  // ── Header ────────────────────────────────────────────────────────────────
  doc.fontSize(18).fillColor(GREEN).font('Helvetica-Bold').text('JUST Group Formation System', { align: 'left' });
  doc.fontSize(14).fillColor(DARK).text(periodLabel(meta));
  doc.fontSize(9).fillColor(MUTED).font('Helvetica')
    .text(`Generated ${meta.generatedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC — ${meta.scope.offerings.length} course offering(s) in scope`);
  doc.moveDown(0.5);
  doc.strokeColor('#E0E0E0').moveTo(50, doc.y).lineTo(545, doc.y).stroke();

  // ── Overview ──────────────────────────────────────────────────────────────
  sectionTitle(doc, 'Overview — Current Snapshot');
  metricRow(doc, 'Active Students', overview.current.activeStudents); doc.moveDown(0.4);
  metricRow(doc, 'Active Cohorts', overview.current.activeCohorts); doc.moveDown(0.4);
  metricRow(doc, 'Active Groups', overview.current.activeGroups); doc.moveDown(0.4);
  metricRow(doc, 'Students Assigned', overview.current.studentsAssigned); doc.moveDown(0.4);
  metricRow(doc, 'Students Unassigned', overview.current.studentsUnassigned); doc.moveDown(0.4);
  metricRow(doc, 'Open Tasks', overview.current.openTasks); doc.moveDown(0.4);
  metricRow(doc, 'Pending Reviews', overview.current.pendingReviews); doc.moveDown(0.4);
  metricRow(doc, 'Overall Average Grade', overview.current.overallAverageGrade); doc.moveDown(0.4);

  sectionTitle(doc, 'Overview — Period Activity');
  metricRow(doc, 'Students Added', overview.period.studentsAdded); doc.moveDown(0.4);
  metricRow(doc, 'Students Removed', overview.period.studentsRemoved); doc.moveDown(0.4);
  metricRow(doc, 'Students Restored', overview.period.studentsRestored); doc.moveDown(0.4);
  metricRow(doc, 'Tasks Created', overview.period.tasksCreated); doc.moveDown(0.4);
  metricRow(doc, 'Submissions Received', overview.period.submissionsReceived); doc.moveDown(0.4);
  metricRow(doc, 'Reviews Completed', overview.period.reviewsCompleted); doc.moveDown(0.4);
  metricRow(doc, 'Groups Generated', overview.period.groupsGenerated); doc.moveDown(0.4);
  metricRow(doc, 'Groups Regenerated', overview.period.groupsRegenerated); doc.moveDown(0.4);

  // ── Student Activity ─────────────────────────────────────────────────────
  sectionTitle(doc, 'Student Activity');
  metricRow(doc, 'Active (current)', studentActivity.current.activeStudents); doc.moveDown(0.4);
  metricRow(doc, 'Assigned (current)', studentActivity.current.assigned); doc.moveDown(0.4);
  metricRow(doc, 'Unassigned (current)', studentActivity.current.unassigned); doc.moveDown(0.4);
  metricRow(doc, 'Added (period)', studentActivity.period.added); doc.moveDown(0.4);
  metricRow(doc, 'Removed (period)', studentActivity.period.removed); doc.moveDown(0.4);
  metricRow(doc, 'Restored (period)', studentActivity.period.restored); doc.moveDown(0.4);

  // ── Group Formation Metrics — aggregated only, no groups list ────────────
  sectionTitle(doc, 'Group Formation Metrics');
  metricRow(doc, 'Groups Generated', groupFormation.groupsGenerated); doc.moveDown(0.4);
  metricRow(doc, 'Groups Regenerated', groupFormation.groupsRegenerated); doc.moveDown(0.4);
  metricRow(doc, 'Active Groups', groupFormation.activeGroups); doc.moveDown(0.4);
  metricRow(doc, 'Empty/Inactive Groups', groupFormation.emptyGroups); doc.moveDown(0.4);
  metricRow(doc, 'Average Group Size', groupFormation.avgGroupSize); doc.moveDown(0.4);
  metricRow(doc, 'Average Group Grade', groupFormation.avgGroupGrade); doc.moveDown(0.4);
  metricRow(doc, 'Highest-Performing Group', groupLabel(groupFormation.highestPerformingGroup)); doc.moveDown(0.4);
  metricRow(doc, 'Lowest-Performing Group', groupLabel(groupFormation.lowestPerformingGroup)); doc.moveDown(0.4);

  // ── Task / Submission / Review Activity ──────────────────────────────────
  sectionTitle(doc, 'Task Activity');
  metricRow(doc, 'Tasks Created', taskActivity.tasksCreated); doc.moveDown(0.4);
  metricRow(doc, 'Tasks Due (in period)', taskActivity.tasksDue); doc.moveDown(0.4);
  metricRow(doc, 'Open Tasks (now)', taskActivity.openTasksNow); doc.moveDown(0.4);
  metricRow(doc, 'Overdue Tasks (now)', taskActivity.overdueTasksNow); doc.moveDown(0.4);

  sectionTitle(doc, 'Submission Activity');
  metricRow(doc, 'Submitted (in period)', submissionActivity.submitted); doc.moveDown(0.4);
  metricRow(doc, 'On Time', submissionActivity.onTime); doc.moveDown(0.4);
  metricRow(doc, 'Late', submissionActivity.late); doc.moveDown(0.4);
  metricRow(doc, 'Expected (tasks due in period)', submissionActivity.expected); doc.moveDown(0.4);
  metricRow(doc, 'Missing', submissionActivity.missing); doc.moveDown(0.4);

  sectionTitle(doc, 'Review Activity');
  metricRow(doc, 'Submissions Received', reviewActivity.submissionsReceived); doc.moveDown(0.4);
  metricRow(doc, 'Reviews Completed', reviewActivity.reviewsCompleted); doc.moveDown(0.4);
  metricRow(doc, 'Reviews Pending (now)', reviewActivity.reviewsPending); doc.moveDown(0.4);
  metricRow(doc, 'Completion Rate (period)', reviewActivity.completionRatePercent != null ? `${reviewActivity.completionRatePercent}%` : '—'); doc.moveDown(0.4);

  // ── Group Performance / Grades ────────────────────────────────────────────
  sectionTitle(doc, 'Group Performance / Grades');
  metricRow(doc, 'Overall Average Grade', groupPerformance.overallAverageGrade); doc.moveDown(0.4);
  metricRow(doc, 'Average Group Grade', groupPerformance.avgGroupGrade); doc.moveDown(0.4);
  metricRow(doc, 'Graded Submissions', groupPerformance.gradedSubmissionsCount); doc.moveDown(0.4);
  metricRow(doc, 'Highest-Performing Group', groupLabel(groupPerformance.highestPerformingGroup)); doc.moveDown(0.4);
  metricRow(doc, 'Lowest-Performing Group', groupLabel(groupPerformance.lowestPerformingGroup)); doc.moveDown(0.4);

  // ── Period Breakdown ──────────────────────────────────────────────────────
  if (periodBreakdown && periodBreakdown.length > 0) {
    sectionTitle(doc, meta.reportType === 'weekly' ? 'Daily Breakdown (Sat–Wed)' : 'Weekly Breakdown (Sat–Wed)');
    const colX = [50, 155, 230, 300, 370, 430, 480, 530];
    const headers = ['Period', 'Added', 'Removed', 'Grp Gen', 'Grp Regen', 'Tasks', 'Subs', 'Avg'];
    doc.fontSize(8).font('Helvetica-Bold');
    headers.forEach((h, i) => doc.text(h, colX[i], doc.y, { continued: i < headers.length - 1, width: 60 }));
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(8);
    for (const row of periodBreakdown) {
      const y = doc.y;
      doc.text(row.label, colX[0], y, { width: 100 });
      doc.text(fmt(row.studentsAdded), colX[1], y, { width: 60 });
      doc.text(fmt(row.studentsRemoved), colX[2], y, { width: 60 });
      doc.text(fmt(row.groupsGenerated), colX[3], y, { width: 60 });
      doc.text(fmt(row.groupsRegenerated), colX[4], y, { width: 60 });
      doc.text(fmt(row.tasksCreated), colX[5], y, { width: 50 });
      doc.text(fmt(row.submissions), colX[6], y, { width: 40 });
      doc.text(fmt(row.averageGrade), colX[7], y, { width: 50 });
      doc.moveDown(0.5);
    }
  }

  doc.fontSize(8).fillColor(MUTED).text(
    'This report shows aggregated analytics only. For detailed group membership and management, use the Groups page.',
    50, doc.page.height - 60, { width: 495, align: 'center' },
  );

  return doc;
}

module.exports = { buildAnalyticsPdf };
