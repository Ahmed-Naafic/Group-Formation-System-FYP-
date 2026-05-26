
// Must be the very first thing — loads .env before any other module reads process.env
require('dotenv').config();

const { PORT } = require('./src/config/env');
const { connect } = require('./src/config/db');
const logger = require('./src/common/utils/logger');
const app = require('./src/app');

// ── Fatal error guards ───────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception — shutting down', { message: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection — shutting down', { reason: String(reason) });
  process.exit(1);
});

// ── Boot sequence ────────────────────────────────────────────────────────────
const mongoose = require('mongoose');
const seedAdmin = require('./src/scripts/seedAdmin');

// Register before connect() so the handler is in place before the event fires
mongoose.connection.once('open', async () => {
  try {
    await seedAdmin();
  } catch (err) {
    logger.error('Admin seed failed', { message: err.message });
  }
});

connect();

const { initSocket } = require('./src/sockets');

const server = app.listen(PORT, () => {
  logger.info(`Server running`, { port: PORT, env: process.env.NODE_ENV });
});

initSocket(server);

// Give the HTTP server a graceful shutdown path too
process.on('SIGTERM', () => {
  server.close(() => logger.info('HTTP server closed'));
});
