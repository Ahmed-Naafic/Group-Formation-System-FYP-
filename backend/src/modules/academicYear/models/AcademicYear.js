const mongoose = require('mongoose');
const softDeletePlugin = require('../../../common/plugins/softDelete');
const { computeEffectiveStatus } = require('../services/academicYearRules');

const academicYearSchema = new mongoose.Schema(
  {
    // Always server-derived from startDate (see academicYearRules.deriveName)
    // — never accepted directly from client input.
    name:      { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate:   { type: Date, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // No stored status field: UPCOMING/CURRENT/CLOSED is always computed live
    // from startDate/endDate vs the real current date (academicYearRules.
    // computeEffectiveStatus) — an admin must never be able to hand-pick
    // "current", and a stored value would drift out of sync over time.
  },
  { timestamps: true },
);

// Name must be globally unique among active records (e.g. "2025/2026" cannot exist twice).
academicYearSchema.index(
  { name: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

academicYearSchema.plugin(softDeletePlugin);

// Computed on every read from the real current date — never stored, never
// admin-settable. Included automatically in API responses (res.json calls
// toJSON() on Mongoose documents).
academicYearSchema.virtual('effectiveStatus').get(function () {
  return computeEffectiveStatus(this.startDate, this.endDate, new Date());
});

// Documents created before this field was removed from the schema still
// carry a stale `status` value in MongoDB (Mongoose surfaces undeclared-but-
// stored fields on read) — strip it explicitly so it can never leak back out
// and get mistaken for effectiveStatus.
function stripLegacyStatus(_doc, ret) {
  delete ret.status;
  return ret;
}
academicYearSchema.set('toJSON',   { virtuals: true, transform: stripLegacyStatus });
academicYearSchema.set('toObject', { virtuals: true, transform: stripLegacyStatus });

module.exports = mongoose.model('AcademicYear', academicYearSchema);
