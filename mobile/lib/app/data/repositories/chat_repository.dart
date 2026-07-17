import 'package:dio/dio.dart';
import '../models/chat_message_model.dart';
import '../providers/api_client.dart';

class ChatRepository {
  final _client = ApiClient();

  Future<List<ChatMessage>> getHistory(
    String workspaceId, {
    int limit = 50,
    String? before,
    String? after,
  }) async {
    final params = <String, dynamic>{'limit': limit};
    if (before != null) params['before'] = before;
    if (after  != null) params['after']  = after;

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

  /// Uploads a recorded voice note and returns the fully-created message.
  /// Other clients in the workspace receive it via the 'new-message' socket
  /// broadcast; the sender reconciles its own optimistic bubble directly from
  /// this response instead — see ChatController's tempId-based replace.
  Future<ChatMessage> uploadVoiceMessage(
    String workspaceId,
    String audioFilePath,
    int durationSeconds, {
    String mimeType = 'audio/mp4',
  }) async {
    final multipart = await MultipartFile.fromFile(
      audioFilePath,
      filename: 'voice-note.m4a',
      contentType: DioMediaType.parse(mimeType),
    );
    final form = FormData.fromMap({
      'audio':    multipart,
      'duration': durationSeconds,
    });
    final response = await _client.dio.post(
      '/workspaces/$workspaceId/messages/voice',
      data: form,
      options: Options(
        sendTimeout:    const Duration(minutes: 2),
        receiveTimeout: const Duration(minutes: 1),
      ),
    );
    return ChatMessage.fromJson(response.data['data']['message'] as Map<String, dynamic>);
  }

  /// Resolves a fresh, short-lived playback URL for a voice message — the
  /// storage bucket is private, so URLs aren't cached client-side.
  Future<String> getVoiceMessageUrl(String workspaceId, String messageId) async {
    final response = await _client.dio.get('/workspaces/$workspaceId/messages/$messageId/audio');
    return response.data['data']['url'] as String;
  }
}
