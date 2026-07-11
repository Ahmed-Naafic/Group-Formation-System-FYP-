import 'dart:async';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:get/get.dart';
import 'package:path_provider/path_provider.dart';
import 'package:open_filex/open_filex.dart';
import '../../../data/models/file_model.dart';
import '../../../data/repositories/file_repository.dart';
import '../../../data/models/workspace_model.dart';

class FilesController extends GetxController {
  final _repo = FileRepository();

  final files        = <FileModel>[].obs;
  final isLoading    = false.obs;
  final isUploading  = false.obs;
  final errorMessage = RxnString();

  WorkspaceModel? workspace;
  bool _disposed = false;

  static const _maxAttempts = 4;
  static const _delays = [800, 1500, 3000]; // ms between retries

  // Shared across instances so re-opening the screen is instant
  static final _cache = <String, List<FileModel>>{};

  @override
  void onInit() {
    super.onInit();
    final args = Get.arguments;
    if (args is! WorkspaceModel) {
      errorMessage.value = 'Invalid workspace.';
      return;
    }
    workspace = args;
    _fetchWithRetry();
  }

  Future<void> _fetchWithRetry({int attempt = 0}) async {
    final ws = workspace;
    if (ws == null || _disposed) return;

    if (attempt == 0) {
      final cached = _cache[ws.id];
      if (cached != null) {
        files.assignAll(cached);
        isLoading.value = false;
        _syncBackground(ws);
        return;
      }
    }

    isLoading.value    = true;
    errorMessage.value = null;
    try {
      final result = await _repo.getFiles(ws.id);
      _cache[ws.id] = List<FileModel>.from(result);
      files.assignAll(result);
    } catch (_) {
      if (_disposed) return;
      if (attempt < _maxAttempts - 1) {
        final delay = _delays[attempt.clamp(0, _delays.length - 1)];
        await Future.delayed(Duration(milliseconds: delay));
        if (!_disposed) await _fetchWithRetry(attempt: attempt + 1);
      } else {
        errorMessage.value = 'Could not load files. Please try again.';
        isLoading.value    = false;
      }
      return;
    }
    if (!_disposed) isLoading.value = false;
  }

  Future<void> _syncBackground(WorkspaceModel ws) async {
    if (_disposed) return;
    try {
      final result = await _repo.getFiles(ws.id);
      _cache[ws.id] = List<FileModel>.from(result);
      if (!_disposed) files.assignAll(result);
    } catch (_) {}
  }

  @override
  void onClose() {
    _disposed = true;
    super.onClose();
  }

  @override
  Future<void> refresh() async {
    _disposed = false;
    final ws = workspace;
    if (ws != null) _cache.remove(ws.id); // force a fresh fetch on explicit pull-to-refresh
    await _fetchWithRetry();
  }

  Future<void> pickAndUpload() async {
    final ws = workspace;
    if (ws == null) return;

    final result = await FilePicker.platform.pickFiles(
      allowMultiple: false,
      withData: kIsWeb,
      withReadStream: false,
    );
    if (result == null || result.files.isEmpty) return;

    final pf       = result.files.single;
    final fileName = pf.name;
    final mimeType = _guessMime(fileName);

    isUploading.value = true;
    try {
      final uploaded = await _repo.uploadFile(
        ws.id,
        fileName,
        mimeType,
        filePath: kIsWeb ? null : pf.path,
        bytes:    kIsWeb ? pf.bytes : null,
      );
      files.insert(0, uploaded);
      _cache[ws.id] = List<FileModel>.from(files);
    } catch (e) {
      Get.snackbar('Upload failed', e.toString(),
          snackPosition: SnackPosition.BOTTOM);
    } finally {
      isUploading.value = false;
    }
  }

  Future<void> downloadFile(FileModel f) async {
    final ws = workspace;
    if (ws == null || kIsWeb) return;
    try {
      final dir      = await getApplicationDocumentsDirectory();
      final savePath = '${dir.path}/${f.originalName}';
      await _repo.downloadFile(ws.id, f.id, savePath);
      Get.rawSnackbar(
        title: 'Downloaded',
        message: 'Tap to open ${f.originalName}',
        snackPosition: SnackPosition.BOTTOM,
        duration: const Duration(seconds: 4),
        onTap: (_) => _openFile(savePath, f.mimeType),
      );
    } catch (e) {
      Get.snackbar('Download failed', e.toString(),
          snackPosition: SnackPosition.BOTTOM);
    }
  }

  Future<void> _openFile(String path, String mime) async {
    final result = await OpenFilex.open(path, type: mime);
    if (result.type != ResultType.done) {
      Get.snackbar('Cannot open file', result.message,
          snackPosition: SnackPosition.BOTTOM);
    }
  }

  Future<void> deleteFile(FileModel f) async {
    final ws = workspace;
    if (ws == null) return;
    try {
      await _repo.deleteFile(ws.id, f.id);
      files.removeWhere((x) => x.id == f.id);
      _cache[ws.id] = List<FileModel>.from(files);
    } catch (e) {
      Get.snackbar('Delete failed', e.toString(),
          snackPosition: SnackPosition.BOTTOM);
    }
  }

  // Called by DashboardController on app open to warm the cache.
  static Future<void> prefetch(String workspaceId) async {
    if (_cache.containsKey(workspaceId)) return;
    try {
      final result = await FileRepository().getFiles(workspaceId);
      _cache[workspaceId] = result;
    } catch (_) {}
  }

  static String _guessMime(String name) {
    final ext = name.split('.').last.toLowerCase();
    const map = {
      'pdf':  'application/pdf',
      'doc':  'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls':  'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt':  'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'png':  'image/png',
      'jpg':  'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif':  'image/gif',
      'zip':  'application/zip',
      'txt':  'text/plain',
    };
    return map[ext] ?? 'application/octet-stream';
  }
}
