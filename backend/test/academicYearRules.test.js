const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  MIN_ACADEMIC_YEAR_MONTHS,
  MAX_ACADEMIC_YEAR_MONTHS,
  EARLIEST_START_YEAR,
  deriveName,
  assertDuration,
  assertEarliestYear,
  assertNoOverlap,
  assertSequentialNext,
  isWithinFinalMonth,
  assertCreationWindow,
  computeEffectiveStatus,
} = require('../src/modules/academicYear/services/academicYearRules');
const { BadRequestError, ConflictError } = require('../src/common/errors');

// ── deriveName — spec items 1-4, 30 ─────────────────────────────────────────
// The name is always built from startDate, so "2025/2027"-style mismatches,
// same-year names, and reversed years are structurally impossible — there is
// no code path where a name can be anything but startYear/(startYear+1).
describe('deriveName', () => {
  test('derives 2025/2026 from a 2025 start date', () => {
    assert.equal(deriveName('2025-09-01'), '2025/2026');
  });

  test('derives 2026/2027 from a 2026 start date', () => {
    assert.equal(deriveName('2026-09-01'), '2026/2027');
  });

  test('always produces consecutive years regardless of start month', () => {
    assert.equal(deriveName('2025-01-01'), '2025/2026');
    assert.equal(deriveName('2025-12-31'), '2025/2026');
  });

  test('never produces a same-year or non-consecutive name', () => {
    const name = deriveName('2025-09-01');
    const [start, end] = name.split('/').map(Number);
    assert.notEqual(start, end);          // rules out 2025/2025
    assert.equal(end, start + 1);          // rules out 2025/2027 and 2027/2026
  });
});

// ── assertDuration — spec items 5-12 ────────────────────────────────────────
describe('assertDuration', () => {
  test('accepts a typical Sept -> July academic year (10 months)', () => {
    assert.doesNotThrow(() => assertDuration('2026-09-01', '2027-07-31'));
  });

  test('accepts exactly 9 months (the minimum)', () => {
    assert.doesNotThrow(() => assertDuration('2026-09-01', '2027-06-01'));
  });

  test('accepts exactly 12 months (the maximum)', () => {
    assert.doesNotThrow(() => assertDuration('2026-09-01', '2027-09-01'));
  });

  test('rejects a duration one day short of 9 months', () => {
    assert.throws(() => assertDuration('2026-09-01', '2027-05-31'), BadRequestError);
  });

  test('rejects less than 9 months generally', () => {
    assert.throws(() => assertDuration('2026-09-01', '2027-01-01'), BadRequestError);
  });

  test('rejects more than 12 months', () => {
    assert.throws(() => assertDuration('2026-09-01', '2027-09-02'), BadRequestError);
  });

  test('rejects a one-day academic year', () => {
    assert.throws(() => assertDuration('2026-09-01', '2026-09-02'), BadRequestError);
  });

  test('rejects a one-month academic year', () => {
    assert.throws(() => assertDuration('2026-09-01', '2026-10-01'), BadRequestError);
  });

  test('rejects the same start and end date (zero duration)', () => {
    assert.throws(() => assertDuration('2026-09-01', '2026-09-01'), BadRequestError);
  });

  test('rejects an end date before the start date', () => {
    assert.throws(() => assertDuration('2026-09-01', '2026-01-01'), BadRequestError);
  });

  test(`min/max constants are ${MIN_ACADEMIC_YEAR_MONTHS} and ${MAX_ACADEMIC_YEAR_MONTHS}`, () => {
    assert.equal(MIN_ACADEMIC_YEAR_MONTHS, 9);
    assert.equal(MAX_ACADEMIC_YEAR_MONTHS, 12);
  });
});

// ── assertEarliestYear — spec items 13-14 ───────────────────────────────────
describe('assertEarliestYear', () => {
  test(`rejects a start year before ${EARLIEST_START_YEAR}`, () => {
    assert.throws(() => assertEarliestYear('1999-09-01'), BadRequestError);
  });

  test(`accepts exactly ${EARLIEST_START_YEAR} (the earliest allowed)`, () => {
    assert.doesNotThrow(() => assertEarliestYear('2000-09-01'));
  });

  test('accepts years after the earliest boundary', () => {
    assert.doesNotThrow(() => assertEarliestYear('2001-09-01'));
  });
});

// ── assertNoOverlap — spec items 16-17, 26 ──────────────────────────────────
describe('assertNoOverlap', () => {
  const existing = [
    { _id: 'ay1', name: '2025/2026', startDate: '2025-09-01', endDate: '2026-07-31' },
  ];

  test('accepts a non-overlapping, sequential range', () => {
    assert.doesNotThrow(() => assertNoOverlap(existing, '2026-09-01', '2027-07-31', null));
  });

  test('rejects a range that overlaps an existing academic year', () => {
    assert.throws(() => assertNoOverlap(existing, '2026-06-01', '2027-04-30', null), ConflictError);
  });

  test('rejects a range fully contained inside an existing academic year', () => {
    assert.throws(() => assertNoOverlap(existing, '2025-10-01', '2026-06-01', null), ConflictError);
  });

  test('excludes the record being updated from its own overlap check', () => {
    assert.doesNotThrow(() => assertNoOverlap(existing, '2025-09-15', '2026-07-31', 'ay1'));
  });

  test('adjacent ranges sharing a boundary day do not overlap', () => {
    // 2025/2026 ends 2026-07-31; 2026/2027 starting the next day must be fine.
    assert.doesNotThrow(() => assertNoOverlap(existing, '2026-08-01', '2027-07-31', null));
  });
});

// ── assertSequentialNext — spec items 18-20 ─────────────────────────────────
describe('assertSequentialNext', () => {
  const latest = { startDate: '2025-09-01', endDate: '2026-07-31' };

  test('allows the very first academic year ever created (no latest)', () => {
    assert.doesNotThrow(() => assertSequentialNext('2000-09-01', null));
  });

  test('allows exactly the next sequential year', () => {
    assert.doesNotThrow(() => assertSequentialNext('2026-09-01', latest));
  });

  test('rejects skipping ahead to a non-adjacent future year', () => {
    assert.throws(() => assertSequentialNext('2028-09-01', latest), BadRequestError);
  });

  test('rejects an arbitrary far-future year', () => {
    assert.throws(() => assertSequentialNext('2031-09-01', latest), BadRequestError);
  });

  test('rejects recreating the same year again', () => {
    assert.throws(() => assertSequentialNext('2025-09-01', latest), BadRequestError);
  });

  test('rejects going backwards', () => {
    assert.throws(() => assertSequentialNext('2024-09-01', latest), BadRequestError);
  });
});

// ── isWithinFinalMonth / assertCreationWindow — spec items 21-22 ───────────
describe('isWithinFinalMonth / assertCreationWindow', () => {
  const latest = { startDate: '2025-09-01', endDate: '2026-07-31' };

  test('blocked with more than one month remaining', () => {
    assert.equal(isWithinFinalMonth(latest.endDate, new Date('2026-06-01T00:00:00Z')), false);
    assert.throws(
      () => assertCreationWindow(latest, new Date('2026-06-01T00:00:00Z')),
      BadRequestError,
    );
  });

  test('allowed once the final calendar month begins', () => {
    assert.equal(isWithinFinalMonth(latest.endDate, new Date('2026-07-01T00:00:00Z')), true);
    assert.doesNotThrow(() => assertCreationWindow(latest, new Date('2026-07-01T00:00:00Z')));
  });

  test('allowed on the last day of the final month', () => {
    assert.doesNotThrow(() => assertCreationWindow(latest, new Date('2026-07-31T00:00:00Z')));
  });

  test('allowed after the academic year has already ended', () => {
    assert.doesNotThrow(() => assertCreationWindow(latest, new Date('2026-09-15T00:00:00Z')));
  });

  test('no restriction when no academic year exists yet', () => {
    assert.doesNotThrow(() => assertCreationWindow(null, new Date('2000-01-01T00:00:00Z')));
  });
});

// ── computeEffectiveStatus — spec items 23-26 ───────────────────────────────
describe('computeEffectiveStatus', () => {
  const startDate = '2025-09-01';
  const endDate   = '2026-07-31';

  test('is UPCOMING before the start date', () => {
    assert.equal(computeEffectiveStatus(startDate, endDate, new Date('2025-08-01T00:00:00Z')), 'UPCOMING');
  });

  test('is CURRENT on the exact start date', () => {
    assert.equal(computeEffectiveStatus(startDate, endDate, new Date('2025-09-01T00:00:00Z')), 'CURRENT');
  });

  test('is CURRENT partway through the academic year', () => {
    assert.equal(computeEffectiveStatus(startDate, endDate, new Date('2026-01-15T00:00:00Z')), 'CURRENT');
  });

  test('is CURRENT on the exact end date', () => {
    assert.equal(computeEffectiveStatus(startDate, endDate, new Date('2026-07-31T00:00:00Z')), 'CURRENT');
  });

  test('is CLOSED after the end date (past academic year)', () => {
    assert.equal(computeEffectiveStatus(startDate, endDate, new Date('2026-08-01T00:00:00Z')), 'CLOSED');
  });

  test('is UPCOMING for a future academic year', () => {
    assert.equal(computeEffectiveStatus('2030-09-01', '2031-07-31', new Date('2026-01-01T00:00:00Z')), 'UPCOMING');
  });

  test('never marks two adjacent, non-overlapping years CURRENT at once', () => {
    const yearA = { startDate: '2025-09-01', endDate: '2026-07-31' };
    const yearB = { startDate: '2026-08-01', endDate: '2027-07-31' };
    // At the instant yearA ends, yearB hasn't started yet — only one CURRENT.
    const now = new Date('2026-07-31T00:00:00Z');
    const statusA = computeEffectiveStatus(yearA.startDate, yearA.endDate, now);
    const statusB = computeEffectiveStatus(yearB.startDate, yearB.endDate, now);
    assert.equal([statusA, statusB].filter((s) => s === 'CURRENT').length, 1);
  });
});
