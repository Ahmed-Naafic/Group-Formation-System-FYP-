import '../models/notification_model.dart';
import '../providers/api_client.dart';

class NotificationRepository {
  final _client = ApiClient();

  Future<Map<String, dynamic>> getAll({int limit = 30, bool unreadOnly = false}) async {
    final response = await _client.dio.get(
      '/notifications',
      queryParameters: {'limit': limit, 'unreadOnly': unreadOnly},
    );
    final data = response.data['data'] as Map<String, dynamic>;
    final raw  = data['notifications'] as List;
    return {
      'notifications': raw
          .map((j) => NotificationModel.fromJson(j as Map<String, dynamic>))
          .toList(),
      'unreadCount': (data['unreadCount'] as num?)?.toInt() ?? 0,
    };
  }

  Future<void> markRead(String id) async {
    await _client.dio.patch('/notifications/$id/read');
  }

  Future<void> markAllRead() async {
    await _client.dio.patch('/notifications/read-all');
  }
}
