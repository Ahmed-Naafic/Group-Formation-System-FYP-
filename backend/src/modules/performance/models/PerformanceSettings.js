const mongoose = require('mongoose');

// Singleton settings document — the system always has exactly one.
// getSettings() in the repository creates defaults on first access.
const performanceSettingsSchema = new mongoose.Schema({
  thresholds: {
    high:   { type: Number, min: 0, max: 100, default: 75 },
    medium: { type: Number, min: 0, max: 100, default: 50 },
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedAt: { type: Date, default: null },
});

module.exports = mongoose.model('PerformanceSettings', performanceSettingsSchema);
