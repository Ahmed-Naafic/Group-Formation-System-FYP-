import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import '../../../data/models/file_model.dart';
import '../../../data/models/task_model.dart';
import '../../../data/models/workspace_model.dart';
import '../../../data/repositories/file_repository.dart';
import '../../../data/repositories/task_repository.dart';

class TaskController extends GetxController {
  final _repo     = TaskRepository();
  final _fileRepo = FileRepository();

  static const _maxAttempts = 4;
  static const _delays = [800, 1500, 3000];
  bool _disposed = false;

  // ── List state ───────────────────────────────────────────────────────────────
  final isLoading    = true.obs;
  final errorMessage = ''.obs;
  final tasks        = <TaskModel>[].obs;
  late WorkspaceModel workspace;

  // ── Detail state (current task) ───────────────────────────────────────────────
  final currentTask             = Rxn<TaskModel>();
  final currentSubmission       = Rxn<SubmissionModel>();
  final isLoadingDetail         = false.obs;
  final detailError             = ''.obs;
  final isSubmitting            = false.obs;
  final submitError             = ''.obs;
  final submitSuccess           = false.obs;
  final isDownloadingAttachment = false.obs;
  final notesCtrl               = TextEditingController();

  // ── Workspace files for submission attachment ────────────────────────────────
  final workspaceFiles   = <FileModel>[].obs;
  final isLoadingFiles   = false.obs;
  final selectedFileIds  = <String>[].obs;

  @override
  void onInit() {
    super.onInit();
    workspace = Get.arguments as WorkspaceModel;
    fetchTasks();
    _loadWorkspaceFiles();
  }

  @override
  void onClose() {
    _disposed = true;
    notesCtrl.dispose();
    super.onClose();
  }

  Future<void> fetchTasks({int attempt = 0}) async {
    if (_disposed) return;
    isLoading.value    = true;
    errorMessage.value = '';
    try {
      tasks.value = await _repo.getTasksForOffering(workspace.courseOfferingId);
      if (!_disposed) isLoading.value = false;
    } catch (e) {
      if (_disposed) return;
      if (attempt < _maxAttempts - 1) {
        final delay = _delays[attempt.clamp(0, _delays.length - 1)];
        await Future.delayed(Duration(milliseconds: delay));
        if (!_disposed) await fetchTasks(attempt: attempt + 1);
      } else {
        final msg = e is DioException
            ? (e.response?.data?['error']?['message'] as String?) ?? 'Could not load tasks.'
            : 'Something went wrong. Please try again.';
        errorMessage.value = msg;
        if (!_disposed) isLoading.value = false;
      }
    }
  }

  Future<void> _loadWorkspaceFiles() async {
    isLoadingFiles.value = true;
    try {
      workspaceFiles.assignAll(await _fileRepo.getFiles(workspace.id));
    } catch (_) {
      // Non-critical — submission can still be text-only
    } finally {
      isLoadingFiles.value = false;
    }
  }

  void toggleFile(String fileId) {
    if (selectedFileIds.contains(fileId)) {
      selectedFileIds.remove(fileId);
    } else {
      selectedFileIds.add(fileId);
    }
  }

  // Called when entering TaskDetailView.
  Future<void> loadTask(TaskModel task) async {
    currentTask.value       = task;
    currentSubmission.value = null;
    detailError.value       = '';
    submitError.value       = '';
    submitSuccess.value     = false;
    selectedFileIds.clear();
    isLoadingDetail.value   = true;

    try {
      final sub = await _repo.getMySubmission(task.id);
      currentSubmission.value = sub;
      notesCtrl.text = sub?.notes ?? '';
      // Restore previously attached files from draft/submission
      if (sub != null) selectedFileIds.assignAll(sub.fileIds);
    } on DioException catch (e) {
      detailError.value =
          (e.response?.data?['error']?['message'] as String?) ??
          'Could not load submission.';
    } catch (_) {
      detailError.value = 'Something went wrong.';
    } finally {
      isLoadingDetail.value = false;
    }
  }

  Future<void> downloadAttachment() async {
    final task = currentTask.value;
    if (task == null || !task.hasAttachment || kIsWeb) return;

    isDownloadingAttachment.value = true;
    try {
      final dir      = await getApplicationDocumentsDirectory();
      final fileName = task.attachmentName ?? 'attachment';
      final savePath = '${dir.path}/$fileName';
      await _repo.downloadAttachment(task.id, savePath);
      final mime = task.attachmentMimeType ?? 'application/octet-stream';
      Get.rawSnackbar(
        title: 'Downloaded',
        message: 'Tap to open $fileName',
        snackPosition: SnackPosition.BOTTOM,
        duration: const Duration(seconds: 4),
        onTap: (_) => Share.shareXFiles([XFile(savePath, mimeType: mime)]),
      );
    } on DioException catch (e) {
      Get.snackbar(
        'Download failed',
        (e.response?.data?['error']?['message'] as String?) ??
            e.message ?? 'Unknown error',
        snackPosition: SnackPosition.BOTTOM,
      );
    } catch (e) {
      Get.snackbar('Download failed', e.toString(),
          snackPosition: SnackPosition.BOTTOM);
    } finally {
      isDownloadingAttachment.value = false;
    }
  }

  Future<void> submit() async {
    final task = currentTask.value;
    if (task == null) return;

    isSubmitting.value  = true;
    submitError.value   = '';
    submitSuccess.value = false;

    try {
      final sub = await _repo.submit(
          task.id, notesCtrl.text.trim(), List.from(selectedFileIds));
      currentSubmission.value = sub;
      submitSuccess.value     = true;
      fetchTasks();
    } on DioException catch (e) {
      submitError.value =
          (e.response?.data?['error']?['message'] as String?) ??
          'Submission failed. Please try again.';
    } catch (_) {
      submitError.value = 'Something went wrong. Please try again.';
    } finally {
      isSubmitting.value = false;
    }
  }

  Future<void> saveDraft() async {
    final task = currentTask.value;
    if (task == null) return;

    isSubmitting.value  = true;
    submitError.value   = '';
    submitSuccess.value = false;

    try {
      final sub = await _repo.saveDraft(
          task.id, notesCtrl.text.trim(), List.from(selectedFileIds));
      currentSubmission.value = sub;
    } on DioException catch (e) {
      submitError.value =
          (e.response?.data?['error']?['message'] as String?) ??
          'Could not save draft.';
    } catch (_) {
      submitError.value = 'Something went wrong.';
    } finally {
      isSubmitting.value = false;
    }
  }
}
