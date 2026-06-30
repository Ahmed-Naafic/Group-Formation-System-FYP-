import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/theme_controller.dart';
import '../../../data/models/workspace_model.dart';
import '../../../routes/app_pages.dart';
import '../../auth/controllers/auth_controller.dart';
import '../../notifications/controllers/notification_controller.dart';
import '../controllers/dashboard_controller.dart';

class DashboardView extends GetView<DashboardController> {
  const DashboardView({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = Get.find<AuthController>();

    return Scaffold(
      appBar: AppBar(
        title: Obx(() => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'My Groups',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
            ),
            if (auth.userName.isNotEmpty)
              Text(
                auth.userName.value,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w400,
                  color: Color(0xFFB8C5E8),
                ),
              ),
          ],
        )),
        actions: [
          _NotificationBell(),
          // Theme toggle
          Obx(() {
            final tc = Get.find<ThemeController>();
            return IconButton(
              tooltip: tc.isDark.value ? 'Light mode' : 'Dark mode',
              icon: Icon(tc.isDark.value
                  ? Icons.light_mode_rounded
                  : Icons.dark_mode_rounded),
              onPressed: tc.toggle,
            );
          }),
          IconButton(
            tooltip: 'Logout',
            icon: const Icon(Icons.logout_rounded),
            onPressed: () => Get.dialog(_logoutDialog(auth)),
          ),
        ],
      ),
      body: Obx(() {
        if (controller.isLoading.value) {
          return const Center(
            child: CircularProgressIndicator(color: Color(0xFF1E3A8A)),
          );
        }

        if (controller.errorMessage.isNotEmpty) {
          return _ErrorState(
            message: controller.errorMessage.value,
            onRetry: controller.fetchWorkspaces,
          );
        }

        if (controller.workspaces.isEmpty) {
          return const _EmptyState();
        }

        return RefreshIndicator(
          color: const Color(0xFF1E3A8A),
          onRefresh: controller.fetchWorkspaces,
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: controller.workspaces.length,
            itemBuilder: (_, i) => _WorkspaceCard(
              workspace:   controller.workspaces[i],
              myStudentId: auth.userStudentId.value,
            ),
          ),
        );
      }),
    );
  }

  Widget _logoutDialog(AuthController auth) => AlertDialog(
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out?'),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        actions: [
          TextButton(
            onPressed: () => Get.back(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Get.back();
              auth.logout();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1E3A8A),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Sign Out'),
          ),
        ],
      );
}

// ── Notification Bell ──────────────────────────────────────────────────────────

class _NotificationBell extends StatelessWidget {
  _NotificationBell();
  final _notif = Get.find<NotificationController>();

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final count = _notif.unreadCount.value;
      return Stack(
        alignment: Alignment.center,
        children: [
          IconButton(
            tooltip: 'Notifications',
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () => Get.toNamed(Routes.notifications),
          ),
          if (count > 0)
            Positioned(
              top: 8,
              right: 8,
              child: Container(
                padding: const EdgeInsets.all(2),
                constraints:
                    const BoxConstraints(minWidth: 16, minHeight: 16),
                decoration: const BoxDecoration(
                  color: Color(0xFFE53E3E),
                  shape: BoxShape.circle,
                ),
                child: Text(
                  count > 99 ? '99+' : '$count',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
        ],
      );
    });
  }
}

// ── Workspace Card ─────────────────────────────────────────────────────────────

class _WorkspaceCard extends StatelessWidget {
  final WorkspaceModel workspace;
  final String myStudentId;

  const _WorkspaceCard({
    required this.workspace,
    required this.myStudentId,
  });

  @override
  Widget build(BuildContext context) {
    final amLeader = workspace.isLeader(myStudentId);

    return GestureDetector(
      onTap: () => Get.toNamed(Routes.workspace, arguments: workspace),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(18),
        decoration: context.cardDecoration(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Course badge + leader chip
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E3A8A).withAlpha(15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    workspace.courseCode,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1E3A8A),
                      letterSpacing: 0.4,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                if (amLeader)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF3CD),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.star_rounded,
                            size: 12, color: Color(0xFF856404)),
                        SizedBox(width: 4),
                        Text(
                          'Leader',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF856404),
                          ),
                        ),
                      ],
                    ),
                  ),
                const Spacer(),
                Icon(Icons.chevron_right_rounded,
                    color: context.textPlaceholder, size: 20),
              ],
            ),
            const SizedBox(height: 10),

            // Group name
            Text(
              workspace.groupName,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: context.textPrimary,
              ),
            ),
            const SizedBox(height: 3),

            Text(
              workspace.courseName,
              style: TextStyle(fontSize: 13, color: context.textSecondary),
            ),
            const SizedBox(height: 2),

            Text(
              '${workspace.semesterName} · ${workspace.cohortName}',
              style: TextStyle(fontSize: 12, color: context.textMuted),
            ),
            const SizedBox(height: 14),

            // Footer: members + task summary
            Row(
              children: [
                Icon(Icons.people_outline_rounded,
                    size: 15, color: context.textMuted),
                const SizedBox(width: 5),
                Text(
                  '${workspace.members.length} members',
                  style: TextStyle(fontSize: 12, color: context.textMuted),
                ),
                const Spacer(),
                if (workspace.taskSummary.total > 0) ...[
                  _TaskChip(
                    label:
                        '${workspace.taskSummary.done}/${workspace.taskSummary.total}',
                    icon:  Icons.check_circle_outline_rounded,
                    color: const Color(0xFF15803D),
                    bg:    const Color(0xFFDCFCE7),
                  ),
                  if (workspace.taskSummary.dueSoon > 0) ...[
                    const SizedBox(width: 6),
                    _TaskChip(
                      label: '${workspace.taskSummary.dueSoon} due soon',
                      icon:  Icons.schedule_rounded,
                      color: const Color(0xFFB45309),
                      bg:    const Color(0xFFFEF3C7),
                    ),
                  ],
                ] else
                  Text(
                    'No tasks yet',
                    style:
                        TextStyle(fontSize: 12, color: context.textMuted),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _TaskChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final Color bg;

  const _TaskChip({
    required this.label,
    required this.icon,
    required this.color,
    required this.bg,
  });

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 12, color: color),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                  fontSize: 11, fontWeight: FontWeight.w600, color: color),
            ),
          ],
        ),
      );
}

// ── Empty / Error states ───────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: const Color(0xFF1E3A8A).withAlpha(15),
                borderRadius: BorderRadius.circular(18),
              ),
              child: const Icon(Icons.groups_outlined,
                  color: Color(0xFF1E3A8A), size: 36),
            ),
            const SizedBox(height: 16),
            Text(
              'No groups yet',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: context.textPrimary),
            ),
            const SizedBox(height: 6),
            Text(
              "You haven't been assigned to any groups.",
              style: TextStyle(fontSize: 13, color: context.textMuted),
            ),
          ],
        ),
      );
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.wifi_off_rounded, color: context.textMuted, size: 48),
              const SizedBox(height: 16),
              Text(
                message,
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: context.textSecondary),
              ),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: const Text('Retry'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1E3A8A),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ],
          ),
        ),
      );
}
