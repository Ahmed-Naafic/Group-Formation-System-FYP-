const Faculty = require('../models/Faculty');

const facultyRepository = {
  create(data) {
    return Faculty.create(data);
  },

  findAll() {
    return Faculty.find().sort({ name: 1 });
  },

  findById(id) {
    return Faculty.findById(id);
  },

  // Case-insensitive — matches the unique index's collation. Soft-deleted
  // faculties are excluded by the softDelete plugin's query middleware, so
  // a deleted faculty's name is free to reuse.
  findByName(name) {
    return Faculty.findOne({ name: name.trim() }).collation({ locale: 'en', strength: 2 });
  },

  updateById(id, updates) {
    return Faculty.findByIdAndUpdate(id, updates, { new: true });
  },
};

module.exports = facultyRepository;
