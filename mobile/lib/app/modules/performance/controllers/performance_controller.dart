import 'package:get/get.dart';
import '../../../data/models/workspace_model.dart';
import '../../../data/repositories/workspace_repository.dart';

class PerformanceController extends GetxController {
  final _repo = WorkspaceRepository();

  final workspaces = <WorkspaceModel>[].obs;
  final isLoading   = false.obs;
  final error       = ''.obs;

  @override
  void onInit() {
    super.onInit();
    load();
  }

  Future<void> load() async {
    isLoading.value = true;
    error.value     = '';
    try {
      final result = await _repo.getMyWorkspaces();
      workspaces.assignAll(result);
    } catch (_) {
      error.value = 'Could not load your grades. Please try again.';
    } finally {
      isLoading.value = false;
    }
  }
}
