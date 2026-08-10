const { BadRequestError, ConflictError } = require('../../../common/errors');

const MIN_SEMESTER_MONTHS    = 4;
const MAX_SEMESTER_MONTHS    = 6;
const MAX_SEMESTERS_PER_YEAR = 12;
const SEMESTER_NAME_PATTERN  = /^Semester (\d+)$/i;

function fmtDate(d) {
  return new Date(d).toISOString().slice(0, 10);
}

// Adds `months` calendar months to `date`, clamping day-of-month overflow to
// the last day of the target month (e.g. Jan 31 + 1 month -> Feb 28, not
// Mar 3) — plain Date#setMonth rolls over instead of clamping, which would
// silently shift the 4-6 month window right at month-end boundaries.
function addMonthsUTC(date, months) {
  const d = new Date(date);
  const year  = d.getUTCFullYear();
  const month = d.getUTCMonth() + months;
  const day   = d.getUTCDate();
  const result = new Date(Date.UTC(year, month, day));
  const expectedMonth = ((month % 12) + 12) % 12;
  if (result.getUTCMonth() !== expectedMonth) {
    // Day overflowed into the month after the intended one — clamp back to
    // the intended month's last day instead of letting it roll forward.
    result.setUTCDate(0);
  }
  return result;
}

// A semester must run at least MIN_SEMESTER_MONTHS and at most
// MAX_SEMESTER_MONTHS calendar months.
function assertDuration(startDate, endDate) {
  const start  = new Date(startDate);
  const end    = new Date(endDate);
  const minEnd = addMonthsUTC(start, MIN_SEMESTER_MONTHS);
  const maxEnd = addMonthsUTC(start, MAX_SEMESTER_MONTHS);
  if (end < minEnd) {
    throw new BadRequestError(`A semester must be at least ${MIN_SEMESTER_MONTHS} months long.`);
  }
  if (end > maxEnd) {
    throw new BadRequestError(`A semester must be at most ${MAX_SEMESTER_MONTHS} months long.`);
  }
}

// Semester dates must fall entirely within the academic year's own dates —
// it may not start before the year starts or end after the year ends.
function assertWithinAcademicYear(startDate, endDate, academicYear) {
  const start   = new Date(startDate);
  const end     = new Date(endDate);
  const ayStart = new Date(academicYear.startDate);
  const ayEnd   = new Date(academicYear.endDate);
  if (start < ayStart || end > ayEnd) {
    throw new BadRequestError(
      `Semester dates must fall within the academic year's date range (${fmtDate(ayStart)} - ${fmtDate(ayEnd)}).`,
    );
  }
}

// No two semesters within the same academic year may have overlapping date
// ranges. `excludeId` skips the semester being updated when checked against
// its own siblings.
function assertNoOverlap(existingSemesters, startDate, endDate, excludeId) {
  const start = new Date(startDate);
  const end   = new Date(endDate);
  for (const s of existingSemesters) {
    if (excludeId && String(s._id) === String(excludeId)) continue;
    const sStart = new Date(s.startDate);
    const sEnd   = new Date(s.endDate);
    if (start < sEnd && end > sStart) {
      throw new ConflictError(
        `Semester dates overlap with "${s.name}" (${fmtDate(sStart)} - ${fmtDate(sEnd)}).`,
      );
    }
  }
}

// Picks the next unused "Semester N" (1-12) for an academic year. The name
// is always derived from what already exists rather than taken from client
// input, so it can never be spoofed, mistyped, or duplicated through the API.
// Returns null once all 12 slots are taken.
function nextSemesterName(existingSemesters) {
  const used = new Set();
  for (const s of existingSemesters) {
    const match = SEMESTER_NAME_PATTERN.exec(String(s.name).trim());
    if (match) used.add(Number(match[1]));
  }
  for (let n = 1; n <= MAX_SEMESTERS_PER_YEAR; n++) {
    if (!used.has(n)) return `Semester ${n}`;
  }
  return null;
}

module.exports = {
  MIN_SEMESTER_MONTHS,
  MAX_SEMESTER_MONTHS,
  MAX_SEMESTERS_PER_YEAR,
  addMonthsUTC,
  assertDuration,
  assertWithinAcademicYear,
  assertNoOverlap,
  nextSemesterName,
};
