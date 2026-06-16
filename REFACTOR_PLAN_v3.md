# REFACTOR PLAN v3 — Cohort-Based Data Model
**Project:** JUST Advanced Automated Student Group Formation System
**Status:** APPROVED — Step 1 in progress
**Date:** 2026-06-15
**Author:** Claude Code
**Approved:** 2026-06-15 with adjustments A1–A3 and answers Q1–Q10 incorporated below

---

## SECTION 1 — RATIONALE

The current `Class` entity conflates two distinct real-world concepts: (1) a permanent student cohort ("CA226 — the students who entered in 2022") and (2) a per-semester teaching arrangement ("CA226 taking Databases in Semester 7, taught by Dr. Hassan"). Because these two concepts are merged into one record, a new `Class` must be created every semester for the same group of students, students must be re-uploaded every semester, `CourseAssignment` exists as a patch to attach instructors to specific courses within the class, and the system has no way to reason about the same cohort across academic years. The new model separates cohort identity from teaching arrangements: a `Cohort` is permanent, a `CourseOffering` is the per-semester teaching instance, and an `AcademicYear` owns its semesters as a first-class entity. Students are uploaded once to a cohort and implicitly attend all that cohort's offerings each semester without re-enrollment. `CourseAssignment` disappears because instructor assignment is a field on `CourseOffering`.

---

## SECTION 2 — ENTITY MAP

### Legend
- **NEW** — does not exist today
- **MODIFIED** — shape changes; existing data wiped (fresh seed)
- **UNCHANGED** — no change to model shape or relationships
- **REMOVED** — deleted entirely

---

### AcademicYear — **NEW**

Represents a full academic year (e.g., "2025/2026"). Owns its semesters.

| Field | Type | Notes |
|---|---|---|
| name | String | Required. e.g. "2025/2026" |
| startDate | Date | Required |
| endDate | Date | Required |
| status | String | `active` \| `completed` \| `archived` |
| createdBy | ObjectId → User | Required |
| deletedAt | Date \| null | Soft-delete |
| deletedBy | ObjectId → User \| null | Soft-delete |
| createdAt / updatedAt | Date | Timestamps |

**Indexes:**
```
{ name: 1 }  unique  partialFilterExpression: { deletedAt: null }
```
Name is globally unique among active records. "2025/2026" cannot exist twice.

**Cascade-delete:** Blocked if it has active `Semester` records.

---

### Semester — **MODIFIED**

Was a standalone entity with a `year: Number` field. Now belongs to an `AcademicYear`.

**Fields — what changes:**
- ADD: `academicYearId: ObjectId → AcademicYear` (required)
- REMOVE: `year: Number` (year information now lives on AcademicYear)
- `status` enum extends: `active` | `completed` | `archived` (was `active` | `archived`)
- All other fields unchanged: `name`, `startDate`, `endDate`, `createdBy`, soft-delete, timestamps

**Indexes (replacing current `{ name, year }` index):**
```
{ name: 1, academicYearId: 1 }  unique  partialFilterExpression: { deletedAt: null }
```
"Semester 1" can exist in 2025/2026 and again in 2026/2027 — but not twice within the same academic year.

**Cascade-delete:** Blocked if it has active `CourseOffering` records (replaces current block-on-Classes).

---

### Cohort — **NEW**

The permanent identity of a student group: "CA226 — Software Engineering entry cohort of 2022." Does not change per semester.

| Field | Type | Notes |
|---|---|---|
| name | String | Required. e.g. "CA226" |
| departmentId | ObjectId → Department | Required |
| yearOfEntry | Number | e.g. 2022. Optional but useful for display |
| description | String | Optional |
| createdBy | ObjectId → User | Required |
| deletedAt / deletedBy | — | Soft-delete |
| createdAt / updatedAt | — | Timestamps |

**Indexes:**
```
{ departmentId: 1, name: 1 }  unique  partialFilterExpression: { deletedAt: null }
```
"CA226" is unique within a department. Two departments can each have a "CA226" cohort.

**Cascade-delete:** Blocked if it has active `Student` records OR active `CourseOffering` records.

---

### CourseOffering — **NEW**

The central operating entity. Represents one course taken by one cohort in one semester, taught by one instructor.

| Field | Type | Notes |
|---|---|---|
| courseId | ObjectId → Course | Required |
| cohortId | ObjectId → Cohort | Required |
| semesterId | ObjectId → Semester | Required |
| instructorId | ObjectId → User | Required (role must be `instructor`) |
| maxStudents | Number \| null | Optional capacity cap |
| status | String | `active` \| `completed` \| `cancelled` |
| createdBy | ObjectId → User | Required |
| deletedAt / deletedBy | — | Soft-delete |
| createdAt / updatedAt | — | Timestamps |

**Indexes:**
```
{ courseId: 1, cohortId: 1, semesterId: 1 }  unique  partialFilterExpression: { deletedAt: null }
```
A course can only be offered to a cohort once per semester. The same course can be offered to the same cohort in different semesters (different academic years).

**Cascade-delete:** Blocked if it has active `Group` records OR active `Attendance` records.

---

### Attendance — **NEW**

Per-student, per-offering attendance percentage. This is the only per-course data point in the new model. Everything else (performance score, category) stays at the cohort/student level.

| Field | Type | Notes |
|---|---|---|
| studentId | ObjectId → Student | Required |
| courseOfferingId | ObjectId → CourseOffering | Required |
| percentage | Number (0–100) | Required |
| updatedBy | ObjectId → User | Required |
| deletedAt / deletedBy | — | Soft-delete |

No `createdAt/updatedAt` timestamps needed — `updatedBy` is sufficient audit trail. One record per student per offering; PATCH to update.

**Indexes:**
```
{ studentId: 1, courseOfferingId: 1 }  unique  partialFilterExpression: { deletedAt: null }
```

**Cascade-delete:** Attendance is a child of CourseOffering (blocks CourseOffering deletion).

---

### Student — **MODIFIED**

The bridge between a User and a Cohort. Shape is mostly unchanged; `classId` becomes `cohortId`, and the global `attendance` field is removed (moved to Attendance table). Students now persist across semesters — they are enrolled in the cohort permanently, not re-uploaded each semester.

**Fields — what changes:**
- `classId: ObjectId → Class` → **`cohortId: ObjectId → Cohort`**
- REMOVE: `attendance: Number` (now per-offering in Attendance table)
- All other fields unchanged: `userId`, `fullName`, `averageScore`, `performanceCategory`, `hasBeenLeader`, `leaderCount`, soft-delete, timestamps

**Indexes (replacing current non-partial + partial):**
```
{ userId: 1, cohortId: 1 }  unique  partialFilterExpression: { deletedAt: null }
```
One active enrollment per (user, cohort). Soft-deleted records can coexist — allows re-enrollment after removal without E11000.

```
{ userId: 1 }  unique  partialFilterExpression: { deletedAt: null }
```
One active cohort membership per user across all cohorts. Preserved from current model ("one-active-class rule" → "one-active-cohort rule").

**Cascade-delete:** None — students are children of Cohort. Cohort deletion is blocked by active Students.

---

### Group — **MODIFIED**

Shape is mostly unchanged. The `classId + courseId` pair is replaced by a single `courseOfferingId`.

**Fields — what changes:**
- REMOVE: `classId: ObjectId → Class`
- REMOVE: `courseId: ObjectId → Course`
- ADD: `courseOfferingId: ObjectId → CourseOffering`
- All other fields unchanged: `name`, `leaderId`, `memberIds`, `generationId`, `generationOptions`, `generatedAt`, `status`, `createdBy`, soft-delete, timestamps

**Indexes:**
```
{ courseOfferingId: 1, status: 1 }
```
(Replaces current `{ classId, courseId, status }` index.)

**Cascade-delete:** Groups are children of CourseOffering (blocks CourseOffering deletion when active groups exist).

---

### GroupHistory — **MODIFIED**

Same purpose. `classId + courseId` → `courseOfferingId`.

**Fields — what changes:**
- REMOVE: `classId`, `courseId`
- ADD: `courseOfferingId: ObjectId → CourseOffering`
- All other fields unchanged: `generationId`, `memberIds`, `leaderId`, `generatedAt`, `groupSize`, `options`

**Indexes:**
```
{ courseOfferingId: 1, generatedAt: -1 }
```
(Replaces current `{ classId, courseId, generatedAt: -1 }`.)

No soft-delete — immutable audit record; this does not change.

---

### Task — **MODIFIED**

Currently has `classId: ObjectId → Class`. Since Class is removed, this becomes `courseOfferingId`.

**Fields — what changes:**
- REMOVE: `classId`
- ADD: `courseOfferingId: ObjectId → CourseOffering`
- All other fields unchanged: `assignedGroups`, `assignedBy`, `title`, `description`, `attachments`, `deadline`, `status`, soft-delete, timestamps

---

### Faculty — **UNCHANGED**

No changes to fields, indexes, or cascade-delete rules.

---

### Department — **UNCHANGED**

No changes. Still `{ facultyId, name }` unique. Still blocked on active Courses.

---

### Course — **UNCHANGED**

No changes. Still `{ departmentId, code }` and `{ departmentId, name }` unique. Cascade-delete check for active CourseOfferings is added (replacing the current block-on-Classes check via `countByCourse`).

> **Note:** The current `Course.softDelete` check blocks if active `Class` records reference it. In the new model, `Course` references must shift to `CourseOffering`. The cascade-delete check becomes: blocked if active `CourseOffering` records reference this course.

---

### User — **UNCHANGED**

Roles (`admin`, `instructor`, `student`), auth fields, `isActive`, `mustChangePassword`, `lastLoginAt`, and both partial unique indexes on `email` and `studentId` are all unchanged.

---

### Workspace — **UNCHANGED**

`groupId → Group` reference is unchanged. Group entity persists (just modified internally).

---

### Message — **UNCHANGED**

`workspaceId → Workspace` reference unchanged.

---

### File — **UNCHANGED**

`workspaceId → Workspace` reference unchanged.

---

### Submission — **UNCHANGED**

`taskId → Task` and `groupId → Group` references unchanged. (Task is modified but still exists; Submission's ref doesn't care about Task's internal fields.)

---

### Notification — **UNCHANGED**

`userId → User` reference unchanged.

---

### Feedback — **UNCHANGED**

`groupId → Group`, `taskId → Task`, `fromUserId → User`, `toUserId → User`, `toGroupId → Group` references all still valid.

---

### AuditLog — **UNCHANGED**

`actorId → User` reference unchanged. `entityKind` strings (e.g. "Group", "Student") remain valid.

---

### PerformanceSettings — **UNCHANGED**

Singleton. Thresholds and mapping logic are unchanged.

---

### Class — **REMOVED**

See Section 3.

---

### CourseAssignment — **REMOVED**

See Section 3.

---

## SECTION 3 — WHAT GOES AWAY

Every file tied to `Class` or `CourseAssignment` is deleted. Nothing is left over.

### Backend — Models
- `backend/src/modules/class/models/Class.js`
- `backend/src/modules/courseAssignment/models/CourseAssignment.js`

### Backend — Repositories
- `backend/src/modules/class/repositories/classRepository.js`
- `backend/src/modules/courseAssignment/repositories/courseAssignmentRepository.js`

### Backend — Services
- `backend/src/modules/class/services/classService.js`
- `backend/src/modules/courseAssignment/services/courseAssignmentService.js`

### Backend — Controllers
- `backend/src/modules/class/controllers/classController.js`
- `backend/src/modules/courseAssignment/controllers/courseAssignmentController.js`

### Backend — Routes
- `backend/src/modules/class/routes/classRoutes.js`
- `backend/src/modules/courseAssignment/routes/courseAssignmentRoutes.js`

### Backend — Validations
- `backend/src/modules/class/validations/classValidation.js`
- `backend/src/modules/courseAssignment/validations/courseAssignmentValidation.js`

### Backend — Route Mount (in app.js)
- `/api/classes` route mount
- `/api/course-assignments` route mount

### Backend — Service References (all imports of classService / courseAssignmentService in other modules must be removed or replaced)
- `enrollmentService.js` — imports `classService` and `courseAssignmentService`
- `studentService.js` — imports `classService` and `courseAssignmentService`
- `groupService.js` — imports `classService` and `courseAssignmentService`
- `dashboardService.js` — references `Class` model and class-based aggregations
- `workspaceService.js` — references class-based task/submission enrichment
- Any other service that calls `courseAssignmentService.hasAccess()`

### Endpoints Removed
| Method | Path | Reason |
|---|---|---|
| GET | `/api/classes` | Replaced by `/api/cohorts` + `/api/course-offerings` |
| POST | `/api/classes` | Replaced by `/api/cohorts` + `/api/course-offerings` |
| GET | `/api/classes/:id` | Replaced |
| PATCH | `/api/classes/:id` | Replaced |
| DELETE | `/api/classes/:id` | Replaced |
| GET | `/api/course-assignments` | Replaced by `/api/course-offerings` |
| POST | `/api/course-assignments` | instructorId is now a field on CourseOffering |
| GET | `/api/course-assignments/:id` | Replaced |
| DELETE | `/api/course-assignments/:id` | Replaced |

### Frontend — Feature Folders Removed
- `web/src/features/class/` (entire folder: `ClassesPage.jsx`, `classApi.js`)
- `web/src/features/courseAssignment/` (entire folder: `InstructorsPage.jsx` — or repurposed, see Section 7)

### Frontend — API Slices Removed
- `classApi.js`
- `courseAssignmentApi.js`

### Frontend — Router Entries Removed
- `/classes` — ClassesPage
- `/classes/:classId/students` — StudentsPage (URL changes)
- `/classes/:classId/students/upload` — BulkUploadPage (URL changes)
- `/classes/:classId/groups` — GroupsPage (URL changes)
- `/classes/:classId/scores` — ScoresPage (URL changes)

---

## SECTION 4 — WHAT STAYS UNCHANGED

These modules are not touched during the refactor. They form the safe perimeter.

### Backend
- `src/app.js` — global middleware, error handler mount (route mounts updated but structure unchanged)
- `src/server.js` — entry point
- `src/config/db.js` — MongoDB connection
- `src/config/env.js` — environment config
- `src/common/errors/` — all error classes (including `TransferConfirmationError`)
- `src/common/plugins/softDelete.js`
- `src/common/responses/apiResponse.js`
- `src/common/utils/` — asyncHandler, logger, passwordGenerator
- `src/common/validators/validate.js`
- `src/middleware/auth.js` — JWT verify + `isActive` check (unchanged)
- `src/middleware/rbac.js` — `requireRole` (unchanged)
- `src/middleware/errorHandler.js` — unchanged
- `src/modules/auth/` — login, change-password, JWT logic — completely unchanged
- `src/modules/user/` — instructor registration, activate/deactivate — unchanged
- `src/modules/faculty/` — entirely unchanged
- `src/modules/department/` — entirely unchanged
- `src/modules/course/` — cascade-delete check updated (Class → CourseOffering) but everything else unchanged
- `src/modules/performance/` — PerformanceSettings, recalculate logic unchanged (endpoint path changes from `/class/:id` to `/cohort/:id`)
- `src/modules/grouping/GroupGenerationService.js` — the pure generation algorithm is unchanged; only its caller (groupService) changes
- `src/modules/workspace/models/Workspace.js`
- `src/modules/chat/` — Message model, routes, controller
- `src/modules/file/` — File model, routes, controller
- `src/modules/submission/` — Submission model (unchanged shape), routes
- `src/modules/notification/` — Notification model, routes
- `src/modules/feedback/` — Feedback model, routes
- `src/modules/auditLog/` — AuditLog model, routes
- `src/modules/task/models/Task.js` — model is MODIFIED, but task routes and controller logic are unchanged

### Frontend
- `web/src/app/store.js` — Redux store structure unchanged
- `web/src/styles/` — JUST design tokens unchanged
- `web/src/components/ui/` — all shadcn components unchanged
- `web/src/components/layout/` — AppShell, Sidebar, Topbar (nav links update, structure unchanged)
- `web/src/components/auth/ProtectedRoute.jsx` — unchanged
- `web/src/features/auth/` — login, change-password, authSlice, authApi — unchanged
- `web/src/features/faculty/` — FacultiesPage, facultyApi — unchanged
- `web/src/features/department/` — DepartmentsPage, departmentApi — unchanged
- `web/src/features/course/` — CoursesPage, courseApi — unchanged
- `web/src/features/user/` — userApi (instructor management) — unchanged
- `web/src/features/performance/` — ScoresPage URL changes but logic mostly unchanged
- `web/src/features/workspace/` — WorkspaceDetailPage — unchanged
- `web/src/lib/api.js` — base query, 401 logout — unchanged
- `web/src/lib/utils.js` — unchanged

---

## SECTION 5 — STEP-BY-STEP REFACTOR ORDER

### Phase A — Additive (system remains fully functional)

---

**Step 1 — Add new Mongoose models**
Create new model files alongside existing ones. Nothing is removed.

Files created:
- `backend/src/modules/academicYear/models/AcademicYear.js`
- `backend/src/modules/cohort/models/Cohort.js`
- `backend/src/modules/courseOffering/models/CourseOffering.js`
- `backend/src/modules/attendance/models/Attendance.js`

No changes to any existing model. Restart backend. Mongoose creates the new indexes.

**Proof step works:** `db.academicyears.indexes()`, `db.cohorts.indexes()`, `db.courseofferings.indexes()`, `db.attendances.indexes()` — all show expected unique/partial indexes.

**Rollback:** Delete the four new files; old system unaffected.

---

**Step 2 — Add repositories, services, and validations for new entities**
One module per entity, following the exact same pattern as faculty/department/course.

Files created:
- `academicYear/{repositories,services,validations}/` — full CRUD + cascade-delete guard
- `cohort/{repositories,services,validations}/`
- `courseOffering/{repositories,services,validations}/` — cascade-delete blocks if Groups or Attendance exist; scoping logic (instructor sees only own offerings)
- `attendance/{repositories,services,validations}/`

No changes to existing modules.

**Proof step works:** Unit-level: call service methods from a Node script. No API yet.

**Rollback:** Delete the four new module folders.

---

**Step 3 — Add admin/instructor CRUD routes and controllers for new entities**
Wire everything into app.js route mounts.

Files created:
- `academicYear/{controllers,routes}/`
- `cohort/{controllers,routes}/`
- `courseOffering/{controllers,routes}/`
- `attendance/{controllers,routes}/`

Files modified:
- `src/app.js` — mount `/api/academic-years`, `/api/cohorts`, `/api/course-offerings`, `/api/attendance`

Old routes (`/api/classes`, `/api/course-assignments`) still mounted and working.

**Proof step works:** Insomnia / curl — POST/GET/PATCH/DELETE for all four new entities. Cascade-delete protection tested for each (try to delete an AcademicYear that has Semesters → 409, etc.).

**Rollback:** Remove the four new module folders and unmount from app.js.

---

### Phase B — Model Swap (breaking changes; on a dedicated feature branch)

**A1 — Branch strategy (approved adjustment):**
Before starting Step 4:
1. Tag the current main: `git tag pre-refactor-v3`
2. Create a feature branch: `git checkout -b refactor/cohort-model-v3`
3. All Steps 4–7 are committed individually on this branch.
4. The branch is NOT merged to main until all four steps complete and integration tests pass.
5. If a step fails badly, `git tag pre-refactor-v3` is the hard rollback point.

Steps 4–7 may be done across multiple sessions on the branch. Between steps the system is in an inconsistent state on the branch (not on main). The fresh seed (Step 11) covers data cleanup.

---

**Step 4 — Update Semester model**
Add `academicYearId`, remove `year`. Update uniqueness index and service.

Files modified:
- `backend/src/modules/semester/models/Semester.js` — add `academicYearId`, remove `year`; replace index `{ name, year }` with `{ name, academicYearId }` partial unique
- `backend/src/modules/semester/repositories/semesterRepository.js` — rename `findActiveByNameAndYear` → `findActiveByNameAndAcademicYear(name, academicYearId)`
- `backend/src/modules/semester/services/semesterService.js` — update create/update pre-checks; validate `academicYearId` exists via `academicYearService.getById()`; cascade-delete check: block if active `CourseOffering` records exist (replaces block-on-Classes)
- `backend/src/modules/semester/validations/semesterValidation.js` — add `academicYearId` required, remove `year`

Old `{ name, year }` index dropped manually before restart (same pattern as class name refactor).

**Proof step works:** POST `/api/semesters` with `academicYearId` → 201; duplicate `{ name, academicYearId }` → 409.

**Rollback:** Not safe to roll back once data is in the new format. Do on a separate branch.

---

**Step 5 — Update Student model (classId → cohortId)**
The most impactful change. Students now belong to cohorts.

Files modified:
- `backend/src/modules/student/models/Student.js` — `classId → cohortId`, remove `attendance` field, update indexes
- `backend/src/modules/student/repositories/studentRepository.js` — all `classId` references → `cohortId`; remove `softDeleteAllByClass` → `softDeleteAllByCohort`; rename lookup methods
- `backend/src/modules/student/services/studentService.js` — `assertClassAccess` → `assertCohortAccess` (checking CourseOffering for instructor scoping); `clearByClass` → `clearByCohort`
- `backend/src/modules/student/validations/studentValidation.js` — `classId` → `cohortId`; remove `clearByClassSchema` → `clearByCohortSchema`
- `backend/src/modules/student/controllers/studentController.js` — update param names
- `backend/src/modules/student/routes/studentRoutes.js` — update param names
- `backend/src/modules/enrollment/services/enrollmentService.js` — `classId` → `cohortId` throughout; transfer detection still works (same userId-uniqueness logic); response shape unchanged
- `backend/src/modules/performance/services/performanceService.js` — `recalculateClass` → `recalculateCohort`; route path changes from `/class/:id` to `/cohort/:id`

Old `userId_1_classId_1` index dropped manually; new `userId_1_cohortId_1` partial index created on restart.

**Proof step works:** POST `/api/students/bulk-upload` with `cohortId` → 201; duplicate upload to same cohort → skipped; transfer between cohorts with `confirmTransfers=true` → transferred.

---

**Step 6 — Update Group, GroupHistory, and groupService**
Groups detach from Class and attach to CourseOffering.

> **DUAL-ATTENDANCE CLEANUP (required at end of Step 6):** Phase A (Step 3) created a bridge:
> the old `Student.attendance` field still exists and is still written by `POST /api/performance/attendance`.
> The new `Attendance` collection is wired into the grouping engine in this step (replacing `Student.attendance`).
> Once Step 6 is complete and the grouping engine reads from `attendanceRepository.findByCourseOffering()`,
> the following must be removed in the SAME commit as Step 6 (not deferred):
> - `Student.attendance` field from `student/models/Student.js` and its index
> - `performanceService.updateStudentAttendance()` and the `POST /api/performance/attendance` route
> - The `updateStudentAttendanceSchema` from performanceValidation.js
> - The `updateAttendance` mutation from `web/src/features/performance/performanceApi.js`
> - The attendance column from `ScoresPage.jsx` (attendance is now per-offering, not per-student)
> Failure to remove these in Step 6 means two parallel attendance systems ship together.

Files modified:
- `backend/src/modules/group/models/Group.js` — remove `classId, courseId`; add `courseOfferingId`; update index
- `backend/src/modules/grouping/models/GroupHistory.js` — same swap
- `backend/src/modules/group/repositories/groupRepository.js` — all `{ classId, courseId }` queries → `{ courseOfferingId }`; rename methods (`findByCourse` → `findByCourseOffering`, etc.)
- `backend/src/modules/grouping/repositories/groupHistoryRepository.js` — same rename pattern
- `backend/src/modules/group/services/groupService.js` — `assertClassAccess` → `assertCourseOfferingAccess`; generation now reads students from cohort via `courseOffering.cohortId`; student attendance comes from `attendanceRepository.findByCourseOffering(courseOfferingId)` rather than Student.attendance field; `archiveForCourse` → `archiveForCourseOffering`
- `backend/src/modules/group/validations/groupValidation.js` — `classId + courseId` → `courseOfferingId` in all schemas
- `backend/src/modules/group/controllers/groupController.js` — update param names
- `backend/src/modules/group/routes/groupRoutes.js` — update query param schema references
- `backend/src/modules/workspace/services/workspaceService.js` — `findForStudent` enrichment: `classId → courseOfferingId` in task/submission bulk lookup
- `backend/src/modules/dashboard/services/dashboardService.js` — `getInstructorStats`: aggregation by `courseOfferingId` instead of `classId`

**Proof step works:** POST `/api/groups/generate` with `courseOfferingId` → groups created; GET groups → populated correctly; `clearAll` → archived.

---

**Step 7 — Update Task, Submission, Feedback, Report; courseService cascade**

Scope is broader than originally planned. Step 6 completed Group/GroupHistory migration,
which revealed that feedbackService reads `group.classId` (removed in Step 6) and is
**currently broken at runtime**. All four modules below must be fixed together.

#### Step 7 Audit (produced at end of Step 6 session, 2026-06-15)

Every `classId`/`Class` reference across task/submission/feedback/report was catalogued.
Classification: **(a)** field swap, **(b)** access-check swap, **(c)** other.

---

##### TASK module

| File | Lines | Class | Fix |
|---|---|---|---|
| `Task.js:16` | `classId: ObjectId, ref:'Class'` | (a) | `courseOfferingId: ObjectId, ref:'CourseOffering'` |
| `taskRepository.js:5` | `populate { path:'courseId' }` on assignedGroups | (a) stale populate | Group has no `courseId` after Step 6 — remove nested courseId populate |
| `taskRepository.js:17-18` | `findByClass(classId)` / `find({ classId })` | (a) | `findByOffering(courseOfferingId)` / filter `{ courseOfferingId }` |
| `taskService.js:3` | `require classService` | (b) | Replace with `courseOfferingService` |
| `taskService.js:10-13` | `assertWriteAccess(classId)` / `courseAssignmentService.hasAccess` | (b) | `assertCourseOfferingAccess(courseOfferingId)` via `courseOfferingService.getById(id, context)` |
| `taskService.js:18` | `classService.getById(data.classId)` | (b) | Drop — existence confirmed inside `assertCourseOfferingAccess` |
| `taskService.js:26-27` | `group.classId !== data.classId` validation | (a) | `group.courseOfferingId !== data.courseOfferingId` |
| `taskService.js:33` | `classId: data.classId` in create | (a) | `courseOfferingId: data.courseOfferingId` |
| `taskService.js:64-77` | `list(classId)` — student path uses `findAll({ userId, classId })` | (a+b) | Student path: load offering → find student by cohortId → find groups in offering → `findByGroupIds`; admin/instructor: `findByOffering(courseOfferingId)` |
| `taskService.js:94,103,121` | `assertWriteAccess(task.classId)` | (b) | `assertCourseOfferingAccess(task.courseOfferingId, context)` |
| `taskValidation.js:7,24` | `classId: objectId.required()` in both schemas | (a) | `courseOfferingId: objectId.required()` |
| `taskController.js:12,14` | `req.query.classId` / `taskService.list(req.query.classId)` | (a) | `req.query.courseOfferingId` |

---

##### SUBMISSION module

Submission model is **UNCHANGED** — carries `taskId` + `groupId`, no `classId`. The service
derives class context by reading off the Task. After Step 7, it reads `task.courseOfferingId`.

| File | Lines | Class | Fix |
|---|---|---|---|
| `submissionService.js:6` | `require courseAssignmentService` | (b) | Replace with `courseOfferingService` or `courseOfferingRepository` |
| `submissionService.js:14-16` | `resolveStudentGroup`: `findAll({ userId, classId: task.classId })` | (a+b) | Load offering from `task.courseOfferingId` → get cohortId → `findOne({ userId, cohortId, deletedAt:null })` |
| `submissionService.js:18` | `'You are not enrolled in this class'` | (c) string | `'You are not enrolled in this cohort'` |
| `submissionService.js:29-32` | `assertInstructorAccess(classId)` / `courseAssignmentService.hasAccess` | (b) | `assertCourseOfferingAccess(task.courseOfferingId, context)` |
| `submissionService.js:105,126,151` | `assertInstructorAccess(task.classId, context)` | (b) | `assertCourseOfferingAccess(task.courseOfferingId, context)` |

---

##### FEEDBACK module

> **CURRENTLY BROKEN** — `feedbackService` reads `group.classId` which was removed in Step 6.
> Instructor access checks fail at runtime until this is fixed.

| File | Lines | Class | Fix |
|---|---|---|---|
| `feedbackService.js:5` | `require courseAssignmentService` | (b) | Replace with `courseOfferingService` |
| `feedbackService.js:18-19` | `group.classId` → `courseAssignmentService.hasAccess` | (b) | Read `group.courseOfferingId`; pass to `courseOfferingService.getById(id, context)` |
| `feedbackService.js:36-38` | `task.classId !== group.classId` validation | (a) | `task.courseOfferingId !== group.courseOfferingId` |

---

##### REPORT module

| File | Lines | Class | Fix |
|---|---|---|---|
| `reportService.js:3-4` | `require classService` + `require courseAssignmentService` | (b) | Remove both; add `courseOfferingService` |
| `reportService.js:7-10` | `assertAccess(classId)` / `courseAssignmentService.hasAccess` | (b) | `courseOfferingService.getById(id, context)` |
| `reportService.js:20-25,85-90` | `buildGroupReport/Csv(classId, courseId, context)` | (a) | Signature → `(courseOfferingId, context)`; `groupRepository.findByCourse` → `findByCourseOffering` |
| `reportService.js:59,103` | `m.attendance` on student row | (c) removed field | Load `attendanceRepository.getAttendanceMap(courseOfferingId)` once; join per student `_id` |
| `reportController.js:18-24` | `classId + courseId` query params | (a) | Single `courseOfferingId` param |

---

##### COURSE service cascade

`courseService.softDelete` currently checks **both** `classRepository.countByCourse` AND
`courseOfferingRepository.countByCourse`. Step 7 removes the Class check and `classRepository`
import, leaving only the offering guard.

---

#### Files to modify in Step 7

- `backend/src/modules/task/models/Task.js`
- `backend/src/modules/task/repositories/taskRepository.js`
- `backend/src/modules/task/services/taskService.js`
- `backend/src/modules/task/validations/taskValidation.js`
- `backend/src/modules/task/controllers/taskController.js` (query param only)
- `backend/src/modules/submission/services/submissionService.js`
- `backend/src/modules/feedback/services/feedbackService.js`
- `backend/src/modules/report/services/reportService.js`
- `backend/src/modules/report/controllers/reportController.js`
- `backend/src/modules/course/services/courseService.js`

**Proof step works:**
- Server boots clean; grep confirms zero `classId`/`Class` refs in all ten modules
- POST `/api/tasks` with `courseOfferingId` → 201
- `courseService.softDelete` blocks on active CourseOfferings (409)

---

### Phase C — Frontend Migration

---

**Step 8 — Frontend: add AcademicYears, Cohorts, CourseOfferings pages**

Files created:
- `web/src/features/academicYear/AcademicYearsPage.jsx`
- `web/src/features/academicYear/academicYearApi.js`
- `web/src/features/cohort/CohortsPage.jsx`
- `web/src/features/cohort/cohortApi.js`
- `web/src/features/courseOffering/CourseOfferingsPage.jsx`
- `web/src/features/courseOffering/courseOfferingApi.js`

Files modified:
- `web/src/app/router.jsx` — add routes: `/academic-years`, `/cohorts`, `/course-offerings`
- `web/src/components/layout/Sidebar.jsx` — update admin nav (replace "Classes" entry with "Academic Years", "Cohorts", "Offerings")
- `web/src/features/semester/SemestersPage.jsx` — add `academicYearId` selector (required field in create/edit form)
- `web/src/features/semester/semesterApi.js` — update query/mutation shapes

**Proof step works:** Admin can create an AcademicYear, create Semesters under it, create a Cohort under a Department, create a CourseOffering linking Course + Cohort + Semester + Instructor.

---

**Step 9 — Frontend: rewire Students, Groups, Scores pages**

URL shapes change:
- `/classes/:classId/students` → `/cohorts/:cohortId/students`
- `/classes/:classId/students/upload` → `/cohorts/:cohortId/students/upload`
- `/cohorts/:cohortId/scores` (new path)
- `/course-offerings/:offeringId/groups`

Files modified:
- `web/src/features/student/StudentsPage.jsx` — `classId` → `cohortId` throughout; "Clear Roster" button targets cohort
- `web/src/features/student/BulkUploadPage.jsx` — `classId` → `cohortId`
- `web/src/features/student/studentApi.js` — endpoint param updates
- `web/src/features/student/StudentDetailPage.jsx` — breadcrumb updated
- `web/src/features/group/GroupsPage.jsx` — single `courseOfferingId` selector replaces `classId + courseId` pair; "Delete All" targets offering
- `web/src/features/group/GroupDetailPage.jsx` — references updated
- `web/src/features/group/groupApi.js` — all params updated
- `web/src/features/performance/ScoresPage.jsx` — scope changes from `classId` to `cohortId`; attendance is now read from Attendance records per offering (see open question in Section 9 about UX split)
- `web/src/features/performance/performanceApi.js` — recalculate endpoint path update
- `web/src/pages/DashboardPage.jsx` — admin stat cards updated (Class count → CourseOffering count, etc.); instructor cards now show CourseOffering-scoped data
- `web/src/features/dashboard/dashboardApi.js` — endpoint shapes updated

**Proof step works:** End-to-end: upload students to a cohort, generate groups for a course offering, view balance summary, adjust group, view workspace.

---

### Phase D — Removal

---

**Step 10 — Remove Class and CourseAssignment entirely**

Files deleted:
- `backend/src/modules/class/` — entire folder
- `backend/src/modules/courseAssignment/` — entire folder
- `web/src/features/class/` — entire folder
- `web/src/features/courseAssignment/` — entire folder (InstructorsPage instructor-account section is preserved — see Step 10 note below)

Files modified:
- `backend/src/app.js` — unmount `/api/classes`, `/api/course-assignments`
- `web/src/app/router.jsx` — remove old class-scoped routes
- `web/src/components/layout/Sidebar.jsx` — remove any lingering "Classes" nav entry

> **Step 10 Note — InstructorsPage:** The current `InstructorsPage.jsx` contains two concerns:
> (1) Instructor account management (register, activate/deactivate, edit) — this is kept and moved to `web/src/features/user/InstructorsPage.jsx`.
> (2) Course assignment table — this is removed. Instructor assignment now happens in CourseOfferingsPage when creating/editing an offering.

**Proof step works:** Backend starts with no errors. All old routes return 404. New routes all function correctly. Frontend has no dead imports.

---

### Phase E — Seed

---

**Step 11 — Fresh seed script + data wipe**
See Section 8 for full spec.

Files created:
- `backend/src/scripts/seedDemo.js` — one script that wipes and repopulates demo data

Run: `node backend/src/scripts/seedDemo.js`

**Proof step works:** After seed, admin logs in → dashboard shows 3 active CourseOfferings; generate groups for "Databases" offering → 15 groups of 4; balance summary shows expected distribution.

---

## SECTION 6 — API ENDPOINT SHAPE

### New Endpoints

#### Academic Years — `/api/academic-years`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Admin | List all academic years |
| POST | `/` | Admin | Create. Body: `{ name, startDate, endDate }` |
| GET | `/:id` | Admin | Get one |
| PATCH | `/:id` | Admin | Update name/dates/status |
| DELETE | `/:id` | Admin | Soft-delete (blocked if has active Semesters) |

#### Semesters — `/api/semesters` (modified)
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/` | Admin | Body now: `{ name, academicYearId, startDate, endDate }` — `year` removed |
| PATCH | `/:id` | Admin | `year` field gone; `academicYearId` editable |

#### Cohorts — `/api/cohorts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Admin | List all cohorts. `?departmentId=` filter |
| POST | `/` | Admin | Create. Body: `{ name, departmentId, yearOfEntry?, description? }` |
| GET | `/:id` | Admin, Instructor | Get one |
| PATCH | `/:id` | Admin | Update |
| DELETE | `/:id` | Admin | Soft-delete (blocked if has active Students or CourseOfferings) |

#### Course Offerings — `/api/course-offerings`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Admin, Instructor | List. Admin: all. Instructor: only own (where `instructorId` matches). `?cohortId=`, `?semesterId=` filters |
| POST | `/` | Admin | Create. Body: `{ courseId, cohortId, semesterId, instructorId, maxStudents? }` |
| GET | `/:id` | Admin, Instructor | Get one (includes cohort, course, semester, instructor) |
| PATCH | `/:id` | Admin | Update instructor, maxStudents, status |
| DELETE | `/:id` | Admin | Soft-delete (blocked if has active Groups or Attendance records) |

#### Attendance — `/api/attendance`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Admin, Instructor | List for an offering. Requires `?courseOfferingId=` |
| POST | `/` | Admin, Instructor | Create record. Body: `{ studentId, courseOfferingId, percentage }` |
| PATCH | `/:id` | Admin, Instructor | Update percentage |
| DELETE | `/:id` | Admin | Soft-delete |
| POST | `/bulk` | Admin, Instructor | Bulk upsert. See below. |

**A2 — Bulk attendance safety pattern (approved adjustment):**
`POST /api/attendance/bulk` follows the same idempotent safety contract as bulk student upload:
- Body: `{ courseOfferingId, records: [{ studentId, percentage }] }`
- Per record: if Attendance record already exists for `(studentId, courseOfferingId)` → update (counted as `updated`); if not → create (counted as `created`); if `studentId` is not in the cohort → `failed` with reason; if `percentage` is out of range → `failed`.
- Response: `{ created: [...], updated: [...], skipped: [...], failed: [{ studentId, reason }] }`
- A `skipped` row means the record exists AND the percentage is unchanged (true no-op).
- The entire batch is processed row-by-row; one failure does not abort the rest.

---

### Changed Endpoints — Before / After

#### Students
| Endpoint | Before | After |
|---|---|---|
| GET `/api/students` | `?classId=` | `?cohortId=` |
| POST `/api/students` | body: `{ classId, ... }` | body: `{ cohortId, ... }` |
| POST `/api/students/bulk-upload` | form field: `classId` | form field: `cohortId` |
| DELETE `/api/students` | `?classId=` | `?cohortId=` |

#### Groups
| Endpoint | Before | After |
|---|---|---|
| GET `/api/groups` | `?classId=&courseId=` | `?courseOfferingId=` |
| POST `/api/groups/generate` | body: `{ classId, courseId, groupSize, options }` | body: `{ courseOfferingId, groupSize, options }` |
| POST `/api/groups/regenerate` | body: `{ classId, courseId, groupSize, options }` | body: `{ courseOfferingId, groupSize, options }` |
| DELETE `/api/groups` | `?classId=&courseId=` | `?courseOfferingId=` |

#### Performance
| Endpoint | Before | After |
|---|---|---|
| POST `/api/performance/recalculate/class/:id` | `classId` param | `/api/performance/recalculate/cohort/:cohortId` |

#### Tasks
| Endpoint | Before | After |
|---|---|---|
| POST `/api/tasks` | body includes `classId, courseId` | body includes `courseOfferingId` |
| GET `/api/tasks` | `?classId=&courseId=` | `?courseOfferingId=` |

---

### Removed Endpoints
```
GET    /api/classes
POST   /api/classes
GET    /api/classes/:id
PATCH  /api/classes/:id
DELETE /api/classes/:id

GET    /api/course-assignments
POST   /api/course-assignments
GET    /api/course-assignments/:id
DELETE /api/course-assignments/:id
```

---

## SECTION 7 — FRONTEND CHANGES (SCREEN BY SCREEN)

### Login — **KEEP AS-IS**
No changes.

### ChangePasswordPage — **KEEP AS-IS**
No changes.

### DashboardPage — **MODIFY**

**Admin view changes:**
- Stat cards: replace "Classes" count with "Cohorts" count + "Course Offerings" count
- "Recent Classes" table → "Active Course Offerings" table (shows course name, cohort, semester, instructor, group status)
- Remove any reference to `classId` or `CourseAssignment`

**Instructor view changes:**
- Replaces class cards with offering cards. Each card shows: course name, cohort name, semester, student count, group count, quick links to Students, Groups, Attendance
- Data source: GET `/api/course-offerings` (scoped to instructor)
- Stat cards: "My Offerings", "Students", "Active Groups", "Pending Submissions"

**Student view:** No change — already shows workspace cards scoped to groups.

### FacultiesPage — **KEEP AS-IS**
### DepartmentsPage — **KEEP AS-IS**
### CoursesPage — **KEEP AS-IS**

### SemestersPage — **MODIFY**
- Create/edit form: replace `year` number input with `academicYearId` dropdown (populated from GET `/api/academic-years`)
- Table: replace "Year" column with "Academic Year" column
- No other changes

### AcademicYearsPage — **NEW**
Admin-only. Standard CRUD table: Name, Start Date, End Date, Status, # Semesters.
Create dialog: Name (e.g. "2025/2026"), Start Date, End Date.
Status chip: Active (green) / Completed (grey) / Archived (muted).
Delete: blocked if Semesters exist — friendly error.

### CohortsPage — **NEW**
Admin-only. Table: Name, Department, Year of Entry, # Students, # Offerings.
Create dialog: Name, Department (dropdown), Year of Entry (optional).
Filter by Department.
Delete: blocked if active Students or Offerings.

### CourseOfferingsPage — **NEW**
Admin-only and Instructor (read-only for instructors viewing their own offerings).

Admin view: full CRUD table scoped by Cohort + Semester (two dropdowns at top).
Columns: Course, Cohort, Semester, Instructor, Status, # Groups.
Create dialog: Course (dropdown), Cohort (dropdown), Semester (dropdown), Instructor (dropdown, role=instructor), Max Students (optional).
Edit: can change Instructor, MaxStudents, Status.
Delete: blocked if active Groups or Attendance.

Instructor view: read-only list of their own offerings.

### InstructorsPage (user management section) — **KEEP; RENAME/MOVE**
The instructor ACCOUNT management table (register, edit, activate/deactivate) is preserved. It moves from `features/courseAssignment/InstructorsPage.jsx` to `features/user/InstructorsPage.jsx`.
The "Course Assignments" section is REMOVED — instructor assignment is now part of CourseOfferings CRUD.

### StudentsPage — **MODIFY**
URL changes from `/classes/:classId/students` to `/cohorts/:cohortId/students`.

Logic changes:
- `classId` param → `cohortId`
- API call: GET `/api/students?cohortId=`
- "Clear Roster" button: DELETE `/api/students?cohortId=`
- Single create: body `{ cohortId, studentId, ... }`
- Breadcrumb: Classes / ClassName → Cohorts / CohortName

No change to column shape (Student ID, Full Name, Avg Score, Category, Actions).

> **Attendance column removed from this page.** Attendance is now per-offering and is managed on the CourseOfferingsPage or a dedicated Attendance sub-page. See Section 9 — open question.

### BulkUploadPage — **MODIFY**
URL: `/cohorts/:cohortId/students/upload`
Form field: `cohortId` instead of `classId`.
Everything else (drag-drop, CSV format hint, result tabs: created/transferred/skipped/failed) unchanged.

### StudentDetailPage — **MODIFY**
Breadcrumb: cohort link instead of class link.
Performance data display: unchanged (averageScore, category stay on Student).
Attendance display: if shown, links to offering-specific Attendance records.

### ScoresPage — **MODIFY**
URL: `/cohorts/:cohortId/scores`

This page currently edits both `averageScore` and `attendance` together. With the new model, these are separate concerns:
- `averageScore` is Student-level (cohort-level) — stays on this page, editable here.
- `attendance` is per-offering — **removed from this page**; managed via a dedicated Attendance sub-page within CourseOfferingsPage.

So this page becomes a **cohort scores page**: shows all students in the cohort with their `averageScore`, inline editable, with "Recalculate All" button calling `/api/performance/recalculate/cohort/:cohortId`.

### AttendancePage — **NEW** (or sub-section of CourseOfferingsPage)
Shows all students in the cohort alongside their attendance % for a specific offering.
Inline editable. Backed by GET/POST/PATCH `/api/attendance?courseOfferingId=`.
Could live at `/course-offerings/:offeringId/attendance`.

### GroupsPage — **MODIFY**
URL: `/course-offerings/:offeringId/groups`

The two-dropdown selector (`classId` + `courseId`) collapses into a single `courseOfferingId` (already implied by the URL param — no selector needed if accessed from the Offering page).
Course selector at top becomes optional context display (showing offering details: "Databases — CA226 — Semester 7").
Generate/Regenerate/Delete All buttons: use `courseOfferingId`.
Group cards: unchanged in shape.

### GroupDetailPage — **MODIFY**
URL: `/groups/:id` (unchanged)
`classId` and `courseId` internal references → `courseOfferingId`.
Breadcrumb updated.
"Add member" panel: queries students from `cohortId` (derived from offering).

### PerformanceSettingsPage — **KEEP AS-IS**
No changes.

### WorkspaceDetailPage — **KEEP AS-IS**
Group → workspace relationship unchanged.

### Router — **MODIFY**
```
OLD routes removed:
  /classes
  /classes/:classId/students
  /classes/:classId/students/upload
  /students/:id        (keep, just breadcrumb updates)
  /classes/:classId/groups
  /groups/:id          (keep)
  /classes/:classId/scores
  /instructors         (keep; component changes)

NEW routes added:
  /academic-years
  /cohorts
  /cohorts/:cohortId/students
  /cohorts/:cohortId/students/upload
  /cohorts/:cohortId/scores
  /course-offerings
  /course-offerings/:offeringId/groups
  /course-offerings/:offeringId/attendance
```

### Sidebar — **MODIFY**

**A3 — Sidebar grouping (approved adjustment):**
The sidebar uses grouped headers (~10 nav items). Groups and order are locked:

```
DASHBOARD
  Dashboard

ACADEMIC STRUCTURE
  Faculties
  Departments
  Courses
  Academic Years
  Semesters

OPERATIONS
  Cohorts
  Course Offerings

USERS
  Instructors

SETTINGS
  Performance
```

**Instructor nav:** Dashboard + "My Offerings" (links to `/course-offerings`, scoped to instructor). No other nav items.

---

## SECTION 8 — SEED SCRIPT SPEC

The seed script (`backend/src/scripts/seedDemo.js`) performs:
1. Wipe all collections except User (to preserve the admin account)
2. Wipe student-role Users (they'll be recreated)
3. Create demo data in dependency order

### Data Created

**Users:**
- Admin: `admin@groupformation.local` / `Admin@123456` (preserved if already exists)
- Instructor 1: `dr.hassan@just.edu.so` / `Inst@12345` — Dr. Hassan Abdi
- Instructor 2: `dr.farah@just.edu.so` / `Inst@12345` — Dr. Farah Nuur
- Instructor 3: `dr.amina@just.edu.so` / `Inst@12345` — Dr. Amina Warsame

**Academic Structure:**
- Faculty: "Faculty of Engineering and Technology"
- Department: "Software Engineering" (under the faculty)
- Courses (under Software Engineering):
  - Databases (DB401)
  - Computer Networks (NET301)
  - Software Project (SP501)
  - Web Development (WD201)
  - Artificial Intelligence (AI401)

**Academic Year:**
- Name: "2025/2026"
- Start: 2025-09-01 / End: 2026-06-30
- Status: active

**Semesters (under 2025/2026):**
- Semester 6: startDate 2025-09-01, endDate 2026-01-31, status: completed
- Semester 7: startDate 2026-02-01, endDate 2026-06-30, status: active

**Cohort:**
- Name: "CA226"
- Department: Software Engineering
- yearOfEntry: 2022

**Students in CA226 (60 total):**

Spread across performance categories:
- 15 HIGH: averageScore 78–95 (random within range)
- 25 MEDIUM: averageScore 51–74
- 15 LOW: averageScore 20–49
- 5 UNGRADED: averageScore = null

Each student gets:
- A real-looking Somali name (first name + last name)
- studentId: "2022SWXXXX" format (padded sequential)
- User account with `mustChangePassword: true`
- Temp password: `Temp@{4-digit-number}`

**PerformanceSettings:** high=75, medium=50 (defaults)

**Course Offerings — Semester 7 (active):**
1. Databases (DB401) — CA226 — Semester 7 — Instructor: Dr. Hassan
2. Computer Networks (NET301) — CA226 — Semester 7 — Instructor: Dr. Farah
3. Software Project (SP501) — CA226 — Semester 7 — Instructor: Dr. Amina

**Attendance — Semester 7 offerings:**
For each of the 3 Semester 7 offerings, create Attendance records for all 60 students:
- Attendance % randomised: roughly 70% of students above 25% threshold, 30% below

**Course Offerings — Semester 6 (completed, optional history):**
4. Web Development (WD201) — CA226 — Semester 6 — Instructor: Dr. Hassan
5. AI (AI401) — CA226 — Semester 6 — Instructor: Dr. Farah

For Semester 6 offerings, generate one set of groups (groupSize=4, archived after generation) to populate GroupHistory — this lets Semester 7 generation avoid repeating pairs from Semester 6.

**Groups — Semester 6 (for history only):**
Run the GroupGenerationService programmatically for WD201 and AI401 offerings. Save groups as archived and write GroupHistory. This demonstrates cross-semester pair-avoidance.

---

## SECTION 9 — RISKS AND OPEN QUESTIONS (RESOLVED)

All questions below were resolved during the approval review on 2026-06-15.

**1. MODEL_REVISION_v2.md does not exist. → RESOLVED**
Document not present in repository. `SYSTEM_OVERVIEW.md` and the locked decisions in the refactor prompt are the authoritative source. No further action needed.

**2. Attendance UX: one page or two? → RESOLVED: TWO PAGES**
ScoresPage stays cohort-level (averageScore only). Attendance becomes a dedicated per-offering page reached from the CourseOffering detail view. The two concerns are structurally separate and the UX reflects that.

**3. GroupHistory cross-semester pair-avoidance → RESOLVED: COHORT-LEVEL HISTORY**
The grouping engine reads GroupHistory across ALL offerings for the same `cohortId` — not scoped to a single offering or course. When CA226 takes any course in any semester, the engine sees pairings from every prior offering CA226 has had. `groupHistoryRepository` must support a `findByCohort(cohortId)` query. GroupHistory documents will store `cohortId` as a queryable field.

**4. Default attendance when no record exists → RESOLVED: DEFAULT = 0**
If a student has no Attendance record for the offering being grouped, the engine treats them as 0% attendance — placing them in the low-attendance scatter group. This is the safe default (never inflates attendance).

**5. Workspace enrichment → RESOLVED**
`workspaceService.findForStudent()` is updated in Step 6 to use `courseOfferingId` for task/submission bulk lookup. Each workspace resolves its offering via `group.courseOfferingId`.

**6. One-active-cohort rule → RESOLVED: KEEP**
`{ userId: 1 }` partial unique index is preserved. One active cohort membership per user. Dual-enrollment is out of scope.

**7. One instructor per offering → RESOLVED: ONE INSTRUCTOR**
`instructorId: ObjectId → User` (scalar, not array). No co-teaching.

**8. Cascade-delete UI warning → RESOLVED: DEFER**
Block-on-children errors at each service layer are sufficient. UI warning surfacing the dependency chain is a future polish item, not part of this refactor.

**9. Seed timing → RESOLVED**
Seed runs at Step 11, after all backend and frontend steps complete. The seed script is the last action of the refactor.

**10. hasAccess() audit → RESOLVED: EXPLICIT STEP 6 REQUIREMENT**
Step 6 proof criteria include a documented audit of every caller of `courseAssignmentService.hasAccess()` in the current codebase. For each caller, the replacement CourseOffering-based check must be shown. The step is not complete until this audit is written out and confirmed. Callers identified so far: `studentService`, `groupService`, `workspaceService`. Full audit at Step 6 time.

---

## SECTION 10 — TIME ESTIMATE

| Step | Description | Estimate |
|---|---|---|
| 1 | Add new Mongoose models | 2 h |
| 2 | Add repositories, services, validations | 4 h |
| 3 | Add new CRUD endpoints + wire to app.js | 4 h |
| 4 | Update Semester model (academicYearId, new index) | 1.5 h |
| 5 | Update Student (cohortId, remove attendance, indexes, enrollment service) | 4 h |
| 6 | Update Group, GroupHistory, groupService, workspaceService | 5 h |
| 7 | Update Task + courseService cascade check | 1.5 h |
| 8 | Frontend: AcademicYears, Cohorts, CourseOfferings pages | 8 h |
| 9 | Frontend: rewire Students, Groups, Scores, Dashboard | 7 h |
| 10 | Remove Class, CourseAssignment (backend + frontend) | 3 h |
| 11 | Seed script (60 students + history) | 3 h |
| Buffer | Integration testing, debugging, edge cases | 6 h |
| **Total** | | **~49 h** |

**Honest assessment: this is a 7–10 day refactor** for a single developer working focused sessions of 5–6 hours/day. The Phase B model swap (Steps 4–7) is the riskiest block and should be done in one continuous session without interruption. Phase C (frontend) is the most time-consuming in absolute hours but carries less risk since it is a mechanical rewiring of existing patterns.

**Critical path:** Steps 4–7 must complete together before anything can be tested end-to-end. If Step 5 (Student → Cohort) finishes but Step 6 (Group → CourseOffering) does not, the system cannot be verified. Budget a full uninterrupted day for Steps 4–7 as a batch.

**Minimum viable checkpoint:** After Step 3, the system is fully functional with both old and new endpoints live. This is the last safe stopping point before the breaking changes begin. If time or priorities change, the team can pause here, ship what exists, and resume with Steps 4–7 later.

---

*End of REFACTOR_PLAN_v3.md*
*Nothing in this document is code. No files have been modified. Awaiting user and mentor approval before Step 1.*
