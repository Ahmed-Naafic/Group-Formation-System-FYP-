import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:get/get.dart';
import '../data/providers/api_client.dart';
import '../routes/app_pages.dart';

class PushNotificationService {
  PushNotificationService._();
  static final _instance = PushNotificationService._();
  static PushNotificationService get instance => _instance;

  final _messaging = FirebaseMessaging.instance;

  Future<void> init() async {
    // Request permission (required on Android 13+ and iOS)
    await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // Register device token with the backend
    await _registerToken();

    // Refresh token when FCM rotates it
    _messaging.onTokenRefresh.listen(_sendTokenToServer);

    // App tapped from background notification
    FirebaseMessaging.onMessageOpenedApp.listen(_handleTap);

    // App launched from a terminated-state notification
    final initial = await _messaging.getInitialMessage();
    if (initial != null) _handleTap(initial);
  }

  Future<void> _registerToken() async {
    final token = await _messaging.getToken();
    if (token != null) await _sendTokenToServer(token);
  }

  Future<void> _sendTokenToServer(String token) async {
    try {
      await ApiClient().dio.post('/auth/fcm-token', data: {'token': token});
    } catch (_) {
      // Non-fatal — will retry on next token refresh or app restart
    }
  }

  Future<void> clearToken() async {
    try {
      await ApiClient().dio.delete('/auth/fcm-token');
      await _messaging.deleteToken();
    } catch (_) {}
  }

  static void _handleTap(RemoteMessage _) {
    if (Get.currentRoute != Routes.notifications) {
      Get.toNamed(Routes.notifications);
    }
  }
}
