import 'package:flutter/material.dart';

class NotificationModel {
  final String id;
  final String type;
  final String title;
  final String message;
  final bool isRead;
  final DateTime createdAt;
  final String? relatedEntityKind;
  final String? relatedEntityId;

  const NotificationModel({
    required this.id,
    required this.type,
    required this.title,
    required this.message,
    required this.isRead,
    required this.createdAt,
    this.relatedEntityKind,
    this.relatedEntityId,
  });

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    final related = json['relatedEntity'] as Map<String, dynamic>?;
    return NotificationModel(
      id:                json['_id']     as String? ?? '',
      type:              json['type']    as String? ?? '',
      title:             json['title']   as String? ?? '',
      message:           json['message'] as String? ?? '',
      isRead:            json['isRead']  as bool?   ?? false,
      createdAt:         DateTime.parse(json['createdAt'] as String),
      relatedEntityKind: related?['kind'] as String?,
      relatedEntityId:   related?['id']   as String?,
    );
  }

  NotificationModel copyWith({bool? isRead}) => NotificationModel(
        id:                id,
        type:              type,
        title:             title,
        message:           message,
        isRead:            isRead ?? this.isRead,
        createdAt:         createdAt,
        relatedEntityKind: relatedEntityKind,
        relatedEntityId:   relatedEntityId,
      );

  IconData get icon {
    switch (type) {
      case 'GROUP_FORMED':      return Icons.group_add_rounded;
      case 'TASK_ASSIGNED':     return Icons.assignment_rounded;
      case 'SUBMISSION_GRADED': return Icons.grade_rounded;
      default:                  return Icons.notifications_rounded;
    }
  }

  Color get color {
    switch (type) {
      case 'GROUP_FORMED':      return const Color(0xFF1E3A8A);
      case 'TASK_ASSIGNED':     return const Color(0xFF0D7850);
      case 'SUBMISSION_GRADED': return const Color(0xFF856404);
      default:                  return const Color(0xFF596070);
    }
  }
}
