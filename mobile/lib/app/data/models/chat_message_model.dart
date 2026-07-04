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

  const ChatMessage({
    required this.id,
    required this.workspaceId,
    required this.sender,
    required this.content,
    required this.createdAt,
    this.isPending = false,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    final raw = json['senderId'];
    final sender = raw is Map<String, dynamic>
        ? ChatSender.fromJson(raw)
        : ChatSender(id: raw?.toString() ?? '', fullName: 'Unknown');

    return ChatMessage(
      id:          json['_id']         as String? ?? '',
      workspaceId: json['workspaceId'] as String? ?? '',
      sender:      sender,
      content:     json['content']     as String? ?? '',
      createdAt:   DateTime.parse(json['createdAt'] as String),
    );
  }
}
