import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import '../../../data/models/notification_model.dart';
import '../controllers/notification_controller.dart';

class NotificationsView extends StatelessWidget {
  const NotificationsView({super.key});

  @override
  Widget build(BuildContext context) {
    final ctrl = Get.find<NotificationController>();

    return Scaffold(
      backgroundColor: const Color(0xFFF5F6F9),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E3A8A),
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Notifications',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
        actions: [
          Obx(() {
            if (ctrl.unreadCount.value == 0) return const SizedBox.shrink();
            return TextButton(
              onPressed: ctrl.markAllRead,
              child: const Text(
                'Mark all read',
                style: TextStyle(color: Colors.white70, fontSize: 12),
              ),
            );
          }),
        ],
      ),
      body: Obx(() {
        if (ctrl.isLoading.value) {
          return const Center(
            child: CircularProgressIndicator(color: Color(0xFF1E3A8A)),
          );
        }
        if (ctrl.notifications.isEmpty) {
          return const Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.notifications_none_rounded,
                    size: 56, color: Color(0xFFCDD5E0)),
                SizedBox(height: 16),
                Text(
                  'No notifications yet.',
                  style: TextStyle(fontSize: 15, color: Color(0xFF8A92A4)),
                ),
              ],
            ),
          );
        }
        return RefreshIndicator(
          color: const Color(0xFF1E3A8A),
          onRefresh: ctrl.refresh,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: ctrl.notifications.length,
            separatorBuilder: (_, _) =>
                const Divider(height: 1, indent: 70, endIndent: 16),
            itemBuilder: (_, i) {
              final n = ctrl.notifications[i];
              return _NotificationTile(n: n, onTap: () => ctrl.markRead(n.id));
            },
          ),
        );
      }),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  final NotificationModel n;
  final VoidCallback onTap;
  const _NotificationTile({required this.n, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final timeLabel = _timeLabel(n.createdAt);
    return InkWell(
      onTap: onTap,
      child: Container(
        color: n.isRead ? Colors.white : const Color(0xFFEFF4FF),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: n.color.withAlpha(24),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(n.icon, color: n.color, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          n.title,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: n.isRead
                                ? FontWeight.w500
                                : FontWeight.w700,
                            color: const Color(0xFF0E1320),
                          ),
                        ),
                      ),
                      if (!n.isRead)
                        Container(
                          width: 8,
                          height: 8,
                          margin: const EdgeInsets.only(left: 8),
                          decoration: const BoxDecoration(
                            color: Color(0xFF1E3A8A),
                            shape: BoxShape.circle,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    n.message,
                    style: const TextStyle(
                        fontSize: 13, color: Color(0xFF596070)),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    timeLabel,
                    style: const TextStyle(
                        fontSize: 11, color: Color(0xFF8A92A4)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _timeLabel(DateTime dt) {
    final now  = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 1)  return 'Just now';
    if (diff.inHours   < 1)  return '${diff.inMinutes}m ago';
    if (diff.inHours   < 24) return '${diff.inHours}h ago';
    if (diff.inDays    < 7)  return '${diff.inDays}d ago';
    return DateFormat('MMM d').format(dt);
  }
}
