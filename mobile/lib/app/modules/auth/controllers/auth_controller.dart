import 'package:dio/dio.dart';
import 'package:get/get.dart';
import '../../../data/providers/api_client.dart';
import '../../../routes/app_pages.dart';
import '../../../services/push_notification_service.dart';
import '../../notifications/controllers/notification_controller.dart';

class AuthController extends GetxController {
  final _api = ApiClient();

  // UI state
  final isLoading     = false.obs;
  final errorMessage  = ''.obs;

  // Logged-in user state (populated after login / restored on auto-login)
  final userId        = ''.obs;
  final userName      = ''.obs;
  final userRole      = ''.obs;
  final userStudentId = ''.obs;

  // ── Auto-login ───────────────────────────────────────────────────────────────
  // Called from SplashView on startup. Navigates away before the user sees
  // the login screen if a token is already stored.

  Future<void> checkAuth() async {
    final token = await _api.getToken();
    if (token != null) {
      final saved = await _api.getUserData();
      if (saved != null) {
        userId.value        = (saved['userId']     ?? '') as String;
        userName.value      = (saved['fullName']   ?? '') as String;
        userRole.value      = (saved['role']       ?? '') as String;
        userStudentId.value = (saved['studentId']  ?? '') as String;
      }
      await PushNotificationService.instance.init();
      Get.offAllNamed(Routes.dashboard);
    } else {
      Get.offAllNamed(Routes.login);
    }
  }

  // ── Login ────────────────────────────────────────────────────────────────────

  Future<void> login(String identifier, String password) async {
    if (identifier.trim().isEmpty || password.isEmpty) {
      errorMessage.value = 'Please enter your Student ID and password.';
      return;
    }

    isLoading.value    = true;
    errorMessage.value = '';

    try {
      final response = await _api.dio.post('/auth/login', data: {
        'identifier': identifier.trim(),
        'password':   password,
      });

      final data = response.data['data'] as Map<String, dynamic>;

      // mustChangePassword — store limited token and route to change-password
      if (data['mustChangePassword'] == true) {
        await _api.saveToken(data['token'] as String);
        Get.offAllNamed(Routes.changePassword);
        return;
      }

      await _storeSession(data);
      await PushNotificationService.instance.init();
      Get.offAllNamed(Routes.dashboard);
    } on DioException catch (e) {
      errorMessage.value =
          (e.response?.data?['error']?['message'] as String?) ??
          'Login failed. Please try again.';
    } catch (_) {
      errorMessage.value = 'Something went wrong. Please try again.';
    } finally {
      isLoading.value = false;
    }
  }

  // ── Change password (forced — limited token already stored) ──────────────────

  Future<void> changePassword(String newPassword, String confirm) async {
    // Client-side validation matching backend rules (min 8, upper, lower, digit)
    if (newPassword != confirm) {
      errorMessage.value = 'Passwords do not match.';
      return;
    }
    if (newPassword.length < 8) {
      errorMessage.value = 'Password must be at least 8 characters.';
      return;
    }
    if (!RegExp(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)').hasMatch(newPassword)) {
      errorMessage.value =
          'Password must contain uppercase, lowercase, and a number.';
      return;
    }

    isLoading.value    = true;
    errorMessage.value = '';

    try {
      // Limited token already in storage — _AuthInterceptor attaches it
      final response = await _api.dio.post('/auth/change-password', data: {
        'newPassword': newPassword,
      });

      final data = response.data['data'] as Map<String, dynamic>;
      await _storeSession(data);
      await PushNotificationService.instance.init();
      Get.offAllNamed(Routes.dashboard);
    } on DioException catch (e) {
      errorMessage.value =
          (e.response?.data?['error']?['message'] as String?) ??
          'Could not change password. Please try again.';
    } catch (_) {
      errorMessage.value = 'Something went wrong. Please try again.';
    } finally {
      isLoading.value = false;
    }
  }

  // ── Logout ───────────────────────────────────────────────────────────────────

  Future<void> logout() async {
    await PushNotificationService.instance.clearToken();
    Get.find<NotificationController>().disconnect();
    await _api.clearAll();
    userId.value        = '';
    userName.value      = '';
    userRole.value      = '';
    userStudentId.value = '';
    Get.offAllNamed(Routes.login);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  Future<void> _storeSession(Map<String, dynamic> data) async {
    await _api.saveToken(data['token'] as String);

    final user = data['user'] as Map<String, dynamic>;
    final userData = {
      'userId':    user['_id']       ?? '',
      'fullName':  user['fullName']  ?? '',
      'role':      user['role']      ?? '',
      'studentId': user['studentId'] ?? '',
    };
    await _api.saveUserData(userData);

    userId.value        = userData['userId']!;
    userName.value      = userData['fullName']!;
    userRole.value      = userData['role']!;
    userStudentId.value = userData['studentId']!;
  }
}
