const { BadRequestError, ConflictError } = require('../../../common/errors');

const MIN_ACADEMIC_YEAR_MONTHS = 9;
const MAX_ACADEMIC_YEAR_MONTHS = 12;
const EARLIEST_START_YEAR = 2000;

function fmtDate(d) {
  return new Date(d).toISOString().slice(0, 10);
}

// Adds `months` calendar months to `date`, clamping day-of-month overflow to
// the last day of the target month (e.g. Jan 31 + 1 month -> Feb 28, not
// Mar 3) — mirrors semesterRules.addMonthsUTC exactly; duplicated locally
// rather than shared so this module stays self-contained.
function addMonthsUTC(date, months) {
  const d = new Date(date);
  const year  = d.getUTCFullYear();
  const month = d.getUTCMonth() + months;
  const day   = d.getUTCDate();
  const result = new Date(Date.UTC(year, month, day));
  const expectedMonth = ((month % 12) + 12) % 12;
  if (result.getUTCMonth() !== expectedMonth) {
    result.setUTCDate(0);
  }
  return result;
}

// The name is always derived from startDate — never taken from client input —
// so "2025/2027"-style mismatches and manual typos are impossible by
// construction. endYear is always startYear + 1.
function deriveName(startDate) {
  const startYear = new Date(startDate).getUTCFullYear();
  return `${startYear}/${startYear + 1}`;
}

// An academic year must run at least MIN_ACADEMIC_YEAR_MONTHS and at most
// MAX_ACADEMIC_YEAR_MONTHS calendar months (e.g. Sept -> July is 10 months).
function assertDuration(startDate, endDate) {
  const start  = new Date(startDate);
  const end    = new Date(endDate);
  const minEnd = addMonthsUTC(start, MIN_ACADEMIC_YEAR_MONTHS);
  const maxEnd = addMonthsUTC(start, MAX_ACADEMIC_YEAR_MONTHS);
  if (end < minEnd) {
    throw new BadRequestError(`An academic year must be at least ${MIN_ACADEMIC_YEAR_MONTHS} months long.`);
  }
  if (end > maxEnd) {
    throw new BadRequestError(`An academic year must be at most ${MAX_ACADEMIC_YEAR_MONTHS} months long.`);
  }
}

// No academic year may start before EARLIEST_START_YEAR (2000/2001).
function assertEarliestYear(startDate) {
  const startYear = new Date(startDate).getUTCFullYear();
  if (startYear < EARLIEST_START_YEAR) {
    throw new BadRequestError(
      `The earliest allowed academic year is ${EARLIEST_START_YEAR}/${EARLIEST_START_YEAR + 1}.`,
    );
  }
}

// No two academic years may have overlapping date ranges. `excludeId` skips
// the record being updated when checked against its own siblings.
function assertNoOverlap(existingYears, startDate, endDate, excludeId) {
  const start = new Date(startDate);
  const end   = new Date(endDate);
  for (const y of existingYears) {
    if (excludeId && String(y._id) === String(excludeId)) continue;
    const yStart = new Date(y.startDate);
    const yEnd   = new Date(y.endDate);
    if (start < yEnd && end > yStart) {
      throw new ConflictError(
        `Academic year dates overlap with "${y.name}" (${fmtDate(yStart)} - ${fmtDate(yEnd)}).`,
      );
    }
  }
}

// Only the immediate next academic year may be created — no skipping ahead,
// no arbitrary future years. `latestYear` is the most recently starting
// existing academic year, or null/undefined if none exist yet (first-ever
// academic year — any valid start year is allowed to bootstrap the system).
function assertSequentialNext(startDate, latestYear) {
  if (!latestYear) return;
  const startYear       = new Date(startDate).getUTCFullYear();
  const latestStartYear = new Date(latestYear.startDate).getUTCFullYear();
  const expectedYear    = latestStartYear + 1;
  if (startYear !== expectedYear) {
    throw new BadRequestError(
      `Only the next sequential academic year can be created. `
      + `Expected ${expectedYear}/${expectedYear + 1}, got ${deriveName(startDate)}.`,
    );
  }
}

// True once `now` has reached the calendar month containing `endDate` (or
// later) — i.e. the academic year has one month or less remaining. Compared
// at whole-month granularity (not a fixed 30-day window) to avoid the
// day-of-month clamping that addMonthsUTC would otherwise introduce right at
// month boundaries.
function isWithinFinalMonth(endDate, now) {
  const end = new Date(endDate);
  const finalMonthStart = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  return now >= finalMonthStart;
}

// The next academic year can only be created once the current (latest) one
// has entered its final month. `latestYear` null/undefined (no academic
// years exist yet) always allows creation — this only gates the *next* one.
function assertCreationWindow(latestYear, now) {
  if (!latestYear) return;
  if (!isWithinFinalMonth(latestYear.endDate, now)) {
    throw new BadRequestError(
      'The next academic year can only be created during the final month of the current academic year.',
    );
  }
}

// Purely derived, never stored — UPCOMING before startDate, CLOSED after
// endDate, CURRENT for the inclusive range in between. Since academic years
// can never overlap (assertNoOverlap), at most one can ever be CURRENT at a
// given instant as a natural consequence, with no separate bookkeeping needed.
function computeEffectiveStatus(startDate, endDate, now) {
  const start = new Date(startDate);
  const end   = new Date(endDate);
  if (now < start) return 'UPCOMING';
  if (now > end) return 'CLOSED';
  return 'CURRENT';
}

module.exports = {
  MIN_ACADEMIC_YEAR_MONTHS,
  MAX_ACADEMIC_YEAR_MONTHS,
  EARLIEST_START_YEAR,
  addMonthsUTC,
  deriveName,
  assertDuration,
  assertEarliestYear,
  assertNoOverlap,
  assertSequentialNext,
  isWithinFinalMonth,
  assertCreationWindow,
  computeEffectiveStatus,
};
