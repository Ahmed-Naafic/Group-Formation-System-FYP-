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

class ChatController extends GetxController {
  final _repo = ChatRepository();

  final messages          = <ChatMessage>[].obs;
  final isLoading         = true.obs;
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
    _loadHistory();
    _connectSocket();
  }

  Future<void> _loadHistory({int attempt = 0}) async {
    final ws = workspace;
    if (ws == null || _disposed) return;
    isLoading.value    = true;
    errorMessage.value = '';
    try {
      final msgs = await _repo.getHistory(ws.id);
      if (!_disposed) {
        messages.assignAll(msgs);
        isLoading.value = false;
        _scrollToBottom();
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

  Future<void> retry() async {
    _disposed = false;
    await _loadHistory();
  }

  Future<void> reconnect() async {
    _socket?.dispose();
    _socket = null;
    isSocketConnected.value = false;
    isConnecting.value      = true;
    errorMessage.value      = '';
    await _connectSocket();
  }

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
          .setReconnectionAttempts(5)
          .setReconnectionDelay(2000)
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

    _socket!.onConnectError((_) {
      isSocketConnected.value = false;
      isConnecting.value      = false;
    });

    _socket!.onDisconnect((_) {
      isSocketConnected.value = false;
      isConnecting.value      = true; // reconnecting...
    });

    _socket!.onReconnect((_) {
      // Re-join the workspace room after reconnect
      _socket!.emit('join-workspace', {'workspaceId': ws.id});
      isSocketConnected.value = true;
      isConnecting.value      = false;
    });

    _socket!.onReconnectFailed((_) {
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
    if (!isSocketConnected.value) return; // silently wait — UI shows connecting state
    _stopTyping();
    textCtrl.clear();
    _socket!.emit('send-message', {
      'workspaceId': ws.id,
      'content':     text,
    });
  }

  void _scrollToBottom() {
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

  @override
  void onClose() {
    _disposed = true;
    _typingTimer?.cancel();
    final wsId = workspace?.id;
    if (_socket != null) {
      if (wsId != null) {
        _socket!.emit('stop-typing',    {'workspaceId': wsId});
        _socket!.emit('leave-workspace', {'workspaceId': wsId});
      }
      _socket!.dispose();
    }
    textCtrl.dispose();
    scrollCtrl.dispose();
    super.onClose();
  }
}
