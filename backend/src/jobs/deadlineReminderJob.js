const cron = require('node-cron');
const taskRepository        = require('../modules/task/repositories/taskRepository');
const notificationService   = require('../modules/notification/services/notificationService');
const groupRepository       = require('../modules/group/repositories/groupRepository');
const userRepository        = require('../modules/user/repositories/userRepository');
const pushService           = require('../common/services/push/PushService');
const logger                = require('../common/utils/logger');

async function runDeadlineReminder() {
  try {
    const tasks = await taskRepository.findDueForReminder(24);
    if (!tasks.length) return;

    logger.info(`Deadline reminder job: ${tasks.length} task(s) due within 24 h`);

    for (const task of tasks) {
      let userIds = [];

      if (task.assignedGroups.length > 0) {
        // Specific groups — members are already populated
        for (const group of task.assignedGroups) {
          for (const member of group.memberIds ?? []) {
            const uid = member.userId?._id ?? member.userId;
            if (uid) userIds.push(uid);
          }
        }
      } else {
        // Task applies to all groups in the offering — look them up
        const allGroups = await groupRepository.findActiveByOffering(task.courseOfferingId);
        for (const g of allGroups) {
          for (const member of g.memberIds ?? []) {
            const uid = member.userId?._id ?? member.userId;
            if (uid) userIds.push(uid);
          }
        }
      }

      if (!userIds.length) {
        await taskRepository.markReminderSent(task._id);
        continue;
      }

      const hoursLeft = Math.round((new Date(task.deadline) - new Date()) / 36e5);
      const timeLabel = hoursLeft <= 1 ? 'less than 1 hour' : `${hoursLeft} hours`;
      const title   = 'Task deadline approaching';
      const message = `"${task.title}" is due in ${timeLabel}.`;

      // Save in-app notifications
      const docs = userIds.map((userId) => ({
        userId,
        type:          'TASK_DEADLINE',
        title,
        message,
        relatedEntity: { kind: 'Task', id: task._id },
      }));
      await notificationService.createMany(docs);

      // FCM push
      const users  = await userRepository.findFcmTokensByUserIds(userIds);
      const tokens = users.map((u) => u.fcmToken).filter(Boolean);
      await pushService.sendBatch(tokens, title, message, {
        type:     'TASK_DEADLINE',
        entityId: String(task._id),
      });

      await taskRepository.markReminderSent(task._id);
      logger.info(`Deadline reminder sent for task "${task.title}" to ${userIds.length} student(s)`);
    }
  } catch (err) {
    logger.error('Deadline reminder job failed', { err: err.message });
  }
}

function startDeadlineReminderJob() {
  // Runs every hour at :00
  cron.schedule('0 * * * *', runDeadlineReminder);
  logger.info('Deadline reminder job scheduled (every hour)');
}

module.exports = { startDeadlineReminderJob };
