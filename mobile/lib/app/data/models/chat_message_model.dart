class ChatSender {
  final String id;
  final String fullName;
  final String? studentId;

  const ChatSender({
    required this.id,
    required this.fullName,
    this.studentId,
  });

  factory ChatSender.fromJson(Map<String, dynamic> json) => ChatSender(
        id:        json['_id']       as String? ?? '',
        fullName:  json['fullName']  as String? ?? 'Unknown',
        studentId: json['studentId'] as String?,
      );
}

class ChatMessage {
  final String id;
  final String workspaceId;
  final ChatSender sender;
  final String content;
  final DateTime createdAt;
  final bool isPending;

  /// Seconds — null for a plain text message.
  final int? audioDuration;

  /// Set only on the sender's own optimistic bubble, before the upload
  /// finishes — lets them preview their own recording immediately. Never
  /// parsed from JSON; the server doesn't know about the local file.
  final String? localAudioPath;

  bool get hasAudio => audioDuration != null || localAudioPath != null;

  const ChatMessage({
    required this.id,
    required this.workspaceId,
    required this.sender,
    required this.content,
    required this.createdAt,
    this.isPending = false,
    this.audioDuration,
    this.localAudioPath,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    final raw = json['senderId'];
    final sender = raw is Map<String, dynamic>
        ? ChatSender.fromJson(raw)
        : ChatSender(id: raw?.toString() ?? '', fullName: 'Unknown');

    return ChatMessage(
      id:            json['_id']          as String? ?? '',
      workspaceId:   json['workspaceId']  as String? ?? '',
      sender:        sender,
      content:       json['content']      as String? ?? '',
      createdAt:     DateTime.parse(json['createdAt'] as String),
      audioDuration: json['audioDuration'] as int?,
    );
  }

  ChatMessage copyWith({
    String? id,
    bool? isPending,
    int? audioDuration,
    String? localAudioPath,
  }) {
    return ChatMessage(
      id:             id ?? this.id,
      workspaceId:    workspaceId,
      sender:         sender,
      content:        content,
      createdAt:      createdAt,
      isPending:      isPending ?? this.isPending,
      audioDuration:  audioDuration ?? this.audioDuration,
      localAudioPath: localAudioPath ?? this.localAudioPath,
    );
  }
}
