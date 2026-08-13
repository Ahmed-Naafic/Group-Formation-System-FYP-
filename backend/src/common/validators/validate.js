const { ValidationError } = require('../errors');

/**
 * Returns middleware that validates req[property] against the given Joi schema.
 * Replaces req[property] with the coerced Joi value on success.
 */
function validate(schema, property = 'body') {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      const details = error.details.map((d) => d.message);
      return next(new ValidationError(details.join('; '), details));
    }
    req[property] = value;
    return next();
  };
}

module.exports = validate;
