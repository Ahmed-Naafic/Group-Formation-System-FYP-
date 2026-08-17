const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

// reportType drives which of date/weekStart/year+month is required — the
// other period fields are simply ignored if sent, matching the pattern of
// only enforcing what the selected report type actually needs.
const analyticsQuerySchema = Joi.object({
  reportType: Joi.string().valid('daily', 'weekly', 'monthly').required().messages({
    'any.required': 'reportType is required',
    'any.only': 'reportType must be one of: daily, weekly, monthly',
  }),
  date: Joi.string().when('reportType', {
    is: 'daily',
    then: Joi.required().messages({ 'any.required': 'date is required for a daily report' }),
  }),
  weekStart: Joi.string().when('reportType', {
    is: 'weekly',
    then: Joi.required().messages({ 'any.required': 'weekStart is required for a weekly report' }),
  }),
  year: Joi.number().integer().min(2000).max(2100).when('reportType', {
    is: 'monthly',
    then: Joi.required().messages({ 'any.required': 'year is required for a monthly report' }),
  }),
  month: Joi.number().integer().min(1).max(12).when('reportType', {
    is: 'monthly',
    then: Joi.required().messages({ 'any.required': 'month is required for a monthly report' }),
  }),
  academicYearId: objectId,
  semesterId: objectId,
  courseOfferingId: objectId,
  cohortId: objectId,
}).unknown(false);

module.exports = { analyticsQuerySchema };
