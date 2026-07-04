import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../models/file_model.dart';
import '../providers/api_client.dart';

class FileRepository {
  final _client = ApiClient();

  Future<List<FileModel>> getFiles(String workspaceId) async {
    final response = await _client.dio.get('/workspaces/$workspaceId/files');
    final raw = response.data['data']['files'] as List;
    return raw.map((j) => FileModel.fromJson(j as Map<String, dynamic>)).toList();
  }

  Future<FileModel> uploadFile(
    String workspaceId,
    String fileName,
    String mimeType, {
    String? filePath,
    Uint8List? bytes,
  }) async {
    final MultipartFile multipart;
    if (kIsWeb && bytes != null) {
      multipart = MultipartFile.fromBytes(
        bytes,
        filename: fileName,
        contentType: DioMediaType.parse(mimeType),
      );
    } else if (filePath != null) {
      multipart = await MultipartFile.fromFile(
        filePath,
        filename: fileName,
        contentType: DioMediaType.parse(mimeType),
      );
    } else {
      throw ArgumentError('Must provide filePath on mobile or bytes on web');
    }

    final form     = FormData.fromMap({'file': multipart});
    final response = await _client.dio.post(
      '/workspaces/$workspaceId/files',
      data: form,
    );
    return FileModel.fromJson(response.data['data']['file'] as Map<String, dynamic>);
  }

  Future<void> deleteFile(String workspaceId, String fileId) async {
    await _client.dio.delete('/workspaces/$workspaceId/files/$fileId');
  }

  Future<String> downloadFile(String workspaceId, String fileId, String savePath) async {
    final response = await _client.dio.get(
      '/workspaces/$workspaceId/files/$fileId/download',
      options: Options(
        responseType: ResponseType.bytes,
        receiveTimeout: const Duration(minutes: 2),
      ),
    );
    await File(savePath).writeAsBytes(response.data as List<int>);
    return savePath;
  }
}
