import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/file_model.dart';
import '../../auth/controllers/auth_controller.dart';
import '../controllers/files_controller.dart';

class FilesView extends StatelessWidget {
  const FilesView({super.key});

  @override
  Widget build(BuildContext context) {
    final ctrl = Get.find<FilesController>();
    final myId = Get.find<AuthController>().userId.value;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          ctrl.workspace?.groupName ?? 'Files',
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
        actions: [
          Obx(() {
            if (ctrl.isUploading.value) {
              return const Padding(
                padding: EdgeInsets.all(16),
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white),
                ),
              );
            }
            return IconButton(
              icon: const Icon(Icons.upload_file_outlined),
              tooltip: 'Upload file',
              onPressed: ctrl.pickAndUpload,
            );
          }),
        ],
      ),
      body: Obx(() {
        if (ctrl.isLoading.value) {
          return const Center(
            child: CircularProgressIndicator(color: Color(0xFF1E3A8A)),
          );
        }
        if (ctrl.errorMessage.value != null) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.wifi_off_rounded,
                      size: 48, color: Color(0xFF9CA3AF)),
                  const SizedBox(height: 12),
                  Text(
                    ctrl.errorMessage.value!,
                    textAlign: TextAlign.center,
                    style: TextStyle(color: context.textSecondary),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: ctrl.refresh,
                    icon: const Icon(Icons.refresh_rounded, size: 18),
                    label: const Text('Retry'),
                    style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF1E3A8A),
                        foregroundColor: Colors.white),
                  ),
                ],
              ),
            ),
          );
        }
        if (ctrl.files.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.folder_open_outlined,
                    size: 56, color: context.textPlaceholder),
                const SizedBox(height: 16),
                Text(
                  'No files uploaded yet.',
                  style: TextStyle(fontSize: 15, color: context.textMuted),
                ),
                const SizedBox(height: 12),
                ElevatedButton.icon(
                  onPressed: ctrl.pickAndUpload,
                  icon: const Icon(Icons.upload_file_outlined, size: 18),
                  label: const Text('Upload a file'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1E3A8A),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 20, vertical: 10),
                  ),
                ),
              ],
            ),
          );
        }
        return RefreshIndicator(
          color: const Color(0xFF1E3A8A),
          onRefresh: ctrl.refresh,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: ctrl.files.length,
            separatorBuilder: (_, _) => Divider(
              height: 1,
              indent: 70,
              endIndent: 16,
              color: context.dividerColor,
            ),
            itemBuilder: (_, i) => _FileTile(
              file:       ctrl.files[i],
              canDelete:  ctrl.files[i].uploadedById == myId,
              onDownload: () => ctrl.downloadFile(ctrl.files[i]),
              onDelete:   () => _confirmDelete(context, ctrl, ctrl.files[i]),
            ),
          ),
        );
      }),
    );
  }

  void _confirmDelete(
      BuildContext context, FilesController ctrl, FileModel f) {
    showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete file?'),
        content: Text('Remove "${f.originalName}" from this workspace?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              ctrl.deleteFile(f);
            },
            style:
                TextButton.styleFrom(foregroundColor: const Color(0xFFE53E3E)),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}

class _FileTile extends StatelessWidget {
  final FileModel file;
  final bool canDelete;
  final VoidCallback onDownload;
  final VoidCallback onDelete;
  const _FileTile({
    required this.file,
    required this.canDelete,
    required this.onDownload,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final dateLabel = DateFormat('MMM d, y').format(file.uploadedAt.toLocal());

    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      leading: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: file.iconColor.withAlpha(24),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(file.icon, color: file.iconColor, size: 22),
      ),
      title: Text(
        file.originalName,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: context.textPrimary),
      ),
      subtitle: Text(
        '${file.sizeLabel} · ${file.uploadedByName} · $dateLabel',
        style: TextStyle(fontSize: 12, color: context.textMuted),
      ),
      trailing: PopupMenuButton<String>(
        icon: Icon(Icons.more_vert, size: 20, color: context.textSecondary),
        onSelected: (v) {
          if (v == 'download') onDownload();
          if (v == 'delete')   onDelete();
        },
        itemBuilder: (_) => [
          if (!kIsWeb)
            const PopupMenuItem(
              value: 'download',
              child: Row(children: [
                Icon(Icons.download_outlined, size: 18),
                SizedBox(width: 10),
                Text('Download'),
              ]),
            ),
          if (canDelete)
            const PopupMenuItem(
              value: 'delete',
              child: Row(children: [
                Icon(Icons.delete_outline, size: 18, color: Color(0xFFE53E3E)),
                SizedBox(width: 10),
                Text('Delete', style: TextStyle(color: Color(0xFFE53E3E))),
              ]),
            ),
        ],
      ),
    );
  }
}
