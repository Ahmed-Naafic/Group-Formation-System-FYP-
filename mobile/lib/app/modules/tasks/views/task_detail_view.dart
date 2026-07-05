import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme.dart';
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
      appBar: AppBar(
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
              // ── Task info card ─────────────────────────────────────────────
              _card(context, Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Status + title
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          task.title,
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: context.textPrimary,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      _taskStatusChip(task),
                    ],
                  ),
                  const SizedBox(height: 6),
                  _submissionTypeChip(task),

                  // Deadline
                  if (task.deadline != null) ...[
                    const SizedBox(height: 10),
                    _DeadlineRow(task: task),
                  ],

                  // Attachment download
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
                            border:
                                Border.all(color: const Color(0xFFBFCFEE)),
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
                    Divider(height: 1, color: context.dividerColor),
                    const SizedBox(height: 14),
                    Text(
                      'DESCRIPTION',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: context.textMuted,
                        letterSpacing: 0.8,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      task.description,
                      style: TextStyle(
                        fontSize: 14,
                        color: context.textBody,
                        height: 1.55,
                      ),
                    ),
                  ],
                ],
              )),

              const SizedBox(height: 12),

              // ── Submission section ─────────────────────────────────────────
              Obx(() {
                final sub = controller.currentSubmission.value;

                if (sub != null && sub.isReviewed) {
                  return _GradedCard(sub: sub);
                }

                if (sub != null && sub.isSubmitted) {
                  return _SubmittedCard(sub: sub, isGroupTask: !task.isIndividual);
                }

                if (task.isClosed && sub == null) {
                  return _card(context, Row(
                    children: [
                      Icon(Icons.lock_outline_rounded,
                          color: context.textMuted, size: 18),
                      const SizedBox(width: 10),
                      Text(
                        'This task is closed — no submission recorded.',
                        style: TextStyle(
                            fontSize: 13, color: context.textSecondary),
                      ),
                    ],
                  ));
                }

                return _SubmissionForm(controller: controller, sub: sub);
              }),
            ],
          ),
        );
      }),
    );
  }

  Widget _card(BuildContext context, Widget child) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: context.cardDecoration(),
        child: child,
      );

  Widget _taskStatusChip(TaskModel task) {
    String label;
    Color color, bg;
    if (task.isClosed) {
      label = 'Closed';  color = const Color(0xFF8A92A4); bg = const Color(0xFFF0F1F4);
    } else if (task.isOverdue) {
      label = 'Overdue'; color = const Color(0xFFB23A3A); bg = const Color(0xFFFEF2F2);
    } else if (task.isDueSoon) {
      label = 'Due Soon'; color = const Color(0xFFB45309); bg = const Color(0xFFFEF3C7);
    } else {
      label = 'Open';    color = const Color(0xFF15803D); bg = const Color(0xFFDCFCE7);
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
      child: Text(label,
          style: TextStyle(
              fontSize: 11, fontWeight: FontWeight.w600, color: color)),
    );
  }

  Widget _submissionTypeChip(TaskModel task) {
    final isIndividual = task.isIndividual;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: isIndividual ? const Color(0xFFEFF3FB) : const Color(0xFFF4F5F7),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(
          color: isIndividual ? const Color(0xFFBFCFEE) : const Color(0xFFD1D5DB),
        ),
      ),
      child: Text(
        isIndividual ? 'Individual submission' : 'Group submission',
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w500,
          color: isIndividual ? const Color(0xFF1E3A8A) : const Color(0xFF6B7280),
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
            : context.textSecondary;
    return Row(
      children: [
        Icon(Icons.schedule_rounded, size: 15, color: color),
        const SizedBox(width: 6),
        Text('Due $date', style: TextStyle(fontSize: 13, color: color)),
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
        color: context.cardColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withAlpha(60)),
        boxShadow: Theme.of(context).brightness == Brightness.dark
            ? null
            : [
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
            'GRADE',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: context.textMuted,
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
              style: TextStyle(fontSize: 12, color: context.textMuted),
            ),
          ],
          if (sub.notes != null && sub.notes!.isNotEmpty) ...[
            const SizedBox(height: 14),
            Divider(height: 1, color: context.dividerColor),
            const SizedBox(height: 14),
            Text(
              'YOUR SUBMISSION NOTES',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: context.textMuted,
                letterSpacing: 0.8,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              sub.notes!,
              style: TextStyle(
                  fontSize: 13, color: context.textBody, height: 1.5),
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
  final bool isGroupTask;
  const _SubmittedCard({required this.sub, this.isGroupTask = false});

  @override
  Widget build(BuildContext context) {
    final isLate = sub.isLate;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: context.cardDecoration(),
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
              style: TextStyle(fontSize: 12, color: context.textMuted),
            ),
          ],
          if (isGroupTask && sub.submittedByName != null) ...[
            const SizedBox(height: 4),
            Text(
              'Submitted by ${sub.submittedByName}',
              style: TextStyle(fontSize: 12, color: context.textMuted),
            ),
          ],
          if (sub.notes != null && sub.notes!.isNotEmpty) ...[
            const SizedBox(height: 14),
            Divider(height: 1, color: context.dividerColor),
            const SizedBox(height: 14),
            Text(
              'YOUR NOTES',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: context.textMuted,
                letterSpacing: 0.8,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              sub.notes!,
              style: TextStyle(
                  fontSize: 13, color: context.textBody, height: 1.5),
            ),
          ],
          const SizedBox(height: 14),
          Text(
            'Awaiting grade from instructor.',
            style: TextStyle(fontSize: 12, color: context.textMuted),
          ),
        ],
      ),
    );
  }
}

// ── Submission Form ────────────────────────────────────────────────────────────

class _SubmissionForm extends StatelessWidget {
  final TaskController controller;
  final SubmissionModel? sub;

  const _SubmissionForm({required this.controller, required this.sub});

  @override
  Widget build(BuildContext context) {
    final isDraft = sub?.isDraft ?? false;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: context.cardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            isDraft ? 'YOUR DRAFT' : 'SUBMIT YOUR WORK',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: context.textMuted,
              letterSpacing: 0.8,
            ),
          ),
          if (isDraft && sub?.submittedAt == null) ...[
            const SizedBox(height: 4),
            Text(
              'Draft saved — not yet submitted.',
              style: TextStyle(fontSize: 12, color: context.textMuted),
            ),
          ],
          const SizedBox(height: 14),

          // Notes field
          TextField(
            controller: controller.notesCtrl,
            maxLines: 5,
            minLines: 3,
            textInputAction: TextInputAction.newline,
            style: TextStyle(color: context.textPrimary),
            decoration: InputDecoration(
              hintText: 'Add notes or a summary of your work…',
              hintStyle: TextStyle(color: context.textPlaceholder, fontSize: 14),
              filled: true,
              fillColor: context.inputFill,
              contentPadding: const EdgeInsets.all(14),
              border: context.inputBorderNone(),
              enabledBorder: context.inputBorderEnabled(),
              focusedBorder: context.inputBorderFocused,
            ),
          ),

          // ── Attach a file from device ──────────────────────────────────
          const SizedBox(height: 16),
          Divider(height: 1, color: context.dividerColor),
          const SizedBox(height: 14),
          Text(
            'ATTACH FILE',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: context.textMuted,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 8),
          Obx(() {
            final name = controller.pickedFileName.value;
            final uploading = controller.isUploadingFile.value;
            if (name != null) {
              return Row(
                children: [
                  const Icon(Icons.attach_file_rounded,
                      size: 18, color: Color(0xFF1E3A8A)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      name,
                      style: TextStyle(
                          fontSize: 13,
                          color: context.textPrimary,
                          fontWeight: FontWeight.w500),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (!uploading)
                    GestureDetector(
                      onTap: controller.clearPickedFile,
                      child: const Icon(Icons.close_rounded,
                          size: 18, color: Color(0xFFE53E3E)),
                    ),
                ],
              );
            }
            return OutlinedButton.icon(
              onPressed: controller.pickFileForSubmission,
              icon: const Icon(Icons.upload_file_outlined, size: 18),
              label: const Text('Pick a file from device'),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF1E3A8A),
                side: const BorderSide(color: Color(0xFF1E3A8A)),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
                padding: const EdgeInsets.symmetric(
                    horizontal: 14, vertical: 10),
              ),
            );
          }),

          // ── Workspace file selection ───────────────────────────────────
          Obx(() {
            if (controller.isLoadingFiles.value) {
              return Padding(
                padding: const EdgeInsets.only(top: 14),
                child: Row(
                  children: [
                    SizedBox(
                      width: 14, height: 14,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: context.textMuted),
                    ),
                    const SizedBox(width: 8),
                    Text('Loading workspace files…',
                        style: TextStyle(
                            fontSize: 12, color: context.textMuted)),
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
                Divider(height: 1, color: context.dividerColor),
                const SizedBox(height: 14),
                Text(
                  'OR ATTACH WORKSPACE FILES',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: context.textMuted,
                    letterSpacing: 0.8,
                  ),
                ),
                const SizedBox(height: 6),
                ...files.map((f) =>
                    _FileCheckRow(f: f, controller: controller)),
              ],
            );
          }),

          // Error banner
          Obx(() {
            if (controller.submitError.isEmpty) {
              return const SizedBox(height: 14);
            }
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
                    style:
                        TextStyle(color: Color(0xFF15803D), fontSize: 13),
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
                Expanded(
                  child: OutlinedButton(
                    onPressed: loading ? null : controller.saveDraft,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF1E3A8A),
                      side: const BorderSide(color: Color(0xFF1E3A8A)),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: loading
                        ? const SizedBox(
                            width: 18, height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Color(0xFF1E3A8A),
                            ),
                          )
                        : const Text('Save Draft',
                            style:
                                TextStyle(fontWeight: FontWeight.w600)),
                  ),
                ),
                const SizedBox(width: 10),
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
                          borderRadius: BorderRadius.circular(12)),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      elevation: 0,
                    ),
                    child: loading
                        ? const SizedBox(
                            width: 18, height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Submit',
                            style: TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 15)),
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
                    : context.textPlaceholder,
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
                        ? context.textBody
                        : context.textSecondary,
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
                style: TextStyle(fontSize: 11, color: context.textMuted),
              ),
            ],
          ),
        ),
      );
    });
  }
}
