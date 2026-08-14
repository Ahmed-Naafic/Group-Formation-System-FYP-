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
      // Generous windows — the backend (Render free tier) can take up to ~60s
      // to wake from a cold start, and weak wifi/mobile data need more room
      // than a fast connection to even finish the TLS handshake.
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 30),
      // X-Client-Platform lets the backend restrict which roles may log in
      // from which app — only students use this app; admins/instructors use
      // the web app.
      headers: {'Content-Type': 'application/json', 'X-Client-Platform': 'mobile'},
    ));

    dio.interceptors.add(_RetryOnConnectionFailureInterceptor(dio));
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

// Retries a request when the connection itself couldn't be established
// (DNS failure, refused connection, handshake timeout) — exactly what
// happens on a weak connection hitting a Render instance that's still
// spinning up from a cold start. Mirrors the web app's own retry-with-backoff
// fix for the same problem (see web/src/lib/api.js).
//
// Deliberately does NOT retry receiveTimeout/sendTimeout: those mean the
// request already reached the server, so blindly resending a non-idempotent
// POST/PATCH/DELETE could duplicate the action server-side. connectionError/
// connectionTimeout mean the request never got there — always safe to retry.
class _RetryOnConnectionFailureInterceptor extends Interceptor {
  final Dio _dio;
  _RetryOnConnectionFailureInterceptor(this._dio);

  static const _delays = [
    Duration(seconds: 5),
    Duration(seconds: 8),
    Duration(seconds: 10),
    Duration(seconds: 12),
    Duration(seconds: 15),
    Duration(seconds: 15),
  ];

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final isConnectionFailure = err.type == DioExceptionType.connectionError ||
        err.type == DioExceptionType.connectionTimeout;
    if (!isConnectionFailure) return handler.next(err);

    final attempt = (err.requestOptions.extra['retryAttempt'] as int?) ?? 0;
    if (attempt >= _delays.length) return handler.next(err);

    await Future.delayed(_delays[attempt]);
    try {
      final options = err.requestOptions..extra['retryAttempt'] = attempt + 1;
      final response = await _dio.fetch(options);
      handler.resolve(response);
    } catch (_) {
      handler.next(err);
    }
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
