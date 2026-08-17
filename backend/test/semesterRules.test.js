const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  SEMESTER_COUNT,
  FIRST_SIX_MONTH_GROUP,
  SECOND_SIX_MONTH_GROUP,
  getSixMonthGroup,
  buildDefaultSemesters,
} = require('../src/modules/semester/services/semesterRules');

describe('SEMESTER_COUNT', () => {
  test('is exactly 10', () => {
    assert.equal(SEMESTER_COUNT, 10);
  });
});

// ── Six-month grouping — spec items 5-14 ────────────────────────────────────
describe('getSixMonthGroup', () => {
  test('1, 3, 5, 7, 9 belong to the first six-month group', () => {
    for (const n of [1, 3, 5, 7, 9]) {
      assert.equal(getSixMonthGroup(n), 'FIRST', `Semester ${n} should be FIRST`);
    }
  });

  test('2, 4, 6, 8, 10 belong to the second six-month group', () => {
    for (const n of [2, 4, 6, 8, 10]) {
      assert.equal(getSixMonthGroup(n), 'SECOND', `Semester ${n} should be SECOND`);
    }
  });

  test('FIRST_SIX_MONTH_GROUP and SECOND_SIX_MONTH_GROUP constants match the fixed classification', () => {
    assert.deepEqual(FIRST_SIX_MONTH_GROUP, [1, 3, 5, 7, 9]);
    assert.deepEqual(SECOND_SIX_MONTH_GROUP, [2, 4, 6, 8, 10]);
  });
});

// ── buildDefaultSemesters — spec items 1-4 ──────────────────────────────────
describe('buildDefaultSemesters', () => {
  const academicYearId = 'ay123';
  const createdBy = 'user456';
  const semesters = buildDefaultSemesters(academicYearId, createdBy);

  test('creates exactly 10 semesters', () => {
    assert.equal(semesters.length, 10);
  });

  test('numbers them 1 through 10 in order, with no gaps and no Semester 11', () => {
    assert.deepEqual(semesters.map((s) => s.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.ok(!semesters.some((s) => s.number === 11), 'must never include Semester 11');
    assert.ok(!semesters.some((s) => s.number === 0), 'must never include Semester 0');
  });

  test('every semester belongs to the given academic year', () => {
    assert.ok(semesters.every((s) => s.academicYearId === academicYearId));
  });

  test('names are always "Semester N", derived from number, never something else', () => {
    for (const s of semesters) {
      assert.equal(s.name, `Semester ${s.number}`);
    }
  });

  test('carries createdBy through to every semester', () => {
    assert.ok(semesters.every((s) => s.createdBy === createdBy));
  });

  test('two different academic years each get their own independent set of 10', () => {
    const setA = buildDefaultSemesters('ayA', createdBy);
    const setB = buildDefaultSemesters('ayB', createdBy);
    assert.equal(setA.length, 10);
    assert.equal(setB.length, 10);
    assert.ok(setA.every((s) => s.academicYearId === 'ayA'));
    assert.ok(setB.every((s) => s.academicYearId === 'ayB'));
  });
});
