const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const createAttendanceSchema = Joi.object({
  studentId:        objectId.required(),
  courseOfferingId: objectId.required(),
  percentage:       Joi.number().min(0).max(100).required(),
});

const updateAttendanceSchema = Joi.object({
  percentage: Joi.number().min(0).max(100).required(),
});

const bulkUpsertSchema = Joi.object({
  courseOfferingId: objectId.required(),
  records: Joi.array().items(
    Joi.object({
      studentId:  objectId.required(),
      percentage: Joi.number().min(0).max(100).required(),
    }),
  ).min(1).required(),
});

const idParamSchema    = Joi.object({ id: objectId.required() });
const offeringQuerySchema = Joi.object({ courseOfferingId: objectId.required() });

module.exports = {
  createAttendanceSchema,
  updateAttendanceSchema,
  bulkUpsertSchema,
  idParamSchema,
  offeringQuerySchema,
};
