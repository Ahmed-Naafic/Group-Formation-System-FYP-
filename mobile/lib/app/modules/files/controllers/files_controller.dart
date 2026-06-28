import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:get/get.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import '../../../data/models/file_model.dart';
import '../../../data/repositories/file_repository.dart';
import '../../../data/models/workspace_model.dart';

class FilesController extends GetxController {
  final _repo = FileRepository();

  final files      = <FileModel>[].obs;
  final isLoading  = false.obs;
  final isUploading = false.obs;
  final errorMessage = RxnString();

  WorkspaceModel? workspace;

  @override
  void onInit() {
    super.onInit();
    final args = Get.arguments;
    if (args is! WorkspaceModel) {
      errorMessage.value = 'Invalid workspace.';
      return;
    }
    workspace = args;
    _fetchFiles();
  }

  Future<void> _fetchFiles() async {
    final ws = workspace;
    if (ws == null) return;
    isLoading.value = true;
    errorMessage.value = null;
    try {
      files.assignAll(await _repo.getFiles(ws.id));
    } catch (e) {
      errorMessage.value = e.toString();
    } finally {
      isLoading.value = false;
    }
  }

  @override
  Future<void> refresh() => _fetchFiles();

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
    try {
      await Share.shareXFiles(
        [XFile(path, mimeType: mime)],
      );
    } catch (e) {
      Get.snackbar('Cannot open file', e.toString(),
          snackPosition: SnackPosition.BOTTOM);
    }
  }

  Future<void> deleteFile(FileModel f) async {
    final ws = workspace;
    if (ws == null) return;
    try {
      await _repo.deleteFile(ws.id, f.id);
      files.removeWhere((x) => x.id == f.id);
    } catch (e) {
      Get.snackbar('Delete failed', e.toString(),
          snackPosition: SnackPosition.BOTTOM);
    }
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
