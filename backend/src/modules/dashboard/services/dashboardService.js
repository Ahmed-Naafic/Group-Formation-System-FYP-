const mongoose = require('mongoose');

// Each model is accessed through its own module to respect the no-cross-module-model rule.
// Dashboard is read-only so direct model imports are acceptable here as a reporting layer.
const User             = require('../../user/models/User');
const Student          = require('../../student/models/Student');
const Group            = require('../../group/models/Group');
const Class            = require('../../class/models/Class');
const Submission       = require('../../submission/models/Submission');
const AuditLog         = require('../../auditLog/models/AuditLog');
const Task             = require('../../task/models/Task');
const CourseAssignment = require('../../courseAssignment/models/CourseAssignment');

const dashboardService = {
  async getStats() {
    const [
      totalUsers,
      totalStudents,
      totalClasses,
      activeGroups,
      totalSubmissions,
      submissionsByStatus,
      recentActivity,
    ] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Student.countDocuments({ deletedAt: null }),
      Class.countDocuments({ deletedAt: null }),
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

    // Reshape submissions-by-status into a plain object
    const submissionStats = {};
    for (const { _id, count } of submissionsByStatus) {
      submissionStats[_id] = count;
    }

    return {
      counts: {
        users:       totalUsers,
        students:    totalStudents,
        classes:     totalClasses,
        activeGroups,
        submissions: totalSubmissions,
      },
      submissions: submissionStats,
      recentActivity,
    };
  },

  async getInstructorStats(instructorId) {
    // Classes this instructor is assigned to
    const classIds = await CourseAssignment.find({
      instructorId,
      deletedAt: null,
    }).distinct('classId');

    if (!classIds.length) {
      return {
        counts: { classes: 0, students: 0, activeGroups: 0, pendingReviews: 0, openTasks: 0, dueSoon: 0, overdue: 0 },
        classSummaries: [],
      };
    }

    // Task IDs needed to correlate submissions back to classes
    const taskIds = await Task.find({ classId: { $in: classIds }, deletedAt: null }).distinct('_id');

    const now          = new Date();
    const weekFromNow  = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      totalStudents,
      totalActiveGroups,
      pendingReviews,
      openTasks,
      dueSoon,
      overdue,
      studentsByClass,
      groupsByClass,
      tasksByClass,
      reviewsByClass,
    ] = await Promise.all([
      Student.countDocuments({ classId: { $in: classIds }, deletedAt: null }),
      Group.countDocuments({ classId: { $in: classIds }, status: 'active', deletedAt: null }),
      taskIds.length
        ? Submission.countDocuments({ taskId: { $in: taskIds }, status: 'submitted', deletedAt: null })
        : 0,
      Task.countDocuments({ classId: { $in: classIds }, status: 'open', deletedAt: null }),
      Task.countDocuments({ classId: { $in: classIds }, status: 'open', deadline: { $gte: now, $lte: weekFromNow }, deletedAt: null }),
      Task.countDocuments({ classId: { $in: classIds }, status: 'open', deadline: { $exists: true, $ne: null, $lt: now }, deletedAt: null }),
      Student.aggregate([
        { $match: { classId: { $in: classIds }, deletedAt: null } },
        { $group: { _id: '$classId', count: { $sum: 1 } } },
      ]),
      Group.aggregate([
        { $match: { classId: { $in: classIds }, status: 'active', deletedAt: null } },
        { $group: { _id: '$classId', count: { $sum: 1 } } },
      ]),
      Task.aggregate([
        { $match: { classId: { $in: classIds }, status: 'open', deletedAt: null } },
        { $group: { _id: '$classId', count: { $sum: 1 } } },
      ]),
      taskIds.length
        ? Submission.aggregate([
            { $match: { taskId: { $in: taskIds }, status: 'submitted', deletedAt: null } },
            { $lookup: { from: 'tasks', localField: 'taskId', foreignField: '_id', as: 'task' } },
            { $unwind: '$task' },
            { $group: { _id: '$task.classId', count: { $sum: 1 } } },
          ])
        : [],
    ]);

    const studentMap = Object.fromEntries(studentsByClass.map((x) => [String(x._id), x.count]));
    const groupMap   = Object.fromEntries(groupsByClass.map((x) => [String(x._id), x.count]));
    const taskMap    = Object.fromEntries(tasksByClass.map((x) => [String(x._id), x.count]));
    const reviewMap  = Object.fromEntries(reviewsByClass.map((x) => [String(x._id), x.count]));

    const classes = await Class.find({ _id: { $in: classIds }, deletedAt: null })
      .populate('semesterId', 'name year')
      .lean();

    const assignments = await CourseAssignment.find({ instructorId, deletedAt: null })
      .populate('courseId', 'name code')
      .lean();

    const coursesByClass = {};
    for (const a of assignments) {
      const cid = String(a.classId);
      if (!coursesByClass[cid]) coursesByClass[cid] = [];
      if (a.courseId) coursesByClass[cid].push(a.courseId);
    }

    const classSummaries = classes.map((cls) => {
      const cid = String(cls._id);
      return {
        _id:            cls._id,
        name:           cls.name,
        semester:       cls.semesterId,
        courses:        coursesByClass[cid] ?? [],
        students:       studentMap[cid] ?? 0,
        activeGroups:   groupMap[cid]   ?? 0,
        openTasks:      taskMap[cid]    ?? 0,
        pendingReviews: reviewMap[cid]  ?? 0,
      };
    });

    return {
      counts: {
        classes:        classIds.length,
        students:       totalStudents,
        activeGroups:   totalActiveGroups,
        pendingReviews,
        openTasks,
        dueSoon,
        overdue,
      },
      classSummaries,
    };
  },
};

module.exports = dashboardService;
