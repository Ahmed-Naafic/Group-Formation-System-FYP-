const studentService          = require('../../student/services/studentService');
const groupHistoryRepository  = require('../repositories/groupHistoryRepository');
const BucketingStage          = require('./stages/BucketingStage');
const AttendanceFilterStage   = require('./stages/AttendanceFilterStage');
const HistoryAwarenessStage   = require('./stages/HistoryAwarenessStage');
const GroupAssemblyStage      = require('./stages/GroupAssemblyStage');
const LeaderAssignmentStage   = require('./stages/LeaderAssignmentStage');
const { BadRequestError }     = require('../../../common/errors');

const GroupGenerationService = {
  // Pure — no DB calls. Accepts pre-fetched students and history docs.
  // Used directly in tests and called internally by generate().
  generateFromData(students, historyDocs, groupSize, options = {}) {
    const { attendanceThreshold = 25 } = options;

    const buckets       = BucketingStage.run(students);
    const withScatter   = AttendanceFilterStage.run(buckets, attendanceThreshold);
    const avoidPairs    = HistoryAwarenessStage.run(historyDocs);
    const rawGroups     = GroupAssemblyStage.run(withScatter, avoidPairs, groupSize);
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

  // Fetches data from DB then delegates to generateFromData.
  // Auth is checked by the caller (groupService) before this is invoked.
  async generate(classId, groupSize, options = {}) {
    const students = await studentService.getStudentsByClass(classId);

    if (students.length < 3) {
      throw new BadRequestError(
        'Not enough students to form groups (minimum 3 required)',
      );
    }

    const historyDocs = await groupHistoryRepository.findByClass(classId);
    return this.generateFromData(students, historyDocs, groupSize, options);
  },
};

module.exports = GroupGenerationService;
