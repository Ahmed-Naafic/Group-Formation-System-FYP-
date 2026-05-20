const mongoose = require('mongoose');
const softDeletePlugin = require('../../../common/plugins/softDelete');

const classSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    semesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', required: true },
    name: { type: String, required: true, trim: true },
    instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    maxStudents: { type: Number, min: 1, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

classSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Class', classSchema);
