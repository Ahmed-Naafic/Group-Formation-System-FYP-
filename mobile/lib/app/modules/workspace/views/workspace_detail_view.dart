import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/workspace_model.dart';
import '../../../routes/app_pages.dart';
import '../../auth/controllers/auth_controller.dart';
import '../../notifications/controllers/notification_controller.dart';

class WorkspaceDetailView extends StatelessWidget {
  const WorkspaceDetailView({super.key});

  @override
  Widget build(BuildContext context) {
    final workspace   = Get.arguments as WorkspaceModel;
    final auth        = Get.find<AuthController>();
    final myStudentId = auth.userStudentId.value;
    final amLeader    = workspace.isLeader(myStudentId);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          workspace.groupName,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Course info card ─────────────────────────────────────────────────
          _Card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _SectionLabel('Course'),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E3A8A),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        workspace.courseCode,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                          letterSpacing: 0.4,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        workspace.courseName,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: context.textPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _InfoRow(icon: Icons.school_outlined,    label: workspace.semesterName),
                const SizedBox(height: 6),
                _InfoRow(icon: Icons.group_work_outlined, label: workspace.cohortName),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // ── Leader banner ────────────────────────────────────────────────────
          if (amLeader)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF3CD),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFFFD966)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.star_rounded, color: Color(0xFF856404), size: 18),
                  SizedBox(width: 10),
                  Text(
                    'You are the Group Leader',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF856404),
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),

          // ── Members card ─────────────────────────────────────────────────────
          _Card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    _SectionLabel('Members'),
                    const Spacer(),
                    Text(
                      '${workspace.members.length} total',
                      style: TextStyle(fontSize: 12, color: context.textMuted),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                ...workspace.members.map((member) {
                  final isThis   = member.studentId == myStudentId;
                  final isLeader = member.id == workspace.leader.id;
                  return _MemberRow(
                    member:   member,
                    isMe:     isThis,
                    isLeader: isLeader,
                  );
                }),
              ],
            ),
          ),

          // ── Action buttons ───────────────────────────────────────────────────
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () =>
                      Get.toNamed(Routes.tasks, arguments: workspace),
                  icon: const Icon(Icons.assignment_outlined, size: 18),
                  label: const Text('Tasks',
                      style: TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 14)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1E3A8A),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                    elevation: 0,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Obx(() {
                  final unread = Get.find<NotificationController>()
                      .unreadMessages[workspace.id] ?? 0;
                  return Badge(
                    isLabelVisible: unread > 0,
                    label: Text('$unread'),
                    child: ElevatedButton.icon(
                      onPressed: () =>
                          Get.toNamed(Routes.chat, arguments: workspace),
                      icon: const Icon(Icons.chat_bubble_outline_rounded, size: 18),
                      label: const Text('Chat',
                          style: TextStyle(
                              fontWeight: FontWeight.w600, fontSize: 14)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0D7850),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14)),
                        elevation: 0,
                      ),
                    ),
                  );
                }),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () =>
                      Get.toNamed(Routes.files, arguments: workspace),
                  icon: const Icon(Icons.folder_outlined, size: 18),
                  label: const Text('Files',
                      style: TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 14)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF856404),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                    elevation: 0,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => Get.toNamed(Routes.performance),
                  icon: const Icon(Icons.school_outlined, size: 17),
                  label: const Text('My Grades',
                      style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => Get.toNamed(
                    Routes.feedback,
                    arguments: workspace.groupId,
                  ),
                  icon: const Icon(Icons.star_border_rounded, size: 17),
                  label: const Text('Feedback',
                      style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Sub-widgets ────────────────────────────────────────────────────────────────

class _Card extends StatelessWidget {
  final Widget child;
  const _Card({required this.child});

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: context.cardDecoration(),
        child: child,
      );
}

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) => Text(
        text.toUpperCase(),
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: context.textMuted,
          letterSpacing: 0.8,
        ),
      );
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  const _InfoRow({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Icon(icon, size: 15, color: context.textMuted),
          const SizedBox(width: 8),
          Text(label,
              style:
                  TextStyle(fontSize: 13, color: context.textSecondary)),
        ],
      );
}

class _MemberRow extends StatelessWidget {
  final MemberModel member;
  final bool isMe;
  final bool isLeader;
  const _MemberRow({
    required this.member,
    required this.isMe,
    required this.isLeader,
  });

  @override
  Widget build(BuildContext context) {
    final initial = member.fullName.isNotEmpty
        ? member.fullName[0].toUpperCase()
        : '?';

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: isMe
                ? const Color(0xFF1E3A8A)
                : const Color(0xFF1E3A8A).withAlpha(20),
            child: Text(
              initial,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: isMe ? Colors.white : const Color(0xFF1E3A8A),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      member.fullName,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight:
                            isMe ? FontWeight.w700 : FontWeight.w500,
                        color: context.textPrimary,
                      ),
                    ),
                    if (isMe) ...[
                      const SizedBox(width: 6),
                      Text(
                        '(You)',
                        style: TextStyle(
                            fontSize: 12, color: context.textMuted),
                      ),
                    ],
                  ],
                ),
                Text(
                  member.studentId,
                  style:
                      TextStyle(fontSize: 12, color: context.textMuted),
                ),
              ],
            ),
          ),
          if (isLeader)
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF3CD),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.star_rounded,
                      size: 11, color: Color(0xFF856404)),
                  SizedBox(width: 3),
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
        ],
      ),
    );
  }
}
