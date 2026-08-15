const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveDailyPeriod,
  resolveWeeklyPeriod,
  resolveMonthlyPeriod,
  snapToWeekStart,
  weekDays,
  monthlyWeekBreakdown,
} = require('../src/modules/report/utils/reportPeriod');
const { BadRequestError } = require('../src/common/errors');

describe('resolveDailyPeriod', () => {
  test('spans exactly the given calendar day, 00:00:00 to 23:59:59', () => {
    const { start, end } = resolveDailyPeriod('2026-08-15');
    assert.equal(start.toISOString(), '2026-08-15T00:00:00.000Z');
    assert.equal(end.toISOString(),   '2026-08-15T23:59:59.999Z');
  });

  test('rejects an invalid date', () => {
    assert.throws(() => resolveDailyPeriod('not-a-date'), BadRequestError);
  });
});

describe('resolveWeeklyPeriod', () => {
  test('spans Saturday 00:00:00 through Wednesday 23:59:59 (5 days)', () => {
    // 2026-08-01 is a Saturday.
    const { start, end } = resolveWeeklyPeriod('2026-08-01');
    assert.equal(start.toISOString(), '2026-08-01T00:00:00.000Z'); // Saturday
    assert.equal(end.toISOString(),   '2026-08-05T23:59:59.999Z'); // Wednesday
  });

  test('excludes Thursday and Friday from the window', () => {
    const { end } = resolveWeeklyPeriod('2026-08-01');
    const thursday = new Date('2026-08-06T00:00:00.000Z');
    const friday    = new Date('2026-08-07T00:00:00.000Z');
    assert.ok(thursday > end, 'Thursday must fall after the weekly period ends');
    assert.ok(friday > end,   'Friday must fall after the weekly period ends');
  });

  test('rejects a non-Saturday start date', () => {
    assert.throws(() => resolveWeeklyPeriod('2026-08-02'), BadRequestError); // Sunday
    assert.throws(() => resolveWeeklyPeriod('2026-08-06'), BadRequestError); // Thursday
  });
});

describe('snapToWeekStart', () => {
  const cases = [
    ['2026-08-01', '2026-08-01'], // Saturday -> itself
    ['2026-08-02', '2026-08-01'], // Sunday -> preceding Saturday
    ['2026-08-03', '2026-08-01'], // Monday -> preceding Saturday
    ['2026-08-04', '2026-08-01'], // Tuesday -> preceding Saturday
    ['2026-08-05', '2026-08-01'], // Wednesday -> preceding Saturday
    ['2026-08-06', '2026-08-08'], // Thursday -> NEXT Saturday (not part of any week)
    ['2026-08-07', '2026-08-08'], // Friday -> next Saturday
    ['2026-08-08', '2026-08-08'], // Saturday -> itself
  ];

  for (const [input, expected] of cases) {
    test(`${input} snaps to Saturday ${expected}`, () => {
      assert.equal(snapToWeekStart(input).toISOString().slice(0, 10), expected);
    });
  }
});

describe('resolveMonthlyPeriod', () => {
  test('August 2026 spans Aug 1 00:00:00 to Aug 31 23:59:59', () => {
    const { start, end } = resolveMonthlyPeriod(2026, 8);
    assert.equal(start.toISOString(), '2026-08-01T00:00:00.000Z');
    assert.equal(end.toISOString(),   '2026-08-31T23:59:59.999Z');
  });

  test('February in a leap year spans through the 29th', () => {
    const { end } = resolveMonthlyPeriod(2028, 2);
    assert.equal(end.toISOString(), '2028-02-29T23:59:59.999Z');
  });

  test('February in a non-leap year spans through the 28th', () => {
    const { end } = resolveMonthlyPeriod(2026, 2);
    assert.equal(end.toISOString(), '2026-02-28T23:59:59.999Z');
  });

  test('rejects an out-of-range month', () => {
    assert.throws(() => resolveMonthlyPeriod(2026, 13), BadRequestError);
    assert.throws(() => resolveMonthlyPeriod(2026, 0),  BadRequestError);
  });
});

describe('weekDays', () => {
  test('returns Saturday..Wednesday in order, never Thursday/Friday', () => {
    const days = weekDays(new Date('2026-08-01T00:00:00.000Z'));
    assert.deepEqual(days.map((d) => d.label), ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday']);
    assert.deepEqual(
      days.map((d) => d.date.toISOString().slice(0, 10)),
      ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05'],
    );
  });
});

describe('monthlyWeekBreakdown', () => {
  test('a month starting exactly on a Saturday divides into clean 5-day weeks', () => {
    // August 2026 starts on a Saturday and has 31 days -> weeks of
    // [1-5][8-12][15-19][22-26][29-31] (last one clipped mid-week by month end).
    const { start, end } = resolveMonthlyPeriod(2026, 8);
    const weeks = monthlyWeekBreakdown(start, end);
    assert.equal(weeks.length, 5);
    assert.equal(weeks[0].start.toISOString().slice(0, 10), '2026-08-01');
    assert.equal(weeks[0].end.toISOString().slice(0, 10),   '2026-08-05');
    assert.equal(weeks[4].start.toISOString().slice(0, 10), '2026-08-29');
    assert.equal(weeks[4].end.toISOString().slice(0, 10),   '2026-08-31'); // clipped — Wed would be Sep 2
  });

  test('a month NOT starting on a Saturday still uses Sat-Wed weeks, clipped at the month boundary', () => {
    // September 2026: Sep 1 is a Tuesday. Its reporting week starts Saturday
    // Aug 29, but must be clipped to start at Sep 1 for this month's breakdown.
    const { start, end } = resolveMonthlyPeriod(2026, 9);
    assert.equal(new Date('2026-09-01T00:00:00Z').getUTCDay(), 2); // sanity: Tuesday
    const weeks = monthlyWeekBreakdown(start, end);
    assert.equal(weeks[0].start.toISOString().slice(0, 10), '2026-09-01', 'first week clipped to month start');
    assert.equal(weeks[0].weekStart.toISOString().slice(0, 10), '2026-08-29', 'natural week start is still the real Saturday');
  });
});
