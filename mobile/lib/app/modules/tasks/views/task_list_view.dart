import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/task_model.dart';
import '../../../routes/app_pages.dart';
import '../controllers/task_controller.dart';

class TaskListView extends GetView<TaskController> {
  const TaskListView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Tasks',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
            ),
            Text(
              controller.workspace.courseName,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w400,
                color: Color(0xFFB8C5E8),
              ),
            ),
          ],
        ),
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
            onRetry: controller.fetchTasks,
          );
        }

        if (controller.tasks.isEmpty) {
          return const _EmptyState();
        }

        return RefreshIndicator(
          color: const Color(0xFF1E3A8A),
          onRefresh: controller.fetchTasks,
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: controller.tasks.length,
            itemBuilder: (_, i) => _TaskCard(task: controller.tasks[i]),
          ),
        );
      }),
    );
  }
}

// ── Task Card ──────────────────────────────────────────────────────────────────

class _TaskCard extends StatelessWidget {
  final TaskModel task;
  const _TaskCard({required this.task});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => Get.toNamed(Routes.taskDetail, arguments: task),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(18),
        decoration: context.cardDecoration(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Title row + status
            Row(
              children: [
                Expanded(
                  child: Text(
                    task.title,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: context.textPrimary,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                _statusChip(task),
              ],
            ),

            // Description
            if (task.description.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                task.description,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 13,
                  color: context.textSecondary,
                  height: 1.4,
                ),
              ),
            ],

            const SizedBox(height: 12),

            // Footer: deadline + attachment
            Row(
              children: [
                _deadlineWidget(context, task),
                const Spacer(),
                if (task.hasAttachment)
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.attach_file_rounded,
                          size: 14, color: context.textMuted),
                      const SizedBox(width: 3),
                      Text(
                        'Attachment',
                        style: TextStyle(
                            fontSize: 11, color: context.textMuted),
                      ),
                    ],
                  ),
                const SizedBox(width: 8),
                Icon(Icons.chevron_right_rounded,
                    color: context.textPlaceholder, size: 18),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _statusChip(TaskModel task) {
    if (task.isClosed) {
      return _Chip(label: 'Closed',   color: const Color(0xFF8A92A4), bg: const Color(0xFFF0F1F4));
    }
    if (task.isOverdue) {
      return _Chip(label: 'Overdue',  color: const Color(0xFFB23A3A), bg: const Color(0xFFFEF2F2));
    }
    if (task.isDueSoon) {
      return _Chip(label: 'Due Soon', color: const Color(0xFFB45309), bg: const Color(0xFFFEF3C7));
    }
    return _Chip(label: 'Open',       color: const Color(0xFF15803D), bg: const Color(0xFFDCFCE7));
  }

  Widget _deadlineWidget(BuildContext context, TaskModel task) {
    if (task.deadline == null) {
      return Text(
        'No deadline',
        style: TextStyle(fontSize: 12, color: context.textMuted),
      );
    }
    final fmt     = DateFormat('MMM d, yyyy');
    final dateStr = fmt.format(task.deadline!.toLocal());
    final color   = task.isOverdue
        ? const Color(0xFFB23A3A)
        : task.isDueSoon
            ? const Color(0xFFB45309)
            : context.textMuted;
    final icon    = task.isOverdue
        ? Icons.warning_amber_rounded
        : Icons.schedule_rounded;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: color),
        const SizedBox(width: 4),
        Text(dateStr, style: TextStyle(fontSize: 12, color: color)),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final Color color;
  final Color bg;
  const _Chip({required this.label, required this.color, required this.bg});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration:
            BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
        child: Text(
          label,
          style: TextStyle(
              fontSize: 11, fontWeight: FontWeight.w600, color: color),
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
              child: const Icon(Icons.assignment_outlined,
                  color: Color(0xFF1E3A8A), size: 36),
            ),
            const SizedBox(height: 16),
            Text(
              'No tasks yet',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: context.textPrimary),
            ),
            const SizedBox(height: 6),
            Text(
              'Tasks assigned to your group will appear here.',
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
