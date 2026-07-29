import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'app/core/theme/app_theme.dart';
import 'app/core/theme/theme_controller.dart';
import 'app/modules/auth/controllers/auth_controller.dart';
import 'app/modules/notifications/controllers/notification_controller.dart';
import 'app/routes/app_pages.dart';
import 'app/services/notification_navigator.dart';

// Must be a top-level function — called by FCM when app is terminated
@pragma('vm:entry-point')
Future<void> _onBackgroundMessage(RemoteMessage _) async {
  await Firebase.initializeApp();
}

// Routes to the relevant screen for any notification type — NotificationNavigator
// itself waits for the app to be past the splash/auth gate, so this can be
// called immediately without a fixed startup delay.
void _handleFcmTap(Map<String, dynamic> data) {
  final type = data['type'] as String?;
  if (type == null) return;
  NotificationNavigator.open(
    type: type,
    entityId: data['entityId'] as String?,
    workspaceId: data['workspaceId'] as String?,
  );
}

Future<void> _initFcmHandlers() async {
  // Refresh notification count when a message arrives in the foreground.
  // No snackbar — push notifications only appear when the app is backgrounded or closed.
  FirebaseMessaging.onMessage.listen((RemoteMessage _) {
    try { Get.find<NotificationController>().refresh(); } catch (_) {}
  });

  // Navigate when the user taps an FCM notification from the background.
  FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
    _handleFcmTap(message.data);
  });

  // Navigate when the app was fully terminated and the user taps the notification.
  final initial = await FirebaseMessaging.instance.getInitialMessage();
  if (initial != null) {
    _handleFcmTap(initial.data);
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  FirebaseMessaging.onBackgroundMessage(_onBackgroundMessage);
  await _initFcmHandlers();
  runApp(const GroupFormationApp());
}

class GroupFormationApp extends StatelessWidget {
  const GroupFormationApp({super.key});

  @override
  Widget build(BuildContext context) {
    // GetX rebuilds when tc.isDark changes, propagating themeMode down the tree.
    return GetX<ThemeController>(
      init: ThemeController(),
      builder: (tc) => GetMaterialApp(
        title: 'JUST Group Formation',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        darkTheme: AppTheme.dark,
        themeMode: tc.isDark.value ? ThemeMode.dark : ThemeMode.light,
        initialBinding: BindingsBuilder(() {
          Get.put(AuthController(), permanent: true);
          Get.put(NotificationController(), permanent: true);
        }),
        initialRoute: AppPages.initial,
        getPages: AppPages.routes,
      ),
    );
  }
}
