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

      if (data['mustChangePassword'] == true) {
        await _api.saveToken(data['token'] as String);
        Get.offAllNamed(Routes.changePassword);
        return;
      }

      await _storeSession(data);
      await PushNotificationService.instance.init();
      Get.offAllNamed(Routes.dashboard);
    } on DioException catch (e) {
      errorMessage.value = _loginError(e);
    } catch (_) {
      errorMessage.value = 'Something went wrong. Please try again.';
    } finally {
      isLoading.value = false;
    }
  }

  // ── Change password (forced — limited token already stored) ──────────────────

  Future<void> changePassword(String newPassword, String confirm) async {
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
      final response = await _api.dio.post('/auth/change-password', data: {
        'newPassword': newPassword,
      });

      final data = response.data['data'] as Map<String, dynamic>;
      await _storeSession(data);
      await PushNotificationService.instance.init();
      Get.offAllNamed(Routes.dashboard);
    } on DioException catch (e) {
      errorMessage.value = _networkAwareError(
        e,
        serverMessage: e.response?.data?['error']?['message'] as String?,
        fallback: 'Could not change password. Please try again.',
      );
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

  // ── Error helpers ────────────────────────────────────────────────────────────

  static String _loginError(DioException e) {
    // Network-level errors (no internet, timeout, server unreachable)
    if (_isNetworkError(e)) return _networkMessage(e);

    final status  = e.response?.statusCode;
    final message = e.response?.data?['error']?['message'] as String?;

    if (status == 400 || status == 401) return 'Incorrect Student ID or password.';
    if (status == 403) return 'Your account has been deactivated. Contact your instructor.';
    if (status == 404) return 'No account found with that Student ID.';
    if (status == 429) return 'Too many attempts. Please wait a moment and try again.';
    if (status != null && status >= 500) return 'Server error. Please try again later.';
    return message ?? 'Login failed. Please try again.';
  }

  static String _networkAwareError(
    DioException e, {
    String? serverMessage,
    required String fallback,
  }) {
    if (_isNetworkError(e)) return _networkMessage(e);
    final status = e.response?.statusCode;
    if (status != null && status >= 500) return 'Server error. Please try again later.';
    return serverMessage ?? fallback;
  }

  static bool _isNetworkError(DioException e) =>
      e.type == DioExceptionType.connectionError ||
      e.type == DioExceptionType.connectionTimeout ||
      e.type == DioExceptionType.receiveTimeout ||
      e.type == DioExceptionType.sendTimeout;

  static String _networkMessage(DioException e) {
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.sendTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      return 'Connection timed out. Please try again.';
    }
    // connectionError covers: no internet, server unreachable, connection refused
    final inner = e.error?.toString() ?? '';
    if (inner.contains('unreachable') || inner.contains('Network is down')) {
      return 'No internet connection. Please check your network.';
    }
    return 'Cannot reach the server. Check your internet connection.';
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
