import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'app/core/theme/app_theme.dart';
import 'app/core/theme/theme_controller.dart';
import 'app/modules/auth/controllers/auth_controller.dart';
import 'app/modules/notifications/controllers/notification_controller.dart';
import 'app/routes/app_pages.dart';

// Must be a top-level function — called by FCM when app is terminated
@pragma('vm:entry-point')
Future<void> _onBackgroundMessage(RemoteMessage _) async {
  await Firebase.initializeApp();
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  FirebaseMessaging.onBackgroundMessage(_onBackgroundMessage);
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
