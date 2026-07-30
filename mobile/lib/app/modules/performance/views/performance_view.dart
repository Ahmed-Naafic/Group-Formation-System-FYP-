import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/workspace_model.dart';
import '../controllers/performance_controller.dart';

class PerformanceView extends StatelessWidget {
  const PerformanceView({super.key});

  @override
  Widget build(BuildContext context) {
    final ctrl = Get.find<PerformanceController>();

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'My Grades',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      body: Obx(() {
        if (ctrl.isLoading.value) {
          return const Center(
            child: CircularProgressIndicator(color: Color(0xFF1E3A8A)),
          );
        }
        if (ctrl.error.value.isNotEmpty) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.error_outline_rounded,
                      size: 40, color: context.textPlaceholder),
                  const SizedBox(height: 12),
                  Text(ctrl.error.value,
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 14, color: context.textSecondary)),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: ctrl.load,
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          );
        }
        if (ctrl.workspaces.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.school_outlined,
                    size: 56, color: context.textPlaceholder),
                const SizedBox(height: 16),
                Text(
                  'No groups yet — grades will show up here once you\'re placed in one.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 14, color: context.textMuted),
                ),
              ],
            ),
          );
        }

        return RefreshIndicator(
          color: const Color(0xFF1E3A8A),
          onRefresh: ctrl.load,
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: ctrl.workspaces.length,
            itemBuilder: (_, i) => _WorkspaceGradeCard(workspace: ctrl.workspaces[i]),
          ),
        );
      }),
    );
  }
}

class _WorkspaceGradeCard extends StatelessWidget {
  final WorkspaceModel workspace;
  const _WorkspaceGradeCard({required this.workspace});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: context.cardColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: context.dividerColor),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(10),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  workspace.groupName,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: context.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  [workspace.courseCode, workspace.courseName]
                      .where((s) => s.isNotEmpty)
                      .join(' · '),
                  style: TextStyle(fontSize: 12, color: context.textMuted),
                ),
              ],
            ),
          ),
          if (workspace.tasks.isEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
              child: Text(
                'No tasks assigned yet.',
                style: TextStyle(fontSize: 12, color: context.textMuted),
              ),
            )
          else
            Column(
              children: [
                for (final task in workspace.tasks) _TaskGradeRow(task: task),
              ],
            ),
          const SizedBox(height: 4),
        ],
      ),
    );
  }
}

class _TaskGradeRow extends StatelessWidget {
  final WorkspaceTaskGrade task;
  const _TaskGradeRow({required this.task});

  ({String label, Color color, Color bg}) get _status {
    if (task.isGraded) {
      return (
        label: '${task.grade!.toStringAsFixed(task.grade! % 1 == 0 ? 0 : 1)}/100',
        color: const Color(0xFF15803D),
        bg: const Color(0xFFDCFCE7),
      );
    }
    switch (task.status) {
      case 'submitted':
        return (label: 'Submitted', color: const Color(0xFF1E3A8A), bg: const Color(0xFFEFF3FB));
      case 'late':
        return (label: 'Late', color: const Color(0xFFB23A3A), bg: const Color(0xFFFEF2F2));
      case 'draft':
        return (label: 'Draft', color: const Color(0xFF8A92A4), bg: const Color(0xFFF0F1F4));
      default:
        return (label: 'Not started', color: const Color(0xFF8A92A4), bg: const Color(0xFFF0F1F4));
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = _status;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: context.dividerColor)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  task.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 13, color: context.textPrimary),
                ),
                if (task.deadline != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    'Due ${DateFormat('MMM d, yyyy').format(task.deadline!.toLocal())}',
                    style: TextStyle(fontSize: 11, color: context.textMuted),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: s.bg, borderRadius: BorderRadius.circular(8)),
            child: Text(
              s.label,
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: s.color),
            ),
          ),
        ],
      ),
    );
  }
}
