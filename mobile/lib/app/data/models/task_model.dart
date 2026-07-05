class TaskModel {
  final String id;
  final String title;
  final String description;
  final DateTime? deadline;
  final String status; // open | closed
  final String submissionType; // group | individual
  final bool hasAttachment;
  final String? attachmentName;
  final String? attachmentMimeType;
  final String? attachmentUrl;

  const TaskModel({
    required this.id,
    required this.title,
    required this.description,
    this.deadline,
    required this.status,
    this.submissionType = 'group',
    required this.hasAttachment,
    this.attachmentName,
    this.attachmentMimeType,
    this.attachmentUrl,
  });

  factory TaskModel.fromJson(Map<String, dynamic> json) {
    final attachments = json['attachments'] as List<dynamic>?;
    final first = (attachments?.isNotEmpty ?? false)
        ? attachments!.first as Map<String, dynamic>
        : null;
    return TaskModel(
      id:                 json['_id']   as String? ?? '',
      title:              json['title'] as String? ?? '',
      description:        json['description'] as String? ?? '',
      deadline:           json['deadline'] != null
          ? DateTime.tryParse(json['deadline'] as String)
          : null,
      status:             json['status']         as String? ?? 'open',
      submissionType:     json['submissionType'] as String? ?? 'group',
      hasAttachment:      attachments?.isNotEmpty ?? false,
      attachmentName:     first?['originalName'] as String?,
      attachmentMimeType: first?['mimeType']     as String?,
      attachmentUrl:      first?['url']          as String?,
    );
  }

  bool get isOpen        => status == 'open';
  bool get isClosed      => status == 'closed';
  bool get isIndividual  => submissionType == 'individual';

  bool get isOverdue =>
      deadline != null && deadline!.isBefore(DateTime.now()) && isOpen;

  bool get isDueSoon {
    if (deadline == null || !isOpen) return false;
    final diff = deadline!.difference(DateTime.now());
    return diff.inDays <= 7 && diff.inSeconds > 0;
  }
}

class SubmissionModel {
  final String id;
  final String status; // draft | submitted | late | reviewed
  final String? notes;
  final double? grade;
  final DateTime? gradedAt;
  final DateTime? submittedAt;
  final List<String> fileIds;
  final String? submittedByName;

  const SubmissionModel({
    required this.id,
    required this.status,
    this.notes,
    this.grade,
    this.gradedAt,
    this.submittedAt,
    this.fileIds = const [],
    this.submittedByName,
  });

  factory SubmissionModel.fromJson(Map<String, dynamic> json) {
    // files is populated — extract just the IDs
    final rawFiles = json['files'] as List<dynamic>?;
    final fileIds = rawFiles
            ?.map((f) => f is Map ? f['_id'] as String? ?? '' : f.toString())
            .where((id) => id.isNotEmpty)
            .toList() ??
        [];
    final submittedBy = json['submittedBy'];
    final submittedByName = submittedBy is Map
        ? submittedBy['fullName'] as String?
        : null;
    return SubmissionModel(
      id:              json['_id']    as String? ?? '',
      status:          json['status'] as String? ?? 'draft',
      notes:           json['notes']  as String?,
      grade:           (json['grade'] as num?)?.toDouble(),
      gradedAt:        json['gradedAt']    != null
          ? DateTime.tryParse(json['gradedAt']    as String)
          : null,
      submittedAt:     json['submittedAt'] != null
          ? DateTime.tryParse(json['submittedAt'] as String)
          : null,
      fileIds:         fileIds,
      submittedByName: submittedByName,
    );
  }

  bool get isDraft     => status == 'draft';
  bool get isSubmitted => status == 'submitted' || status == 'late';
  bool get isLate      => status == 'late';
  bool get isReviewed  => status == 'reviewed';
  bool get isGraded    => isReviewed && grade != null;
  bool get canEdit     => status == 'draft';
}
