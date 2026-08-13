import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';
import 'package:emoji_picker_flutter/emoji_picker_flutter.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/chat_message_model.dart';
import '../../../routes/app_pages.dart';
import '../controllers/chat_controller.dart';

/// Sticker-style rendering (big, borderless) applies to any attachment/audio-
/// free message whose content is only emoji — whether typed or sent via the
/// sticker picker. Mirrors isStickerContent() in the web app's ChatTab.
// Explicit codepoint ranges rather than \p{Extended_Pictographic} — Dart's
// RegExp doesn't support named Unicode property escapes. Covers the emoji
// blocks plus the variation-selector/ZWJ codepoints used to join composites.
final _emojiPattern = RegExp(
  r'[\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1FFFF}\u{FE0F}\u{200D}]',
  unicode: true,
);

bool _isStickerContent(String content) {
  final trimmed = content.trim();
  if (trimmed.isEmpty) return false;
  final nonEmoji = trimmed.replaceAll(_emojiPattern, '').trim();
  if (nonEmoji.isNotEmpty) return false;
  // Generous rune cap — composite emoji (flags, ZWJ sequences, skin-tone
  // modifiers) can span several runes per visible glyph.
  final runeCount = trimmed.runes.length;
  return runeCount > 0 && runeCount <= 8;
}

const _stickerEmojis = [
  '😀', '😂', '🥹', '😍', '😎', '🥳', '😢', '😭', '😡', '🤔',
  '👍', '👎', '👏', '🙏', '❤️', '💔', '🔥', '🎉', '✨', '💯',
  '👌', '🙌', '🤝', '😴', '🤯', '😱', '😇', '🥰', '😜', '🤩',
  '😅', '🙄', '😬', '🤗', '👋', '💪', '🌟', '✅', '❌', '🎁',
];

/// Emoji picker — inserts into the composer text field, doesn't send.
void _showEmojiSheet(BuildContext context, ChatController ctrl) {
  showModalBottomSheet<void>(
    context: context,
    builder: (_) => SizedBox(
      height: 280,
      child: EmojiPicker(
        onEmojiSelected: (category, emoji) {
          final text = ctrl.textCtrl.text;
          final selection = ctrl.textCtrl.selection;
          final insertAt = selection.isValid ? selection.start : text.length;
          ctrl.textCtrl.value = TextEditingValue(
            text: text.replaceRange(insertAt, insertAt, emoji.emoji),
            selection: TextSelection.collapsed(
              offset: insertAt + emoji.emoji.length,
            ),
          );
        },
      ),
    ),
  );
}

/// Sticker picker — a grid of large emoji; tapping one sends immediately
/// (see ChatController.sendSticker) and closes the sheet.
void _showStickerSheet(BuildContext context, ChatController ctrl) {
  showModalBottomSheet<void>(
    context: context,
    builder: (sheetContext) => SafeArea(
      child: SizedBox(
        height: 280,
        child: GridView.count(
          padding: const EdgeInsets.all(12),
          crossAxisCount: 6,
          children: _stickerEmojis
              .map(
                (emoji) => InkWell(
                  borderRadius: BorderRadius.circular(10),
                  onTap: () {
                    Navigator.pop(sheetContext);
                    ctrl.sendSticker(emoji);
                  },
                  child: Center(
                    child: Text(emoji, style: const TextStyle(fontSize: 30)),
                  ),
                ),
              )
              .toList(),
        ),
      ),
    ),
  );
}

class ChatView extends StatelessWidget {
  const ChatView({super.key});

  @override
  Widget build(BuildContext context) {
    final ctrl = Get.find<ChatController>();

    return Scaffold(
      backgroundColor: context.chatBgColor,
      appBar: AppBar(
        title: Obx(
          () => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                ctrl.workspace?.groupName ?? 'Group Chat',
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '${ctrl.messages.length} messages',
                    style: const TextStyle(
                      fontSize: 11,
                      color: Color(0xFFB0C4F0),
                    ),
                  ),
                  if (ctrl.isSyncing.value) ...[
                    const SizedBox(width: 6),
                    const SizedBox(
                      width: 10,
                      height: 10,
                      child: CircularProgressIndicator(
                        strokeWidth: 1.5,
                        color: Color(0xFFB0C4F0),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
      body: Column(
        children: [
          // ── No-internet banner (shown only after all reconnect attempts fail) ──
          Obx(() {
            if (!ctrl.isSocketConnected.value &&
                !ctrl.isConnecting.value &&
                ctrl.workspace != null) {
              return Container(
                width: double.infinity,
                color: const Color(0xFFE53E3E).withAlpha(20),
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      Icons.wifi_off_rounded,
                      size: 13,
                      color: Color(0xFFE53E3E),
                    ),
                    const SizedBox(width: 6),
                    const Text(
                      'No internet · Messages may not send',
                      style: TextStyle(fontSize: 12, color: Color(0xFFE53E3E)),
                    ),
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: ctrl.reconnect,
                      child: const Text(
                        'Retry',
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF1E3A8A),
                          fontWeight: FontWeight.w700,
                          decoration: TextDecoration.underline,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }
            return const SizedBox.shrink();
          }),

          // ── Message list ───────────────────────────────────────────────────
          Expanded(
            child: Obx(() {
              if (ctrl.isLoading.value) {
                return const Center(
                  child: CircularProgressIndicator(color: Color(0xFF1E3A8A)),
                );
              }
              if (ctrl.errorMessage.isNotEmpty) {
                final noWorkspace = ctrl.workspace == null;
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.chat_bubble_outline_rounded,
                          size: 48,
                          color: context.textPlaceholder,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          ctrl.errorMessage.value,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: context.textSecondary,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 20),
                        ElevatedButton(
                          onPressed: noWorkspace
                              ? () => Get.offAllNamed(Routes.main)
                              : ctrl.retry,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF1E3A8A),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                          child: Text(
                            noWorkspace ? 'Go to Dashboard' : 'Retry',
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }
              if (ctrl.messages.isEmpty) {
                return LayoutBuilder(
                  builder: (context, constraints) => RefreshIndicator(
                    onRefresh: ctrl.pullRefresh,
                    color: const Color(0xFF1E3A8A),
                    child: SingleChildScrollView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      child: SizedBox(
                        height: constraints.maxHeight,
                        child: Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.chat_bubble_outline_rounded,
                                size: 56,
                                color: context.textPlaceholder,
                              ),
                              const SizedBox(height: 16),
                              Text(
                                'No messages yet.\nSay hello to your group!',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 15,
                                  color: context.textMuted,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              }
              final showLoadingOlder = ctrl.isLoadingOlder.value;
              return RefreshIndicator(
                onRefresh: ctrl.pullRefresh,
                color: const Color(0xFF1E3A8A),
                child: ListView.builder(
                  controller: ctrl.scrollCtrl,
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 12,
                  ),
                  itemCount: ctrl.messages.length + (showLoadingOlder ? 1 : 0),
                  itemBuilder: (_, rawIndex) {
                    if (showLoadingOlder && rawIndex == 0) {
                      return const Padding(
                        padding: EdgeInsets.symmetric(vertical: 8),
                        child: Center(
                          child: SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Color(0xFF1E3A8A),
                            ),
                          ),
                        ),
                      );
                    }
                    final i = showLoadingOlder ? rawIndex - 1 : rawIndex;
                    final msg = ctrl.messages[i];
                    final prev = i > 0 ? ctrl.messages[i - 1] : null;
                    final showSenderName =
                        !ctrl.isMyMessage(msg) &&
                        (prev == null || prev.sender.id != msg.sender.id);
                    final showDateDivider =
                        prev == null ||
                        !_sameDay(prev.createdAt, msg.createdAt);

                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (showDateDivider) _DateDivider(msg.createdAt),
                        _HighlightableBubble(
                          msg: msg,
                          isMe: ctrl.isMyMessage(msg),
                          showSenderName: showSenderName,
                          ctrl: ctrl,
                        ),
                      ],
                    );
                  },
                ),
              );
            }),
          ),

          // ── Typing indicator ───────────────────────────────────────────────
          _TypingIndicator(ctrl: ctrl),

          // ── Input bar ──────────────────────────────────────────────────────
          _InputBar(ctrl: ctrl),
        ],
      ),
    );
  }

  static bool _sameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;
}

// ── Date divider ───────────────────────────────────────────────────────────────

class _DateDivider extends StatelessWidget {
  final DateTime date;
  const _DateDivider(this.date);

  @override
  Widget build(BuildContext context) {
    final label = _label(date);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Expanded(child: Divider(color: context.borderColor)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: context.textMuted,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          Expanded(child: Divider(color: context.borderColor)),
        ],
      ),
    );
  }

  static String _label(DateTime d) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(d.year, d.month, d.day);
    if (day == today) return 'Today';
    if (day == today.subtract(const Duration(days: 1))) return 'Yesterday';
    return DateFormat('MMM d, y').format(d);
  }
}

// ── Highlightable wrapper ────────────────────────────────────────────────────
// Carries the GlobalKey ChatController scrolls to (via Scrollable.ensureVisible)
// when chat is opened from a notification tap, and tints the bubble briefly
// once it's the highlighted one — see ChatController._scrollToTargetOrBottom.

class _HighlightableBubble extends StatelessWidget {
  final ChatMessage msg;
  final bool isMe;
  final bool showSenderName;
  final ChatController ctrl;

  const _HighlightableBubble({
    required this.msg,
    required this.isMe,
    required this.showSenderName,
    required this.ctrl,
  });

  @override
  Widget build(BuildContext context) {
    final key = ctrl.bubbleKeys.putIfAbsent(msg.id, () => GlobalKey());
    return Obx(() {
      final highlighted = ctrl.highlightedMessageId.value == msg.id;
      return AnimatedContainer(
        key: key,
        duration: const Duration(milliseconds: 300),
        padding: const EdgeInsets.symmetric(vertical: 2),
        decoration: BoxDecoration(
          color: highlighted
              ? const Color(0xFFFFD54F).withAlpha(60)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(14),
        ),
        child: _MessageBubble(
          msg: msg,
          isMe: isMe,
          showSenderName: showSenderName,
          ctrl: ctrl,
        ),
      );
    });
  }
}

// ── Message bubble ─────────────────────────────────────────────────────────────

class _MessageBubble extends StatelessWidget {
  final ChatMessage msg;
  final bool isMe;
  final bool showSenderName;
  final ChatController ctrl;

  const _MessageBubble({
    required this.msg,
    required this.isMe,
    required this.showSenderName,
    required this.ctrl,
  });

  static String _fmtDuration(int seconds) {
    final d = Duration(seconds: seconds < 0 ? 0 : seconds);
    final m = d.inMinutes;
    final s = d.inSeconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  Widget _buildAudioRow(BuildContext context) {
    final iconColor = isMe ? Colors.white : context.textPrimary;
    return Obx(() {
      final isThisMsg = ctrl.currentlyPlayingMessageId.value == msg.id;
      final loading = isThisMsg && ctrl.isPlaybackLoading.value;
      final playing = isThisMsg && ctrl.isPlaybackPlaying.value;
      final position = isThisMsg ? ctrl.playbackPosition.value : Duration.zero;
      final total =
          isThisMsg && ctrl.playbackDurationTotal.value > Duration.zero
          ? ctrl.playbackDurationTotal.value
          : Duration(seconds: msg.audioDuration ?? 0);
      final progress = total.inMilliseconds > 0
          ? (position.inMilliseconds / total.inMilliseconds).clamp(0.0, 1.0)
          : 0.0;
      final remaining = isThisMsg && total > position
          ? total - position
          : total;

      return SizedBox(
        width: 210,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () => ctrl.togglePlayback(msg),
              child: Padding(
                padding: const EdgeInsets.all(2),
                child: loading
                    ? SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: iconColor,
                        ),
                      )
                    : Icon(
                        playing
                            ? Icons.pause_circle_filled
                            : Icons.play_circle_fill,
                        size: 30,
                        color: iconColor,
                      ),
              ),
            ),
            const SizedBox(width: 4),
            Expanded(
              child: SliderTheme(
                data: SliderTheme.of(context).copyWith(
                  trackHeight: 3,
                  thumbShape: const RoundSliderThumbShape(
                    enabledThumbRadius: 5,
                  ),
                  overlayShape: const RoundSliderOverlayShape(
                    overlayRadius: 12,
                  ),
                  activeTrackColor: iconColor,
                  inactiveTrackColor: iconColor.withAlpha(60),
                  thumbColor: iconColor,
                  overlayColor: iconColor.withAlpha(40),
                ),
                // Only draggable once this bubble's audio is actually loaded —
                // dragging before that has nothing to seek within yet.
                child: Slider(
                  value: progress.clamp(0.0, 1.0),
                  onChanged: (isThisMsg && total.inMilliseconds > 0)
                      ? (value) {
                          final target = Duration(
                            milliseconds: (value * total.inMilliseconds)
                                .round(),
                          );
                          ctrl.seekTo(msg, target);
                        }
                      : null,
                ),
              ),
            ),
            const SizedBox(width: 4),
            Text(
              _fmtDuration(remaining.inSeconds),
              style: TextStyle(fontSize: 11, color: iconColor.withAlpha(200)),
            ),
          ],
        ),
      );
    });
  }

  Widget _buildAttachmentContent(BuildContext context) {
    final attachment = msg.attachments.isNotEmpty ? msg.attachments.first : null;
    final mime = attachment?.mimeType ?? msg.localAttachmentMime ?? '';
    final isImage = mime.startsWith('image/');
    final isVideo = mime.startsWith('video/');

    final Widget preview;
    if (isImage) {
      preview = _AttachmentImage(msg: msg, ctrl: ctrl);
    } else if (isVideo) {
      preview = _AttachmentVideoTile(
        name: attachment?.originalName ?? 'Video',
        onTap: attachment != null ? () => ctrl.openAttachment(attachment) : null,
      );
    } else {
      preview = _AttachmentFileChip(
        name: attachment?.originalName ?? 'File',
        sizeBytes: attachment?.sizeBytes,
        isMe: isMe,
        onTap: attachment != null ? () => ctrl.openAttachment(attachment) : null,
      );
    }

    return Column(
      crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        preview,
        if (msg.content.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(
            msg.content,
            style: TextStyle(fontSize: 14, color: isMe ? Colors.white : context.textPrimary),
          ),
        ],
      ],
    );
  }

  static const _quickEmojis = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

  void _confirmDelete(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete message?'),
        content: Text(
          msg.hasAudio
              ? 'Remove this voice message for everyone in the group?'
              : msg.hasAttachment
                  ? 'Remove this attachment for everyone in the group?'
                  : 'Remove this message for everyone in the group?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              ctrl.deleteMessage(msg);
            },
            style: TextButton.styleFrom(
              foregroundColor: const Color(0xFFE53E3E),
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  void _showMessageActions(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 14),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: _quickEmojis
                    .map(
                      (emoji) => InkWell(
                        borderRadius: BorderRadius.circular(24),
                        onTap: () {
                          Navigator.pop(sheetContext);
                          ctrl.reactToMessage(msg, emoji);
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(6),
                          child: Text(
                            emoji,
                            style: const TextStyle(fontSize: 26),
                          ),
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.reply_rounded),
              title: const Text('Reply'),
              onTap: () {
                Navigator.pop(sheetContext);
                ctrl.startReply(msg);
              },
            ),
            if (isMe && !msg.isPending)
              ListTile(
                leading: const Icon(
                  Icons.delete_outline,
                  color: Color(0xFFE53E3E),
                ),
                title: const Text(
                  'Delete',
                  style: TextStyle(color: Color(0xFFE53E3E)),
                ),
                onTap: () {
                  Navigator.pop(sheetContext);
                  _confirmDelete(context);
                },
              ),
          ],
        ),
      ),
    );
  }

  void _showReactionNames(
    BuildContext context,
    String emoji,
    List<MessageReaction> reactors,
  ) {
    showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(emoji, style: const TextStyle(fontSize: 20)),
            const SizedBox(width: 8),
            const Text('Reacted'),
          ],
        ),
        content: SizedBox(
          width: double.maxFinite,
          child: ListView(
            shrinkWrap: true,
            children: reactors
                .map(
                  (r) => ListTile(
                    dense: true,
                    leading: const Icon(Icons.person_outline, size: 20),
                    title: Text(r.userName),
                  ),
                )
                .toList(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Widget _buildReactionsRow(BuildContext context) {
    if (msg.reactions.isEmpty) return const SizedBox.shrink();
    final grouped = <String, List<MessageReaction>>{};
    for (final r in msg.reactions) {
      grouped.putIfAbsent(r.emoji, () => []).add(r);
    }
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Wrap(
        spacing: 4,
        children: grouped.entries.map((entry) {
          final mine = entry.value.any((r) => r.userId == ctrl.myUserId);
          return InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () => _showReactionNames(context, entry.key, entry.value),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: mine
                    ? const Color(0xFF1E3A8A).withAlpha(30)
                    : context.chatBubbleOther,
                borderRadius: BorderRadius.circular(12),
                border: mine
                    ? Border.all(color: const Color(0xFF1E3A8A))
                    : null,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(entry.key, style: const TextStyle(fontSize: 12)),
                  if (entry.value.length > 1) ...[
                    const SizedBox(width: 3),
                    Text(
                      '${entry.value.length}',
                      style: TextStyle(
                        fontSize: 11,
                        color: context.textSecondary,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildReplyQuote(BuildContext context) {
    final reply = msg.replyTo;
    if (reply == null) return const SizedBox.shrink();
    final quoteColor = isMe ? Colors.white : context.textPrimary;
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: (isMe ? Colors.white : const Color(0xFF1E3A8A)).withAlpha(
          isMe ? 40 : 15,
        ),
        borderRadius: BorderRadius.circular(8),
        border: Border(
          left: BorderSide(color: quoteColor.withAlpha(180), width: 3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            reply.senderName,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: quoteColor.withAlpha(220),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            reply.isAudio ? '🎤 Voice message' : reply.content,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 12, color: quoteColor.withAlpha(180)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Sticker-style: no attachment, no audio, content is just 1-3 emoji —
    // rendered big and borderless instead of inside the usual colored bubble.
    final isSticker = !msg.hasAttachment &&
        !msg.hasAudio &&
        _isStickerContent(msg.content);
    final tickColor = isSticker
        ? context.textMuted
        : (isMe ? Colors.white.withAlpha(160) : context.textMuted);
    // Instructor messages get a distinct gold treatment (except the
    // instructor's own view of their own message — that's still "mine" blue).
    final isFromInstructor = !isMe && msg.sender.isInstructor;

    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: EdgeInsets.only(
          top: showSenderName ? 8 : 2,
          bottom: 2,
          left: isMe ? 48 : 0,
          right: isMe ? 0 : 48,
        ),
        child: Column(
          crossAxisAlignment: isMe
              ? CrossAxisAlignment.end
              : CrossAxisAlignment.start,
          children: [
            if (showSenderName)
              Padding(
                padding: const EdgeInsets.only(left: 4, bottom: 3),
                child: Text(
                  isFromInstructor ? '${msg.sender.fullName} · Instructor' : msg.sender.fullName,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: isFromInstructor ? context.instructorAccent : const Color(0xFF1E3A8A),
                  ),
                ),
              ),
            GestureDetector(
              onLongPress: msg.isPending
                  ? null
                  : () => _showMessageActions(context),
              child: Container(
                padding: isSticker
                    ? EdgeInsets.zero
                    : const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                decoration: isSticker
                    ? null
                    : BoxDecoration(
                        color: isMe
                            ? const Color(0xFF1E3A8A)
                            : isFromInstructor
                                ? context.chatBubbleInstructor
                                : context.chatBubbleOther,
                        border: isFromInstructor
                            ? Border.all(color: context.chatBubbleInstructorBorder)
                            : null,
                        borderRadius: BorderRadius.only(
                          topLeft: const Radius.circular(18),
                          topRight: const Radius.circular(18),
                          bottomLeft: Radius.circular(isMe ? 18 : 4),
                          bottomRight: Radius.circular(isMe ? 4 : 18),
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withAlpha(10),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                child: Column(
                  crossAxisAlignment: isMe
                      ? CrossAxisAlignment.end
                      : CrossAxisAlignment.start,
                  children: [
                    _buildReplyQuote(context),
                    if (msg.hasAttachment)
                      _buildAttachmentContent(context)
                    else if (msg.hasAudio)
                      _buildAudioRow(context)
                    else if (isSticker)
                      Text(msg.content, style: const TextStyle(fontSize: 52))
                    else
                      Text(
                        msg.content,
                        style: TextStyle(
                          fontSize: 14,
                          color: isMe ? Colors.white : context.textPrimary,
                        ),
                      ),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          DateFormat('h:mm a').format(msg.createdAt.toLocal()),
                          style: TextStyle(fontSize: 10, color: tickColor),
                        ),
                        if (isMe) ...[
                          const SizedBox(width: 4),
                          Icon(
                            msg.isPending ? Icons.check : Icons.done_all,
                            size: 13,
                            color: tickColor,
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ),
            _buildReactionsRow(context),
          ],
        ),
      ),
    );
  }
}

// ── Attachment bubbles ────────────────────────────────────────────────────────

/// Image attachment preview: local file directly for the sender's own
/// optimistic bubble (no network round-trip needed), otherwise fetched bytes
/// via ChatController.fetchAttachmentBytes (the storage bucket is private).
class _AttachmentImage extends StatelessWidget {
  final ChatMessage msg;
  final ChatController ctrl;
  const _AttachmentImage({required this.msg, required this.ctrl});

  @override
  Widget build(BuildContext context) {
    if (msg.localAttachmentPath != null) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: Image.file(
          File(msg.localAttachmentPath!),
          width: 200,
          height: 200,
          fit: BoxFit.cover,
        ),
      );
    }
    final attachment = msg.attachments.isNotEmpty ? msg.attachments.first : null;
    if (attachment == null) return const SizedBox.shrink();
    return FutureBuilder<Uint8List>(
      future: ctrl.fetchAttachmentBytes(attachment),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return Container(
            width: 200,
            height: 150,
            decoration: BoxDecoration(
              color: context.chatBubbleOther,
              borderRadius: BorderRadius.circular(10),
            ),
            alignment: Alignment.center,
            child: const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          );
        }
        if (snapshot.hasError || !snapshot.hasData) {
          return Container(
            width: 200,
            height: 150,
            decoration: BoxDecoration(
              color: context.chatBubbleOther,
              borderRadius: BorderRadius.circular(10),
            ),
            alignment: Alignment.center,
            child: Icon(Icons.broken_image_outlined, color: context.textMuted),
          );
        }
        return ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: GestureDetector(
            onTap: () => showDialog<void>(
              context: context,
              builder: (_) => Dialog(
                backgroundColor: Colors.transparent,
                child: InteractiveViewer(child: Image.memory(snapshot.data!)),
              ),
            ),
            child: Image.memory(
              snapshot.data!,
              width: 200,
              height: 200,
              fit: BoxFit.cover,
            ),
          ),
        );
      },
    );
  }
}

/// Video attachments don't play inline (no video-player dependency in this
/// app yet) — tapping downloads (if needed) and opens with the device's
/// default video player, same pattern as every other file type already uses.
class _AttachmentVideoTile extends StatelessWidget {
  final String name;
  final VoidCallback? onTap;
  const _AttachmentVideoTile({required this.name, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 200,
        height: 130,
        decoration: BoxDecoration(
          color: Colors.black87,
          borderRadius: BorderRadius.circular(10),
        ),
        alignment: Alignment.center,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.play_circle_fill, color: Colors.white, size: 40),
            const SizedBox(height: 6),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Text(
                name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white70, fontSize: 11),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Document (PDF/Word/Excel/CSV/etc.) chip — tap downloads and opens with
/// the device's default viewer.
class _AttachmentFileChip extends StatelessWidget {
  final String name;
  final int? sizeBytes;
  final bool isMe;
  final VoidCallback? onTap;
  const _AttachmentFileChip({
    required this.name,
    required this.isMe,
    this.sizeBytes,
    this.onTap,
  });

  String get _sizeLabel {
    final b = sizeBytes;
    if (b == null) return '';
    if (b < 1024) return '${b}B';
    if (b < 1024 * 1024) return '${(b / 1024).toStringAsFixed(1)}KB';
    return '${(b / (1024 * 1024)).toStringAsFixed(1)}MB';
  }

  @override
  Widget build(BuildContext context) {
    final fg = isMe ? Colors.white : context.textPrimary;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 220),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: (isMe ? Colors.white : const Color(0xFF1E3A8A)).withAlpha(
            isMe ? 30 : 12,
          ),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.insert_drive_file_outlined, color: fg, size: 22),
            const SizedBox(width: 8),
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13,
                      color: fg,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (_sizeLabel.isNotEmpty)
                    Text(
                      _sizeLabel,
                      style: TextStyle(fontSize: 11, color: fg.withAlpha(180)),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 6),
            Icon(Icons.download_rounded, color: fg, size: 16),
          ],
        ),
      ),
    );
  }
}

// ── Typing indicator ───────────────────────────────────────────────────────────

class _TypingIndicator extends StatelessWidget {
  final ChatController ctrl;
  const _TypingIndicator({required this.ctrl});

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final names = ctrl.typingUsers;
      return AnimatedSize(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        child: names.isEmpty
            ? const SizedBox.shrink()
            : _TypingBubble(names: List.from(names)),
      );
    });
  }
}

class _TypingBubble extends StatelessWidget {
  final List<String> names;
  const _TypingBubble({required this.names});

  String get _nameLabel {
    if (names.length == 1) return names[0];
    if (names.length == 2) return '${names[0]} & ${names[1]}';
    return 'Several people';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: context.chatBgColor,
      padding: const EdgeInsets.fromLTRB(12, 2, 64, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 3),
            child: Text(
              _nameLabel,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1E3A8A),
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
            alignment: Alignment.centerLeft,
            decoration: BoxDecoration(
              color: context.chatBubbleOther,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(18),
                topRight: Radius.circular(18),
                bottomLeft: Radius.circular(4),
                bottomRight: Radius.circular(18),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withAlpha(10),
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: const _BouncingDots(),
          ),
        ],
      ),
    );
  }
}

class _BouncingDots extends StatefulWidget {
  const _BouncingDots();

  @override
  State<_BouncingDots> createState() => _BouncingDotsState();
}

class _BouncingDotsState extends State<_BouncingDots>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ac;

  @override
  void initState() {
    super.initState();
    _ac = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat();
  }

  @override
  void dispose() {
    _ac.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ac,
      builder: (_, _) {
        return Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: List.generate(3, (i) {
            final t = (_ac.value - i * 0.18) % 1.0;
            final bounce = math.sin(t * math.pi).clamp(0.0, 1.0);
            return Transform.translate(
              offset: Offset(0, -bounce * 7),
              child: Container(
                width: 8,
                height: 8,
                margin: EdgeInsets.only(right: i < 2 ? 5 : 0),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Color.lerp(
                    context.borderColor,
                    const Color(0xFF1E3A8A),
                    bounce,
                  ),
                ),
              ),
            );
          }),
        );
      },
    );
  }
}

// ── Input bar ──────────────────────────────────────────────────────────────────

class _InputBar extends StatelessWidget {
  final ChatController ctrl;
  const _InputBar({required this.ctrl});

  static String _fmtElapsed(Duration d) {
    final m = d.inMinutes;
    final s = d.inSeconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 16),
      decoration: BoxDecoration(
        color: context.inputBarBg,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(
              Theme.of(context).brightness == Brightness.dark ? 40 : 20,
            ),
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Obx(() {
              final target = ctrl.replyTarget.value;
              if (target == null) return const SizedBox.shrink();
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: context.inputFill,
                  borderRadius: BorderRadius.circular(10),
                  border: const Border(
                    left: BorderSide(color: Color(0xFF1E3A8A), width: 3),
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Replying to ${target.sender.fullName}',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF1E3A8A),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            target.hasAudio
                                ? '🎤 Voice message'
                                : target.content,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 12,
                              color: context.textMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: Icon(
                        Icons.close,
                        size: 18,
                        color: context.textMuted,
                      ),
                      onPressed: ctrl.cancelReply,
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    ),
                  ],
                ),
              );
            }),
            Obx(() {
              final path = ctrl.pickedAttachmentPath.value;
              final name = ctrl.pickedAttachmentName.value;
              if (path == null) return const SizedBox.shrink();
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: context.inputFill,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        if (ctrl.pickedAttachmentIsImage)
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.file(
                              File(path),
                              width: 44,
                              height: 44,
                              fit: BoxFit.cover,
                            ),
                          )
                        else
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: context.chatBubbleOther,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Icon(
                              ctrl.pickedAttachmentIsVideo
                                  ? Icons.videocam_rounded
                                  : Icons.insert_drive_file_outlined,
                              color: context.textMuted,
                            ),
                          ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            name ?? '',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: context.textPrimary,
                            ),
                          ),
                        ),
                        IconButton(
                          icon: Icon(Icons.close, size: 18, color: context.textMuted),
                          onPressed: ctrl.cancelPickedAttachment,
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: ctrl.attachmentCaptionCtrl,
                            style: TextStyle(color: context.textPrimary, fontSize: 13),
                            decoration: InputDecoration(
                              hintText: 'Add a caption…',
                              hintStyle: TextStyle(color: context.textMuted, fontSize: 13),
                              isDense: true,
                              filled: true,
                              fillColor: context.cardColor,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(20),
                                borderSide: BorderSide.none,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Obx(
                          () => Material(
                            color: const Color(0xFF1E3A8A),
                            borderRadius: BorderRadius.circular(20),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(20),
                              onTap: ctrl.isUploadingAttachment.value
                                  ? null
                                  : ctrl.sendPickedAttachment,
                              child: Padding(
                                padding: const EdgeInsets.all(10),
                                child: ctrl.isUploadingAttachment.value
                                    ? const SizedBox(
                                        width: 18,
                                        height: 18,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: Colors.white,
                                        ),
                                      )
                                    : const Icon(Icons.send_rounded, color: Colors.white, size: 18),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            }),
            Row(
              children: [
                Obx(
                  () => IconButton(
                    icon: const Icon(Icons.attach_file_rounded),
                    color: context.textMuted,
                    onPressed: ctrl.pickedAttachmentPath.value != null
                        ? null
                        : ctrl.pickAttachment,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.emoji_emotions_outlined),
                  color: context.textMuted,
                  onPressed: () => _showEmojiSheet(context, ctrl),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                ),
                IconButton(
                  icon: const Icon(Icons.emoji_emotions_rounded),
                  color: context.textMuted,
                  onPressed: () => _showStickerSheet(context, ctrl),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                ),
                // Text field while idle, recording indicator while recording — this
                // is a sibling of the mic button below, never its ancestor, so
                // swapping it never interrupts an in-progress press-and-hold.
                Expanded(
                  child: Obx(() {
                    if (ctrl.isRecording.value) {
                      final cancelPreview = ctrl.recordingCancelPreview.value;
                      return Container(
                        height: 40,
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        decoration: BoxDecoration(
                          color: context.inputFill,
                          borderRadius: BorderRadius.circular(24),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.fiber_manual_record,
                              size: 12,
                              color: cancelPreview
                                  ? context.textMuted
                                  : Colors.redAccent,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              _fmtElapsed(ctrl.recordingDuration.value),
                              style: TextStyle(
                                fontSize: 13,
                                color: context.textPrimary,
                              ),
                            ),
                            const Spacer(),
                            Text(
                              cancelPreview
                                  ? 'Release to cancel'
                                  : '◀ Slide to cancel',
                              style: TextStyle(
                                fontSize: 12,
                                color: cancelPreview
                                    ? Colors.redAccent
                                    : context.textMuted,
                                fontWeight: cancelPreview
                                    ? FontWeight.w600
                                    : FontWeight.normal,
                              ),
                            ),
                          ],
                        ),
                      );
                    }
                    return TextField(
                      controller: ctrl.textCtrl,
                      maxLines: null,
                      textInputAction: TextInputAction.send,
                      onChanged: ctrl.onTextChanged,
                      onSubmitted: (_) => ctrl.sendMessage(),
                      style: TextStyle(color: context.textPrimary),
                      decoration: InputDecoration(
                        hintText: 'Message your group…',
                        hintStyle: TextStyle(
                          color: context.textMuted,
                          fontSize: 14,
                        ),
                        filled: true,
                        fillColor: context.inputFill,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 10,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: BorderSide.none,
                        ),
                      ),
                    );
                  }),
                ),
                const SizedBox(width: 8),
                // Swaps between send (has text) and mic (empty) — but the mic
                // branch's GestureDetector keeps the same widget identity across
                // isRecording/cancelPreview rebuilds, so an active long-press
                // gesture is never interrupted mid-recording.
                ValueListenableBuilder<TextEditingValue>(
                  valueListenable: ctrl.textCtrl,
                  builder: (context, value, _) {
                    final hasText = value.text.trim().isNotEmpty;
                    return Obx(() {
                      if (hasText && !ctrl.isRecording.value) {
                        return Material(
                          color: const Color(0xFF1E3A8A),
                          borderRadius: BorderRadius.circular(24),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(24),
                            onTap: ctrl.sendMessage,
                            child: const Padding(
                              padding: EdgeInsets.all(12),
                              child: Icon(
                                Icons.send_rounded,
                                color: Colors.white,
                                size: 20,
                              ),
                            ),
                          ),
                        );
                      }
                      final cancelPreview = ctrl.recordingCancelPreview.value;
                      return GestureDetector(
                        onLongPressStart: (_) => ctrl.startRecording(),
                        onLongPressMoveUpdate: (d) =>
                            ctrl.updateRecordingDrag(d.offsetFromOrigin.dx),
                        onLongPressEnd: (_) => ctrl.stopRecordingAndSend(),
                        onLongPressCancel: ctrl.cancelRecording,
                        child: Material(
                          color: cancelPreview
                              ? Colors.redAccent
                              : const Color(0xFF1E3A8A),
                          borderRadius: BorderRadius.circular(24),
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Icon(
                              ctrl.isRecording.value
                                  ? Icons.mic
                                  : Icons.mic_none_rounded,
                              color: Colors.white,
                              size: 20,
                            ),
                          ),
                        ),
                      );
                    });
                  },
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
