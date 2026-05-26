const columnMapper = require('../utils/columnMapper');
const classService = require('../../class/services/classService');
const courseAssignmentService = require('../../courseAssignment/services/courseAssignmentService');
const userService = require('../../user/services/userService');
const studentService = require('../../student/services/studentService');
const performanceService = require('../../performance/services/performanceService');
const passwordGenerator = require('../../../common/utils/passwordGenerator');
const { ForbiddenError, BadRequestError } = require('../../../common/errors');

// averageScore is 0–100; blank/invalid → null (UNGRADED)
function parseAverageScore(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  if (Number.isNaN(n)) return null;
  return Math.min(100, Math.max(0, n));
}

// Attendance is a percentage 0–100; blank/invalid → 0
function parseAttendance(val) {
  if (val === null || val === undefined || val === '') return 0;
  const n = Number(val);
  if (Number.isNaN(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

async function assertClassAccess(classId, context) {
  const cls = await classService.getById(String(classId));
  if (context.role === 'admin') return cls;
  const allowed = await courseAssignmentService.hasAccess(context.userId, String(classId));
  if (!allowed) throw new ForbiddenError('You do not have access to this class');
  return cls;
}

const enrollmentService = {
  async bulkUpload(classId, buffer, mimetype, originalname, context) {
    await assertClassAccess(classId, context);

    let rawRows;
    try {
      rawRows = await columnMapper.parse(buffer, mimetype, originalname);
    } catch (err) {
      throw new BadRequestError(`Could not parse file: ${err.message}`);
    }

    // Fetch thresholds once for the whole batch
    const { thresholds } = await performanceService.getSettings();

    const created = [];
    const skipped = [];
    const failed  = [];

    for (let i = 0; i < rawRows.length; i++) {
      const rowNum = i + 2; // row 1 = header
      const row = rawRows[i];

      try {
        const studentId = row.studentId != null ? String(row.studentId).trim() : '';
        const fullName  = row.fullName  != null ? String(row.fullName).trim()  : '';

        if (!studentId || !fullName) {
          const missing = [];
          if (!studentId) missing.push('studentId');
          if (!fullName)  missing.push('fullName');
          failed.push({ row: rowNum, reason: `Missing required fields: ${missing.join(', ')}` });
          continue;
        }

        // Idempotency — same studentId already enrolled in this class
        const isDuplicate = await studentService.existsByStudentIdAndClass(studentId, classId);
        if (isDuplicate) {
          skipped.push({ studentId, fullName, reason: 'already exists in this class' });
          continue;
        }

        const averageScore       = parseAverageScore(row.averageScore);
        const attendance         = parseAttendance(row.attendance);
        const performanceCategory = performanceService.mapToCategory(averageScore, thresholds);

        // Find-or-create User by studentId — prevents duplicate logins
        let user = await userService.findByStudentId(studentId);
        let tempPassword = null;

        if (!user) {
          tempPassword = passwordGenerator.generate();
          user = await userService.createUser({
            studentId,
            fullName,
            role: 'student',
            password: tempPassword,
            mustChangePassword: true,
          });
        }

        await studentService.createRecord({
          userId: user._id,
          classId,
          fullName,
          averageScore,
          attendance,
          performanceCategory,
        });

        // tempPassword is null when reusing an existing account
        created.push({ studentId, fullName, tempPassword });
      } catch (err) {
        failed.push({ row: rowNum, reason: err.message });
      }
    }

    return { created, skipped, failed };
  },
};

module.exports = enrollmentService;
