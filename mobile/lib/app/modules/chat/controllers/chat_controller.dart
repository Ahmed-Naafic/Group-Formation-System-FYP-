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
  final isSocketConnected = false.obs;
  final typingUsers       = <String>[].obs; // names of peers currently typing
  final textCtrl          = TextEditingController();
  final scrollCtrl        = ScrollController();

  // Nullable: Get.arguments is null on browser refresh / direct URL navigation.
  WorkspaceModel? workspace;
  String _myStudentId = '';
  io.Socket? _socket;
  Timer? _typingTimer;

  bool isMyMessage(ChatMessage msg) =>
      _myStudentId.isNotEmpty && msg.sender.studentId == _myStudentId;

  @override
  void onInit() {
    super.onInit();
    final args = Get.arguments;
    if (args is! WorkspaceModel) {
      // Reached /chat without a workspace argument (e.g. browser refresh).
      // Show an error state; the view will offer a back button.
      errorMessage.value = 'No workspace selected. Please open a group first.';
      isLoading.value = false;
      return;
    }
    workspace    = args;
    _myStudentId = Get.find<AuthController>().userStudentId.value;
    _loadHistory();
    _connectSocket();
  }

  Future<void> _loadHistory() async {
    final ws = workspace;
    if (ws == null) return;
    isLoading.value    = true;
    errorMessage.value = '';
    try {
      final msgs = await _repo.getHistory(ws.id);
      messages.assignAll(msgs);
      _scrollToBottom();
    } catch (_) {
      errorMessage.value = 'Could not load messages. Pull down to retry.';
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> retry() => _loadHistory();

  Future<void> _connectSocket() async {
    final ws    = workspace;
    final token = await ApiClient().getToken();
    if (ws == null || token == null) return;

    // forceNew: true creates a fresh Manager each time, preventing connection
    // reuse across different workspace chat sessions. Without this, the cached
    // Manager's socket is already "connected" on second open, so onConnect never
    // fires and join-workspace is never emitted — making send silently fail.
    _socket = io.io(
      kServerUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .enableAutoConnect()
          .enableForceNew()
          .build(),
    );

    void joinWorkspace() {
      _socket!.emit('join-workspace', {'workspaceId': ws.id});
      isSocketConnected.value = true;
    }

    if (_socket!.connected) {
      joinWorkspace();
    } else {
      _socket!.onConnect((_) => joinWorkspace());
    }

    _socket!.onConnectError((err) {
      isSocketConnected.value = false;
      errorMessage.value = 'Chat connection failed. Pull down to retry.';
    });

    _socket!.onDisconnect((_) {
      isSocketConnected.value = false;
    });

    _socket!.on('new-message', (data) {
      try {
        // On Flutter Web the event payload may arrive as Map<dynamic, dynamic>
        // rather than Map<String, dynamic> — cast explicitly to handle both.
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
        // Avoid duplicates (sender sees their own message broadcast back).
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
      // Surface server-side errors (e.g. workspace access denied) to the user.
      final err = data is Map ? (data['message'] ?? 'Socket error') : 'Socket error';
      errorMessage.value = err.toString();
    });
  }

  void onTextChanged(String text) {
    final ws = workspace;
    if (ws == null || _socket == null) return;
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

  void sendMessage() {
    final ws   = workspace;
    final text = textCtrl.text.trim();
    if (text.isEmpty || ws == null) return;
    if (_socket == null || !_socket!.connected) {
      errorMessage.value = 'Not connected to chat. Please wait or pull down to retry.';
      return;
    }
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
