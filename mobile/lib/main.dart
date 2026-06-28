import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'app/modules/auth/controllers/auth_controller.dart';
import 'app/modules/notifications/controllers/notification_controller.dart';
import 'app/routes/app_pages.dart';

void main() {
  runApp(const GroupFormationApp());
}

class GroupFormationApp extends StatelessWidget {
  const GroupFormationApp({super.key});

  @override
  Widget build(BuildContext context) {
    return GetMaterialApp(
      title: 'JUST Group Formation',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1E3A8A),
        ),
        useMaterial3: true,
      ),
      // Register AuthController as a permanent singleton before any route loads.
      initialBinding: BindingsBuilder(() {
        Get.put(AuthController(),           permanent: true);
        Get.put(NotificationController(),   permanent: true);
      }),
      initialRoute: AppPages.initial,
      getPages: AppPages.routes,
    );
  }
}
