const asyncHandler    = require('../../../common/utils/asyncHandler');
const reportService   = require('../services/reportService');
const { getAnalyticsReport } = require('../services/reportAnalyticsService');
const { buildAnalyticsExcel } = require('../services/reportExcelExport');
const { buildAnalyticsPdf }   = require('../services/reportPdfExport');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const { BadRequestError } = require('../../../common/errors');

function analyticsParams(req) {
  return {
    reportType:       req.query.reportType,
    date:             req.query.date,
    weekStart:        req.query.weekStart,
    year:             req.query.year,
    month:            req.query.month,
    courseOfferingId: req.query.courseOfferingId,
    cohortId:         req.query.cohortId,
  };
}

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape  = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines   = [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ];
  return lines.join('\r\n');
}

const reportController = {
  // GET /api/reports/groups/formatted?courseOfferingId=
  formattedGroupReport: asyncHandler(async (req, res) => {
    const { courseOfferingId } = req.query;
    if (!courseOfferingId) throw new BadRequestError('courseOfferingId is required');

    const wb = await reportService.exportFormattedGroupsExcel(courseOfferingId, req.context);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="group_list.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  }),

  // GET /api/reports/groups?courseOfferingId=&format=xlsx|csv
  groupReport: asyncHandler(async (req, res) => {
    const { courseOfferingId, format = 'xlsx' } = req.query;
    if (!courseOfferingId) throw new BadRequestError('courseOfferingId is required');

    if (format === 'csv') {
      const rows = await reportService.buildGroupCsv(courseOfferingId, req.context);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="groups.csv"');
      return res.send(toCsv(rows));
    }

    const wb = await reportService.buildGroupReport(courseOfferingId, req.context);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="groups.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  }),

  // GET /api/reports/tasks/:taskId/grades?format=xlsx|csv
  taskGrades: asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    const { format = 'xlsx' } = req.query;

    if (format === 'csv') {
      const rows = await reportService.buildTaskGradesCsv(taskId, req.context);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="grades.csv"');
      return res.send(toCsv(rows));
    }

    const wb = await reportService.buildTaskGradesExcel(taskId, req.context);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="grades.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  }),

  // GET /api/reports/analytics?reportType=daily|weekly|monthly&...
  // The one calculation reused by the web view, PDF, and Excel exports below.
  getAnalytics: asyncHandler(async (req, res) => {
    const report = await getAnalyticsReport(analyticsParams(req), req.context);
    return sendSuccess(res, { data: { report } });
  }),

  // GET /api/reports/analytics/excel?reportType=...
  exportAnalyticsExcel: asyncHandler(async (req, res) => {
    const report = await getAnalyticsReport(analyticsParams(req), req.context);
    const wb = buildAnalyticsExcel(report);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="report-${report.meta.reportType}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  }),

  // GET /api/reports/analytics/pdf?reportType=...
  exportAnalyticsPdf: asyncHandler(async (req, res) => {
    const report = await getAnalyticsReport(analyticsParams(req), req.context);
    const doc = buildAnalyticsPdf(report);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-${report.meta.reportType}.pdf"`);
    doc.pipe(res);
    doc.end();
  }),
};

module.exports = reportController;
