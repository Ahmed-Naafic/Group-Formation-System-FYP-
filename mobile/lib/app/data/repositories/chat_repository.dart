import '../models/chat_message_model.dart';
import '../providers/api_client.dart';

class ChatRepository {
  final _client = ApiClient();

  Future<List<ChatMessage>> getHistory(
    String workspaceId, {
    int limit = 50,
    String? before,
  }) async {
    final params = <String, dynamic>{'limit': limit};
    if (before != null) params['before'] = before;

    final response = await _client.dio.get(
      '/workspaces/$workspaceId/messages',
      queryParameters: params,
    );
    final List<dynamic> raw = response.data['data']['messages'] as List;
    return raw
        .map((j) => ChatMessage.fromJson(j as Map<String, dynamic>))
        .toList();
  }

  Future<void> markAllRead(String workspaceId) async {
    await _client.dio.post('/workspaces/$workspaceId/messages/read-all');
  }
}
