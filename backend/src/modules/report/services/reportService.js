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

  async exportFormattedGroupsExcel(courseOfferingId, context) {
    if (!courseOfferingId) throw new BadRequestError('courseOfferingId is required');
    const offering = await courseOfferingService.getById(courseOfferingId, context);
    const groups   = await groupRepository.findByCourseOffering(courseOfferingId);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Group Report');

    ws.getColumn(1).width = 14;
    ws.getColumn(2).width = 28;
    ws.getColumn(3).width = 14;
    ws.getColumn(4).width = 16;

    const C_GREEN    = 'FF1D6F42';
    const C_WHITE    = 'FFFFFFFF';
    const C_LT_GREEN = 'FFC6EFCE';
    const C_DK_GREEN = 'FF276221';
    const C_YELLOW   = 'FFFFF9E6';
    const C_LT_GRAY  = 'FFF9F9F9';

    function applyFill(cell, argb) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
    }
    function applyFont(cell, { bold = false, color = 'FF000000', size = 11 } = {}) {
      cell.font = { name: 'Arial', size, bold, color: { argb: color } };
    }
    function style(cell, fillArgb, fontOpts = {}) {
      if (fillArgb) applyFill(cell, fillArgb);
      applyFont(cell, fontOpts);
    }

    const courseName     = offering.courseId?.name         ?? '—';
    const cohortName     = offering.cohortId?.name         ?? '—';
    const semesterName   = offering.semesterId?.name       ?? '—';
    const instructorName = offering.instructorId?.fullName ?? '—';
    const totalStudents  = groups.reduce((s, g) => s + (g.memberIds?.length ?? 0), 0);

    const now = new Date();
    const dateStr = [
      String(now.getDate()).padStart(2, '0'),
      String(now.getMonth() + 1).padStart(2, '0'),
      now.getFullYear(),
    ].join('/');

    // Row 1 — title (merged A:C)
    const r1 = ws.addRow([`Group Formation Report — ${courseName}`]);
    [1, 2, 3].forEach(c => style(r1.getCell(c), C_GREEN, { bold: true, color: C_WHITE, size: 12 }));
    ws.mergeCells(`A${r1.number}:C${r1.number}`);

    // Rows 2–4 — metadata (label bold in A/C, value in B/D)
    const metaRows = [
      ['Cohort',     cohortName,     'Semester',       semesterName],
      ['Generated',  dateStr,        'Total groups',   groups.length],
      ['Instructor', instructorName, 'Total students', totalStudents],
    ];
    for (const values of metaRows) {
      const r = ws.addRow(values);
      [1, 3].forEach(c => applyFont(r.getCell(c), { bold: true }));
      [2, 4].forEach(c => applyFont(r.getCell(c)));
    }

    // Row 5 — spacer
    ws.addRow([]);

    for (const group of groups) {
      const leaderId = String(group.leaderId?._id ?? group.leaderId);
      const leader   = group.memberIds?.find(m => String(m._id) === leaderId);
      const members  = group.memberIds?.filter(m => String(m._id) !== leaderId) ?? [];

      ws.addRow([]); // spacer before each group

      // Group header (merged A:D)
      const ghRow = ws.addRow([group.name]);
      [1, 2, 3, 4].forEach(c => style(ghRow.getCell(c), C_GREEN, { bold: true, color: C_WHITE }));
      ws.mergeCells(`A${ghRow.number}:D${ghRow.number}`);

      // Column headers
      const chRow = ws.addRow(['#', 'Student name', 'Role']);
      [1, 2, 3].forEach(c => style(chRow.getCell(c), C_LT_GREEN, { bold: true, color: C_DK_GREEN }));

      // Leader row
      if (leader) {
        const lRow = ws.addRow(['1', leader.fullName, 'Leader']);
        [1, 2, 3].forEach(c => style(lRow.getCell(c), C_YELLOW));
      }

      // Member rows — alternate fill on even row numbers
      members.forEach((m, idx) => {
        const rowNum = idx + 2;
        const bg     = rowNum % 2 === 0 ? C_LT_GRAY : C_WHITE;
        const mRow   = ws.addRow([String(rowNum), m.fullName, 'Member']);
        [1, 2, 3].forEach(c => style(mRow.getCell(c), bg));
      });
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
