const Joi = require('joi');

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(5000),
  MONGODB_URI: Joi.string().uri().required(),
  ALLOWED_ORIGINS: Joi.string().default('http://localhost:3000'),

  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  JWT_LIMITED_EXPIRES_IN: Joi.string().default('15m'),

  ADMIN_EMAIL: Joi.string().email({ tlds: { allow: false } }).required(),
  ADMIN_PASSWORD: Joi.string().min(6).required(),
  ADMIN_FULL_NAME: Joi.string().min(2).required(),

});

const { error, value } = schema.validate(process.env, { abortEarly: false, allowUnknown: true });

if (error) {
  const missing = error.details.map((d) => `  • ${d.message}`).join('\n');
  console.error(`\n[env] Invalid environment configuration:\n${missing}\n`);
  process.exit(1);
}

module.exports = {
  NODE_ENV: value.NODE_ENV,
  PORT: value.PORT,
  MONGODB_URI: value.MONGODB_URI,
  ALLOWED_ORIGINS: value.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
  IS_PRODUCTION: value.NODE_ENV === 'production',
  IS_DEVELOPMENT: value.NODE_ENV === 'development',

  JWT_SECRET: value.JWT_SECRET,
  JWT_EXPIRES_IN: value.JWT_EXPIRES_IN,
  JWT_LIMITED_EXPIRES_IN: value.JWT_LIMITED_EXPIRES_IN,

  ADMIN_EMAIL: value.ADMIN_EMAIL,
  ADMIN_PASSWORD: value.ADMIN_PASSWORD,
  ADMIN_FULL_NAME: value.ADMIN_FULL_NAME,
};
