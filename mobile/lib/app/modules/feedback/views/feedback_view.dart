import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../core/theme/app_theme.dart';
import '../controllers/feedback_controller.dart';

class FeedbackView extends StatelessWidget {
  const FeedbackView({super.key});

  @override
  Widget build(BuildContext context) {
    final ctrl = Get.find<FeedbackController>();

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Feedback',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      body: Obx(() {
        if (ctrl.isLoading.value) {
          return const Center(
            child: CircularProgressIndicator(color: Color(0xFF1E3A8A)),
          );
        }

        return RefreshIndicator(
          color: const Color(0xFF1E3A8A),
          onRefresh: ctrl.load,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // ── Submit form ────────────────────────────────────────────────
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: context.cardColor,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: context.dividerColor),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Leave Feedback',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: context.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    // Star rating
                    Obx(() => Row(
                      children: List.generate(5, (i) {
                        final n = i + 1;
                        return GestureDetector(
                          onTap: () => ctrl.rating.value = n,
                          child: Padding(
                            padding: const EdgeInsets.only(right: 6),
                            child: Icon(
                              Icons.star_rounded,
                              size: 32,
                              color: n <= ctrl.rating.value
                                  ? const Color(0xFFFBBF24)
                                  : context.textPlaceholder,
                            ),
                          ),
                        );
                      }),
                    )),
                    const SizedBox(height: 12),
                    // Comment
                    TextField(
                      maxLines: 3,
                      maxLength: 2000,
                      style: TextStyle(fontSize: 14, color: context.textPrimary),
                      decoration: InputDecoration(
                        hintText: 'Optional comment…',
                        hintStyle: TextStyle(color: context.textPlaceholder, fontSize: 13),
                        filled: true,
                        fillColor: context.inputFill,
                        contentPadding: const EdgeInsets.all(12),
                        border: context.inputBorderNone(),
                        enabledBorder: context.inputBorderEnabled(),
                        focusedBorder: context.inputBorderFocused,
                        counterStyle: TextStyle(fontSize: 10, color: context.textPlaceholder),
                      ),
                      onChanged: (v) => ctrl.comment.value = v,
                    ),
                    const SizedBox(height: 12),
                    Obx(() => SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: ctrl.submitting.value || ctrl.rating.value == 0
                            ? null
                            : () async {
                                final ok = await ctrl.submit();
                                if (ok) {
                                  Get.snackbar('Done', 'Feedback submitted',
                                      duration: const Duration(seconds: 2),
                                      snackPosition: SnackPosition.TOP);
                                } else {
                                  Get.snackbar('Error', 'Failed to submit feedback',
                                      duration: const Duration(seconds: 2),
                                      snackPosition: SnackPosition.TOP);
                                }
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF1E3A8A),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        child: ctrl.submitting.value
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                    color: Colors.white, strokeWidth: 2),
                              )
                            : const Text('Submit'),
                      ),
                    )),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // ── Feedback list ──────────────────────────────────────────────
              if (ctrl.feedbackList.isEmpty)
                Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 32),
                    child: Text(
                      'No feedback yet.',
                      style: TextStyle(fontSize: 14, color: context.textMuted),
                    ),
                  ),
                )
              else
                ...ctrl.feedbackList.map((fb) => _FeedbackCard(fb: fb)),
            ],
          ),
        );
      }),
    );
  }
}

class _FeedbackCard extends StatelessWidget {
  final FeedbackItem fb;
  const _FeedbackCard({required this.fb});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: context.cardColor,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: context.dividerColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              ...List.generate(5, (i) => Icon(
                Icons.star_rounded,
                size: 15,
                color: (i + 1) <= fb.rating
                    ? const Color(0xFFFBBF24)
                    : const Color(0xFFE5E7EB),
              )),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  fb.fromName ?? 'Anonymous',
                  style: TextStyle(fontSize: 12, color: context.textMuted),
                ),
              ),
              Text(
                _formatDate(fb.createdAt),
                style: TextStyle(fontSize: 11, color: context.textPlaceholder),
              ),
            ],
          ),
          if (fb.comment != null && fb.comment!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              fb.comment!,
              style: TextStyle(fontSize: 13, color: context.textSecondary),
            ),
          ],
        ],
      ),
    );
  }

  String _formatDate(DateTime dt) {
    final months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return '${dt.day} ${months[dt.month - 1]}';
  }
}
