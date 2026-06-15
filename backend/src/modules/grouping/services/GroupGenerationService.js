const courseOfferingRepository = require('../../courseOffering/repositories/courseOfferingRepository');
const attendanceRepository     = require('../../attendance/repositories/attendanceRepository');
const groupHistoryRepository   = require('../repositories/groupHistoryRepository');
const studentService           = require('../../student/services/studentService');
const BucketingStage           = require('./stages/BucketingStage');
const AttendanceFilterStage    = require('./stages/AttendanceFilterStage');
const HistoryAwarenessStage    = require('./stages/HistoryAwarenessStage');
const GroupAssemblyStage       = require('./stages/GroupAssemblyStage');
const LeaderAssignmentStage    = require('./stages/LeaderAssignmentStage');
const { BadRequestError, NotFoundError } = require('../../../common/errors');

const GroupGenerationService = {
  // Pure — no DB calls. Accepts pre-fetched students (with attendance merged in)
  // and history docs. The stages are unchanged from the original implementation.
  generateFromData(students, historyDocs, groupSize, options = {}) {
    const { attendanceThreshold = 25 } = options;

    const buckets        = BucketingStage.run(students);
    const withScatter    = AttendanceFilterStage.run(buckets, attendanceThreshold);
    const avoidPairs     = HistoryAwarenessStage.run(historyDocs);
    const rawGroups      = GroupAssemblyStage.run(withScatter, avoidPairs, groupSize);
    const assembledGroups = LeaderAssignmentStage.run(rawGroups);

    const summary = {
      total:    students.length,
      ungraded: buckets.UNGRADED.length,
      groups:   assembledGroups.length,
      breakdown: {
        HIGH:    buckets.HIGH.length,
        MEDIUM:  buckets.MEDIUM.length,
        LOW:     buckets.LOW.length,
        UNGRADED: buckets.UNGRADED.length,
      },
    };

    return { assembledGroups, summary };
  },

  // Assembles data from DB then delegates to generateFromData.
  // Auth is checked by groupService before this is called.
  async generate(courseOfferingId, groupSize, options = {}) {
    // Load offering → derive cohortId
    const offering = await courseOfferingRepository.findById(courseOfferingId);
    if (!offering) throw new NotFoundError('Course offering not found');

    const cohortId = String(offering.cohortId?._id ?? offering.cohortId);

    // Load students from the cohort (no attendance field on Student)
    const rawStudents = await studentService.getStudentsByCohort(cohortId);
    if (rawStudents.length < 3) {
      throw new BadRequestError('Not enough students to form groups (minimum 3 required)');
    }

    // Load per-offering attendance: Map<studentId → percentage>
    // Students with no Attendance record default to 0 (per Q4 design decision).
    const attendanceMap = await attendanceRepository.getAttendanceMap(courseOfferingId);

    // Merge offering attendance into each student plain object.
    const students = rawStudents.map((s) => {
      const plain = s.toObject ? s.toObject() : { ...s };
      plain.attendance = attendanceMap.get(String(s._id)) ?? 0;
      return plain;
    });

    // History query: ALL prior generations for this cohort (across all offerings).
    // Pair-avoidance spans the entire cohort history, not just this offering (Q3).
    const historyDocs = await groupHistoryRepository.findByCohort(cohortId);

    return this.generateFromData(students, historyDocs, groupSize, options);
  },
};

module.exports = GroupGenerationService;
