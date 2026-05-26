const ExcelJS         = require('exceljs');
const groupRepository = require('../../group/repositories/groupRepository');
const classService    = require('../../class/services/classService');
const courseAssignmentService = require('../../courseAssignment/services/courseAssignmentService');
const { ForbiddenError, BadRequestError } = require('../../../common/errors');

async function assertAccess(classId, context) {
  if (context.role === 'admin') return;
  const allowed = await courseAssignmentService.hasAccess(context.userId, String(classId));
  if (!allowed) throw new ForbiddenError('You are not assigned to this class');
}

const reportService = {
  /**
   * Generates an Excel workbook with two sheets:
   *   Sheet 1 — Groups summary
   *   Sheet 2 — Student roster with performance data
   * Returns the ExcelJS Workbook instance for streaming.
   */
  async buildGroupReport(classId, courseId, context) {
    if (!classId || !courseId) throw new BadRequestError('classId and courseId are required');
    await classService.getById(classId);
    await assertAccess(classId, context);

    const groups = await groupRepository.findByCourse(classId, courseId);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'JUST Group Formation System';
    wb.created = new Date();

    // ── Sheet 1: Groups ──────────────────────────────────────────────────────
    const gs = wb.addWorksheet('Groups');
    gs.columns = [
      { header: 'Group',       key: 'name',       width: 28 },
      { header: 'Leader',      key: 'leader',      width: 24 },
      { header: 'Members',     key: 'memberCount', width: 10 },
      { header: 'Generated At', key: 'generatedAt', width: 20 },
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
      { header: 'Student ID',   key: 'studentId',   width: 16 },
      { header: 'Full Name',    key: 'fullName',     width: 26 },
      { header: 'Group',        key: 'group',        width: 28 },
      { header: 'Role',         key: 'role',         width: 10 },
      { header: 'Category',     key: 'category',     width: 12 },
      { header: 'Avg Score',    key: 'avgScore',     width: 12 },
      { header: 'Attendance %', key: 'attendance',   width: 14 },
    ];
    ss.getRow(1).font = { bold: true };

    for (const g of groups) {
      for (const m of g.memberIds ?? []) {
        const isLeader = String(g.leaderId?._id ?? g.leaderId) === String(m._id);
        ss.addRow({
          studentId:  m.userId?.studentId ?? '—',
          fullName:   m.fullName,
          group:      g.name,
          role:       isLeader ? 'Leader' : 'Member',
          category:   m.performanceCategory ?? 'UNGRADED',
          avgScore:   m.averageScore != null ? m.averageScore.toFixed(1) : '—',
          attendance: m.attendance ?? 0,
        });
      }
    }

    return wb;
  },

  /**
   * Streams a plain CSV of the student roster (lightweight alternative).
   * Returns an array of rows as plain objects for the controller to serialise.
   */
  async buildGroupCsv(classId, courseId, context) {
    if (!classId || !courseId) throw new BadRequestError('classId and courseId are required');
    await classService.getById(classId);
    await assertAccess(classId, context);

    const groups = await groupRepository.findByCourse(classId, courseId);
    const rows   = [];

    for (const g of groups) {
      for (const m of g.memberIds ?? []) {
        const isLeader = String(g.leaderId?._id ?? g.leaderId) === String(m._id);
        rows.push({
          studentId:           m.userId?.studentId ?? '',
          fullName:            m.fullName,
          group:               g.name,
          role:                isLeader ? 'Leader' : 'Member',
          performanceCategory: m.performanceCategory ?? 'UNGRADED',
          averageScore:        m.averageScore != null ? m.averageScore.toFixed(1) : '',
          attendance:          m.attendance ?? 0,
        });
      }
    }

    return rows;
  },
};

module.exports = reportService;
