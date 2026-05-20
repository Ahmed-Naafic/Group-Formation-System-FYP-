const userService = require('../modules/user/services/userService');
const logger = require('../common/utils/logger');
const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FULL_NAME } = require('../config/env');

async function seedAdmin() {
  const exists = await userService.adminExists();
  if (exists) {
    logger.info('Admin account already exists — skipping seed');
    return;
  }

  await userService.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    fullName: ADMIN_FULL_NAME,
    role: 'admin',
    mustChangePassword: false,
  });

  logger.info('Admin account created', { email: ADMIN_EMAIL });
}

module.exports = seedAdmin;
