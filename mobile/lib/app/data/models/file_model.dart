import 'package:flutter/material.dart';

class FileModel {
  final String id;
  final String originalName;
  final String mimeType;
  final int sizeBytes;
  final String uploadedByName;
  final String uploadedById;
  final DateTime uploadedAt;
  final String url;

  const FileModel({
    required this.id,
    required this.originalName,
    required this.mimeType,
    required this.sizeBytes,
    required this.uploadedByName,
    required this.uploadedById,
    required this.uploadedAt,
    required this.url,
  });

  factory FileModel.fromJson(Map<String, dynamic> json) {
    final uploader = json['uploadedBy'];
    final String uploaderName;
    final String uploaderId;
    if (uploader is Map<String, dynamic>) {
      uploaderName = uploader['fullName'] as String? ?? 'Unknown';
      uploaderId   = uploader['_id']      as String? ?? '';
    } else {
      uploaderName = 'Unknown';
      uploaderId   = uploader?.toString() ?? '';
    }
    return FileModel(
      id:             json['_id']          as String? ?? '',
      originalName:   json['originalName'] as String? ?? 'file',
      mimeType:       json['mimeType']     as String? ?? '',
      sizeBytes:      (json['sizeBytes']   as num?)?.toInt() ?? 0,
      uploadedByName: uploaderName,
      uploadedById:   uploaderId,
      uploadedAt:     DateTime.parse(json['uploadedAt'] as String),
      url:            json['url']          as String? ?? '',
    );
  }

  String get sizeLabel {
    if (sizeBytes < 1024) return '${sizeBytes}B';
    if (sizeBytes < 1024 * 1024) return '${(sizeBytes / 1024).toStringAsFixed(1)}KB';
    return '${(sizeBytes / (1024 * 1024)).toStringAsFixed(1)}MB';
  }

  IconData get icon {
    if (mimeType.startsWith('image/')) return Icons.image_outlined;
    if (mimeType == 'application/pdf') return Icons.picture_as_pdf_outlined;
    if (mimeType.contains('word'))     return Icons.description_outlined;
    if (mimeType.contains('excel') || mimeType.contains('spreadsheet')) {
      return Icons.table_chart_outlined;
    }
    if (mimeType.contains('powerpoint') || mimeType.contains('presentation')) {
      return Icons.slideshow_outlined;
    }
    if (mimeType == 'application/zip' || mimeType.contains('zip')) {
      return Icons.folder_zip_outlined;
    }
    return Icons.insert_drive_file_outlined;
  }

  Color get iconColor {
    if (mimeType.startsWith('image/')) return const Color(0xFF0D7850);
    if (mimeType == 'application/pdf') return const Color(0xFFB23A3A);
    if (mimeType.contains('word'))     return const Color(0xFF1E3A8A);
    if (mimeType.contains('excel') || mimeType.contains('spreadsheet')) {
      return const Color(0xFF0D7850);
    }
    return const Color(0xFF596070);
  }
}
