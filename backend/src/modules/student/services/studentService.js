const studentRepository = require('../repositories/studentRepository');
const userService = require('../../user/services/userService');
const classService = require('../../class/services/classService');
const courseAssignmentService = require('../../courseAssignment/services/courseAssignmentService');
const passwordGenerator = require('../../../common/utils/passwordGenerator');
const { NotFoundError, ForbiddenError, ConflictError, BadRequestError } = require('../../../common/errors');

// ── Ownership guard ───────────────────────────────────────────────────────────
async function assertClassAccess(classId, context) {
  const cls = await classService.getById(String(classId));
  if (context.role === 'admin') return cls;
  const allowed = await courseAssignmentService.hasAccess(context.userId, String(classId));
  if (!allowed) throw new ForbiddenError('You do not have access to this class');
  return cls;
}

const studentService = {
  // ── Called by enrollmentService to check duplicates before creating ─────────
  async existsByStudentIdAndClass(studentId, classId) {
    const user = await userService.findByStudentId(studentId);
    if (!user) return false;
    const existing = await studentRepository.findOne({ userId: user._id, classId });
    return !!existing;
  },

  // ── Called by enrollmentService after it has created the User account ────────
  createRecord(data) {
    return studentRepository.create(data);
  },

  // ── Single manual creation (admin-only) ─────────────────────────────────────
  async create({ classId, studentId, fullName, attendance, averageScore }, context) {
    await assertClassAccess(classId, context);

    const duplicate = await studentService.existsByStudentIdAndClass(studentId, classId);
    if (duplicate) throw new ConflictError(`Student ${studentId} already exists in this class`);

    // Reuse an existing User account if the student is already in another class
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
    } else if (user.role !== 'student') {
      throw new BadRequestError('A non-student account already exists with that Student ID');
    }

    const raw = await studentRepository.create({
      userId: user._id,
      classId,
      fullName,
      attendance: attendance ?? 0,
      averageScore: averageScore ?? null,
    });

    const student = await studentRepository.findById(raw._id);
    return { student, tempPassword };
  },

  // ── List all students in a class ─────────────────────────────────────────────
  async getAll(classId, context) {
    if (!classId) throw new BadRequestError('classId query parameter is required');
    await assertClassAccess(classId, context);
    return studentRepository.findAll({ classId });
  },

  // ── Get one student ───────────────────────────────────────────────────────────
  async getById(id, context) {
    const student = await studentRepository.findById(id);
    if (!student) throw new NotFoundError('Student not found');
    await assertClassAccess(student.classId, context);
    return student;
  },

  // ── Update student info ───────────────────────────────────────────────────────
  async update(id, updates, context) {
    await studentService.getById(id, context);
    return studentRepository.updateById(id, updates);
  },

  // ── Soft delete ───────────────────────────────────────────────────────────────
  async softDelete(id, userId, context) {
    const student = await studentService.getById(id, context);
    return student.softDelete(userId);
  },

  // ── Internal — called by the grouping engine (auth already verified by caller) ─
  getStudentsByClass(classId) {
    return studentRepository.findAll({ classId });
  },

  markAsLeader(studentId) {
    return studentRepository.markAsLeader(studentId);
  },

  // ── Instructor-initiated password reset (Section 2.14.5) ─────────────────────
  async resetPassword(id, context) {
    const student = await studentService.getById(id, context);
    const tempPassword = passwordGenerator.generate();
    const userId = student.userId?._id ?? student.userId;
    await userService.resetToTempPassword(userId, tempPassword);
    return {
      studentId: student.userId?.studentId ?? null,
      fullName: student.fullName,
      tempPassword,
    };
  },
};

module.exports = studentService;
