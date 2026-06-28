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
}
