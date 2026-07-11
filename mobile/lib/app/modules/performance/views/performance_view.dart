import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../core/theme/app_theme.dart';
import '../controllers/performance_controller.dart';

class PerformanceView extends StatelessWidget {
  const PerformanceView({super.key});

  @override
  Widget build(BuildContext context) {
    final ctrl = Get.find<PerformanceController>();

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'My Grades',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      body: Obx(() {
        if (ctrl.isLoading.value) {
          return const Center(
            child: CircularProgressIndicator(color: Color(0xFF1E3A8A)),
          );
        }
        if (ctrl.error.value.isNotEmpty) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.error_outline_rounded,
                      size: 40, color: context.textPlaceholder),
                  const SizedBox(height: 12),
                  Text(ctrl.error.value,
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 14, color: context.textSecondary)),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: ctrl.load,
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          );
        }
        if (ctrl.records.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.school_outlined,
                    size: 56, color: context.textPlaceholder),
                const SizedBox(height: 16),
                Text(
                  'No grade records found.',
                  style: TextStyle(fontSize: 15, color: context.textMuted),
                ),
              ],
            ),
          );
        }

        return RefreshIndicator(
          color: const Color(0xFF1E3A8A),
          onRefresh: ctrl.load,
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: ctrl.records.length,
            itemBuilder: (_, i) => _RecordCard(record: ctrl.records[i]),
          ),
        );
      }),
    );
  }
}

class _RecordCard extends StatelessWidget {
  final PerformanceRecord record;
  const _RecordCard({required this.record});

  @override
  Widget build(BuildContext context) {
    final score = record.averageScore;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: context.cardColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: context.dividerColor),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(10),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  record.cohortName,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: context.textPrimary,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  score != null ? 'Avg Score: ${score.toStringAsFixed(1)}' : 'Score: —',
                  style: TextStyle(fontSize: 13, color: context.textSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
