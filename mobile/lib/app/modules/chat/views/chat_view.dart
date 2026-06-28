import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import '../../../data/models/chat_message_model.dart';
import '../../../routes/app_pages.dart';
import '../controllers/chat_controller.dart';

class ChatView extends StatelessWidget {
  const ChatView({super.key});

  @override
  Widget build(BuildContext context) {
    final ctrl = Get.find<ChatController>();

    return Scaffold(
      backgroundColor: const Color(0xFFF0F2F5),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E3A8A),
        foregroundColor: Colors.white,
        elevation: 0,
        title: Obx(() => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  ctrl.workspace?.groupName ?? 'Group Chat',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  '${ctrl.messages.length} messages',
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFFB0C4F0),
                  ),
                ),
              ],
            )),
      ),
      body: Column(
        children: [
          // ── Message list ─────────────────────────────────────────────────────
          Expanded(
            child: Obx(() {
              if (ctrl.isLoading.value) {
                return const Center(
                  child: CircularProgressIndicator(
                    color: Color(0xFF1E3A8A),
                  ),
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
                        const Icon(
                          Icons.chat_bubble_outline_rounded,
                          size: 48,
                          color: Color(0xFFCDD5E0),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          ctrl.errorMessage.value,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: Color(0xFF596070),
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 20),
                        ElevatedButton(
                          onPressed: noWorkspace
                              ? () => Get.offAllNamed(Routes.dashboard)
                              : ctrl.retry,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF1E3A8A),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                          child: Text(noWorkspace ? 'Go to Dashboard' : 'Retry'),
                        ),
                      ],
                    ),
                  ),
                );
              }
              if (ctrl.messages.isEmpty) {
                return const Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.chat_bubble_outline_rounded,
                        size: 56,
                        color: Color(0xFFCDD5E0),
                      ),
                      SizedBox(height: 16),
                      Text(
                        'No messages yet.\nSay hello to your group!',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 15,
                          color: Color(0xFF8A92A4),
                        ),
                      ),
                    ],
                  ),
                );
              }
              return ListView.builder(
                controller: ctrl.scrollCtrl,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                itemCount: ctrl.messages.length,
                itemBuilder: (_, i) {
                  final msg  = ctrl.messages[i];
                  final prev = i > 0 ? ctrl.messages[i - 1] : null;
                  final showSenderName = !ctrl.isMyMessage(msg) &&
                      (prev == null || prev.sender.id != msg.sender.id);
                  final showDateDivider = prev == null ||
                      !_sameDay(prev.createdAt, msg.createdAt);

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (showDateDivider) _DateDivider(msg.createdAt),
                      _MessageBubble(
                        msg:            msg,
                        isMe:           ctrl.isMyMessage(msg),
                        showSenderName: showSenderName,
                      ),
                    ],
                  );
                },
              );
            }),
          ),

          // ── Typing indicator ─────────────────────────────────────────────────
          _TypingIndicator(ctrl: ctrl),

          // ── Input bar ────────────────────────────────────────────────────────
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
          const Expanded(child: Divider(color: Color(0xFFCDD5E0))),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                color: Color(0xFF8A92A4),
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          const Expanded(child: Divider(color: Color(0xFFCDD5E0))),
        ],
      ),
    );
  }

  static String _label(DateTime d) {
    final now   = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final day   = DateTime(d.year, d.month, d.day);
    if (day == today) return 'Today';
    if (day == today.subtract(const Duration(days: 1))) return 'Yesterday';
    return DateFormat('MMM d, y').format(d);
  }
}

// ── Message bubble ─────────────────────────────────────────────────────────────

class _MessageBubble extends StatelessWidget {
  final ChatMessage msg;
  final bool isMe;
  final bool showSenderName;

  const _MessageBubble({
    required this.msg,
    required this.isMe,
    required this.showSenderName,
  });

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: EdgeInsets.only(
          top: showSenderName ? 8 : 2,
          bottom: 2,
          left:  isMe ? 48 : 0,
          right: isMe ? 0 : 48,
        ),
        child: Column(
          crossAxisAlignment:
              isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            if (showSenderName)
              Padding(
                padding: const EdgeInsets.only(left: 4, bottom: 3),
                child: Text(
                  msg.sender.fullName,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1E3A8A),
                  ),
                ),
              ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: isMe ? const Color(0xFF1E3A8A) : Colors.white,
                borderRadius: BorderRadius.only(
                  topLeft:     const Radius.circular(18),
                  topRight:    const Radius.circular(18),
                  bottomLeft:  Radius.circular(isMe ? 18 : 4),
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
                  Text(
                    msg.content,
                    style: TextStyle(
                      fontSize: 14,
                      color: isMe ? Colors.white : const Color(0xFF0E1320),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    DateFormat('h:mm a').format(msg.createdAt.toLocal()),
                    style: TextStyle(
                      fontSize: 10,
                      color: isMe
                          ? Colors.white.withAlpha(160)
                          : const Color(0xFF8A92A4),
                    ),
                  ),
                ],
              ),
            ),
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
      color: const Color(0xFFF0F2F5),
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
              color: Colors.white,
              borderRadius: const BorderRadius.only(
                topLeft:     Radius.circular(18),
                topRight:    Radius.circular(18),
                bottomLeft:  Radius.circular(4),
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
            // Each dot is staggered by 0.18 of the cycle
            final t = (_ac.value - i * 0.18) % 1.0;
            // sin over [0, π] gives a smooth rise-and-fall bounce
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
                    const Color(0xFFCDD5E0),
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

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 16),
      decoration: const BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 8,
            offset: Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: ctrl.textCtrl,
                maxLines: null,
                textInputAction: TextInputAction.send,
                onChanged: ctrl.onTextChanged,
                onSubmitted: (_) => ctrl.sendMessage(),
                decoration: InputDecoration(
                  hintText: 'Message your group…',
                  hintStyle: const TextStyle(
                    color: Color(0xFF8A92A4),
                    fontSize: 14,
                  ),
                  filled: true,
                  fillColor: const Color(0xFFF5F6F9),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 10,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Material(
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
            ),
          ],
        ),
      ),
    );
  }
}
