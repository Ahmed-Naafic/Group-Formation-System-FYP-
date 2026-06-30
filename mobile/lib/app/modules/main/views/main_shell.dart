import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/theme_controller.dart';
import '../../../data/models/notification_model.dart';
import '../../auth/controllers/auth_controller.dart';
import '../../dashboard/controllers/dashboard_controller.dart';
import '../../dashboard/views/dashboard_view.dart';
import '../../notifications/controllers/notification_controller.dart';
import '../../notifications/views/notifications_view.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _index = 0;

  void _switchTab(int i) => setState(() => _index = i);

  @override
  Widget build(BuildContext context) {
    final notif = Get.find<NotificationController>();

    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: [
          _HomeTab(onGroupsTap: () => _switchTab(1), onAlertsTap: () => _switchTab(2)),
          const DashboardView(),
          const NotificationsView(),
          const _ProfileTab(),
        ],
      ),
      bottomNavigationBar: Obx(() {
        final unread = notif.unreadCount.value;
        return NavigationBarTheme(
          data: NavigationBarThemeData(
            backgroundColor: const Color(0xFF1E3A8A),
            indicatorColor: Colors.white.withAlpha(38),
            iconTheme: WidgetStateProperty.resolveWith((states) {
              if (states.contains(WidgetState.selected)) {
                return const IconThemeData(color: Colors.white);
              }
              return const IconThemeData(color: Colors.white54);
            }),
            labelTextStyle: WidgetStateProperty.resolveWith((states) {
              if (states.contains(WidgetState.selected)) {
                return const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                );
              }
              return const TextStyle(color: Colors.white54, fontSize: 12);
            }),
          ),
          child: NavigationBar(
            selectedIndex: _index,
            onDestinationSelected: _switchTab,
            labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
            destinations: [
              const NavigationDestination(
                icon: Icon(Icons.home_outlined),
                selectedIcon: Icon(Icons.home_rounded),
                label: 'Home',
              ),
              const NavigationDestination(
                icon: Icon(Icons.groups_outlined),
                selectedIcon: Icon(Icons.groups_rounded),
                label: 'Groups',
              ),
              NavigationDestination(
                icon: Badge(
                  isLabelVisible: unread > 0,
                  label: Text(unread > 99 ? '99+' : '$unread'),
                  child: const Icon(Icons.notifications_outlined),
                ),
                selectedIcon: Badge(
                  isLabelVisible: unread > 0,
                  label: Text(unread > 99 ? '99+' : '$unread'),
                  child: const Icon(Icons.notifications_rounded),
                ),
                label: 'Alerts',
              ),
              const NavigationDestination(
                icon: Icon(Icons.person_outline_rounded),
                selectedIcon: Icon(Icons.person_rounded),
                label: 'Profile',
              ),
            ],
          ),
        );
      }),
    );
  }
}

// ── Home Tab ──────────────────────────────────────────────────────────────────

class _HomeTab extends StatelessWidget {
  final VoidCallback onGroupsTap;
  final VoidCallback onAlertsTap;

  const _HomeTab({required this.onGroupsTap, required this.onAlertsTap});

  @override
  Widget build(BuildContext context) {
    final auth  = Get.find<AuthController>();
    final notif = Get.find<NotificationController>();
    final dash  = Get.find<DashboardController>();

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Home',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
        ),
        actions: [
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
        ],
      ),
      body: Obx(() {
        final workspaces = dash.workspaces;
        final unread     = notif.unreadCount.value;
        final pending    = workspaces.fold<int>(0, (sum, w) => sum + w.taskSummary.pending);

        return RefreshIndicator(
          color: const Color(0xFF1E3A8A),
          onRefresh: dash.fetchWorkspaces,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
            children: [
              _GreetingCard(name: auth.userName.value),
              const SizedBox(height: 20),

              // Stats
              Row(
                children: [
                  Expanded(
                    child: _StatCard(
                      icon: Icons.groups_rounded,
                      color: const Color(0xFF1E3A8A),
                      value: '${workspaces.length}',
                      label: 'Groups',
                      onTap: onGroupsTap,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _StatCard(
                      icon: Icons.assignment_outlined,
                      color: const Color(0xFF15803D),
                      value: '$pending',
                      label: 'Pending',
                      onTap: onGroupsTap,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _StatCard(
                      icon: Icons.notifications_active_outlined,
                      color: const Color(0xFFB45309),
                      value: '$unread',
                      label: 'Unread',
                      onTap: onAlertsTap,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 28),

              // Recent alerts
              if (notif.notifications.isNotEmpty) ...[
                _SectionHeader(
                  title: 'Recent Alerts',
                  actionLabel: 'See all',
                  onAction: onAlertsTap,
                ),
                const SizedBox(height: 10),
                ...notif.notifications.take(5).map((n) => _RecentAlertTile(
                      n: n,
                      onTap: () {
                        notif.markRead(n.id);
                        onAlertsTap();
                      },
                    )),
              ] else ...[
                const SizedBox(height: 32),
                Center(
                  child: Column(
                    children: [
                      Icon(Icons.notifications_none_rounded,
                          size: 48, color: Colors.white.withAlpha(80)),
                      const SizedBox(height: 12),
                      Text(
                        'No notifications yet',
                        style: TextStyle(
                            fontSize: 14,
                            color: Colors.white.withAlpha(160)),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        );
      }),
    );
  }
}

class _GreetingCard extends StatelessWidget {
  final String name;
  const _GreetingCard({required this.name});

  @override
  Widget build(BuildContext context) {
    final hour     = DateTime.now().hour;
    final greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1E3A8A), Color(0xFF2563EB)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            greeting,
            style: const TextStyle(fontSize: 13, color: Colors.white70),
          ),
          const SizedBox(height: 4),
          Text(
            name.isNotEmpty ? name : 'Student',
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Group Formation System',
            style: TextStyle(fontSize: 12, color: Colors.white54),
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final Color    color;
  final String   value;
  final String   label;
  final VoidCallback onTap;

  const _StatCard({
    required this.icon,
    required this.color,
    required this.value,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
          decoration: context.cardDecoration(),
          child: Column(
            children: [
              Icon(icon, color: color, size: 22),
              const SizedBox(height: 8),
              Text(
                value,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: context.textPrimary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                label,
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 10, color: context.textMuted),
              ),
            ],
          ),
        ),
      );
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  const _SectionHeader({
    required this.title,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Text(
            title,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: context.textPrimary,
            ),
          ),
          const Spacer(),
          if (actionLabel != null && onAction != null)
            TextButton(
              onPressed: onAction,
              style: TextButton.styleFrom(
                padding: EdgeInsets.zero,
                minimumSize: const Size(0, 32),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: Text(actionLabel!, style: const TextStyle(fontSize: 13)),
            ),
        ],
      );
}

class _RecentAlertTile extends StatelessWidget {
  final NotificationModel n;
  final VoidCallback onTap;
  const _RecentAlertTile({required this.n, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(12),
          decoration: context.cardDecoration(radius: 12),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: n.color.withAlpha(24),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(n.icon, color: n.color, size: 18),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      n.title,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: n.isRead ? FontWeight.w500 : FontWeight.w700,
                        color: context.textPrimary,
                      ),
                    ),
                    Text(
                      n.message,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 12, color: context.textSecondary),
                    ),
                  ],
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
        ),
      );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────

class _ProfileTab extends StatelessWidget {
  const _ProfileTab();

  @override
  Widget build(BuildContext context) {
    final auth = Get.find<AuthController>();
    final tc   = Get.find<ThemeController>();

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Profile',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
        ),
      ),
      body: Obx(() {
        final name      = auth.userName.value;
        final studentId = auth.userStudentId.value;
        final words     = name.trim().split(RegExp(r'\s+'));
        final initials  = words
            .take(2)
            .map((w) => w.isNotEmpty ? w[0].toUpperCase() : '')
            .join();

        return ListView(
          padding: const EdgeInsets.fromLTRB(24, 32, 24, 32),
          children: [
            // Avatar
            Center(
              child: Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF1E3A8A), Color(0xFF2563EB)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(22),
                ),
                child: Center(
                  child: Text(
                    initials.isNotEmpty ? initials : '?',
                    style: const TextStyle(
                      fontSize: 30,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Center(
              child: Text(
                name.isNotEmpty ? name : 'Student',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: context.textPrimary,
                ),
              ),
            ),
            if (studentId.isNotEmpty) ...[
              const SizedBox(height: 4),
              Center(
                child: Text(
                  'Student ID: $studentId',
                  style: TextStyle(fontSize: 14, color: context.textSecondary),
                ),
              ),
            ],
            const SizedBox(height: 36),

            // Dark mode
            Obx(() => Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: context.cardDecoration(),
                  child: ListTile(
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16)),
                    leading: Icon(
                      tc.isDark.value
                          ? Icons.dark_mode_rounded
                          : Icons.light_mode_rounded,
                      color: const Color(0xFF1E3A8A),
                    ),
                    title: Text('Dark Mode',
                        style: TextStyle(color: context.textPrimary)),
                    trailing: Switch(
                      value: tc.isDark.value,
                      onChanged: (_) => tc.toggle(),
                      activeThumbColor: Colors.white,
                      activeTrackColor: const Color(0xFF1E3A8A),
                    ),
                  ),
                )),

            // Sign out
            Container(
              decoration: context.cardDecoration(),
              child: ListTile(
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
                leading:
                    const Icon(Icons.logout_rounded, color: Color(0xFFE53E3E)),
                title: Text('Sign Out',
                    style: TextStyle(color: context.textPrimary)),
                onTap: () => Get.dialog(_logoutDialog(auth)),
              ),
            ),
          ],
        );
      }),
    );
  }

  Widget _logoutDialog(AuthController auth) => AlertDialog(
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out?'),
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        actions: [
          TextButton(
            onPressed: Get.back,
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
