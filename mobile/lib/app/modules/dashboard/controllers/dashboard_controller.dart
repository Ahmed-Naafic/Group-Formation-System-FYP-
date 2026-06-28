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

  @override
  void onInit() {
    super.onInit();
    fetchWorkspaces();
    Get.find<NotificationController>().connect();
  }

  Future<void> fetchWorkspaces() async {
    isLoading.value    = true;
    errorMessage.value = '';
    try {
      workspaces.value = await _repo.getMyWorkspaces();
    } on DioException catch (e) {
      errorMessage.value =
          (e.response?.data?['error']?['message'] as String?) ??
          'Could not load workspaces.';
    } catch (_) {
      errorMessage.value = 'Something went wrong. Please try again.';
    } finally {
      isLoading.value = false;
    }
  }
}
