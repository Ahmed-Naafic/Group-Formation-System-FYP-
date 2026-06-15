const asyncHandler    = require('../../../common/utils/asyncHandler');
const reportService   = require('../services/reportService');
const { BadRequestError } = require('../../../common/errors');

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
};

module.exports = reportController;
