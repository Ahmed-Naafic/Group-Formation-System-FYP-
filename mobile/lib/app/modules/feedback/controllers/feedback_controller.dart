import 'package:get/get.dart';
import '../../../data/providers/api_client.dart';

class FeedbackItem {
  final String id;
  final int rating;
  final String? comment;
  final String? fromName;
  final DateTime createdAt;

  const FeedbackItem({
    required this.id,
    required this.rating,
    this.comment,
    this.fromName,
    required this.createdAt,
  });

  factory FeedbackItem.fromJson(Map<String, dynamic> json) {
    final from = json['fromUserId'];
    return FeedbackItem(
      id:        json['_id'] as String,
      rating:    (json['rating'] as num).toInt(),
      comment:   json['comment'] as String?,
      fromName:  (from is Map ? from['fullName'] : null) as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

class FeedbackController extends GetxController {
  final _api = ApiClient();

  final String groupId;
  FeedbackController({required this.groupId});

  final feedbackList = <FeedbackItem>[].obs;
  final isLoading    = false.obs;
  final submitting   = false.obs;
  final error        = ''.obs;

  final rating  = 0.obs;
  final comment = ''.obs;

  @override
  void onInit() {
    super.onInit();
    load();
  }

  Future<void> load() async {
    isLoading.value = true;
    error.value     = '';
    try {
      final res = await _api.dio.get('/feedback', queryParameters: {'groupId': groupId});
      final raw = res.data['data']['feedback'] as List<dynamic>;
      feedbackList.assignAll(
        raw.map((e) => FeedbackItem.fromJson(e as Map<String, dynamic>)),
      );
    } catch (_) {
      error.value = 'Could not load feedback.';
    } finally {
      isLoading.value = false;
    }
  }

  Future<bool> submit() async {
    if (rating.value == 0) return false;
    submitting.value = true;
    try {
      await _api.dio.post('/feedback', data: {
        'groupId': groupId,
        'rating':  rating.value,
        if (comment.value.trim().isNotEmpty) 'comment': comment.value.trim(),
      });
      rating.value  = 0;
      comment.value = '';
      await load();
      return true;
    } catch (_) {
      return false;
    } finally {
      submitting.value = false;
    }
  }
}
