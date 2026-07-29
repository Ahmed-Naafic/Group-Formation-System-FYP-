class ChatAttachment {
  final String id;
  final String originalName;
  final String mimeType;
  final int sizeBytes;

  const ChatAttachment({
    required this.id,
    required this.originalName,
    required this.mimeType,
    required this.sizeBytes,
  });

  bool get isImage => mimeType.startsWith('image/');
  bool get isVideo => mimeType.startsWith('video/');

  factory ChatAttachment.fromJson(Map<String, dynamic> json) => ChatAttachment(
        id:           json['_id']          as String? ?? '',
        originalName: json['originalName'] as String? ?? 'file',
        mimeType:     json['mimeType']     as String? ?? '',
        sizeBytes:    (json['sizeBytes']   as num?)?.toInt() ?? 0,
      );
}

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

class MessageReaction {
  final String userId;
  final String userName;
  final String emoji;

  const MessageReaction({
    required this.userId,
    required this.userName,
    required this.emoji,
  });

  factory MessageReaction.fromJson(Map<String, dynamic> json) {
    final raw = json['userId'];
    final user = raw is Map<String, dynamic> ? raw : <String, dynamic>{};
    return MessageReaction(
      userId:   user['_id'] as String? ?? raw?.toString() ?? '',
      userName: user['fullName'] as String? ?? 'Unknown',
      emoji:    json['emoji'] as String? ?? '',
    );
  }
}

/// A compact preview of the message being replied to — null replyTo (either
/// this message isn't a reply, or the original was since deleted) just means
/// no quote block is shown.
class ReplyPreview {
  final String messageId;
  final String senderName;
  final String content;
  final bool isAudio;

  const ReplyPreview({
    required this.messageId,
    required this.senderName,
    required this.content,
    required this.isAudio,
  });

  /// Builds a quote preview directly from a message already on-screen — lets
  /// the optimistic pending bubble show the correct quote immediately,
  /// without waiting for the server to echo it back.
  factory ReplyPreview.fromMessage(ChatMessage m) => ReplyPreview(
        messageId: m.id,
        senderName: m.sender.fullName,
        content: m.content,
        isAudio: m.hasAudio,
      );

  factory ReplyPreview.fromJson(Map<String, dynamic> json) {
    final rawSender = json['senderId'];
    final senderName = rawSender is Map<String, dynamic>
        ? (rawSender['fullName'] as String? ?? 'Unknown')
        : 'Unknown';
    return ReplyPreview(
      messageId:  json['_id'] as String? ?? '',
      senderName: senderName,
      content:    json['content'] as String? ?? '',
      isAudio:    json['audioDuration'] != null,
    );
  }
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

  final List<ChatAttachment> attachments;

  /// Set only on the sender's own optimistic bubble, before the upload
  /// finishes — mirrors localAudioPath. Never parsed from JSON.
  final String? localAttachmentPath;
  final String? localAttachmentMime;

  final List<MessageReaction> reactions;
  final ReplyPreview? replyTo;

  bool get hasAudio => audioDuration != null || localAudioPath != null;
  bool get hasAttachment => attachments.isNotEmpty || localAttachmentPath != null;

  const ChatMessage({
    required this.id,
    required this.workspaceId,
    required this.sender,
    required this.content,
    required this.createdAt,
    this.isPending = false,
    this.audioDuration,
    this.localAudioPath,
    this.attachments = const [],
    this.localAttachmentPath,
    this.localAttachmentMime,
    this.reactions = const [],
    this.replyTo,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    final raw = json['senderId'];
    final sender = raw is Map<String, dynamic>
        ? ChatSender.fromJson(raw)
        : ChatSender(id: raw?.toString() ?? '', fullName: 'Unknown');

    final rawReactions = json['reactions'] as List<dynamic>? ?? const [];
    final rawReply = json['replyTo'];
    final rawAttachments = json['attachments'] as List<dynamic>? ?? const [];

    return ChatMessage(
      id:            json['_id']          as String? ?? '',
      workspaceId:   json['workspaceId']  as String? ?? '',
      sender:        sender,
      content:       json['content']      as String? ?? '',
      createdAt:     DateTime.parse(json['createdAt'] as String),
      audioDuration: json['audioDuration'] as int?,
      attachments: rawAttachments
          .whereType<Map<String, dynamic>>()
          .map(ChatAttachment.fromJson)
          .toList(),
      reactions: rawReactions
          .map((r) => MessageReaction.fromJson(r as Map<String, dynamic>))
          .toList(),
      replyTo: rawReply is Map<String, dynamic>
          ? ReplyPreview.fromJson(rawReply)
          : null,
    );
  }

  ChatMessage copyWith({
    String? id,
    bool? isPending,
    int? audioDuration,
    String? localAudioPath,
    List<ChatAttachment>? attachments,
    String? localAttachmentPath,
    String? localAttachmentMime,
    List<MessageReaction>? reactions,
  }) {
    return ChatMessage(
      id:                  id ?? this.id,
      workspaceId:         workspaceId,
      sender:              sender,
      content:             content,
      createdAt:           createdAt,
      isPending:           isPending ?? this.isPending,
      audioDuration:       audioDuration ?? this.audioDuration,
      localAudioPath:      localAudioPath ?? this.localAudioPath,
      attachments:         attachments ?? this.attachments,
      localAttachmentPath: localAttachmentPath ?? this.localAttachmentPath,
      localAttachmentMime: localAttachmentMime ?? this.localAttachmentMime,
      reactions:           reactions ?? this.reactions,
      replyTo:             replyTo,
    );
  }
}
