const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');

const { ALLOWED_ORIGINS, IS_PRODUCTION } = require('./config/env');
const { connection } = require('./config/db');
const { sendSuccess } = require('./common/responses/apiResponse');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ── Security & transport middleware ─────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
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

// ── 404 & error handling ─────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
