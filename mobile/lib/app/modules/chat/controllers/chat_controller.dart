import 'dart:async';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../../../core/config.dart';
import '../../../data/models/chat_message_model.dart';
import '../../../data/models/workspace_model.dart';
import '../../../data/providers/api_client.dart';
import '../../../data/repositories/chat_repository.dart';
import '../../auth/controllers/auth_controller.dart';
import '../../notifications/controllers/notification_controller.dart';

class ChatController extends GetxController {
  final _repo = ChatRepository();

  // Persists across controller recreation so re-opening chat is instant.
  static final _cache = <String, List<ChatMessage>>{};

  final messages          = <ChatMessage>[].obs;
  final isLoading         = true.obs;
  final isSyncing         = false.obs;
  final errorMessage      = ''.obs;
  final isConnecting      = true.obs;
  final isSocketConnected = false.obs;
  final typingUsers       = <String>[].obs;
  final textCtrl          = TextEditingController();
  final scrollCtrl        = ScrollController();

  WorkspaceModel? workspace;
  String _myStudentId = '';
  io.Socket? _socket;
  Timer? _typingTimer;
  bool _disposed = false;

  static const _maxAttempts = 4;
  static const _delays = [800, 1500, 3000];

  bool isMyMessage(ChatMessage msg) =>
      _myStudentId.isNotEmpty && msg.sender.studentId == _myStudentId;

  @override
  void onInit() {
    super.onInit();
    final args = Get.arguments;
    if (args is! WorkspaceModel) {
      errorMessage.value = 'No workspace selected. Please open a group first.';
      isLoading.value    = false;
      isConnecting.value = false;
      return;
    }
    workspace    = args;
    _myStudentId = Get.find<AuthController>().userStudentId.value;

    // Clear the unread badge for this workspace now that the user is here
    try { Get.find<NotificationController>().clearUnread(workspace!.id); } catch (_) {}

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
  }

  // ── Full load ────────────────────────────────────────────────────────────────

  Future<void> _loadHistory({int attempt = 0}) async {
    final ws = workspace;
    if (ws == null || _disposed) return;
    isLoading.value    = true;
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
    isSyncing.value = true;
    try {
      final lastId = messages.last.id;
      final newer  = await _repo.getHistory(ws.id, after: lastId);
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
    isConnecting.value      = true;
    errorMessage.value      = '';
    await _connectSocket();
  }

  // ── Socket ───────────────────────────────────────────────────────────────────

  Future<void> _connectSocket() async {
    final ws    = workspace;
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
      isConnecting.value      = false;
      errorMessage.value      = '';
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
      isConnecting.value      = true; // still retrying
    });

    _socket!.onDisconnect((_) {
      isSocketConnected.value = false;
      isConnecting.value      = true; // reconnecting…
    });

    _socket!.onReconnect((_) {
      _socket!.emit('join-workspace', {'workspaceId': ws.id});
      isSocketConnected.value = true;
      isConnecting.value      = false;
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
      final err = data is Map ? (data['message'] ?? 'Socket error') : 'Socket error';
      errorMessage.value = err.toString();
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
    if (text.trim().isEmpty) { _stopTyping(); return; }
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

  void sendMessage() {
    final ws   = workspace;
    final text = textCtrl.text.trim();
    if (text.isEmpty || ws == null) return;
    if (!isSocketConnected.value) return;
    _stopTyping();
    textCtrl.clear();
    _socket!.emit('send-message', {
      'workspaceId': ws.id,
      'content':     text,
    });
  }

  @override
  void onClose() {
    _disposed = true;
    _typingTimer?.cancel();
    final wsId = workspace?.id;
    if (_socket != null) {
      if (wsId != null) {
        _socket!.emit('stop-typing',     {'workspaceId': wsId});
        _socket!.emit('leave-workspace', {'workspaceId': wsId});
      }
      _socket!.dispose();
    }
    textCtrl.dispose();
    scrollCtrl.dispose();
    super.onClose();
  }
}
