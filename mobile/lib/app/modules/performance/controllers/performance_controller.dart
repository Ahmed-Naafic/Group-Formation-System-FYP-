import 'package:get/get.dart';
import '../../../data/providers/api_client.dart';

class PerformanceRecord {
  final String cohortName;
  final double? averageScore;
  final String? performanceCategory;

  const PerformanceRecord({
    required this.cohortName,
    this.averageScore,
    this.performanceCategory,
  });

  factory PerformanceRecord.fromJson(Map<String, dynamic> json) {
    final cohort = json['cohortId'];
    return PerformanceRecord(
      cohortName: (cohort is Map ? cohort['name'] : null) as String? ?? 'Unknown Cohort',
      averageScore: (json['averageScore'] as num?)?.toDouble(),
      performanceCategory: json['performanceCategory'] as String?,
    );
  }
}

class PerformanceController extends GetxController {
  final _api = ApiClient();

  final records   = <PerformanceRecord>[].obs;
  final isLoading = false.obs;
  final error     = ''.obs;

  @override
  void onInit() {
    super.onInit();
    load();
  }

  Future<void> load() async {
    isLoading.value = true;
    error.value     = '';
    try {
      final res  = await _api.dio.get('/students/me');
      final raw  = res.data['data']['records'] as List<dynamic>;
      records.assignAll(
        raw.map((e) => PerformanceRecord.fromJson(e as Map<String, dynamic>)),
      );
    } catch (e) {
      error.value = 'Could not load your scores. Please try again.';
    } finally {
      isLoading.value = false;
    }
  }
}
