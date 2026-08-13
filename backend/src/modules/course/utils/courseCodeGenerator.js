const courseRepository = require('../repositories/courseRepository');
const { ConflictError } = require('../../../common/errors');

// Multi-word department name ("Computer Science") -> initials ("CS").
// Single-word department name ("Mathematics") -> first 3 letters ("MAT").
function buildPrefix(departmentName) {
  const words = departmentName
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 2) {
    return words.map((w) => w[0]).join('').toUpperCase().slice(0, 4);
  }
  return (words[0] || 'CRS').toUpperCase().slice(0, 3).padEnd(2, 'X');
}

// Generates the next free "<PREFIX><number>" code for a department, e.g. CS101, CS102.
// Sequential lookups are fine at this scale — departments hold a handful of courses.
async function generateCourseCode(departmentId, departmentName) {
  const prefix = buildPrefix(departmentName);
  for (let n = 101; n <= 999; n += 1) {
    const candidate = `${prefix}${n}`;
    // eslint-disable-next-line no-await-in-loop
    const exists = await courseRepository.findOne({ departmentId, code: candidate });
    if (!exists) return candidate;
  }
  throw new ConflictError('Unable to generate a unique course code for this department.');
}

module.exports = { generateCourseCode, buildPrefix };
