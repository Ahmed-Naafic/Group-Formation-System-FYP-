import 'dart:io';
import 'package:dio/dio.dart';
import '../models/task_model.dart';
import '../providers/api_client.dart';

class TaskRepository {
  final _api = ApiClient();

  Future<List<TaskModel>> getTasksForOffering(String courseOfferingId) async {
    final response = await _api.dio
        .get('/tasks', queryParameters: {'courseOfferingId': courseOfferingId});
    final raw = response.data['data']['tasks'] as List<dynamic>;
    return raw
        .map((t) => TaskModel.fromJson(t as Map<String, dynamic>))
        .toList();
  }

  Future<SubmissionModel?> getMySubmission(String taskId) async {
    final response = await _api.dio.get('/tasks/$taskId/my-submission');
    final sub = response.data['data']['submission'];
    if (sub == null) return null;
    return SubmissionModel.fromJson(sub as Map<String, dynamic>);
  }

  Future<SubmissionModel> submit(
      String taskId, String notes, List<String> fileIds) async {
    final response = await _api.dio.post(
      '/tasks/$taskId/submit',
      data: {'notes': notes, 'fileIds': fileIds},
    );
    return SubmissionModel.fromJson(
      response.data['data']['submission'] as Map<String, dynamic>,
    );
  }

  Future<SubmissionModel> saveDraft(
      String taskId, String notes, List<String> fileIds) async {
    final response = await _api.dio.post(
      '/tasks/$taskId/draft',
      data: {'notes': notes, 'fileIds': fileIds},
    );
    return SubmissionModel.fromJson(
      response.data['data']['submission'] as Map<String, dynamic>,
    );
  }

  Future<void> downloadAttachment(String taskId, String savePath) async {
    final response = await _api.dio.get(
      '/tasks/$taskId/attachment',
      options: Options(
        responseType: ResponseType.bytes,
        receiveTimeout: const Duration(minutes: 2),
      ),
    );
    await File(savePath).writeAsBytes(response.data as List<int>);
  }
}
