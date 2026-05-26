const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');

const { ALLOWED_ORIGINS, IS_PRODUCTION, IS_DEVELOPMENT } = require('./config/env');
const { connection } = require('./config/db');
const { sendSuccess } = require('./common/responses/apiResponse');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ── Security & transport middleware ─────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (curl, mobile apps, server-to-server)
      if (!origin) return callback(null, true);
      // In development, accept any localhost port so the Vite dev server can connect
      // regardless of which port it lands on (5173, 5174, …).
      if (IS_DEVELOPMENT && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);
app.use(compression());

// ── Request logging ──────────────────────────────────────────────────────────
app.use(morgan(IS_PRODUCTION ? 'combined' : 'dev'));

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  const dbState = connection.readyState; // 0=disconnected 1=connected 2=connecting 3=disconnecting
  const stateMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

  const status = dbState === 1 ? 200 : 503;
  return sendSuccess(res, {
    status,
    message: 'Health check',
    data: {
      server: 'ok',
      database: stateMap[dbState] ?? 'unknown',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    },
  });
});

// ── Module routes ────────────────────────────────────────────────────────────
app.use('/api/auth',        require('./modules/auth/routes/authRoutes'));
app.use('/api/faculty',     require('./modules/faculty/routes/facultyRoutes'));
app.use('/api/departments', require('./modules/department/routes/departmentRoutes'));
app.use('/api/courses',     require('./modules/course/routes/courseRoutes'));
app.use('/api/semesters',   require('./modules/semester/routes/semesterRoutes'));
app.use('/api/classes',     require('./modules/class/routes/classRoutes'));
app.use('/api/students',    require('./modules/student/routes/studentRoutes'));
app.use('/api',             require('./modules/attendance/routes/attendanceRoutes'));
app.use('/api/performance', require('./modules/performance/routes/performanceRoutes'));
app.use('/api/groups',              require('./modules/group/routes/groupRoutes'));
app.use('/api/workspaces',          require('./modules/workspace/routes/workspaceRoutes'));
app.use('/api/workspaces/:workspaceId/messages', require('./modules/chat/routes/messageRoutes'));
app.use('/api/workspaces/:workspaceId/files',    require('./modules/file/routes/fileRoutes'));
app.use('/api/course-assignments',  require('./modules/courseAssignment/routes/courseAssignmentRoutes'));
app.use('/api/users',               require('./modules/user/routes/userRoutes'));
app.use('/api/tasks',               require('./modules/task/routes/taskRoutes'));
app.use('/api/submissions',         require('./modules/submission/routes/submissionRoutes'));
app.use('/api/feedback',            require('./modules/feedback/routes/feedbackRoutes'));
app.use('/api/notifications',       require('./modules/notification/routes/notificationRoutes'));
app.use('/api/audit-logs',          require('./modules/auditLog/routes/auditLogRoutes'));
app.use('/api/reports',             require('./modules/report/routes/reportRoutes'));
app.use('/api/dashboard',           require('./modules/dashboard/routes/dashboardRoutes'));

// ── 404 & error handling ─────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
