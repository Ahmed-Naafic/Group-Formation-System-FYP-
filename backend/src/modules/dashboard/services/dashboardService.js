const mongoose = require('mongoose');

const User           = require('../../user/models/User');
const Student        = require('../../student/models/Student');
const Group          = require('../../group/models/Group');
const CourseOffering = require('../../courseOffering/models/CourseOffering');
const Submission     = require('../../submission/models/Submission');
const AuditLog       = require('../../auditLog/models/AuditLog');
const Task           = require('../../task/models/Task');

const dashboardService = {
  async getStats() {
    const [
      totalUsers,
      totalStudents,
      totalActiveOfferings,
      activeGroups,
      totalSubmissions,
      submissionsByStatus,
      recentActivity,
    ] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Student.countDocuments({ deletedAt: null }),
      CourseOffering.countDocuments({ status: 'active', deletedAt: null }),
      Group.countDocuments({ status: 'active', deletedAt: null }),
      Submission.countDocuments({ deletedAt: null }),
      Submission.aggregate([
        { $match: { deletedAt: null } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      AuditLog.find()
        .sort({ timestamp: -1 })
        .limit(10)
        .populate({ path: 'actorId', select: 'fullName role' })
        .lean(),
    ]);

    const submissionStats = {};
    for (const { _id, count } of submissionsByStatus) {
      submissionStats[_id] = count;
    }

    return {
      counts: {
        users:           totalUsers,
        students:        totalStudents,
        activeOfferings: totalActiveOfferings,
        activeGroups,
        submissions:     totalSubmissions,
      },
      submissions: submissionStats,
      recentActivity,
    };
  },

  async getInstructorStats(instructorId) {
    const offerings = await CourseOffering.find({ instructorId, status: 'active', deletedAt: null })
      .populate('courseId',   'name code')
      .populate('cohortId',   'name')
      .populate('semesterId', 'name')
      .lean();

    if (!offerings.length) {
      return {
        counts: { offerings: 0, students: 0, activeGroups: 0, pendingReviews: 0, openTasks: 0, dueSoon: 0, overdue: 0 },
        offeringSummaries: [],
      };
    }

    const offeringIds = offerings.map(o => o._id);
    const cohortIds   = [...new Set(offerings.map(o => String(o.cohortId?._id ?? o.cohortId)))];
    const cohortOids  = cohortIds.map(id => new mongoose.Types.ObjectId(id));

    const [totalStudents, totalActiveGroups, studentsByCohort, groupsByOffering] = await Promise.all([
      Student.countDocuments({ cohortId: { $in: cohortOids }, deletedAt: null }),
      Group.countDocuments({ courseOfferingId: { $in: offeringIds }, status: 'active', deletedAt: null }),
      Student.aggregate([
        { $match: { cohortId: { $in: cohortOids }, deletedAt: null } },
        { $group: { _id: '$cohortId', count: { $sum: 1 } } },
      ]),
      Group.aggregate([
        { $match: { courseOfferingId: { $in: offeringIds }, status: 'active', deletedAt: null } },
        { $group: { _id: '$courseOfferingId', count: { $sum: 1 } } },
      ]),
    ]);

    const studentMap = Object.fromEntries(studentsByCohort.map(x => [String(x._id), x.count]));
    const groupMap   = Object.fromEntries(groupsByOffering.map(x => [String(x._id), x.count]));

    const offeringSummaries = offerings.map(o => ({
      _id:          o._id,
      course:       o.courseId,
      cohort:       o.cohortId,
      semester:     o.semesterId,
      status:       o.status,
      students:     studentMap[String(o.cohortId?._id ?? o.cohortId)] ?? 0,
      activeGroups: groupMap[String(o._id)] ?? 0,
      // Task/submission stats pending Step 7 (Task.courseOfferingId migration)
      openTasks:      0,
      pendingReviews: 0,
    }));

    return {
      counts: {
        offerings:      offerings.length,
        students:       totalStudents,
        activeGroups:   totalActiveGroups,
        pendingReviews: 0,
        openTasks:      0,
        dueSoon:        0,
        overdue:        0,
      },
      offeringSummaries,
    };
  },
};

module.exports = dashboardService;
