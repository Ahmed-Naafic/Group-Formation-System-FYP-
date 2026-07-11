import 'dart:async';
import 'package:dio/dio.dart';
import 'package:get/get.dart';
import '../../../data/models/workspace_model.dart';
import '../../../data/providers/api_client.dart';
import '../../../data/repositories/workspace_repository.dart';
import '../../notifications/controllers/notification_controller.dart';
import '../../chat/controllers/chat_controller.dart';
import '../../files/controllers/files_controller.dart';
import '../../tasks/controllers/task_controller.dart';

class DashboardController extends GetxController {
  final _repo = WorkspaceRepository();

  final isLoading    = true.obs;
  final errorMessage = ''.obs;
  final workspaces   = <WorkspaceModel>[].obs;

  static const _maxAttempts = 4;
  static const _delays = [800, 1500, 3000];
  bool _disposed = false;
  Timer? _keepAliveTimer;

  @override
  void onInit() {
    super.onInit();
    fetchWorkspaces();
    Get.find<NotificationController>().connect();
    // Ping every 14 min to prevent Render free tier from sleeping
    _keepAliveTimer = Timer.periodic(
      const Duration(minutes: 14),
      (_) => ApiClient().dio.get('/health').catchError((_) {}),
    );
  }

  Future<void> fetchWorkspaces({int attempt = 0}) async {
    if (_disposed) return;
    isLoading.value    = true;
    errorMessage.value = '';
    try {
      workspaces.value = await _repo.getMyWorkspaces();
      if (!_disposed) {
        isLoading.value = false;
        Get.find<NotificationController>()
            .joinWorkspaceRooms(workspaces.map((w) => w.id).toList());
        _prefetchAll(workspaces);
      }
    } catch (e) {
      if (_disposed) return;
      if (attempt < _maxAttempts - 1) {
        final delay = _delays[attempt.clamp(0, _delays.length - 1)];
        await Future.delayed(Duration(milliseconds: delay));
        if (!_disposed) await fetchWorkspaces(attempt: attempt + 1);
      } else {
        final msg = e is DioException
            ? (e.response?.data?['error']?['message'] as String?) ?? 'Could not load workspaces.'
            : 'Something went wrong. Please try again.';
        errorMessage.value = msg;
        if (!_disposed) isLoading.value = false;
      }
    }
  }

  void _prefetchAll(List<WorkspaceModel> workspaces) {
    for (final ws in workspaces) {
      ChatController.prefetch(ws.id);
      FilesController.prefetch(ws.id);
      TaskController.prefetch(ws.courseOfferingId, ws.id);
    }
  }

  @override
  void onClose() {
    _disposed = true;
    _keepAliveTimer?.cancel();
    super.onClose();
  }
}
