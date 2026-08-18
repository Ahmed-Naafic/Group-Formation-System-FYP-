const PerformanceSettings = require('../models/PerformanceSettings');

const performanceSettingsRepository = {
  // Returns the settings document, creating it with defaults on first call.
  async getSettings() {
    let settings = await PerformanceSettings.findOne();
    if (!settings) {
      settings = await PerformanceSettings.create({});
    }
    return settings;
  },

  async updateSettings(data) {
    return PerformanceSettings.findOneAndUpdate(
      {},
      { $set: data },
      { new: true, upsert: true, runValidators: true }
    );
  },

  setCategoryVisibility(enabled) {
    return PerformanceSettings.findOneAndUpdate(
      {},
      { $set: { categoryVisibleToInstructors: enabled } },
      { new: true, upsert: true, runValidators: true }
    );
  },
};

module.exports = performanceSettingsRepository;
