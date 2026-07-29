import '../models/workspace_model.dart';
import '../providers/api_client.dart';

class WorkspaceRepository {
  final _api = ApiClient();

  Future<List<WorkspaceModel>> getMyWorkspaces() async {
    final response = await _api.dio.get('/workspaces');
    final raw = response.data['data']['workspaces'] as List<dynamic>;
    return raw
        .map((w) => WorkspaceModel.fromJson(w as Map<String, dynamic>))
        .toList();
  }

  /// Used to resolve a NEW_MESSAGE notification's workspaceId into a full
  /// WorkspaceModel when it isn't already cached in DashboardController.
  Future<WorkspaceModel> getById(String workspaceId) async {
    final response = await _api.dio.get('/workspaces/$workspaceId');
    return WorkspaceModel.fromJson(response.data['data']['workspace'] as Map<String, dynamic>);
  }

  /// Used to resolve a GROUP_FORMED notification's entityId (a group id)
  /// into the workspace that was just created for it.
  Future<WorkspaceModel> getByGroupId(String groupId) async {
    final response = await _api.dio.get('/workspaces/by-group/$groupId');
    return WorkspaceModel.fromJson(response.data['data']['workspace'] as Map<String, dynamic>);
  }
}
