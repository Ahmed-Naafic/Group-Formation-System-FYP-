import 'dart:async';
import 'package:dio/dio.dart';
import 'package:get/get.dart';
import '../../../data/models/workspace_model.dart';
import '../../../data/repositories/workspace_repository.dart';
import '../../notifications/controllers/notification_controller.dart';

class DashboardController extends GetxController {
  final _repo = WorkspaceRepository();

  final isLoading    = true.obs;
  final errorMessage = ''.obs;
  final workspaces   = <WorkspaceModel>[].obs;
  final retryCountdown = 0.obs;

  Timer? _retryTimer;
  Timer? _countdownTimer;

  @override
  void onInit() {
    super.onInit();
    fetchWorkspaces();
    Get.find<NotificationController>().connect();
  }

  Future<void> fetchWorkspaces() async {
    _cancelRetry();
    isLoading.value      = true;
    errorMessage.value   = '';
    retryCountdown.value = 0;
    try {
      workspaces.value = await _repo.getMyWorkspaces();
    } on DioException catch (e) {
      errorMessage.value =
          (e.response?.data?['error']?['message'] as String?) ??
          'Could not load workspaces.';
      _scheduleRetry();
    } catch (_) {
      errorMessage.value = 'Something went wrong. Please try again.';
      _scheduleRetry();
    } finally {
      isLoading.value = false;
    }
  }

  void _scheduleRetry() {
    const seconds = 5;
    retryCountdown.value = seconds;
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (retryCountdown.value > 1) {
        retryCountdown.value--;
      } else {
        t.cancel();
      }
    });
    _retryTimer = Timer(const Duration(seconds: seconds), fetchWorkspaces);
  }

  void _cancelRetry() {
    _retryTimer?.cancel();
    _countdownTimer?.cancel();
    _retryTimer = _countdownTimer = null;
    retryCountdown.value = 0;
  }

  @override
  void onClose() {
    _cancelRetry();
    super.onClose();
  }
}
