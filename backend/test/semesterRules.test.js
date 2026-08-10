const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  MAX_SEMESTERS_PER_YEAR,
  addMonthsUTC,
  assertDuration,
  assertWithinAcademicYear,
  assertNoOverlap,
  nextSemesterName,
} = require('../src/modules/semester/services/semesterRules');
const { BadRequestError, ConflictError } = require('../src/common/errors');

describe('addMonthsUTC', () => {
  test('adds whole calendar months', () => {
    assert.equal(addMonthsUTC('2026-01-15', 4).toISOString().slice(0, 10), '2026-05-15');
  });

  test('clamps day-of-month overflow to the last day of the target month', () => {
    // Jan 31 + 1 month would naively roll to Mar 3 via Date#setMonth — must clamp to Feb 28 instead.
    assert.equal(addMonthsUTC('2026-01-31', 1).toISOString().slice(0, 10), '2026-02-28');
  });

  test('clamps correctly across a leap year', () => {
    assert.equal(addMonthsUTC('2028-01-31', 1).toISOString().slice(0, 10), '2028-02-29');
  });
});

describe('assertDuration', () => {
  test('accepts exactly 4 months', () => {
    assert.doesNotThrow(() => assertDuration('2026-01-15', '2026-05-15'));
  });

  test('accepts exactly 6 months', () => {
    assert.doesNotThrow(() => assertDuration('2026-01-15', '2026-07-15'));
  });

  test('accepts a duration in between', () => {
    assert.doesNotThrow(() => assertDuration('2026-01-15', '2026-06-01'));
  });

  test('rejects less than 4 months', () => {
    assert.throws(() => assertDuration('2026-01-15', '2026-05-14'), BadRequestError);
  });

  test('rejects more than 6 months', () => {
    assert.throws(() => assertDuration('2026-01-15', '2026-07-16'), BadRequestError);
  });
});

describe('assertWithinAcademicYear', () => {
  const ay = { startDate: '2026-01-01', endDate: '2026-12-31' };

  test('accepts dates inside the academic year', () => {
    assert.doesNotThrow(() => assertWithinAcademicYear('2026-02-01', '2026-06-01', ay));
  });

  test('accepts dates exactly on the academic year boundaries', () => {
    assert.doesNotThrow(() => assertWithinAcademicYear('2026-01-01', '2026-06-01', ay));
  });

  test('rejects a semester starting before the academic year', () => {
    assert.throws(() => assertWithinAcademicYear('2025-12-15', '2026-06-01', ay), BadRequestError);
  });

  test('rejects a semester ending after the academic year', () => {
    assert.throws(() => assertWithinAcademicYear('2026-08-01', '2027-01-15', ay), BadRequestError);
  });
});

describe('assertNoOverlap', () => {
  const siblings = [
    { _id: 's1', name: 'Semester 1', startDate: '2026-01-01', endDate: '2026-05-01' },
    { _id: 's2', name: 'Semester 2', startDate: '2026-06-01', endDate: '2026-10-01' },
  ];

  test('accepts a range that falls entirely in the gap between siblings', () => {
    assert.doesNotThrow(() => assertNoOverlap(siblings, '2026-05-02', '2026-05-31', null));
  });

  test('rejects a range that overlaps an existing sibling', () => {
    assert.throws(() => assertNoOverlap(siblings, '2026-04-01', '2026-08-01', null), ConflictError);
  });

  test('rejects a range fully contained inside an existing sibling', () => {
    assert.throws(() => assertNoOverlap(siblings, '2026-02-01', '2026-03-01', null), ConflictError);
  });

  test('excludes the semester being updated from its own overlap check', () => {
    assert.doesNotThrow(() => assertNoOverlap(siblings, '2026-01-10', '2026-05-10', 's1'));
  });

  test('still catches overlap with a different sibling while excluding self', () => {
    assert.throws(() => assertNoOverlap(siblings, '2026-01-10', '2026-06-15', 's1'), ConflictError);
  });
});

describe('nextSemesterName', () => {
  test('returns "Semester 1" for an empty academic year', () => {
    assert.equal(nextSemesterName([]), 'Semester 1');
  });

  test('returns the next sequential number', () => {
    const existing = [{ name: 'Semester 1' }, { name: 'Semester 2' }];
    assert.equal(nextSemesterName(existing), 'Semester 3');
  });

  test('fills the first gap rather than always appending', () => {
    const existing = [{ name: 'Semester 1' }, { name: 'Semester 3' }];
    assert.equal(nextSemesterName(existing), 'Semester 2');
  });

  test('is case-insensitive when parsing existing names', () => {
    const existing = [{ name: 'semester 1' }];
    assert.equal(nextSemesterName(existing), 'Semester 2');
  });

  test(`returns null once all ${MAX_SEMESTERS_PER_YEAR} slots are taken`, () => {
    const existing = Array.from({ length: MAX_SEMESTERS_PER_YEAR }, (_, i) => ({ name: `Semester ${i + 1}` }));
    assert.equal(nextSemesterName(existing), null);
  });

  test('ignores unrelated names when computing the next number', () => {
    const existing = [{ name: 'Semester 1' }, { name: 'Fall Break' }];
    assert.equal(nextSemesterName(existing), 'Semester 2');
  });
});
