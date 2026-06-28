import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import '../../../data/models/file_model.dart';
import '../../../data/models/task_model.dart';
import '../controllers/task_controller.dart';

class TaskDetailView extends StatefulWidget {
  const TaskDetailView({super.key});

  @override
  State<TaskDetailView> createState() => _TaskDetailViewState();
}

class _TaskDetailViewState extends State<TaskDetailView> {
  late final TaskController controller;
  late final TaskModel task;

  @override
  void initState() {
    super.initState();
    controller = Get.find<TaskController>();
    task       = Get.arguments as TaskModel;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      controller.loadTask(task);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F6F9),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E3A8A),
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Task Detail',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
        ),
      ),
      body: Obx(() {
        if (controller.isLoadingDetail.value) {
          return const Center(
            child: CircularProgressIndicator(color: Color(0xFF1E3A8A)),
          );
        }

        return SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Task info card ───────────────────────────────────────────────
              _card(Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Status + title
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          task.title,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF0E1320),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      _taskStatusChip(task),
                    ],
                  ),

                  // Deadline
                  if (task.deadline != null) ...[
                    const SizedBox(height: 10),
                    _DeadlineRow(task: task),
                  ],

                  // Attachment
                  if (task.hasAttachment) ...[
                    const SizedBox(height: 10),
                    Obx(() {
                      final loading =
                          controller.isDownloadingAttachment.value;
                      return InkWell(
                        onTap: loading ? null : controller.downloadAttachment,
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF3FB),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFBFCFEE)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (loading)
                                const SizedBox(
                                  width: 14,
                                  height: 14,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Color(0xFF1E3A8A),
                                  ),
                                )
                              else
                                const Icon(Icons.download_rounded,
                                    size: 16, color: Color(0xFF1E3A8A)),
                              const SizedBox(width: 6),
                              Text(
                                loading
                                    ? 'Downloading…'
                                    : (task.attachmentName ??
                                        'Download attachment'),
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: Color(0xFF1E3A8A),
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                  ],

                  // Description
                  if (task.description.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    const Divider(height: 1, color: Color(0xFFECEEF2)),
                    const SizedBox(height: 14),
                    const Text(
                      'DESCRIPTION',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF8A92A4),
                        letterSpacing: 0.8,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      task.description,
                      style: const TextStyle(
                        fontSize: 14,
                        color: Color(0xFF1A1F2E),
                        height: 1.55,
                      ),
                    ),
                  ],
                ],
              )),

              const SizedBox(height: 12),

              // ── Submission section ───────────────────────────────────────────
              Obx(() {
                final sub = controller.currentSubmission.value;

                // Already graded
                if (sub != null && sub.isReviewed) {
                  return _GradedCard(sub: sub);
                }

                // Already submitted (not yet graded)
                if (sub != null && sub.isSubmitted) {
                  return _SubmittedCard(sub: sub);
                }

                // Task is closed and nothing submitted
                if (task.isClosed && sub == null) {
                  return _card(const Row(
                    children: [
                      Icon(Icons.lock_outline_rounded,
                          color: Color(0xFF8A92A4), size: 18),
                      SizedBox(width: 10),
                      Text(
                        'This task is closed — no submission recorded.',
                        style:
                            TextStyle(fontSize: 13, color: Color(0xFF596070)),
                      ),
                    ],
                  ));
                }

                // Draft or not started — show submission form
                return _SubmissionForm(controller: controller, sub: sub);
              }),
            ],
          ),
        );
      }),
    );
  }

  Widget _card(Widget child) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withAlpha(12),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: child,
      );

  Widget _taskStatusChip(TaskModel task) {
    String label;
    Color color, bg;
    if (task.isClosed) {
      label = 'Closed';
      color = const Color(0xFF8A92A4);
      bg    = const Color(0xFFF0F1F4);
    } else if (task.isOverdue) {
      label = 'Overdue';
      color = const Color(0xFFB23A3A);
      bg    = const Color(0xFFFEF2F2);
    } else if (task.isDueSoon) {
      label = 'Due Soon';
      color = const Color(0xFFB45309);
      bg    = const Color(0xFFFEF3C7);
    } else {
      label = 'Open';
      color = const Color(0xFF15803D);
      bg    = const Color(0xFFDCFCE7);
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration:
          BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}

// ── Deadline row ───────────────────────────────────────────────────────────────

class _DeadlineRow extends StatelessWidget {
  final TaskModel task;
  const _DeadlineRow({required this.task});

  @override
  Widget build(BuildContext context) {
    final fmt   = DateFormat('EEEE, MMM d, yyyy · HH:mm');
    final date  = fmt.format(task.deadline!.toLocal());
    final color = task.isOverdue
        ? const Color(0xFFB23A3A)
        : task.isDueSoon
            ? const Color(0xFFB45309)
            : const Color(0xFF596070);
    return Row(
      children: [
        Icon(Icons.schedule_rounded, size: 15, color: color),
        const SizedBox(width: 6),
        Text(
          'Due $date',
          style: TextStyle(fontSize: 13, color: color),
        ),
      ],
    );
  }
}

// ── Graded Card ────────────────────────────────────────────────────────────────

class _GradedCard extends StatelessWidget {
  final SubmissionModel sub;
  const _GradedCard({required this.sub});

  @override
  Widget build(BuildContext context) {
    final grade = sub.grade!.toStringAsFixed(0);
    final color = sub.grade! >= 90
        ? const Color(0xFF15803D)
        : sub.grade! >= 70
            ? const Color(0xFF1E3A8A)
            : sub.grade! >= 50
                ? const Color(0xFFB45309)
                : const Color(0xFFB23A3A);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withAlpha(60)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(12),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'GRADE',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: Color(0xFF8A92A4),
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Text(
                grade,
                style: TextStyle(
                  fontSize: 48,
                  fontWeight: FontWeight.bold,
                  color: color,
                  height: 1,
                ),
              ),
              Text(
                ' / 100',
                style: TextStyle(
                  fontSize: 18,
                  color: color.withAlpha(160),
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          if (sub.gradedAt != null) ...[
            const SizedBox(height: 8),
            Text(
              'Graded ${DateFormat('MMM d, yyyy').format(sub.gradedAt!.toLocal())}',
              style: const TextStyle(fontSize: 12, color: Color(0xFF8A92A4)),
            ),
          ],
          if (sub.notes != null && sub.notes!.isNotEmpty) ...[
            const SizedBox(height: 14),
            const Divider(height: 1, color: Color(0xFFECEEF2)),
            const SizedBox(height: 14),
            const Text(
              'YOUR SUBMISSION NOTES',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: Color(0xFF8A92A4),
                letterSpacing: 0.8,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              sub.notes!,
              style: const TextStyle(
                fontSize: 13,
                color: Color(0xFF1A1F2E),
                height: 1.5,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Submitted Card (not yet graded) ───────────────────────────────────────────

class _SubmittedCard extends StatelessWidget {
  final SubmissionModel sub;
  const _SubmittedCard({required this.sub});

  @override
  Widget build(BuildContext context) {
    final isLate = sub.isLate;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(12),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                isLate
                    ? Icons.warning_amber_rounded
                    : Icons.check_circle_rounded,
                color: isLate
                    ? const Color(0xFFB45309)
                    : const Color(0xFF15803D),
                size: 20,
              ),
              const SizedBox(width: 10),
              Text(
                isLate ? 'Submitted Late' : 'Submitted',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                  color: isLate
                      ? const Color(0xFFB45309)
                      : const Color(0xFF15803D),
                ),
              ),
            ],
          ),
          if (sub.submittedAt != null) ...[
            const SizedBox(height: 6),
            Text(
              'Submitted ${DateFormat('MMM d, yyyy · HH:mm').format(sub.submittedAt!.toLocal())}',
              style: const TextStyle(fontSize: 12, color: Color(0xFF8A92A4)),
            ),
          ],
          if (sub.notes != null && sub.notes!.isNotEmpty) ...[
            const SizedBox(height: 14),
            const Divider(height: 1, color: Color(0xFFECEEF2)),
            const SizedBox(height: 14),
            const Text(
              'YOUR NOTES',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: Color(0xFF8A92A4),
                letterSpacing: 0.8,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              sub.notes!,
              style: const TextStyle(
                fontSize: 13,
                color: Color(0xFF1A1F2E),
                height: 1.5,
              ),
            ),
          ],
          const SizedBox(height: 14),
          const Text(
            'Awaiting grade from instructor.',
            style: TextStyle(fontSize: 12, color: Color(0xFF8A92A4)),
          ),
        ],
      ),
    );
  }
}

// ── Submission Form ────────────────────────────────────────────────────────────

class _SubmissionForm extends StatelessWidget {
  final TaskController controller;
  final SubmissionModel? sub; // null = not started, non-null = draft

  const _SubmissionForm({required this.controller, required this.sub});

  @override
  Widget build(BuildContext context) {
    final isDraft = sub?.isDraft ?? false;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(12),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            isDraft ? 'YOUR DRAFT' : 'SUBMIT YOUR WORK',
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: Color(0xFF8A92A4),
              letterSpacing: 0.8,
            ),
          ),
          if (isDraft && sub?.submittedAt == null) ...[
            const SizedBox(height: 4),
            const Text(
              'Draft saved — not yet submitted.',
              style: TextStyle(fontSize: 12, color: Color(0xFF8A92A4)),
            ),
          ],
          const SizedBox(height: 14),

          // Notes field
          TextField(
            controller: controller.notesCtrl,
            maxLines: 5,
            minLines: 3,
            textInputAction: TextInputAction.newline,
            decoration: InputDecoration(
              hintText: 'Add notes or a summary of your work…',
              hintStyle: const TextStyle(
                color: Color(0xFFB0B8CC),
                fontSize: 14,
              ),
              filled: true,
              fillColor: const Color(0xFFF5F6F9),
              contentPadding: const EdgeInsets.all(14),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFECEEF2)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide:
                    const BorderSide(color: Color(0xFF1E3A8A), width: 1.5),
              ),
            ),
          ),

          // ── Workspace file selection ─────────────────────────────────────────
          Obx(() {
            if (controller.isLoadingFiles.value) {
              return const Padding(
                padding: EdgeInsets.only(top: 14),
                child: Row(
                  children: [
                    SizedBox(
                      width: 14, height: 14,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Color(0xFF8A92A4)),
                    ),
                    SizedBox(width: 8),
                    Text('Loading workspace files…',
                        style: TextStyle(fontSize: 12, color: Color(0xFF8A92A4))),
                  ],
                ),
              );
            }
            final files = controller.workspaceFiles;
            if (files.isEmpty) return const SizedBox.shrink();
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 16),
                const Divider(height: 1, color: Color(0xFFECEEF2)),
                const SizedBox(height: 14),
                const Text(
                  'ATTACH WORKSPACE FILES',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF8A92A4),
                    letterSpacing: 0.8,
                  ),
                ),
                const SizedBox(height: 6),
                ...files.map((f) => _FileCheckRow(f: f, controller: controller)),
              ],
            );
          }),

          // Error banner
          Obx(() {
            if (controller.submitError.isEmpty) return const SizedBox(height: 14);
            return Container(
              margin: const EdgeInsets.only(top: 12),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFFECACA)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline_rounded,
                      color: Color(0xFFB23A3A), size: 16),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      controller.submitError.value,
                      style: const TextStyle(
                          color: Color(0xFFB23A3A), fontSize: 13),
                    ),
                  ),
                ],
              ),
            );
          }),

          // Success banner
          Obx(() {
            if (!controller.submitSuccess.value) return const SizedBox.shrink();
            return Container(
              margin: const EdgeInsets.only(top: 12),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDF4),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFF86EFAC)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.check_circle_outline_rounded,
                      color: Color(0xFF15803D), size: 16),
                  SizedBox(width: 8),
                  Text(
                    'Submitted successfully!',
                    style: TextStyle(color: Color(0xFF15803D), fontSize: 13),
                  ),
                ],
              ),
            );
          }),

          const SizedBox(height: 16),

          // Buttons
          Obx(() {
            final loading = controller.isSubmitting.value;
            return Row(
              children: [
                // Save draft
                Expanded(
                  child: OutlinedButton(
                    onPressed: loading ? null : controller.saveDraft,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF1E3A8A),
                      side: const BorderSide(color: Color(0xFF1E3A8A)),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: loading
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Color(0xFF1E3A8A),
                            ),
                          )
                        : const Text('Save Draft',
                            style: TextStyle(fontWeight: FontWeight.w600)),
                  ),
                ),
                const SizedBox(width: 10),
                // Submit
                Expanded(
                  flex: 2,
                  child: ElevatedButton(
                    onPressed: loading ? null : controller.submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1E3A8A),
                      foregroundColor: Colors.white,
                      disabledBackgroundColor:
                          const Color(0xFF1E3A8A).withAlpha(120),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      elevation: 0,
                    ),
                    child: loading
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Submit',
                            style: TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 15)),
                  ),
                ),
              ],
            );
          }),
        ],
      ),
    );
  }
}

// ── File checkbox row ──────────────────────────────────────────────────────────

class _FileCheckRow extends StatelessWidget {
  final FileModel f;
  final TaskController controller;
  const _FileCheckRow({required this.f, required this.controller});

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final selected = controller.selectedFileIds.contains(f.id);
      return InkWell(
        onTap: () => controller.toggleFile(f.id),
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 7),
          child: Row(
            children: [
              Icon(
                selected
                    ? Icons.check_box_rounded
                    : Icons.check_box_outline_blank_rounded,
                size: 20,
                color: selected
                    ? const Color(0xFF1E3A8A)
                    : const Color(0xFFB0B8CC),
              ),
              const SizedBox(width: 10),
              Icon(f.icon, size: 18, color: f.iconColor),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  f.originalName,
                  style: TextStyle(
                    fontSize: 13,
                    color: selected
                        ? const Color(0xFF1A1F2E)
                        : const Color(0xFF596070),
                    fontWeight: selected
                        ? FontWeight.w500
                        : FontWeight.normal,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                f.sizeLabel,
                style: const TextStyle(
                    fontSize: 11, color: Color(0xFF8A92A4)),
              ),
            ],
          ),
        ),
      );
    });
  }
}
