// A "Semester" in this module means the Course Offering period within an
// Academic Year (Semester 1-10) — NOT a student's program/degree semester.
// A student's program semester (their own academic progression, e.g.
// "Program Semester 8") is an entirely separate concept tracked elsewhere
// and is not bounded by this 1-10 range at all.

const SEMESTER_COUNT = 10;

// Fixed classification — not derived from any date. Every academic year's
// semesters split into these two six-month groups the same way, always.
const FIRST_SIX_MONTH_GROUP  = [1, 3, 5, 7, 9];
const SECOND_SIX_MONTH_GROUP = [2, 4, 6, 8, 10];

function getSixMonthGroup(number) {
  return number % 2 === 1 ? 'FIRST' : 'SECOND';
}

// The 10 semester documents (plain objects, ready for insertMany) that must
// exist for every academic year — always exactly this shape, always numbered
// 1-10, names always derived ("Semester N"), never partial and never client-
// influenced in any way.
function buildDefaultSemesters(academicYearId, createdBy) {
  const semesters = [];
  for (let number = 1; number <= SEMESTER_COUNT; number++) {
    semesters.push({
      name: `Semester ${number}`,
      number,
      academicYearId,
      createdBy,
    });
  }
  return semesters;
}

module.exports = {
  SEMESTER_COUNT,
  FIRST_SIX_MONTH_GROUP,
  SECOND_SIX_MONTH_GROUP,
  getSixMonthGroup,
  buildDefaultSemesters,
};
