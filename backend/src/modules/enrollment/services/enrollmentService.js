const columnMapper = require('../utils/columnMapper');
const classService = require('../../class/services/classService');
const userService = require('../../user/services/userService');
const studentService = require('../../student/services/studentService');
const passwordGenerator = require('../../../common/utils/passwordGenerator');
const { ForbiddenError, BadRequestError } = require('../../../common/errors');

// ── Type coercion helpers ─────────────────────────────────────────────────────

// Scores are raw points; blank/invalid → null (Section 2.16)
function parseScore(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

// Attendance is a percentage 0–100; blank/invalid → 0 (Section 2.16)
function parseAttendance(val) {
  if (val === null || val === undefined || val === '') return 0;
  const n = Number(val);
  if (Number.isNaN(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

// ── Ownership guard ───────────────────────────────────────────────────────────

async function assertClassAccess(classId, context) {
  const cls = await classService.getById(String(classId));
  if (context.role === 'admin') return cls;
  const assignedId = cls.instructorId?._id?.toString() ?? cls.instructorId?.toString();
  if (!assignedId || assignedId !== context.userId.toString()) {
    throw new ForbiddenError('You do not have access to this class');
  }
  return cls;
}

// ── Service ───────────────────────────────────────────────────────────────────

const enrollmentService = {
  async bulkUpload(classId, buffer, mimetype, originalname, context) {
    await assertClassAccess(classId, context);

    // Parse file — wrap in a clear error so the user knows the file is the problem
    let rawRows;
    try {
      rawRows = await columnMapper.parse(buffer, mimetype, originalname);
    } catch (err) {
      throw new BadRequestError(`Could not parse file: ${err.message}`);
    }

    const created = [];
    const skipped = [];
    const failed = [];

    for (let i = 0; i < rawRows.length; i++) {
      const rowNum = i + 2; // row 1 = header, so data starts at row 2
      const row = rawRows[i];

      try {
        const studentId = row.studentId != null ? String(row.studentId).trim() : '';
        const fullName = row.fullName != null ? String(row.fullName).trim() : '';

        // Required-field check
        if (!studentId || !fullName) {
          const missing = [];
          if (!studentId) missing.push('studentId');
          if (!fullName) missing.push('fullName');
          failed.push({ row: rowNum, reason: `Missing required fields: ${missing.join(', ')}` });
          continue;
        }

        // Idempotency check — same studentId already in this class
        const isDuplicate = await studentService.existsByStudentIdAndClass(studentId, classId);
        if (isDuplicate) {
          skipped.push({ studentId, fullName, reason: 'already exists in this class' });
          continue;
        }

        // Reuse User if the student already has an account (e.g. enrolled in another class)
        let user = await userService.findByStudentId(studentId);
        let tempPassword = null;

        if (!user) {
          tempPassword = passwordGenerator.generate();
          // TODO(transactions): wrap User + Student creation in a MongoDB transaction
          user = await userService.createUser({
            studentId,
            fullName,
            email: row.email ? String(row.email).trim() || null : null,
            role: 'student',
            password: tempPassword,      // hashed inside userService, never stored as plaintext
            mustChangePassword: true,
          });
        }

        await studentService.createRecord({
          userId: user._id,
          classId,
          fullName,
          attendance: parseAttendance(row.attendance),
          scores: {
            midterm: parseScore(row.midterm),
            final: parseScore(row.final),
            coursework: parseScore(row.coursework),
          },
        });

        // tempPassword is null when reusing an existing account — student already has credentials
        created.push({ studentId, fullName, tempPassword });
      } catch (err) {
        failed.push({ row: rowNum, reason: err.message });
      }
    }

    return { created, skipped, failed };
  },
};

module.exports = enrollmentService;
