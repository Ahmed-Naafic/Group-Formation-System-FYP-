const ExcelJS                  = require('exceljs');
const groupRepository          = require('../../group/repositories/groupRepository');
const attendanceRepository     = require('../../attendance/repositories/attendanceRepository');
const courseOfferingService    = require('../../courseOffering/services/courseOfferingService');
const taskRepository           = require('../../task/repositories/taskRepository');
const submissionRepository     = require('../../submission/repositories/submissionRepository');
const studentRepository        = require('../../student/repositories/studentRepository');
const { BadRequestError, NotFoundError } = require('../../../common/errors');

const STATUS_LABELS = {
  draft:     'Draft',
  submitted: 'Submitted',
  late:      'Late',
  reviewed:  'Reviewed',
};

// Short group label for reports (e.g. "G3"). Falls back to a number parsed out
// of the full name for groups created before the `code` field existed.
function groupCode(group) {
  if (!group) return 'Ungrouped';
  if (group.code) return group.code;
  const match = /(\d+)\s*$/.exec(group.name ?? '');
  return match ? `G${match[1]}` : (group.name ?? 'Ungrouped');
}

// Builds one row per student — every student enrolled in the offering's cohort,
// always, regardless of whether they submitted or were even assigned this task.
// Ungraded/unsubmitted students still get a row with grade 0, never blank, so the
// roster can be handed to a department as a complete mark sheet.
//
// Individual-mode tasks: grade comes from that student's own submission.
// Group-mode tasks: grade is the member's per-student override
// (Submission.memberGrades) if the instructor set one, else the shared group grade.
async function buildTaskGradesRoster(taskId, context) {
  const task = await taskRepository.findById(taskId);
  if (!task) throw new NotFoundError('Task not found');

  const courseOfferingId = String(task.courseOfferingId?._id ?? task.courseOfferingId);
  const offering = await courseOfferingService.getById(courseOfferingId, context);
  const cohortId = String(offering.cohortId?._id ?? offering.cohortId);

  const [students, groups, submissions] = await Promise.all([
    studentRepository.findAll({ cohortId, deletedAt: null }),
    groupRepository.findByCourseOffering(courseOfferingId),
    submissionRepository.findByTask(taskId),
  ]);

  const groupByStudentId = new Map();
  for (const g of groups) {
    for (const m of g.memberIds ?? []) {
      groupByStudentId.set(String(m._id), g);
    }
  }

  const isIndividual = task.submissionType === 'individual';

  const submissionByStudentId = new Map(
    submissions.map((s) => [String(s.submittedBy?._id ?? s.submittedBy), s]),
  );
  const submissionByGroupId = new Map(
    submissions.map((s) => [String(s.groupId?._id ?? s.groupId), s]),
  );

  function gradeAndStatus(studentId, group) {
    if (isIndividual) {
      const s = submissionByStudentId.get(studentId);
      if (!s) return { grade: 0, status: 'Not submitted', submittedAt: null };
      return { grade: s.grade ?? 0, status: STATUS_LABELS[s.status] ?? s.status, submittedAt: s.submittedAt };
    }
    const s = group ? submissionByGroupId.get(String(group._id)) : null;
    if (!s) return { grade: 0, status: 'Not submitted', submittedAt: null };
    const override = (s.memberGrades ?? []).find(
      (mg) => String(mg.studentId?._id ?? mg.studentId) === studentId,
    );
    const grade = override?.grade ?? s.grade ?? 0;
    return { grade, status: STATUS_LABELS[s.status] ?? s.status, submittedAt: s.submittedAt };
  }

  const rows = students.map((student) => {
    const sid   = String(student._id);
    const group = groupByStudentId.get(sid) ?? null;
    const { grade, status, submittedAt } = gradeAndStatus(sid, group);
    return {
      studentId:   student.userId?.studentId ?? '',
      fullName:    student.fullName,
      groupCode:   groupCode(group),
      status,
      grade,
      submittedAt: submittedAt ? submittedAt.toISOString().slice(0, 10) : '',
    };
  });

  rows.sort((a, b) =>
    a.groupCode.localeCompare(b.groupCode, undefined, { numeric: true }) ||
    a.fullName.localeCompare(b.fullName),
  );

  return { task, offering, rows };
}

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

  /**
   * Grades export for a single task: one row per student, always covering the
   * whole cohort roster (see buildTaskGradesRoster), color-coded by status and
   * score band so an instructor can scan a large class at a glance.
   */
  async buildTaskGradesExcel(taskId, context) {
    const { task, offering, rows } = await buildTaskGradesRoster(taskId, context);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'JUST Group Formation System';
    wb.created = new Date();
    const ws = wb.addWorksheet('Grades');

    const columns = [
      { header: '#',            key: 'idx',         width: 5  },
      { header: 'Student ID',   key: 'studentId',    width: 16 },
      { header: 'Full Name',    key: 'fullName',     width: 26 },
      { header: 'Group',        key: 'groupCode',    width: 10 },
      { header: 'Status',       key: 'status',       width: 14 },
      { header: 'Grade',        key: 'grade',        width: 10 },
      { header: 'Submitted At', key: 'submittedAt',  width: 14 },
    ];
    const colCount   = columns.length;
    const lastColLtr = String.fromCharCode(64 + colCount);
    columns.forEach((c, i) => { ws.getColumn(i + 1).width = c.width; });

    // ── Palette ────────────────────────────────────────────────────────────────
    const C_GREEN    = 'FF1D6F42';
    const C_WHITE    = 'FFFFFFFF';
    const C_LT_GREEN = 'FFC6EFCE';
    const C_DK_GREEN = 'FF276221';
    const C_ROW_A    = 'FFFFFFFF';
    const C_ROW_B    = 'FFF3F7F4';

    const STATUS_STYLE = {
      Reviewed:        { fill: 'FFC6EFCE', font: 'FF1E7B34' },
      Submitted:       { fill: 'FFD6E4FF', font: 'FF1D4ED8' },
      Late:            { fill: 'FFFFE8B3', font: 'FF9A6400' },
      Draft:           { fill: 'FFEDEDED', font: 'FF666666' },
      'Not submitted': { fill: 'FFFAD4D4', font: 'FFB42318' },
    };

    function applyFill(cell, argb) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
    }
    function applyFont(cell, { bold = false, color = 'FF1A1A1A', size = 11, italic = false } = {}) {
      cell.font = { name: 'Arial', size, bold, italic, color: { argb: color } };
    }
    function gradeColor(status, grade) {
      if (status === 'Not submitted' || status === 'Draft') return 'FF9AA0A6';
      if (grade >= 70) return 'FF1E7B34';
      if (grade >= 40) return 'FF9A6400';
      return 'FFB42318';
    }

    const courseName   = offering.courseId?.name ?? '—';
    const cohortName   = offering.cohortId?.name ?? '—';
    const deadlineStr  = task.deadline
      ? new Date(task.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';
    const gradedCount  = rows.filter((r) => r.status === 'Reviewed').length;

    // Title banner
    const r1 = ws.addRow([`Grades — ${task.title}`]);
    for (let c = 1; c <= colCount; c++) applyFill(r1.getCell(c), C_GREEN);
    applyFont(r1.getCell(1), { bold: true, color: C_WHITE, size: 13 });
    ws.mergeCells(`A${r1.number}:${lastColLtr}${r1.number}`);
    r1.height = 22;

    // Meta line
    const r2 = ws.addRow([
      `Course: ${courseName} — ${cohortName}    Deadline: ${deadlineStr}    ` +
      `Students: ${rows.length}    Graded: ${gradedCount}/${rows.length}`,
    ]);
    applyFont(r2.getCell(1), { italic: true, color: 'FF555555', size: 10 });
    ws.mergeCells(`A${r2.number}:${lastColLtr}${r2.number}`);

    ws.addRow([]); // spacer

    // Column headers
    const headerRow = ws.addRow(columns.map((c) => c.header));
    for (let c = 1; c <= colCount; c++) {
      applyFill(headerRow.getCell(c), C_LT_GREEN);
      applyFont(headerRow.getCell(c), { bold: true, color: C_DK_GREEN });
      headerRow.getCell(c).alignment = { vertical: 'middle' };
    }
    headerRow.height = 18;
    ws.views = [{ state: 'frozen', ySplit: headerRow.number }];
    ws.autoFilter = { from: { row: headerRow.number, column: 1 }, to: { row: headerRow.number, column: colCount } };

    // Data rows
    rows.forEach((row, i) => {
      const excelRow = ws.addRow([i + 1, row.studentId, row.fullName, row.groupCode, row.status, row.grade, row.submittedAt]);
      const bandColor = i % 2 === 0 ? C_ROW_A : C_ROW_B;

      for (let c = 1; c <= colCount; c++) {
        applyFill(excelRow.getCell(c), bandColor);
        applyFont(excelRow.getCell(c));
      }

      const statusCell = excelRow.getCell(5);
      const statusStyle = STATUS_STYLE[row.status] ?? STATUS_STYLE.Draft;
      applyFill(statusCell, statusStyle.fill);
      applyFont(statusCell, { bold: true, color: statusStyle.font, size: 10 });
      statusCell.alignment = { horizontal: 'center' };

      const gradeCell = excelRow.getCell(6);
      applyFont(gradeCell, { bold: true, color: gradeColor(row.status, row.grade) });
      gradeCell.alignment = { horizontal: 'center' };
      gradeCell.numFmt = '0"/100"';

      excelRow.getCell(4).alignment = { horizontal: 'center' };
      excelRow.getCell(1).alignment = { horizontal: 'center' };
    });

    // Outer border for the whole table
    const firstDataRow = headerRow.number;
    const lastDataRow  = headerRow.number + rows.length;
    for (let r = firstDataRow; r <= lastDataRow; r++) {
      for (let c = 1; c <= colCount; c++) {
        ws.getRow(r).getCell(c).border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        };
      }
    }

    return wb;
  },

  /**
   * Returns an array of plain row objects (CSV-friendly), one per student.
   */
  async buildTaskGradesCsv(taskId, context) {
    const { rows } = await buildTaskGradesRoster(taskId, context);
    return rows;
  },
};

module.exports = reportService;
