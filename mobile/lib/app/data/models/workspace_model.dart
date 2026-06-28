// Data models for the workspace/group API response.
// performanceCategory is intentionally NEVER captured here (Ground Rule 6).

class MemberModel {
  final String id;
  final String fullName;
  final String studentId;

  MemberModel._({
    required this.id,
    required this.fullName,
    required this.studentId,
  });

  factory MemberModel.fromJson(Map<String, dynamic> json) {
    final userMap = json['userId'] as Map<String, dynamic>? ?? {};
    return MemberModel._(
      id:        json['_id']      as String? ?? '',
      fullName:  json['fullName'] as String? ?? '',
      studentId: userMap['studentId'] as String? ?? '',
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
  });

  factory WorkspaceModel.fromJson(Map<String, dynamic> json) {
    final group      = json['groupId']  as Map<String, dynamic>? ?? {};
    final offering   = group['courseOfferingId'] as Map<String, dynamic>? ?? {};
    final course     = offering['courseId']  as Map<String, dynamic>? ?? {};
    final cohort     = offering['cohortId']  as Map<String, dynamic>? ?? {};
    final semester   = offering['semesterId'] as Map<String, dynamic>? ?? {};
    final leaderJson = group['leaderId'] as Map<String, dynamic>? ?? {};
    final membersRaw = group['memberIds'] as List<dynamic>? ?? [];

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
    );
  }

  // Returns true if the given studentId is this group's leader.
  bool isLeader(String studentId) => leader.studentId == studentId;
}
