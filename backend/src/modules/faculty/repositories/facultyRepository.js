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

  findByName(name) {
    return Faculty.findOne({ name: name.trim() });
  },

  updateById(id, updates) {
    return Faculty.findByIdAndUpdate(id, updates, { new: true });
  },
};

module.exports = facultyRepository;
