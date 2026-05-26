const mongoose   = require('mongoose');
const softDelete = require('../../../common/plugins/softDelete');

const submissionSchema = new mongoose.Schema(
  {
    taskId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Task',    required: true, index: true },
    groupId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Group',   required: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    files:       [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }],
    notes:       { type: String, trim: true, maxlength: 5000 },
    status:      {
      type:    String,
      enum:    ['draft', 'submitted', 'reviewed', 'late'],
      default: 'draft',
    },
    grade:     { type: Number, min: 0, max: 100 },
    gradedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    gradedAt:  { type: Date },
    submittedAt: { type: Date },
  },
  { timestamps: true },
);

// One submission per group per task
submissionSchema.index({ taskId: 1, groupId: 1 }, { unique: true });

submissionSchema.plugin(softDelete);

module.exports = mongoose.model('Submission', submissionSchema);
