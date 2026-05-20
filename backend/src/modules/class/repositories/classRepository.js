const Class = require('../models/Class');

const classRepository = {
  create(data) {
    return Class.create(data);
  },

  findAll(filter = {}) {
    return Class.find(filter)
      .populate('instructorId', 'fullName email')
      .sort({ name: 1 });
  },

  findById(id) {
    return Class.findById(id).populate('instructorId', 'fullName email');
  },

  findOne(filter) {
    return Class.findOne(filter);
  },

  updateById(id, updates) {
    return Class.findByIdAndUpdate(id, updates, { new: true }).populate(
      'instructorId',
      'fullName email'
    );
  },
};

module.exports = classRepository;
