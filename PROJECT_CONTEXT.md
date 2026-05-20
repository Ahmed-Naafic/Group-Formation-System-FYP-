claude --version# PROJECT CONTEXT — Advanced Automated Student Group Formation System

> **CRITICAL — READ THIS FIRST**
>
> This document is the **single source of truth** for this project. Every architectural decision, every constraint, every phase plan is captured here.
>
> **For Claude Code (or any AI assistant working on this project):**
> 1. Read this entire document before generating any code.
> 2. Do not deviate from the decisions locked in this document.
> 3. If you believe a different approach is better, **stop, explain your reasoning, and ask for approval before changing course**.
> 4. Build **one phase at a time**. Do not skip ahead.
> 5. Within a phase, build **one module at a time**, fully completing each before starting the next.
> 6. Within a module, build **bottom-up**: model → repository → service → validation → controller → routes → wire-up.
> 7. **No frontend code.** Backend only.
> 8. After each phase, **stop and wait** for the user to test the APIs in Insomnia before continuing.

---

## 1. PROJECT OVERVIEW

### 1.1 What We're Building

A full-stack academic collaboration platform whose **core intelligence** is automated, balanced student group formation based on academic performance and attendance data. Around this core sits a complete ecosystem: collaborative workspaces, file sharing, real-time chat, task management, notifications, feedback, and audit logging.

### 1.2 The Two Clients

| Client | Technology | Users |
|--------|-----------|-------|
| Web app | ReactJS | Admin, Instructor |
| Mobile app | Flutter | Student only |

**This project covers the backend only.** Frontend is built separately, later.

### 1.3 Backend Technology Stack

- **Runtime:** Node.js (v18+, ideally v20 LTS)
- **Framework:** Express.js
- **Database:** MongoDB (Atlas cloud or local)
- **ODM:** Mongoose
- **Authentication:** JSON Web Tokens (JWT)
- **Password hashing:** bcryptjs
- **File uploads:** Multer
- **Real-time:** Socket.IO (for chat and notifications)
- **Validation:** Joi
- **Logging:** Winston
- **Security:** Helmet, CORS, express-rate-limit
- **CSV/Excel parsing:** csv-parser, xlsx

### 1.4 Knowledge Cutoff Reminder

Always use **current stable versions** of libraries. Verify versions when installing.

---

## 2. LOCKED ARCHITECTURAL DECISIONS

These decisions are **final**. Do not change them without explicit user approval.

### 2.1 Three Roles Only

The system has **exactly three** user roles:

| Role | Login via | Client | Scope of authority |
|------|-----------|--------|--------------------|
| `admin` | Email + password | Web | Full system control |
| `instructor` | Email + password | Web | Their assigned classes only |
| `student` | Student ID + password | Mobile | Their own group only |

**No "class monitor" role.** Class monitor was considered and explicitly rejected to protect privacy of instructor-only data.

### 2.2 Role Permissions Matrix

| Action | Admin | Instructor | Student |
|--------|:-----:|:----------:|:-------:|
| Create faculty / department / course / class | ✅ | ❌ | ❌ |
| Register instructors | ✅ | ❌ | ❌ |
| Manage semesters | ✅ | ❌ | ❌ |
| Upload students (CSV/Excel) | ✅ | ✅ (own classes) | ❌ |
| Manage attendance | ✅ | ✅ (own classes) | ❌ |
| Manage scores | ✅ | ✅ (own classes) | ❌ |
| Generate groups | ✅ | ✅ (own classes) | ❌ |
| Assign tasks | ✅ | ✅ (own classes) | ❌ |
| Grade submissions | ✅ | ✅ (own classes) | ❌ |
| Send notifications | ✅ | ✅ | ❌ |
| View own group | N/A | N/A | ✅ |
| Access workspace | N/A | ✅ (own classes) | ✅ (own group only) |
| Upload files to workspace | ✅ | ✅ | ✅ (own group only) |
| Chat in workspace | ❌ | ✅ (own classes) | ✅ (own group only) |
| Submit tasks | ❌ | ❌ | ✅ |
| View own notifications | ✅ | ✅ | ✅ |
| View audit logs | ✅ | ❌ | ❌ |
| Export reports | ✅ | ✅ (own classes) | ❌ |

### 2.3 Feature-Based Modular Architecture

**Modules are organized by business domain, not by user role.** A role-based folder structure (admin/, instructor/, student/) is explicitly forbidden — it causes duplication, tight coupling, and makes microservice extraction impossible.

### 2.4 Module Internal Pattern — Service + Repository

Every module follows this internal structure:

```
module-name/
├── controllers/       ← HTTP layer (thin, no business logic)
├── services/          ← Business logic (the brain)
├── repositories/      ← Database access (the only place queries live)
├── models/            ← Mongoose schemas
├── validations/       ← Joi schemas for request validation
└── routes/            ← Express route definitions
```

**Strict layering rule:**
- Controllers call Services
- Services call Repositories (and other Services when needed)
- Repositories call Models
- **Never skip layers. Never reverse direction.**

### 2.5 No Cross-Module Model Access

A module **must not** import another module's Mongoose model directly. If module A needs data owned by module B, it calls **module B's service**. This is the single most important rule for long-term maintainability.

**Example:** The `grouping` module needs student data. It must call `studentService.getStudentsByClass(classId)` — it must **not** `require('../student/models/Student')`.

### 2.6 Soft Delete Everywhere

Every domain model includes:
- `deletedAt: Date | null` (default: `null`)
- `deletedBy: ObjectId | null` (default: `null`)

A reusable Mongoose plugin (`src/common/plugins/softDelete.js`) attaches these fields and provides:
- `.softDelete(userId)` instance method
- `.restore()` instance method
- A pre-find hook that excludes soft-deleted docs by default
- An `.includeSoftDeleted()` query helper for admin access

**Hard delete is reserved for admins only, and only in extreme cases.**

### 2.7 Single-Tenant Now, Multi-Tenant Upgrade Path Preserved

The system serves **one institution** for now. Multi-tenancy is **not implemented** but the architecture is designed so that it can be added later with minimal pain:

- **Faculty is the root** of the academic hierarchy. If multi-tenancy is added later, an `Institution` collection is added *above* Faculty; only Faculty needs `institutionId` — everything below inherits scope via the hierarchy.
- **Request context** (`req.context`) is centralized in auth middleware
. Adding `institutionId` later means one change.
- **Repository pattern** ensures that adding tenant scoping later touches one file per module, not scattered query sites.

Mark in code with `// TODO(multi-tenant)` comments at three places when relevant: Faculty model, auth middleware, request context.

### 2.8 Storage Abstraction From Day One

File uploads (workspace files, task attachments, submissions) go through a **`StorageService` interface** in `src/common/services/storage/`. The first implementation is **local disk** (`uploads/` folder). Later swap to S3/Cloudinary by writing a new implementation — modules don't change.

### 2.9 Centralized Request Context

After the auth middleware runs, every request carries:

```javascript
req.context = {
  userId: ObjectId,
  role: 'admin' | 'instructor' | 'student',
  studentId: string | null,  // only for students
  // TODO(multi-tenant): institutionId
}
```

This is the **only** place downstream code reads user identity from. Never read JWT payload directly in services or controllers.

### 2.10 Uniform Response Shape

Every successful response:
```json
{
  "success": true,
  "data": {...},
  "message": "Optional human-readable message",
  "meta": { "pagination": {...} }
}
```

Every error response:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_CONSTANT",
    "message": "Human-readable message",
    "details": [...]
  }
}
```

**No endpoint deviates from this shape, ever.**

### 2.11 Global Error Handling

- All custom errors extend `AppError` (which extends `Error`).
- Concrete errors: `BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `ValidationError`, `InternalError`.
- Services and controllers **throw** errors. They never format responses for errors.
- One global error handler middleware (the last one mounted) formats every error into the standard error shape.
- Async controllers are wrapped with `asyncHandler` so errors auto-propagate.

### 2.12 Validation Library — Joi

Joi is used for:
1. Environment variable validation on startup
2. Request body / query / params validation

Each module has a `validations/` folder with one Joi schema per endpoint.

### 2.13 Logger — Winston

Structured logging with Winston. Pretty output in development, JSON in production. Logs go to console always; file transport in production.

### 2.14 Student Authentication & Auto-Creation Flow

**Critical flow — read carefully.**

#### 2.14.1 Login Identifier
- Admins and instructors log in by **email**.
- Students log in by **Student ID** (institutional ID).
- The User model has both `email` (unique sparse) and `studentId` (unique sparse).
- The login endpoint accepts an `identifier` field and resolves it intelligently.

#### 2.14.2 Bulk Student Upload Flow

When an instructor uploads a CSV/Excel of students for a class:

1. File received and parsed (format-agnostic via a mapper — actual columns specified later by user).
2. For **each row**, in a transaction:
   - Generate a readable random password (e.g. `Mango7-Tiger` — easy to type, ~10 chars)
   - Hash with bcrypt (rounds = 12)
   - Create a `User` document:
     ```
     {
       studentId: <from row>,
       role: "student",
       passwordHash: <hash>,
       mustChangePassword: true,
       email: null
     }
     ```
   - Create a `Student` document:
     ```
     {
       userId: <ref>,
       classId: <target class>,
       fullName: <from row>,
       attendance: 0,
       scores: { midterm: null, final: null, coursework: null },
       totalScore: null,
       performanceCategory: null,
       hasBeenLeader: false
     }
     ```
   - Collect `{ studentId, fullName, tempPassword }` for the response.
3. Return structured response:
   ```json
   {
     "success": true,
     "data": {
       "created": [
         { "studentId": "CS2025001", "fullName": "...", "tempPassword": "Mango7-Tiger" }
       ],
       "skipped": [
         { "studentId": "CS2025002", "reason": "already exists in this class" }
       ],
       "failed": [
         { "row": 47, "reason": "missing studentId field" }
       ]
     }
   }
   ```
4. Plaintext passwords appear in this response **exactly once**. Never stored, never logged, never returned again.

#### 2.14.3 Idempotency

Re-uploading the same file produces:
- Already-existing students → `skipped`
- New students → `created`
- Malformed rows → `failed`

No duplicates. Detection by `studentId` within the same `classId`.

#### 2.14.4 First-Login Forced Password Change

When a student logs in with `mustChangePassword: true`:

1. Backend issues a **limited JWT** scoped to the password-change endpoint only.
2. All other endpoints reject this limited JWT.
3. Student submits new password.
4. Backend hashes, stores, sets `mustChangePassword: false`.
5. Backend issues a **full JWT** with normal scope.

The same flow handles **instructor-initiated password resets** — no separate code path.

#### 2.14.5 Password Reset

Students cannot self-reset (no email). Instructors trigger reset:
- Instructor clicks "Reset password" for a student.
- Backend generates new temp password, sets `mustChangePassword: true`, returns plaintext password to instructor once.
- Student logs in with new temp password → forced change flow runs again.

### 2.15 Single Login Endpoint

`POST /api/auth/login` accepts:
```json
{ "identifier": "...", "password": "..." }
```

The service determines whether `identifier` is an email (admin/instructor) or a student ID, and looks up accordingly.

### 2.16 CSV/Excel Student Upload Format — FINAL SPEC ✅ LOCKED

**Supported formats:** `.csv` and `.xlsx` (both processed through the same format-agnostic column mapper)

**Header row:** REQUIRED. Column name matching is case-insensitive.

**Columns:**

| Column | Required | Type | Notes |
|--------|:--------:|------|-------|
| `studentId` | ✅ | string | Unique within the class |
| `fullName` | ✅ | string | |
| `midterm` | optional | number | RAW POINTS only. Blank → stored as `null` |
| `final` | optional | number | RAW POINTS only. Blank → stored as `null` |
| `coursework` | optional | number | RAW POINTS only. Blank → stored as `null` |
| `attendance` | optional | number | Percentage 0–100. Blank → defaults to `0` |
| `email` | optional | string | Usually blank for students |

**Score scale — critical rule:**
- All scores are entered as **RAW POINTS only**. Never percentages.
- Maximum marks for midterm / final / coursework are configured by the admin in the `PerformanceSettings` collection and can be changed at any time.
- Percentage conversion is **computed by the system** in Phase 5. It is never entered in the file.

**Class assignment:** Determined by the upload request (which class the instructor selects in the UI). There is no `classId` column in the file.

**Passwords:** Auto-generated by the system. Never present in the file.

**Parsing rules:**
- Blank score fields → stored as `null` (never as `0`)
- Blank attendance → stored as `0`
- Row missing `studentId` or `fullName` → added to `failed` array
- `studentId` already exists in the same class → added to `skipped` array (idempotent re-upload)
- The column mapper is a separate pluggable module — column names can be remapped later without rewriting parsing logic

---

## 3. FOLDER STRUCTURE

```
group-formation-system/
│
├── src/
│   ├── config/
│   │   ├── env.js
│   │   └── db.js
│   │
│   ├── common/
│   │   ├── constants/
│   │   ├── helpers/
│   │   ├── utils/
│   │   │   ├── logger.js
│   │   │   ├── asyncHandler.js
│   │   │   └── passwordGenerator.js
│   │   ├── validators/
│   │   ├── responses/
│   │   │   └── apiResponse.js
│   │   ├── errors/
│   │   │   ├── AppError.js
│   │   │   ├── index.js
│   │   │   └── errorCodes.js
│   │   ├── plugins/
│   │   │   └── softDelete.js
│   │   └── services/
│   │       └── storage/
│   │           ├── StorageService.js   ← interface
│   │           └── LocalStorage.js     ← first implementation
│   │
│   ├── middleware/
│   │   ├── errorHandler.js
│   │   ├── notFound.js
│   │   ├── auth.js                     ← (Phase 2)
│   │   ├── rbac.js                     ← (Phase 2)
│   │   └── requestContext.js           ← (Phase 2)
│   │
│   ├── modules/
│   │   ├── auth/
│   │   ├── user/
│   │   ├── faculty/
│   │   ├── department/
│   │   ├── course/
│   │   ├── semester/
│   │   ├── class/
│   │   ├── student/
│   │   ├── enrollment/
│   │   ├── performance/
│   │   ├── attendance/
│   │   ├── group/
│   │   ├── grouping/          ← isolated grouping engine
│   │   ├── workspace/
│   │   ├── chat/
│   │   ├── file/
│   │   ├── task/
│   │   ├── submission/
│   │   ├── notification/
│   │   ├── feedback/
│   │   ├── evaluation/
│   │   ├── report/
│   │   ├── auditLog/
│   │   └── dashboard/
│   │
│   ├── sockets/                ← Socket.IO setup (Phase 7)
│   │   └── index.js
│   │
│   ├── uploads/                ← gitignored
│   │
│   └── app.js
│
├── .env.example
├── .env                        ← gitignored
├── .gitignore
├── package.json
├── server.js
├── PROJECT_CONTEXT.md          ← this file
└── README.md
```

---

## 4. THE 9 DEVELOPMENT PHASES

Build in this exact order. **Do not skip ahead.** Each phase ends with a testing checkpoint in Insomnia before the next phase begins.

### Phase 1 — Foundation ✅ COMPLETE & TESTED

**Goal:** Skeleton that boots cleanly, connects to MongoDB, has error handling and response utilities ready.

**Files:**
- `package.json` + dependencies
- `.env.example`, `.gitignore`
- `server.js`, `src/app.js`
- `src/config/env.js`, `src/config/db.js`
- `src/common/utils/logger.js`, `src/common/utils/asyncHandler.js`
- `src/common/errors/` (3 files)
- `src/common/responses/apiResponse.js`
- `src/common/plugins/softDelete.js`
- `src/middleware/errorHandler.js`, `src/middleware/notFound.js`
- `README.md`

**Dependencies (production):** `express`, `mongoose`, `dotenv`, `cors`, `helmet`, `morgan`, `winston`, `joi`, `compression`

**Dependencies (dev):** `nodemon`

**Tests in Insomnia:**
1. `GET /health` → 200, standard success shape
2. `GET /does-not-exist` → 404, standard error shape
3. Malformed JSON POST → 400, standard error shape
4. MongoDB disconnection reflected in `/health`

### Phase 2 — Authentication & RBAC ✅ COMPLETE & TESTED

**Goal:** User model, login (both email and studentId paths), JWT, role middleware, request context.

**Modules built:** `auth/`, `user/`

**Key features:**
- User model with `email`, `studentId`, `passwordHash`, `role`, `mustChangePassword`
- `POST /api/auth/login` — accepts `identifier` field
- `POST /api/auth/change-password` — works with limited JWT
- `GET /api/auth/me` — returns current user
- `POST /api/auth/logout` — token blacklist or client-side discard (decide during phase)
- Auth middleware: extracts JWT, attaches `req.context`
- RBAC middleware: `requireRole('admin')`, `requireRole('admin', 'instructor')`
- Limited-scope JWT for first-login flow
- Initial admin seed script (one admin account created on first run)

**Dependencies added:** `bcryptjs`, `jsonwebtoken`

**Tests in Insomnia:**
1. Login as seeded admin → returns JWT
2. Access protected route without JWT → 401
3. Access protected route with wrong role → 403
4. Forced password change flow works end-to-end

### Phase 3 — Academic Structure ✅ COMPLETE & TESTED

**Goal:** Admin-only management of Faculty, Department, Course, Semester, Class.

**Modules built:** `faculty/`, `department/`, `course/`, `semester/`, `class/`

**Key constraints:**
- All endpoints require `admin` role.
- Class assignment to instructor happens here — admin assigns instructor to class.
- Validation enforces hierarchy: Department must belong to existing Faculty, etc.

**Tests in Insomnia:**
- Full CRUD on each entity
- Hierarchy enforcement (can't create department under non-existent faculty)
- Instructor cannot access these endpoints → 403

### Phase 4 — Student Management

**Goal:** Manual student CRUD, bulk CSV/Excel upload with auto-creation, attendance management, score management.

**Modules built:** `student/`, `enrollment/`, `attendance/`, plus auth integration for student auto-creation

**Key features:**
- `POST /api/students` — single manual creation (admin/instructor)
- `POST /api/students/bulk-upload` — CSV/Excel upload, auto-create User + Student
- `GET /api/students` — list by class with filters
- `GET /api/students/:id`, `PATCH /api/students/:id`, `DELETE /api/students/:id` (soft)
- `POST /api/students/:id/reset-password` — instructor-initiated reset
- `POST /api/attendance` — record attendance
- `POST /api/scores` — record scores
- Format-agnostic CSV parser with pluggable column mapper

**Dependencies added:** `multer`, `csv-parser`, `xlsx`

**Tests in Insomnia:**
- Upload CSV → students created, temp passwords returned
- Re-upload same CSV → students skipped, no duplicates
- Upload malformed CSV → partial success with row-level errors
- Student logs in with temp password → forced change flow
- After change, student can log in normally

### Phase 5 — Performance Processing

**Goal:** Calculate weighted total scores, classify students into High/Medium/Low categories.

**Modules built:** `performance/`

**Key features:**
- Configurable weights (midterm/final/coursework) stored in a settings collection
- Service: `calculatePerformance(studentId)` — recomputes and caches on Student doc
- Service: `recalculateClass(classId)` — batch operation
- Listens to score-update events; auto-recalculates
- Configurable thresholds for High/Medium/Low categorization

**Tests in Insomnia:**
- Update score → student's performanceCategory updates automatically
- Bulk recalculate class → all students updated

### Phase 6 — Group Formation Engine (CORE)

**Goal:** The crown jewel — automated, balanced group generation with all constraints.

**Modules built:** `group/`, `grouping/`

**Architecture:** Pipeline of pluggable stages inside `grouping/services/`:

1. **BucketingStage** — split students into High/Medium/Low buckets
2. **AttendanceFilterStage** — tag low-attendance students as scatter-priority
3. **HistoryAwarenessStage** — load past GroupHistory, build "avoid pairs" set
4. **GroupAssemblyStage** — assemble groups respecting all constraints
5. **LeaderAssignmentStage** — assign leaders, prefer `hasBeenLeader: false`
6. **PersistenceStage** — transactional write of Groups + GroupHistory + Workspaces
7. **NotificationStage** — emit events for downstream listeners

**Composed by:** `GroupGenerationService.generate(classId, options)`

**Endpoints:**
- `POST /api/groups/generate` — body: `{ classId, groupSize, options }`
- `POST /api/groups/regenerate` — runs again, prior attempt now in history
- `GET /api/groups?classId=...` — list groups
- `GET /api/groups/:id` — group detail
- `PATCH /api/groups/:id` — manual adjustments (swap members, reassign leader)
- Group history collection auto-populated on every generation

**Tests in Insomnia:**
- Generate groups for a class → balanced distribution
- Regenerate → different composition (history-aware)
- Manual adjustment works
- Performance + attendance balance verified by inspection

### Phase 7 — Workspace, Chat, Files

**Goal:** Per-group collaborative space with real-time chat and file uploads.

**Modules built:** `workspace/`, `chat/`, `file/`

**Key features:**
- Workspace auto-created when group is created (Phase 6 integration)
- Socket.IO setup in `src/sockets/`
- Chat messages persisted in MongoDB
- File uploads via `StorageService` (local disk implementation)
- Workspace access scoped: only group members + assigned instructor + admin

**Dependencies added:** `socket.io`

**Tests in Insomnia + Socket.IO client:**
- Send message → received by other group members in real time
- Upload file → stored, retrievable
- Non-member tries to access → 403

### Phase 8 — Tasks, Submissions, Feedback

**Goal:** Instructor-assigned tasks, student submissions, grading with feedback.

**Modules built:** `task/`, `submission/`, `feedback/`, `evaluation/`

**Key features:**
- `POST /api/tasks` — instructor creates task for one or more groups
- `POST /api/tasks/:id/submit` — student submits files + notes
- `PATCH /api/submissions/:id/grade` — instructor grades
- `POST /api/feedback` — peer or instructor feedback
- Task status progression: `not_started → in_progress → submitted → reviewed`
- Deadline reminders trigger via notification module

**Tests in Insomnia:**
- Full task lifecycle: create → assign → submit → grade
- Status transitions enforced
- Late submissions flagged

### Phase 9 — Notifications, Audit, Reports

**Goal:** Cross-cutting features that observe all other modules.

**Modules built:** `notification/`, `auditLog/`, `report/`, `dashboard/`

**Key features:**
- Event-driven: modules emit events; notification and audit modules listen
- `GET /api/notifications` — user's inbox
- `PATCH /api/notifications/:id/read` — mark as read
- Real-time push via Socket.IO when user online
- Audit log records every meaningful action
- Report exports: PDF, Excel, CSV
- Admin dashboard: system stats, recent activity

**Dependencies added:** `pdfkit` or `puppeteer` (for PDF), `exceljs` (for Excel)

**Tests in Insomnia:**
- Trigger action → notification created
- Audit log entry recorded for every privileged action
- Report exports download correctly

---

## 5. SYSTEM RUNTIME WORKFLOW

Read this end-to-end to understand the user's journey:

### 5.1 First Boot
- One seeded admin account exists. Nothing else.
- Admin logs in via web app → receives JWT.

### 5.2 Building the Academic Skeleton (Admin)
- Admin creates Faculty → Department → Course → Semester → Class.
- Admin registers instructors.
- Admin assigns instructors to classes.

### 5.3 Filling a Class with Students (Instructor)
- Instructor logs in, sees their assigned classes.
- Instructor uploads CSV/Excel of students for a class.
- System creates User + Student per row, returns temp passwords.
- Instructor distributes credentials.

### 5.4 Student First Login (Mobile)
- Student logs in by Student ID + temp password.
- Forced password change.
- Full JWT issued.
- Student lands on their dashboard (initially empty — no group yet).

### 5.5 Scores and Attendance (Instructor)
- Instructor records attendance and scores throughout the semester.
- Performance module auto-recalculates each student's category.

### 5.6 Group Generation (Instructor)
- Instructor opens a class, clicks "Generate Groups", picks group size.
- Grouping engine runs pipeline → produces balanced groups + workspaces.
- Notifications fired to all students.

### 5.7 Student Sees Their Group (Mobile)
- Student opens app → sees group, role (leader/member), teammates.
- Enters workspace → chat, files, tasks available.

### 5.8 Tasks and Collaboration
- Instructor assigns tasks.
- Group collaborates (chat, file sharing).
- Group submits work.
- Instructor grades and provides feedback.

### 5.9 Cross-Cutting
- Every privileged action audit-logged.
- Notifications fire for all relevant events.
- Reports exportable on demand.

---

## 6. DATABASE COLLECTIONS — FIELD REFERENCE

### 6.1 User
```
_id, email (unique sparse), studentId (unique sparse), passwordHash,
role (enum: admin|instructor|student), fullName, mustChangePassword,
isActive, lastLoginAt, deletedAt, deletedBy, createdAt, updatedAt
```

### 6.2 Faculty
```
_id, name (unique), description, createdBy, deletedAt, deletedBy, timestamps
```

### 6.3 Department
```
_id, facultyId (ref), name, description, createdBy, deletedAt, deletedBy, timestamps
```

### 6.4 Course
```
_id, departmentId (ref), name, code (unique within dept), description,
createdBy, deletedAt, deletedBy, timestamps
```

### 6.5 Semester
```
_id, name, year, startDate, endDate, status (active|archived),
createdBy, deletedAt, deletedBy, timestamps
```

### 6.6 Class
```
_id, courseId (ref), semesterId (ref), name, instructorId (ref to User),
maxStudents, createdBy, deletedAt, deletedBy, timestamps
```

### 6.7 Student
```
_id, userId (ref User), classId (ref), fullName, attendance (percentage),
scores: { midterm, final, coursework }, totalScore, performanceCategory (enum: HIGH|MEDIUM|LOW|null),
hasBeenLeader, deletedAt, deletedBy, timestamps
```

### 6.8 Group
```
_id, classId (ref), name, leaderId (ref Student), memberIds: [refs Student],
generatedAt, generationOptions, status (active|archived),
createdBy, deletedAt, deletedBy, timestamps
```

### 6.9 GroupHistory
```
_id, classId (ref), memberIds: [refs Student], leaderId, generatedAt,
groupSize, options
```

### 6.10 Workspace
```
_id, groupId (ref, unique), settings, createdAt, deletedAt, deletedBy, timestamps
```

### 6.11 Message
```
_id, workspaceId (ref), senderId (ref User), content, attachments,
readBy: [{ userId, readAt }], createdAt
```

### 6.12 File
```
_id, workspaceId (ref), uploadedBy (ref User), originalName,
storageKey, mimeType, sizeBytes, uploadedAt, deletedAt, deletedBy
```

### 6.13 Task
```
_id, classId (ref), assignedGroups: [refs Group], assignedBy (ref User),
title, description, attachments, deadline, status, createdAt, deletedAt, deletedBy
```

### 6.14 Submission
```
_id, taskId (ref), groupId (ref), submittedBy (ref Student), files: [refs File],
notes, status (draft|submitted|reviewed|late), grade, gradedBy, gradedAt,
submittedAt, deletedAt, deletedBy
```

### 6.15 Notification
```
_id, userId (ref), type, title, message, relatedEntity: { kind, id },
isRead, readAt, createdAt
```

### 6.16 Feedback
```
_id, groupId (ref), taskId (ref, nullable), fromUserId (ref), toUserId (ref, nullable),
toGroupId (ref, nullable), rating, comment, isPeer, createdAt
```

### 6.17 AuditLog
```
_id, actorId (ref User), actorRole, action, entityKind, entityId,
changes, ipAddress, userAgent, timestamp
```

### 6.18 PerformanceSettings
```
_id, weights: { midterm, final, coursework }, thresholds: { high, medium },
updatedBy, updatedAt
```

---

## 7. IRON RULES FOR CLAUDE CODE

These rules govern every line of code generated:

1. **One phase at a time.** Stop at phase boundaries. Wait for user to test.
2. **One module at a time within a phase.** Complete fully before next.
3. **Bottom-up within a module:** model → repository → service → validation → controller → routes.
4. **No cross-module model imports.** Use services.
5. **Controllers stay thin.** No business logic. They call services and return responses.
6. **Services own business logic.** They orchestrate repositories.
7. **Repositories own queries.** No raw DB queries outside repositories.
8. **All async code uses async/await.** No callback chains.
9. **All async controllers wrapped with `asyncHandler`.** No try/catch in controllers.
10. **All errors thrown as `AppError` subclasses.** Never `throw new Error(...)` in app code.
11. **All requests validated** before reaching controller logic.
12. **Standard response shape** on every endpoint.
13. **Soft delete by default.** Hard delete is admin-only and exceptional.
14. **RBAC enforced at route level.** Use `requireRole(...)` middleware.
15. **Ownership scoped at repository level.** Instructors only see their classes; students only see their group.
16. **No sensitive data in logs.** Never log passwords, JWTs, or PII.
17. **Env vars validated at startup.** Server refuses to boot on missing required vars.
18. **Comments explain "why", not "what".** Code should be readable; comments add context.
19. **No frontend code generated.** Backend only.
20. **Explain before coding.** When starting a new phase or module, summarize the plan before writing code.

---

## 8. TESTING DISCIPLINE

After each phase, the user tests every endpoint in **Insomnia**. Phase is not complete until all tests pass.

A shared Insomnia workspace is built up incrementally:
- Phase 1: 4 tests (health, 404, malformed JSON, DB state)
- Phase 2: + auth tests (login, protected route, RBAC, password change)
- Phase 3: + academic structure CRUD tests
- ... and so on.

Tests must verify both **happy paths** and **failure paths** (wrong role, missing fields, invalid IDs).

---

## 9. COMMUNICATION RULES

When working with the user:

1. **Explain architecture before coding.** Always provide analysis + plan + reasoning first.
2. **Beginner-friendly tone.** This is a learning project as much as a production project.
3. **Warn about bad decisions.** If the user requests something architecturally harmful, flag it and recommend better.
4. **Recommend improvements when seen.** Don't silently follow flawed instructions.
5. **Never rush.** Quality over speed.

---

## 10. KNOWN GAPS — USER MUST PROVIDE

These details are not yet specified. Pause and ask the user when needed:

1. ~~**CSV/Excel column specification for student upload**~~ → ✅ **LOCKED in Section 2.16**
2. **Performance score weighting defaults** (needed in Phase 5 — sensible defaults: midterm 30%, final 50%, coursework 20%)
3. **Performance category thresholds** (needed in Phase 5 — sensible defaults: High ≥ 75%, Medium 50–74%, Low < 50%)
4. **Attendance scatter threshold** (needed in Phase 6 — sensible default: bottom 25%)
5. **Group size default and range** (needed in Phase 6 — default 4, range 3–6)
6. **Notification types catalog** (needed in Phase 9)
7. **Report templates** (needed in Phase 9)

Use sensible defaults if the user wants to proceed; flag them as configurable for later.

---

## 11. SUCCESS CRITERIA

The backend is complete when:

1. All 9 phases delivered, each tested in Insomnia.
2. All 22 modules built following the service + repository pattern.
3. RBAC enforced consistently — wrong roles always blocked.
4. Soft delete works everywhere.
5. Student bulk upload + auto-creation + first-login flow works end-to-end.
6. Group generation pipeline produces balanced groups respecting all constraints.
7. Workspaces, chat, files, tasks, submissions, notifications all work for the right roles.
8. Audit log captures all privileged actions.
9. Reports export to PDF/Excel/CSV.
10. Server boots cleanly with `npm run dev`, fails fast on missing env vars.
11. No frontend code in the backend repository.
12. `PROJECT_CONTEXT.md` remains accurate as the source of truth.

---

## 12. GIT COMMIT DISCIPLINE

1. **Commit only after confirmed testing.** After each phase is COMPLETE and the user confirms it passed Insomnia testing, create a Git commit for that phase. Do NOT commit a phase that has not been tested and confirmed by the user.

2. **Always run `git status` first.** Before staging anything, show the user what will be committed. NEVER blindly run `git add .`.

3. **Never commit secrets or generated files.** NEVER stage or commit: `.env` files, `node_modules/`, `uploads/`, log files, or any secrets. Verify these are gitignored before every commit. If any secret appears in `git status`, STOP and warn the user immediately.

4. **Use Conventional Commit format:**
   ```
   type(scope): summary
   ```
   Example: `feat(students): phase 4 - bulk CSV upload with auto-created accounts`

5. **Commit message body required.** The commit message must include a short body listing what the phase delivered.

6. **Do NOT push automatically.** After committing, tell the user the commit is ready and let the user run `git push` themselves, OR ask explicit permission before pushing.

7. **One commit per phase.** Do not bundle multiple phases into one commit.

---

## END OF PROJECT CONTEXT

**Next step:** Begin Phase 1. Read section 4.1, follow the iron rules, deliver Phase 1 file-by-file with explanations. Stop and wait for Insomnia testing before Phase 2.
