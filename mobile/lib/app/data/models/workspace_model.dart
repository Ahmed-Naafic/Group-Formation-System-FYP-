// Data models for the workspace/group API response.
// performanceCategory is intentionally NEVER captured here (Ground Rule 6).

class MemberModel {
  final String id;
  final String fullName;
  final String studentId;
  final String? avatarUrl;

  MemberModel._({
    required this.id,
    required this.fullName,
    required this.studentId,
    this.avatarUrl,
  });

  factory MemberModel.fromJson(Map<String, dynamic> json) {
    final userMap = json['userId'] as Map<String, dynamic>? ?? {};
    return MemberModel._(
      id:        json['_id']      as String? ?? '',
      fullName:  json['fullName'] as String? ?? '',
      studentId: userMap['studentId'] as String? ?? '',
      avatarUrl: userMap['avatarUrl'] as String?,
      // performanceCategory is deliberately not read
    );
  }
}

class TaskSummaryModel {
  final int total;
  final int done;
  final int pending;
  final int dueSoon;

  const TaskSummaryModel({
    required this.total,
    required this.done,
    required this.pending,
    required this.dueSoon,
  });

  factory TaskSummaryModel.fromJson(Map<String, dynamic> json) =>
      TaskSummaryModel(
        total:   json['total']   as int? ?? 0,
        done:    json['done']    as int? ?? 0,
        pending: json['pending'] as int? ?? 0,
        dueSoon: json['dueSoon'] as int? ?? 0,
      );

  static const empty = TaskSummaryModel(total: 0, done: 0, pending: 0, dueSoon: 0);
}

/// One task's grade within a workspace — "not started" (status null) through
/// "reviewed" (status + grade both set). Used by the Grades screen.
class WorkspaceTaskGrade {
  final String taskId;
  final String title;
  final String submissionType; // group | individual
  final DateTime? deadline;
  final String? status; // null | draft | submitted | late | reviewed
  final double? grade;
  final DateTime? gradedAt;

  const WorkspaceTaskGrade({
    required this.taskId,
    required this.title,
    required this.submissionType,
    this.deadline,
    this.status,
    this.grade,
    this.gradedAt,
  });

  factory WorkspaceTaskGrade.fromJson(Map<String, dynamic> json) => WorkspaceTaskGrade(
        taskId:         json['taskId'] as String? ?? '',
        title:          json['title']  as String? ?? '',
        submissionType: json['submissionType'] as String? ?? 'group',
        deadline:       json['deadline'] != null
            ? DateTime.tryParse(json['deadline'] as String)
            : null,
        status:   json['status'] as String?,
        grade:    (json['grade'] as num?)?.toDouble(),
        gradedAt: json['gradedAt'] != null
            ? DateTime.tryParse(json['gradedAt'] as String)
            : null,
  );

  bool get isGraded    => status == 'reviewed' && grade != null;
  bool get isSubmitted => status == 'submitted' || status == 'late' || status == 'reviewed';
}

class WorkspaceModel {
  final String id;
  final String groupId;
  final String groupName;
  final String courseName;
  final String courseCode;
  final String cohortName;
  final String semesterName;
  final MemberModel leader;
  final List<MemberModel> members;
  final TaskSummaryModel taskSummary;
  final List<WorkspaceTaskGrade> tasks;

  final String courseOfferingId;

  WorkspaceModel._({
    required this.id,
    required this.groupId,
    required this.groupName,
    required this.courseOfferingId,
    required this.courseName,
    required this.courseCode,
    required this.cohortName,
    required this.semesterName,
    required this.leader,
    required this.members,
    required this.taskSummary,
    required this.tasks,
  });

  factory WorkspaceModel.fromJson(Map<String, dynamic> json) {
    final group      = json['groupId']  as Map<String, dynamic>? ?? {};
    final offering   = group['courseOfferingId'] as Map<String, dynamic>? ?? {};
    final course     = offering['courseId']  as Map<String, dynamic>? ?? {};
    final cohort     = offering['cohortId']  as Map<String, dynamic>? ?? {};
    final semester   = offering['semesterId'] as Map<String, dynamic>? ?? {};
    final leaderJson = group['leaderId'] as Map<String, dynamic>? ?? {};
    final membersRaw = group['memberIds'] as List<dynamic>? ?? [];
    final tasksRaw   = json['tasks'] as List<dynamic>? ?? [];

    return WorkspaceModel._(
      id:               json['_id']      as String? ?? '',
      groupId:          group['_id']     as String? ?? '',
      groupName:        group['name']    as String? ?? '',
      courseOfferingId: offering['_id']  as String? ?? '',
      courseName:       course['name']   as String? ?? '',
      courseCode:       course['code']   as String? ?? '',
      cohortName:   cohort['name'] as String? ?? '',
      semesterName: semester['name'] as String? ?? '',
      leader:       MemberModel.fromJson(leaderJson),
      members:      membersRaw
          .map((m) => MemberModel.fromJson(m as Map<String, dynamic>))
          .toList(),
      taskSummary:  json['taskSummary'] != null
          ? TaskSummaryModel.fromJson(
              json['taskSummary'] as Map<String, dynamic>,
            )
          : TaskSummaryModel.empty,
      tasks: tasksRaw
          .whereType<Map<String, dynamic>>()
          .map(WorkspaceTaskGrade.fromJson)
          .toList(),
    );
  }

  // Returns true if the given studentId is this group's leader.
  bool isLeader(String studentId) => leader.studentId == studentId;
}
