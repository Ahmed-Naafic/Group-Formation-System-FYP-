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

    const now         = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Fetch students, groups, and tasks in parallel.
    // Task fetch is lean — only the fields needed for stat computation.
    const [totalStudents, totalActiveGroups, studentsByCohort, groupsByOffering, tasks] = await Promise.all([
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
      Task.find(
        { courseOfferingId: { $in: offeringIds } },
        '_id courseOfferingId status deadline',
      ).lean(),
    ]);

    // ── Task stats (computed in memory) ──────────────────────────────────────
    const taskIds = tasks.map(t => t._id);

    const openTaskCount = tasks.filter(t => t.status === 'open').length;
    const dueSoonCount  = tasks.filter(t =>
      t.status === 'open' && t.deadline && t.deadline >= now && t.deadline <= weekFromNow,
    ).length;
    const overdueCount  = tasks.filter(t =>
      t.status === 'open' && t.deadline && t.deadline < now,
    ).length;

    // Per-offering open-task breakdown
    const openByOffering = {};
    for (const t of tasks) {
      if (t.status === 'open') {
        const oid = String(t.courseOfferingId);
        openByOffering[oid] = (openByOffering[oid] ?? 0) + 1;
      }
    }

    // ── Submission stats ──────────────────────────────────────────────────────
    // pendingReviews = submissions that are submitted/late but not yet graded.
    // Fetch only taskId so we can map back to offering without a $lookup.
    let pendingReviewCount  = 0;
    const pendingByOffering = {};

    if (taskIds.length > 0) {
      const taskOfferingMap = {};
      for (const t of tasks) taskOfferingMap[String(t._id)] = String(t.courseOfferingId);

      const pendingSubs = await Submission.find(
        { taskId: { $in: taskIds }, status: { $in: ['submitted', 'late'] } },
        'taskId',
      ).lean();

      pendingReviewCount = pendingSubs.length;
      for (const s of pendingSubs) {
        const oid = taskOfferingMap[String(s.taskId)];
        if (oid) pendingByOffering[oid] = (pendingByOffering[oid] ?? 0) + 1;
      }
    }

    // ── Assemble response ─────────────────────────────────────────────────────
    const studentMap = Object.fromEntries(studentsByCohort.map(x => [String(x._id), x.count]));
    const groupMap   = Object.fromEntries(groupsByOffering.map(x => [String(x._id), x.count]));

    const offeringSummaries = offerings.map(o => ({
      _id:            o._id,
      course:         o.courseId,
      cohort:         o.cohortId,
      semester:       o.semesterId,
      status:         o.status,
      students:       studentMap[String(o.cohortId?._id ?? o.cohortId)] ?? 0,
      activeGroups:   groupMap[String(o._id)] ?? 0,
      openTasks:      openByOffering[String(o._id)]    ?? 0,
      pendingReviews: pendingByOffering[String(o._id)] ?? 0,
    }));

    return {
      counts: {
        offerings:      offerings.length,
        students:       totalStudents,
        activeGroups:   totalActiveGroups,
        pendingReviews: pendingReviewCount,
        openTasks:      openTaskCount,
        dueSoon:        dueSoonCount,
        overdue:        overdueCount,
      },
      offeringSummaries,
    };
  },
};

module.exports = dashboardService;
