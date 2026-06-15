const ExcelJS                  = require('exceljs');
const groupRepository          = require('../../group/repositories/groupRepository');
const attendanceRepository     = require('../../attendance/repositories/attendanceRepository');
const courseOfferingService    = require('../../courseOffering/services/courseOfferingService');
const { BadRequestError } = require('../../../common/errors');

const reportService = {
  /**
   * Generates an Excel workbook with two sheets:
   *   Sheet 1 — Groups summary
   *   Sheet 2 — Student roster with per-offering attendance from the Attendance table
   */
  async buildGroupReport(courseOfferingId, context) {
    if (!courseOfferingId) throw new BadRequestError('courseOfferingId is required');
    await courseOfferingService.getById(courseOfferingId, context);

    const groups        = await groupRepository.findByCourseOffering(courseOfferingId);
    const attendanceMap = await attendanceRepository.getAttendanceMap(courseOfferingId);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'JUST Group Formation System';
    wb.created = new Date();

    // ── Sheet 1: Groups ──────────────────────────────────────────────────────
    const gs = wb.addWorksheet('Groups');
    gs.columns = [
      { header: 'Group',        key: 'name',        width: 28 },
      { header: 'Leader',       key: 'leader',       width: 24 },
      { header: 'Members',      key: 'memberCount',  width: 10 },
      { header: 'Generated At', key: 'generatedAt',  width: 20 },
    ];
    gs.getRow(1).font = { bold: true };

    for (const g of groups) {
      gs.addRow({
        name:        g.name,
        leader:      g.leaderId?.fullName ?? '—',
        memberCount: g.memberIds?.length ?? 0,
        generatedAt: g.generatedAt ? g.generatedAt.toISOString().slice(0, 10) : '—',
      });
    }

    // ── Sheet 2: Students ────────────────────────────────────────────────────
    const ss = wb.addWorksheet('Students');
    ss.columns = [
      { header: 'Student ID',    key: 'studentId',   width: 16 },
      { header: 'Full Name',     key: 'fullName',     width: 26 },
      { header: 'Group',         key: 'group',        width: 28 },
      { header: 'Role',          key: 'role',         width: 10 },
      { header: 'Category',      key: 'category',     width: 12 },
      { header: 'Avg Score',     key: 'avgScore',     width: 12 },
      { header: 'Attendance %',  key: 'attendance',   width: 14 },
    ];
    ss.getRow(1).font = { bold: true };

    for (const g of groups) {
      for (const m of g.memberIds ?? []) {
        const isLeader   = String(g.leaderId?._id ?? g.leaderId) === String(m._id);
        const attendance = attendanceMap.get(String(m._id)) ?? 0;
        ss.addRow({
          studentId:  m.userId?.studentId ?? '—',
          fullName:   m.fullName,
          group:      g.name,
          role:       isLeader ? 'Leader' : 'Member',
          category:   m.performanceCategory ?? 'UNGRADED',
          avgScore:   m.averageScore != null ? m.averageScore.toFixed(1) : '—',
          attendance,
        });
      }
    }

    return wb;
  },

  /**
   * Returns an array of plain row objects (CSV-friendly).
   */
  async buildGroupCsv(courseOfferingId, context) {
    if (!courseOfferingId) throw new BadRequestError('courseOfferingId is required');
    await courseOfferingService.getById(courseOfferingId, context);

    const groups        = await groupRepository.findByCourseOffering(courseOfferingId);
    const attendanceMap = await attendanceRepository.getAttendanceMap(courseOfferingId);
    const rows = [];

    for (const g of groups) {
      for (const m of g.memberIds ?? []) {
        const isLeader   = String(g.leaderId?._id ?? g.leaderId) === String(m._id);
        const attendance = attendanceMap.get(String(m._id)) ?? 0;
        rows.push({
          studentId:           m.userId?.studentId ?? '',
          fullName:            m.fullName,
          group:               g.name,
          role:                isLeader ? 'Leader' : 'Member',
          performanceCategory: m.performanceCategory ?? 'UNGRADED',
          averageScore:        m.averageScore != null ? m.averageScore.toFixed(1) : '',
          attendance,
        });
      }
    }

    return rows;
  },
};

module.exports = reportService;
