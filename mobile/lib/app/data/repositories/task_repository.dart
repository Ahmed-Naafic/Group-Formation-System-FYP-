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
    await _api.dio.download(
      '/tasks/$taskId/attachment',
      savePath,
      options: Options(receiveTimeout: const Duration(minutes: 5)),
    );
  }

  /// Fetches a single task by id — used to resolve a TASK_ASSIGNED
  /// notification's entityId into a full TaskModel for navigation.
  Future<TaskModel> getTaskById(String taskId) async {
    final response = await _api.dio.get('/tasks/$taskId');
    return TaskModel.fromJson(response.data['data']['task'] as Map<String, dynamic>);
  }

  /// Resolves a SUBMISSION_GRADED notification's entityId (a submission id)
  /// to its parent task id, so the navigator can then call getTaskById.
  Future<String?> getTaskIdForSubmission(String submissionId) async {
    final response = await _api.dio.get('/submissions/$submissionId');
    final submission = response.data['data']['submission'] as Map<String, dynamic>?;
    final rawTaskId = submission?['taskId'];
    return rawTaskId is Map ? rawTaskId['_id'] as String? : rawTaskId as String?;
  }
}
