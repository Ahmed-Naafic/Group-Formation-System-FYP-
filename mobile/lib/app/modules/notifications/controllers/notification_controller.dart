import 'package:get/get.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../../../core/config.dart';
import '../../../data/models/notification_model.dart';
import '../../../data/providers/api_client.dart';
import '../../../data/repositories/notification_repository.dart';

class NotificationController extends GetxController {
  final _repo = NotificationRepository();

  final notifications = <NotificationModel>[].obs;
  final unreadCount   = 0.obs;
  final isLoading     = false.obs;

  io.Socket? _socket;
  bool _connected    = false;
  bool _disposed     = false;

  static const _maxAttempts = 4;
  static const _delays      = [800, 1500, 3000];

  // Called from DashboardController after login to start real-time updates.
  Future<void> connect() async {
    if (_connected) return;
    final fetched = await _fetchAllWithRetry();
    await _openSocket();
    if (fetched) _connected = true;
  }

  // Called when returning to the alerts tab — re-fetch if not yet loaded.
  Future<void> ensureLoaded() async {
    if (notifications.isNotEmpty || isLoading.value) return;
    await _fetchAllWithRetry();
  }

  // Called from AuthController.logout().
  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket    = null;
    _connected = false;
    notifications.clear();
    unreadCount.value = 0;
  }

  // Returns true if fetch ultimately succeeded.
  Future<bool> _fetchAllWithRetry({int attempt = 0}) async {
    if (_disposed) return false;
    isLoading.value = true;
    try {
      final result = await _repo.getAll(limit: 50);
      if (!_disposed) {
        notifications.assignAll(result['notifications'] as List<NotificationModel>);
        unreadCount.value = result['unreadCount'] as int;
        isLoading.value   = false;
      }
      return true;
    } catch (_) {
      if (_disposed) return false;
      if (attempt < _maxAttempts - 1) {
        final delay = _delays[attempt.clamp(0, _delays.length - 1)];
        await Future.delayed(Duration(milliseconds: delay));
        return _fetchAllWithRetry(attempt: attempt + 1);
      }
      if (!_disposed) isLoading.value = false;
      return false;
    }
  }

  @override
  Future<void> refresh() async {
    _disposed = false;
    await _fetchAllWithRetry();
  }

  Future<void> markRead(String id) async {
    try {
      await _repo.markRead(id);
      final idx = notifications.indexWhere((n) => n.id == id);
      if (idx != -1 && !notifications[idx].isRead) {
        notifications[idx] = notifications[idx].copyWith(isRead: true);
        notifications.refresh();
        if (unreadCount.value > 0) unreadCount.value--;
      }
    } catch (_) {}
  }

  Future<void> markAllRead() async {
    try {
      await _repo.markAllRead();
      final updated = notifications.map((n) => n.copyWith(isRead: true)).toList();
      notifications.assignAll(updated);
      unreadCount.value = 0;
    } catch (_) {}
  }

  Future<void> _openSocket() async {
    final token = await ApiClient().getToken();
    if (token == null || _disposed) return;

    _socket = io.io(
      kServerUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .enableAutoConnect()
          .enableReconnection()
          .setReconnectionAttempts(10)
          .setReconnectionDelay(3000)
          .build(),
    );

    _socket!.onReconnect((_) {
      // Re-fetch notifications after socket reconnects so nothing is missed.
      _fetchAllWithRetry();
    });

    _socket!.on('notification', (data) {
      try {
        final Map<String, dynamic> raw;
        if (data is Map<String, dynamic>) {
          raw = data;
        } else if (data is Map) {
          raw = Map<String, dynamic>.from(data);
        } else {
          return;
        }
        final n = NotificationModel.fromJson(
          raw['notification'] is Map<String, dynamic>
              ? raw['notification'] as Map<String, dynamic>
              : Map<String, dynamic>.from(raw['notification'] as Map),
        );
        notifications.insert(0, n);
        unreadCount.value++;
      } catch (_) {}
    });
  }

  @override
  void onClose() {
    _disposed = true;
    disconnect();
    super.onClose();
  }
}
