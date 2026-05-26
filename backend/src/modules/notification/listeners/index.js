const emitter            = require('../../../common/events/emitter');
const notificationService = require('../services/notificationService');
const auditLogService    = require('../../auditLog/services/auditLogService');
const logger             = require('../../../common/utils/logger');

/**
 * Called once at startup with the Socket.IO server instance.
 * Registers all application event listeners and handles the real-time push.
 *
 * Each listener:
 *  1. Creates notification DB records
 *  2. Pushes to online users via their personal room `user:{userId}`
 *  3. Writes to the audit log where appropriate
 */
function initListeners(io) {
  function pushToUser(userId, notification) {
    io.to(`user:${userId}`).emit('notification', { notification });
  }

  // ── groups.generated ─────────────────────────────────────────────────────────
  // Payload: { groups, classId, courseId, actorId, actorRole, ipAddress, userAgent }
  emitter.on('groups.generated', async (payload) => {
    try {
      const { groups, courseId, actorId, actorRole, ipAddress, userAgent } = payload;

      // Build one notification per group member
      const docs = [];
      for (const group of groups) {
        for (const member of group.memberIds ?? []) {
          const userId  = member.userId?._id ?? member.userId;
          const isLeader = String(group.leaderId?._id ?? group.leaderId) === String(member._id ?? member);
          docs.push({
            userId,
            type:    'GROUP_FORMED',
            title:   'You have been placed in a group',
            message: `You are now in ${group.name}${isLeader ? ' as the group leader' : ''}.`,
            relatedEntity: { kind: 'Group', id: group._id },
          });
        }
      }

      const created = await notificationService.createMany(docs);
      for (const n of created) pushToUser(String(n.userId), n);

      await auditLogService.log({
        actorId, actorRole, ipAddress, userAgent,
        action:     'GROUP_GENERATED',
        entityKind: 'Group',
        entityId:   groups[0]?._id,
        changes:    { groupCount: groups.length, courseId: String(courseId) },
      });
    } catch (err) {
      logger.error('groups.generated listener error', { err: err.message });
    }
  });

  // ── task.created ──────────────────────────────────────────────────────────────
  // Payload: { task, actorId, actorRole, ipAddress, userAgent }
  emitter.on('task.created', async (payload) => {
    try {
      const { task, actorId, actorRole, ipAddress, userAgent } = payload;

      // Notify all members of every assigned group
      const docs = [];
      for (const group of task.assignedGroups ?? []) {
        for (const member of group.memberIds ?? []) {
          const userId = member.userId?._id ?? member.userId;
          docs.push({
            userId,
            type:    'TASK_ASSIGNED',
            title:   'New task assigned',
            message: `"${task.title}" has been assigned to your group.`,
            relatedEntity: { kind: 'Task', id: task._id },
          });
        }
      }

      const created = await notificationService.createMany(docs);
      for (const n of created) pushToUser(String(n.userId), n);

      await auditLogService.log({
        actorId, actorRole, ipAddress, userAgent,
        action:     'TASK_CREATED',
        entityKind: 'Task',
        entityId:   task._id,
        changes:    { title: task.title },
      });
    } catch (err) {
      logger.error('task.created listener error', { err: err.message });
    }
  });

  // ── submission.graded ────────────────────────────────────────────────────────
  // Payload: { submission, task, actorId, actorRole, ipAddress, userAgent }
  emitter.on('submission.graded', async (payload) => {
    try {
      const { submission, task, actorId, actorRole, ipAddress, userAgent } = payload;

      // Notify the student who submitted
      const submittedBy = submission.submittedBy;
      if (submittedBy) {
        const userId = submittedBy.userId?._id ?? submittedBy.userId ?? submittedBy;
        const n = await notificationService.create({
          userId,
          type:    'SUBMISSION_GRADED',
          title:   'Your submission has been graded',
          message: `Your submission for "${task?.title ?? 'a task'}" received a grade of ${submission.grade}/100.`,
          relatedEntity: { kind: 'Submission', id: submission._id },
        });
        pushToUser(String(userId), n);
      }

      await auditLogService.log({
        actorId, actorRole, ipAddress, userAgent,
        action:     'SUBMISSION_GRADED',
        entityKind: 'Submission',
        entityId:   submission._id,
        changes:    { grade: submission.grade },
      });
    } catch (err) {
      logger.error('submission.graded listener error', { err: err.message });
    }
  });

  // ── password.reset ────────────────────────────────────────────────────────────
  // Payload: { targetUserId, actorId, actorRole, ipAddress, userAgent }
  emitter.on('password.reset', async (payload) => {
    try {
      const { targetUserId, actorId, actorRole, ipAddress, userAgent } = payload;
      await auditLogService.log({
        actorId, actorRole, ipAddress, userAgent,
        action:     'PASSWORD_RESET',
        entityKind: 'User',
        entityId:   targetUserId,
      });
    } catch (err) {
      logger.error('password.reset listener error', { err: err.message });
    }
  });
}

module.exports = { initListeners };
