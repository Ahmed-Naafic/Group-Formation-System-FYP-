const mongoose = require('mongoose');
const { MONGODB_URI, IS_PRODUCTION } = require('./env');

const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 5000;

let retryCount = 0;

function connect() {
  const logger = require('../common/utils/logger');

  mongoose
    .connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    })
    .then(() => {
      retryCount = 0;
      logger.info('MongoDB connected', { uri: IS_PRODUCTION ? '[hidden]' : MONGODB_URI });
    })
    .catch((err) => {
      retryCount += 1;
      logger.error(`MongoDB connection failed (attempt ${retryCount}/${MAX_RETRIES})`, {
        message: err.message,
      });

      if (retryCount >= MAX_RETRIES) {
        logger.error('Max MongoDB retries reached — shutting down');
        process.exit(1);
      }

      setTimeout(connect, RETRY_INTERVAL_MS);
    });
}

mongoose.connection.on('disconnected', () => {
  // Lazy-require to avoid circular dependency at module load time
  const logger = require('../common/utils/logger');
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  const logger = require('../common/utils/logger');
  logger.info('MongoDB reconnected');
});

function gracefulShutdown(signal) {
  const logger = require('../common/utils/logger');
  logger.info(`${signal} received — closing MongoDB connection`);
  mongoose.connection.close(false).then(() => {
    logger.info('MongoDB connection closed');
    process.exit(0);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = { connect, connection: mongoose.connection };
