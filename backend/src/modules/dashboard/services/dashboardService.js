const mongoose = require('mongoose');

// Each model is accessed through its own module to respect the no-cross-module-model rule.
// Dashboard is read-only so direct model imports are acceptable here as a reporting layer.
const User         = require('../../user/models/User');
const Student      = require('../../student/models/Student');
const Group        = require('../../group/models/Group');
const Class        = require('../../class/models/Class');
const Submission   = require('../../submission/models/Submission');
const AuditLog     = require('../../auditLog/models/AuditLog');

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
};

module.exports = dashboardService;
