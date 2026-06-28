import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:get/get.dart';
import '../../../app/core/config.dart';

const String _kTokenKey   = 'jwt_token';
const String _kUserKey    = 'user_data';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

  late final Dio dio;
  final _storage = const FlutterSecureStorage();

  ApiClient._internal() {
    dio = Dio(BaseOptions(
      baseUrl: kApiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
      headers: {'Content-Type': 'application/json'},
    ));

    dio.interceptors.add(_AuthInterceptor(_storage));
    dio.interceptors.add(_UnauthorizedInterceptor());
  }

  // ── Token ────────────────────────────────────────────────────────────────────

  Future<void>    saveToken(String token) => _storage.write(key: _kTokenKey, value: token);
  Future<String?> getToken()              => _storage.read(key: _kTokenKey);
  Future<void>    clearToken()            => _storage.delete(key: _kTokenKey);

  // ── User data ────────────────────────────────────────────────────────────────
  // Stores minimal user info {fullName, role, studentId} as JSON string.

  Future<void> saveUserData(Map<String, dynamic> data) =>
      _storage.write(key: _kUserKey, value: jsonEncode(data));

  Future<Map<String, dynamic>?> getUserData() async {
    final raw = await _storage.read(key: _kUserKey);
    if (raw == null) return null;
    return jsonDecode(raw) as Map<String, dynamic>;
  }

  Future<void> clearUserData() => _storage.delete(key: _kUserKey);

  // ── Clear everything (logout) ────────────────────────────────────────────────

  Future<void> clearAll() async {
    await clearToken();
    await clearUserData();
  }
}

// Attaches the stored JWT to every outgoing request.
class _AuthInterceptor extends Interceptor {
  final FlutterSecureStorage _storage;
  _AuthInterceptor(this._storage);

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _storage.read(key: _kTokenKey);
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }
}

// Catches 401s on authenticated endpoints and sends the user back to login.
// Auth endpoints (/auth/login, /auth/change-password) are excluded because
// a 401 there is an expected response (wrong credentials / expired limited
// token) — the caller's own catch block handles it, not this interceptor.
class _UnauthorizedInterceptor extends Interceptor {
  static bool _isAuthEndpoint(String path) =>
      path.contains('/auth/login') || path.contains('/auth/change-password');

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode == 401 &&
        !_isAuthEndpoint(err.requestOptions.path)) {
      ApiClient().clearAll();
      Get.offAllNamed('/login');
    }
    handler.next(err);
  }
}
