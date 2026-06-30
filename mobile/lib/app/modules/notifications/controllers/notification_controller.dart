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
  bool _connected = false;

  // Called from DashboardController after login to start real-time updates.
  Future<void> connect() async {
    if (_connected) return;
    await _fetchAll();
    await _openSocket();
    _connected = true;
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

  Future<void> _fetchAll() async {
    isLoading.value = true;
    try {
      final result = await _repo.getAll(limit: 50);
      notifications.assignAll(result['notifications'] as List<NotificationModel>);
      unreadCount.value = result['unreadCount'] as int;
    } catch (_) {}
    finally {
      isLoading.value = false;
    }
  }

  @override
  Future<void> refresh() => _fetchAll();

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
    if (token == null) return;

    _socket = io.io(
      kServerUrl,
      io.OptionBuilder()
          .setTransports(['polling', 'websocket'])
          .setAuth({'token': token})
          .enableAutoConnect()
          .build(),
    );

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
}
