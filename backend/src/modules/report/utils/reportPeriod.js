const { BadRequestError } = require('../../../common/errors');

// All period math is done in UTC to avoid server-timezone drift, matching
// the same convention semesterRules.js's addMonthsUTC already established.

function parseDate(input, label) {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) throw new BadRequestError(`Invalid ${label}`);
  return d;
}

// Daily: the given calendar day, 00:00:00.000 -> 23:59:59.999 UTC.
function resolveDailyPeriod(dateStr) {
  const d = parseDate(dateStr, 'date');
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  const end   = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
  return { start, end };
}

// Given ANY date, returns the Saturday (UTC midnight) that starts its
// reporting week. Thu/Fri aren't part of any reporting week, so a date
// landing on either snaps FORWARD to the upcoming Saturday rather than being
// silently folded into the week that just ended.
function snapToWeekStart(dateStr) {
  const d = parseDate(dateStr, 'date');
  const day = d.getUTCDay(); // Sun=0 .. Sat=6
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (day === 6) {
    // already Saturday
  } else if (day <= 3) {
    // Sun(1)/Mon(2)/Tue(3)/Wed(4) days back to the preceding Saturday
    start.setUTCDate(start.getUTCDate() - (day + 1));
  } else {
    // Thu(4)/Fri(5) -> forward to the next Saturday
    start.setUTCDate(start.getUTCDate() + (6 - day));
  }
  return start;
}

// Weekly: Saturday 00:00:00 -> Wednesday 23:59:59 UTC (5 days — Thu/Fri
// excluded entirely). `weekStartStr` must already be a Saturday; use
// snapToWeekStart first if the input might not be. Validated here too since
// this is also reachable directly from request input.
function resolveWeeklyPeriod(weekStartStr) {
  const d = parseDate(weekStartStr, 'week start date');
  if (d.getUTCDay() !== 6) {
    throw new BadRequestError('Weekly report period must start on a Saturday');
  }
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  const end   = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 4, 23, 59, 59, 999));
  return { start, end };
}

// Monthly: calendar month, day 1 00:00:00 -> last day 23:59:59 UTC.
// `month` is 1-12 (calendar convention, not JS's 0-indexed Date months).
function resolveMonthlyPeriod(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
    throw new BadRequestError('Invalid year/month');
  }
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  // Day 0 of the following month == the last day of this month.
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return { start, end };
}

// The 5 reporting-week day labels in order, anchored to a given Saturday
// weekStart — used to build the mandatory Sat..Wed daily breakdown.
const WEEK_DAY_LABELS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday'];

function weekDays(weekStart) {
  return WEEK_DAY_LABELS.map((label, i) => {
    const date = new Date(Date.UTC(
      weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + i,
    ));
    return { label, date };
  });
}

// Splits a monthly period into the Sat-Wed reporting weeks it overlaps,
// clipped to the month's own boundaries — so the breakdown always respects
// the system's Sat-Wed week definition (never Mon-Sun) even though a
// calendar month essentially never starts or ends on a Saturday.
function monthlyWeekBreakdown(monthStart, monthEnd) {
  const weeks = [];
  let cursor = snapToWeekStart(monthStart.toISOString());
  // If the month starts mid-week (Sun..Wed), that week's Saturday is before
  // the month — still the correct week to report, just clipped at monthStart.
  while (cursor <= monthEnd) {
    const { end: naturalEnd } = resolveWeeklyPeriod(cursor.toISOString());
    const clippedStart = cursor < monthStart ? monthStart : cursor;
    const clippedEnd   = naturalEnd > monthEnd ? monthEnd : naturalEnd;
    weeks.push({ weekStart: cursor, start: clippedStart, end: clippedEnd });
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + 7));
  }
  return weeks;
}

module.exports = {
  resolveDailyPeriod,
  resolveWeeklyPeriod,
  resolveMonthlyPeriod,
  snapToWeekStart,
  weekDays,
  monthlyWeekBreakdown,
};
