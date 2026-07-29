import 'package:get/get.dart';
import '../data/models/workspace_model.dart';
import '../data/repositories/task_repository.dart';
import '../data/repositories/workspace_repository.dart';
import '../routes/app_pages.dart';

/// Resolves a notification (FCM push tap, or a row tapped in the in-app
/// notification list) into the screen it's actually about, and navigates
/// there. Both entry points funnel through here so tapping a notification
/// always lands on the same place regardless of how it was tapped.
class NotificationNavigator {
  NotificationNavigator._();

  static final _taskRepo = TaskRepository();
  static final _workspaceRepo = WorkspaceRepository();

  /// [type] is the notification's `type` (GROUP_FORMED / TASK_ASSIGNED /
  /// SUBMISSION_GRADED / NEW_MESSAGE). [entityId] is `relatedEntity.id` (in-app
  /// list) or the FCM payload's `entityId` (group id / task id / submission id
  /// depending on type). [workspaceId] is only set for NEW_MESSAGE, from the
  /// FCM payload's `workspaceId` field — chat has no DB notification record.
  static Future<void> open({
    required String type,
    String? entityId,
    String? workspaceId,
  }) async {
    if (!await _waitUntilReady()) return;

    try {
      switch (type) {
        case 'NEW_MESSAGE':
          if (workspaceId == null) return;
          final ws = await _workspaceRepo.getById(workspaceId);
          Get.toNamed(Routes.chat, arguments: ws);
          break;

        case 'GROUP_FORMED':
          if (entityId == null) return;
          final ws = await _workspaceRepo.getByGroupId(entityId);
          Get.toNamed(Routes.workspace, arguments: ws);
          break;

        case 'TASK_ASSIGNED':
          if (entityId == null) return;
          await _openTask(entityId);
          break;

        case 'SUBMISSION_GRADED':
          if (entityId == null) return;
          final taskId = await _taskRepo.getTaskIdForSubmission(entityId);
          if (taskId == null) return;
          await _openTask(taskId);
          break;
      }
    } catch (_) {
      // Best-effort: a stale/deleted entity (task removed, submission's group
      // reshuffled, etc. after the notification was sent) should silently
      // no-op rather than crash the app on a cold-start deep link.
    }
  }

  static Future<void> _openTask(String taskId) async {
    final task = await _taskRepo.getTaskById(taskId);
    if (task.courseOfferingId == null) return;

    // TaskDetailView requires TaskController already registered, which only
    // happens via TaskBinding on the task-list route — so push the list
    // first (creates the controller scoped to this task's workspace), then
    // the detail screen on top of it. Mirrors the app's normal navigation
    // path (workspace → tasks → detail); "back" from detail lands on the list.
    WorkspaceModel? ws;
    for (final w in await _workspaceRepo.getMyWorkspaces()) {
      if (w.courseOfferingId == task.courseOfferingId) {
        ws = w;
        break;
      }
    }
    if (ws == null) return;

    Get.toNamed(Routes.tasks, arguments: ws);
    Get.toNamed(Routes.taskDetail, arguments: task);
  }

  /// Waits until the app is past the splash/auth gate — navigating while
  /// still on splash/login would push onto a dead-end back stack (and the
  /// API calls above would 401 before a session exists anyway). Bounded so a
  /// logged-out cold start just drops the deep link instead of hanging.
  static Future<bool> _waitUntilReady() async {
    const maxAttempts = 20;
    const interval = Duration(milliseconds: 300);
    for (var i = 0; i < maxAttempts; i++) {
      final route = Get.currentRoute;
      if (route != Routes.splash &&
          route != Routes.login &&
          route != Routes.changePassword) {
        return true;
      }
      await Future.delayed(interval);
    }
    return false;
  }
}
