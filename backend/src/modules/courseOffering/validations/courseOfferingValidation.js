const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const createCourseOfferingSchema = Joi.object({
  courseId:     objectId.required(),
  cohortId:     objectId.required(),
  semesterId:   objectId.required(),
  instructorId: objectId.required(),
  maxStudents:  Joi.number().integer().min(1).allow(null).default(null),
  status:       Joi.string().valid('active', 'completed', 'cancelled').default('active'),
});

const updateCourseOfferingSchema = Joi.object({
  instructorId: objectId,
  // Optional note captured on reassignment (instructorId actually changing).
  // Ignored otherwise — see instructorAssignmentService.reassign.
  reason:       Joi.string().trim().max(500).allow('', null),
  maxStudents:  Joi.number().integer().min(1).allow(null),
  status:       Joi.string().valid('active', 'completed', 'cancelled'),
}).min(1);

const idParamSchema = Joi.object({ id: objectId.required() });

// Optional query filters when listing offerings
const offeringQuerySchema = Joi.object({
  cohortId:   objectId,
  semesterId: objectId,
});

module.exports = {
  createCourseOfferingSchema,
  updateCourseOfferingSchema,
  idParamSchema,
  offeringQuerySchema,
};
