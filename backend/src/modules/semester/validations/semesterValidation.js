const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

// No create/update schemas — semesters are entirely system-managed (see
// semesterService.createDefaultSemesters), there is no admin-facing
// create/update/delete endpoint at all.

const idParamSchema = Joi.object({ id: objectId.required() });

// academicYearId filters the list to one academic year's 10 semesters —
// what the Course Offering page's cascading dropdown uses.
const listQuerySchema = Joi.object({
  academicYearId: objectId,
});

module.exports = { idParamSchema, listQuerySchema };
