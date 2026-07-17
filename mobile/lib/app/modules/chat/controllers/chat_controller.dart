import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:just_audio/just_audio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../../../core/config.dart';
import '../../../data/models/chat_message_model.dart';
import '../../../data/models/workspace_model.dart';
import '../../../data/providers/api_client.dart';
import '../../../data/repositories/chat_repository.dart';
import '../../auth/controllers/auth_controller.dart';
import '../../notifications/controllers/notification_controller.dart';

/// Voice notes are capped at 3 minutes — plenty for a chat aside, keeps
/// uploads small, and stops recordings from becoming unwieldy to skim.
const kMaxVoiceMessageSeconds = 180;

/// Below this, a press-and-hold is almost certainly an accidental tap rather
/// than an intentional recording — discard instead of uploading a blip.
const _kMinRecordingMs = 400;

class ChatController extends GetxController {
  final _repo = ChatRepository();
  final _audioRecorder = AudioRecorder();
  final _audioPlayer = AudioPlayer();

  // Persists across controller recreation so re-opening chat is instant.
  static final _cache = <String, List<ChatMessage>>{};

  final messages = <ChatMessage>[].obs;
  final isLoading = true.obs;
  final isSyncing = false.obs;
  final errorMessage = ''.obs;
  final isConnecting = true.obs;
  final isSocketConnected = false.obs;
  final typingUsers = <String>[].obs;
  final textCtrl = TextEditingController();
  final scrollCtrl = ScrollController();

  // ── Recording ──────────────────────────────────────────────────────────────
  final isRecording = false.obs;
  final recordingDuration = Duration.zero.obs;
  final recordingCancelPreview =
      false.obs; // true once dragged past the cancel threshold

  // ── Playback (one shared player — starting a bubble pauses any other) ──────
  final currentlyPlayingMessageId = RxnString();
  final playbackPosition = Duration.zero.obs;
  final playbackDurationTotal = Duration.zero.obs;
  final isPlaybackLoading = false.obs;
  final isPlaybackPlaying = false.obs;

  // ── Reply-to (null = not currently composing a reply) ──────────────────────
  final replyTarget = Rxn<ChatMessage>();

  WorkspaceModel? workspace;
  String _myStudentId = '';
  String _myFullName = '';
  String _myUserId = '';
  io.Socket? _socket;
  Timer? _typingTimer;
  Timer? _recordingTimer;
  DateTime? _recordingStartedAt;
  bool _recordingCancelled = false;
  bool _disposed = false;

  static const _maxAttempts = 4;
  static const _delays = [800, 1500, 3000];

  bool isMyMessage(ChatMessage msg) =>
      _myStudentId.isNotEmpty && msg.sender.studentId == _myStudentId;

  String get myUserId => _myUserId;

  // Called by DashboardController on app open to warm the cache before the
  // user taps into a workspace, so the chat screen opens without a spinner.
  static Future<void> prefetch(String workspaceId) async {
    if (_cache.containsKey(workspaceId)) return;
    try {
      final msgs = await ChatRepository().getHistory(workspaceId);
      _cache[workspaceId] = msgs;
    } catch (_) {}
  }

  @override
  void onInit() {
    super.onInit();
    final args = Get.arguments;
    if (args is! WorkspaceModel) {
      errorMessage.value = 'No workspace selected. Please open a group first.';
      isLoading.value = false;
      isConnecting.value = false;
      return;
    }
    workspace = args;
    _myStudentId = Get.find<AuthController>().userStudentId.value;
    _myFullName = Get.find<AuthController>().userName.value;
    _myUserId = Get.find<AuthController>().userId.value;

    // Clear the unread badge for this workspace now that the user is here
    try {
      Get.find<NotificationController>().clearUnread(workspace!.id);
    } catch (_) {}

    final cached = _cache[workspace!.id];
    if (cached != null && cached.isNotEmpty) {
      // Instant display — no spinner
      messages.assignAll(cached);
      isLoading.value = false;
      _scrollToBottom(force: true);
      _syncNew(); // background: fetch anything missed while the screen was closed
    } else {
      _loadHistory();
    }
    _connectSocket();
    _listenToPlayback();
  }

  void _listenToPlayback() {
    _audioPlayer.positionStream.listen((p) => playbackPosition.value = p);
    _audioPlayer.durationStream.listen((d) {
      if (d != null) playbackDurationTotal.value = d;
    });
    _audioPlayer.playerStateStream.listen((state) {
      isPlaybackPlaying.value = state.playing;
      if (state.processingState == ProcessingState.completed) {
        _audioPlayer.pause();
        _audioPlayer.seek(Duration.zero);
        currentlyPlayingMessageId.value = null;
        isPlaybackPlaying.value = false;
      }
    });
  }

  // ── Full load ────────────────────────────────────────────────────────────────

  Future<void> _loadHistory({int attempt = 0}) async {
    final ws = workspace;
    if (ws == null || _disposed) return;
    isLoading.value = true;
    errorMessage.value = '';
    try {
      final msgs = await _repo.getHistory(ws.id);
      if (!_disposed) {
        messages.assignAll(msgs);
        _cache[ws.id] = List<ChatMessage>.from(msgs);
        isLoading.value = false;
        _scrollToBottom(force: true);
      }
    } catch (_) {
      if (_disposed) return;
      if (attempt < _maxAttempts - 1) {
        final delay = _delays[attempt.clamp(0, _delays.length - 1)];
        await Future.delayed(Duration(milliseconds: delay));
        if (!_disposed) await _loadHistory(attempt: attempt + 1);
      } else {
        errorMessage.value = 'Could not load messages. Pull down to retry.';
        if (!_disposed) isLoading.value = false;
      }
    }
  }

  // ── Background sync of messages sent while this screen was closed ────────────

  Future<void> _syncNew() async {
    final ws = workspace;
    if (ws == null || _disposed || messages.isEmpty) return;
    // Use the last confirmed (non-pending) message as the sync anchor
    final confirmed = messages.where((m) => !m.isPending).toList();
    if (confirmed.isEmpty) return;
    isSyncing.value = true;
    try {
      final lastId = confirmed.last.id;
      final newer = await _repo.getHistory(ws.id, after: lastId);
      if (_disposed) return;
      if (newer.isNotEmpty) {
        for (final msg in newer) {
          if (!messages.any((m) => m.id == msg.id)) {
            messages.add(msg);
          }
        }
        _cache[ws.id] = List<ChatMessage>.from(messages);
        _scrollToBottom();
      }
    } catch (_) {
      // Stale cache is still useful — silently ignore
    } finally {
      if (!_disposed) isSyncing.value = false;
    }
  }

  // ── Pull-to-refresh ──────────────────────────────────────────────────────────

  Future<void> pullRefresh() async {
    final ws = workspace;
    if (ws == null) return;
    try {
      final msgs = await _repo.getHistory(ws.id);
      if (!_disposed) {
        messages.assignAll(msgs);
        _cache[ws.id] = List<ChatMessage>.from(msgs);
      }
    } catch (_) {}
  }

  // ── Error retry (clears cache, shows full spinner) ───────────────────────────

  Future<void> retry() async {
    _disposed = false;
    errorMessage.value = '';
    _cache.remove(workspace?.id);
    messages.clear();
    await _loadHistory();
  }

  // ── Socket reconnect ─────────────────────────────────────────────────────────

  Future<void> reconnect() async {
    _socket?.dispose();
    _socket = null;
    isSocketConnected.value = false;
    isConnecting.value = true;
    errorMessage.value = '';
    await _connectSocket();
  }

  // ── Socket ───────────────────────────────────────────────────────────────────

  Future<void> _connectSocket() async {
    final ws = workspace;
    final token = await ApiClient().getToken();
    if (ws == null || token == null) {
      isConnecting.value = false;
      return;
    }

    _socket = io.io(
      kServerUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .enableAutoConnect()
          .enableForceNew()
          .enableReconnection()
          .setReconnectionAttempts(10)
          .setReconnectionDelay(3000)
          .build(),
    );

    void joinWorkspace() {
      _socket!.emit('join-workspace', {'workspaceId': ws.id});
      isSocketConnected.value = true;
      isConnecting.value = false;
      errorMessage.value = '';
    }

    if (_socket!.connected) {
      joinWorkspace();
    } else {
      _socket!.onConnect((_) => joinWorkspace());
    }

    // Keep showing "connecting…" while auto-reconnect retries are running.
    // Only flip to disconnected after all attempts are exhausted.
    _socket!.onConnectError((_) {
      isSocketConnected.value = false;
      isConnecting.value = true; // still retrying
    });

    _socket!.onDisconnect((_) {
      isSocketConnected.value = false;
      isConnecting.value = true; // reconnecting…
    });

    _socket!.onReconnect((_) {
      _socket!.emit('join-workspace', {'workspaceId': ws.id});
      isSocketConnected.value = true;
      isConnecting.value = false;
      _syncNew(); // catch up on messages sent while disconnected
    });

    _socket!.onReconnectFailed((_) {
      // All 10 attempts exhausted — show the disconnected banner with reconnect button
      isConnecting.value = false;
    });

    _socket!.on('new-message', (data) {
      try {
        final Map<String, dynamic> raw;
        if (data is Map<String, dynamic>) {
          raw = data;
        } else if (data is Map) {
          raw = Map<String, dynamic>.from(data);
        } else {
          return;
        }
        final msgJson = raw['message'];
        if (msgJson is! Map) return;
        final msg = ChatMessage.fromJson(
          msgJson is Map<String, dynamic>
              ? msgJson
              : Map<String, dynamic>.from(msgJson),
        );
        // My own message returning from server: upgrade pending → confirmed (2 ticks).
        // Content-match only applies to text messages (msg.content.isNotEmpty) — a
        // voice message's content is always '', so this must never match one of its
        // pending bubbles. Voice messages reconcile via an explicit tempId in
        // stopRecordingAndSend() instead, and fall through to the id-based add below
        // regardless of whether the HTTP response or this socket echo arrives first.
        if (_myStudentId.isNotEmpty &&
            msg.sender.studentId == _myStudentId &&
            msg.content.isNotEmpty) {
          final pendingIdx = messages.indexWhere(
            (m) => m.isPending && m.content == msg.content,
          );
          if (pendingIdx != -1) {
            messages[pendingIdx] = msg;
            _cache[workspace!.id] = List<ChatMessage>.from(messages);
            return;
          }
        }
        if (msg.id.isNotEmpty && !messages.any((m) => m.id == msg.id)) {
          messages.add(msg);
          _cache[workspace!.id] = List<ChatMessage>.from(messages);
          _scrollToBottom();
        }
      } catch (_) {}
    });

    _socket!.on('typing', (data) {
      try {
        final map = data is Map<String, dynamic>
            ? data
            : Map<String, dynamic>.from(data as Map);
        final name = map['fullName'] as String? ?? 'Someone';
        if (!typingUsers.contains(name)) typingUsers.add(name);
      } catch (_) {}
    });

    _socket!.on('stop-typing', (data) {
      try {
        final map = data is Map<String, dynamic>
            ? data
            : Map<String, dynamic>.from(data as Map);
        final name = map['fullName'] as String?;
        if (name != null) typingUsers.remove(name);
      } catch (_) {}
    });

    _socket!.on('error', (data) {
      final err = data is Map
          ? (data['message'] ?? 'Socket error')
          : 'Socket error';
      errorMessage.value = err.toString();
    });

    // Another client's own deleteMessage() call already removes it from
    // their local list directly — this only needs to reach everyone else.
    _socket!.on('message-deleted', (data) {
      try {
        final map = data is Map<String, dynamic>
            ? data
            : Map<String, dynamic>.from(data as Map);
        final messageId = map['messageId'] as String?;
        if (messageId == null) return;
        messages.removeWhere((m) => m.id == messageId);
        if (currentlyPlayingMessageId.value == messageId) {
          _audioPlayer.stop();
          currentlyPlayingMessageId.value = null;
        }
        _cache[workspace!.id] = List<ChatMessage>.from(messages);
      } catch (_) {}
    });

    // Another client's own reactToMessage() call already updates their local
    // list directly — this reaches everyone else (and also the reactor's own
    // other devices/sessions, which is fine — it's an idempotent replace).
    _socket!.on('message-reacted', (data) {
      try {
        final map = data is Map<String, dynamic>
            ? data
            : Map<String, dynamic>.from(data as Map);
        final msgJson = map['message'];
        if (msgJson is! Map) return;
        final updated = ChatMessage.fromJson(
          msgJson is Map<String, dynamic>
              ? msgJson
              : Map<String, dynamic>.from(msgJson),
        );
        final index = messages.indexWhere((m) => m.id == updated.id);
        if (index != -1) {
          messages[index] = updated.copyWith(
            localAudioPath: messages[index].localAudioPath,
          );
          _cache[workspace!.id] = List<ChatMessage>.from(messages);
        }
      } catch (_) {}
    });
  }

  // ── Scroll helpers ────────────────────────────────────────────────────────────

  bool _isNearBottom() {
    if (!scrollCtrl.hasClients) return true;
    final pos = scrollCtrl.position;
    return pos.maxScrollExtent - pos.pixels < 200;
  }

  void _scrollToBottom({bool force = false}) {
    if (!force && !_isNearBottom()) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (scrollCtrl.hasClients) {
        scrollCtrl.animateTo(
          scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
        );
      }
    });
  }

  // ── Typing ────────────────────────────────────────────────────────────────────

  void onTextChanged(String text) {
    final ws = workspace;
    if (ws == null || _socket == null || !isSocketConnected.value) return;
    if (text.trim().isEmpty) {
      _stopTyping();
      return;
    }
    _socket!.emit('typing', {'workspaceId': ws.id});
    _typingTimer?.cancel();
    _typingTimer = Timer(const Duration(seconds: 2), _stopTyping);
  }

  void _stopTyping() {
    final ws = workspace;
    if (ws == null || _socket == null) return;
    _typingTimer?.cancel();
    _typingTimer = null;
    _socket!.emit('stop-typing', {'workspaceId': ws.id});
  }

  void startReply(ChatMessage msg) => replyTarget.value = msg;
  void cancelReply() => replyTarget.value = null;

  void sendMessage() {
    final ws = workspace;
    final text = textCtrl.text.trim();
    if (text.isEmpty || ws == null) return;
    _stopTyping();
    textCtrl.clear();

    final replyingTo = replyTarget.value;
    replyTarget.value = null;

    // Optimistic message — shows immediately with 1 tick
    final pending = ChatMessage(
      id: 'pending_${DateTime.now().millisecondsSinceEpoch}',
      workspaceId: ws.id,
      sender: ChatSender(
        id: '',
        fullName: _myFullName,
        studentId: _myStudentId,
      ),
      content: text,
      createdAt: DateTime.now(),
      isPending: true,
      replyTo: replyingTo != null ? ReplyPreview.fromMessage(replyingTo) : null,
    );
    messages.add(pending);
    _cache[ws.id] = List<ChatMessage>.from(messages);
    _scrollToBottom(force: true);

    if (isSocketConnected.value) {
      _socket!.emit('send-message', {
        'workspaceId': ws.id,
        'content': text,
        if (replyingTo != null) 'replyToId': replyingTo.id,
      });
    }
  }

  // ── Voice recording ──────────────────────────────────────────────────────────

  Future<void> startRecording() async {
    if (isRecording.value) return;
    final hasPermission = await _audioRecorder.hasPermission();
    if (!hasPermission) {
      Get.snackbar(
        'Microphone permission needed',
        'Allow microphone access in your device settings to send voice messages.',
      );
      return;
    }

    final dir = await getTemporaryDirectory();
    final path =
        '${dir.path}/voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
    await _audioRecorder.start(
      const RecordConfig(encoder: AudioEncoder.aacLc),
      path: path,
    );

    _recordingStartedAt = DateTime.now();
    _recordingCancelled = false;
    isRecording.value = true;
    recordingCancelPreview.value = false;
    recordingDuration.value = Duration.zero;

    _recordingTimer = Timer.periodic(const Duration(milliseconds: 200), (_) {
      if (_recordingStartedAt == null) return;
      recordingDuration.value = DateTime.now().difference(_recordingStartedAt!);
      if (recordingDuration.value.inSeconds >= kMaxVoiceMessageSeconds) {
        stopRecordingAndSend();
      }
    });
  }

  /// Called as the user drags away from the mic button — past the cancel
  /// threshold, releasing discards the recording instead of sending it.
  void updateRecordingDrag(double dx) {
    if (!isRecording.value) return;
    recordingCancelPreview.value = dx < -80;
  }

  Future<void> cancelRecording() async {
    if (!isRecording.value) return;
    _recordingCancelled = true;
    await _stopAndDiscard();
  }

  Future<void> _stopAndDiscard() async {
    _recordingTimer?.cancel();
    isRecording.value = false;
    recordingDuration.value = Duration.zero;
    recordingCancelPreview.value = false;
    final path = await _audioRecorder.stop();
    if (path != null) {
      try {
        await File(path).delete();
      } catch (_) {}
    }
  }

  Future<void> stopRecordingAndSend() async {
    if (!isRecording.value) return;

    // Released past the slide-to-cancel threshold — discard, don't upload.
    if (recordingCancelPreview.value) {
      await _stopAndDiscard();
      return;
    }

    _recordingTimer?.cancel();
    isRecording.value = false;
    final elapsed = recordingDuration.value;
    recordingDuration.value = Duration.zero;
    final path = await _audioRecorder.stop();

    if (_recordingCancelled || path == null) {
      if (path != null) {
        try {
          await File(path).delete();
        } catch (_) {}
      }
      return;
    }

    // Accidental-tap guard — a near-instant press/release produces a junk blip.
    if (elapsed.inMilliseconds < _kMinRecordingMs) {
      try {
        await File(path).delete();
      } catch (_) {}
      return;
    }

    final ws = workspace;
    if (ws == null) return;

    final tempId = 'pending_voice_${DateTime.now().millisecondsSinceEpoch}';
    final durationSeconds = elapsed.inSeconds.clamp(1, kMaxVoiceMessageSeconds);
    final replyingTo = replyTarget.value;
    replyTarget.value = null;

    final pending = ChatMessage(
      id: tempId,
      workspaceId: ws.id,
      sender: ChatSender(
        id: '',
        fullName: _myFullName,
        studentId: _myStudentId,
      ),
      content: '',
      createdAt: DateTime.now(),
      isPending: true,
      audioDuration: durationSeconds,
      localAudioPath: path,
      replyTo: replyingTo != null ? ReplyPreview.fromMessage(replyingTo) : null,
    );
    messages.add(pending);
    _cache[ws.id] = List<ChatMessage>.from(messages);
    _scrollToBottom(force: true);

    try {
      final real = await _repo.uploadVoiceMessage(
        ws.id,
        path,
        durationSeconds,
        replyToId: replyingTo?.id,
      );
      // Race-safe: the HTTP response and the 'new-message' socket broadcast are
      // two independent deliveries with no ordering guarantee — the socket
      // echo may have already added this message by the time we get here.
      messages.removeWhere((m) => m.id == tempId);
      if (!messages.any((m) => m.id == real.id)) {
        messages.add(real.copyWith(localAudioPath: path));
        _scrollToBottom();
      }
      _cache[ws.id] = List<ChatMessage>.from(messages);
    } catch (_) {
      messages.removeWhere((m) => m.id == tempId);
      _cache[ws.id] = List<ChatMessage>.from(messages);
      Get.snackbar('Failed to send', 'Your voice message could not be sent.');
    }
  }

  // ── Voice playback ───────────────────────────────────────────────────────────

  Future<void> togglePlayback(ChatMessage msg) async {
    if (currentlyPlayingMessageId.value == msg.id) {
      // Same message already loaded — just toggle, no need to reload it.
      if (_audioPlayer.playing) {
        await _audioPlayer.pause();
      } else {
        _fireAndForgetPlay(msg.id);
      }
      return;
    }

    // Set this bubble as "current" up front, before the (possibly slow)
    // network fetch — the loading spinner is keyed off currentlyPlayingMessageId,
    // so setting it only after the fetch succeeded meant it never showed
    // during the fetch itself (the tap looked unresponsive for a few seconds).
    currentlyPlayingMessageId.value = msg.id;
    playbackPosition.value = Duration.zero;
    isPlaybackLoading.value = true;
    try {
      if (msg.localAudioPath != null) {
        await _audioPlayer.setFilePath(msg.localAudioPath!);
      } else {
        final url = await _repo.getVoiceMessageUrl(msg.workspaceId, msg.id);
        await _audioPlayer.setUrl(url);
      }
      isPlaybackLoading.value = false;
      _fireAndForgetPlay(msg.id);
    } catch (_) {
      isPlaybackLoading.value = false;
      if (currentlyPlayingMessageId.value == msg.id) {
        currentlyPlayingMessageId.value = null;
      }
      Get.snackbar('Playback failed', 'Could not play this voice message.');
    }
  }

  /// just_audio's play() future only completes when playback finishes, is
  /// paused, or is stopped — it does NOT complete when playback starts. It
  /// must never be awaited inside togglePlayback: doing so left a play()
  /// call dangling in the background for as long as that message kept
  /// playing, and switching to a different voice message (which reuses the
  /// same player and stops the old source) made that stale, unrelated call
  /// reject — surfacing as a spurious "Playback failed" for audio that had
  /// actually played back just fine.
  void _fireAndForgetPlay(String messageId) {
    unawaited(
      _audioPlayer.play().catchError((_) {
        // A rejection here just means playback was interrupted (e.g. the user
        // switched to another message) — expected, not a real failure, so it's
        // only worth reacting to if this message is still the "current" one.
        if (currentlyPlayingMessageId.value == messageId) {
          currentlyPlayingMessageId.value = null;
        }
      }),
    );
  }

  // ── Deletion ─────────────────────────────────────────────────────────────────

  Future<void> deleteMessage(ChatMessage msg) async {
    final ws = workspace;
    if (ws == null) return;

    if (currentlyPlayingMessageId.value == msg.id) {
      await _audioPlayer.stop();
      currentlyPlayingMessageId.value = null;
    }

    final removed = msg;
    final index = messages.indexWhere((m) => m.id == msg.id);
    messages.removeWhere((m) => m.id == msg.id);
    _cache[ws.id] = List<ChatMessage>.from(messages);

    try {
      await _repo.deleteMessage(ws.id, msg.id);
      // Other clients remove it themselves via the 'message-deleted' socket event.
    } catch (e) {
      // Restore on failure — the delete didn't actually happen server-side.
      if (index != -1 && index <= messages.length) {
        messages.insert(index, removed);
      } else {
        messages.add(removed);
      }
      _cache[ws.id] = List<ChatMessage>.from(messages);
      Get.snackbar('Delete failed', 'Could not delete this message.');
    }
  }

  // ── Reactions ────────────────────────────────────────────────────────────────

  /// Sets (or, tapping the same emoji again, clears) the caller's reaction.
  /// Anyone in the workspace may react, not just the sender.
  Future<void> reactToMessage(ChatMessage msg, String emoji) async {
    final ws = workspace;
    if (ws == null) return;
    try {
      final updated = await _repo.reactToMessage(ws.id, msg.id, emoji);
      final index = messages.indexWhere((m) => m.id == msg.id);
      if (index != -1) {
        messages[index] = updated.copyWith(localAudioPath: msg.localAudioPath);
        _cache[ws.id] = List<ChatMessage>.from(messages);
      }
    } catch (_) {
      Get.snackbar('Reaction failed', 'Could not react to this message.');
    }
  }

  @override
  void onClose() {
    _disposed = true;
    _typingTimer?.cancel();
    _recordingTimer?.cancel();
    _audioRecorder.dispose();
    _audioPlayer.dispose();
    final wsId = workspace?.id;
    if (_socket != null) {
      if (wsId != null) {
        _socket!.emit('stop-typing', {'workspaceId': wsId});
        _socket!.emit('leave-workspace', {'workspaceId': wsId});
      }
      _socket!.dispose();
    }
    textCtrl.dispose();
    scrollCtrl.dispose();
    super.onClose();
  }
}
