const mongoose = require('mongoose');

function softDeletePlugin(schema) {
  schema.add({
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  });

  // Exclude soft-deleted docs from all standard queries by default
  const exclude = { deletedAt: null };

  for (const method of ['find', 'findOne', 'findOneAndUpdate', 'countDocuments', 'exists']) {
    schema.pre(method, function () {
      // Only apply the filter if the caller has not opted in to seeing deleted docs
      if (!this.getOptions()._includeSoftDeleted) {
        this.where(exclude);
      }
    });
  }

  // Query helper: MyModel.find().includeSoftDeleted()
  schema.query.includeSoftDeleted = function () {
    return this.setOptions({ _includeSoftDeleted: true });
  };

  // Instance method: await doc.softDelete(userId)
  schema.methods.softDelete = function (userId) {
    this.deletedAt = new Date();
    this.deletedBy = userId;
    return this.save();
  };

  // Instance method: await doc.restore()
  schema.methods.restore = function () {
    this.deletedAt = null;
    this.deletedBy = null;
    return this.save();
  };
}

module.exports = softDeletePlugin;
