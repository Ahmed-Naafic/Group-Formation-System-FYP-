const emitter            = require('../../../common/events/emitter');
const notificationService = require('../services/notificationService');
const auditLogService    = require('../../auditLog/services/auditLogService');
const userRepository     = require('../../user/repositories/userRepository');
const groupRepository    = require('../../group/repositories/groupRepository');
const Workspace          = require('../../workspace/models/Workspace');
const pushService        = require('../../../common/services/push/PushService');
const logger             = require('../../../common/utils/logger');

/**
 * Called once at startup with the Socket.IO server instance.
 * Registers all application event listeners and handles the real-time push.
 *
 * Each listener:
 *  1. Creates notification DB records
 *  2. Pushes to online users via their personal room `user:{userId}`
 *  3. Sends FCM push notification to offline devices
 *  4. Writes to the audit log where appropriate
 */
function initListeners(io) {
  function pushToUser(userId, notification) {
    io.to(`user:${userId}`).emit('notification', { notification });
  }

  async function sendFcmBatch(userIds, title, body, data = {}) {
    try {
      const users = await userRepository.findFcmTokensByUserIds(userIds);
      const tokens = users.map((u) => u.fcmToken).filter(Boolean);
      await pushService.sendBatch(tokens, title, body, data);
    } catch (err) {
      logger.warn('FCM batch lookup failed', { err: err.message });
    }
  }

  // ── groups.generated ─────────────────────────────────────────────────────────
  // Payload: { groups, classId, courseId, actorId, actorRole, ipAddress, userAgent }
  emitter.on('groups.generated', async (payload) => {
    try {
      const { groups, courseId, actorId, actorRole, ipAddress, userAgent } = payload;

      const docs = [];
      const allUserIds = [];
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
          allUserIds.push(userId);
        }
      }

      const created = await notificationService.createMany(docs);
      for (const n of created) pushToUser(String(n.userId), n);

      await sendFcmBatch(
        allUserIds,
        'You have been placed in a group',
        'Open the app to see your new group.',
        { type: 'GROUP_FORMED' }
      );

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

      const docs = [];
      const allUserIds = [];

      let groups = task.assignedGroups ?? [];
      if (groups.length === 0) {
        // Task applies to all groups in the offering — fetch them all
        groups = await groupRepository.findActiveByOffering(task.courseOfferingId);
      }

      for (const group of groups) {
        for (const member of group.memberIds ?? []) {
          const userId = member.userId?._id ?? member.userId;
          docs.push({
            userId,
            type:    'TASK_ASSIGNED',
            title:   'New task assigned',
            message: `"${task.title}" has been assigned to your group.`,
            relatedEntity: { kind: 'Task', id: task._id },
          });
          allUserIds.push(userId);
        }
      }

      const created = await notificationService.createMany(docs);
      for (const n of created) pushToUser(String(n.userId), n);

      await sendFcmBatch(
        allUserIds,
        'New task assigned',
        `"${task.title}" has been assigned to your group.`,
        { type: 'TASK_ASSIGNED', entityId: String(task._id) }
      );

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

        await sendFcmBatch(
          [userId],
          'Your submission has been graded',
          `"${task?.title ?? 'A task'}" — ${submission.grade}/100`,
          { type: 'SUBMISSION_GRADED', entityId: String(submission._id) }
        );
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

  // ── message.sent ──────────────────────────────────────────────────────────────
  // Payload: { workspaceId, senderUserId, senderName, preview }
  // No DB notification record — just FCM push to group members who are offline/elsewhere.
  emitter.on('message.sent', async ({ workspaceId, senderUserId, senderName, preview }) => {
    try {
      const ws = await Workspace.findById(workspaceId, 'groupId')
        .populate({
          path: 'groupId',
          select: 'memberIds',
          populate: { path: 'memberIds', select: 'userId' },
        })
        .lean();

      if (!ws?.groupId?.memberIds?.length) return;

      const recipientUserIds = ws.groupId.memberIds
        .map((m) => m.userId?._id ?? m.userId)
        .filter((uid) => uid && String(uid) !== senderUserId);

      if (!recipientUserIds.length) return;

      await sendFcmBatch(recipientUserIds, senderName, preview, {
        type: 'NEW_MESSAGE',
        workspaceId,
      });
    } catch (err) {
      logger.error('message.sent listener error', { err: err.message });
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
