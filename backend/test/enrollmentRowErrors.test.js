const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const describeRowError = require('../src/modules/enrollment/utils/describeRowError');

// ── describeRowError — bulk-upload row-level error messages must always ────
// name the actual problem, never surface a raw Mongoose error verbatim, and
// never collapse into a bare "Upload failed" (spec Sections 11/14).
describe('describeRowError', () => {
  test('translates a duplicate-key (E11000) error into a readable constraint message', () => {
    const err = { code: 11000, keyValue: { studentId: 'CS20250017' } };
    assert.equal(
      describeRowError(err),
      'Database constraint violation: duplicate value for studentId.',
    );
  });

  test('falls back to a generic field label when E11000 has no keyValue', () => {
    const err = { code: 11000 };
    assert.equal(
      describeRowError(err),
      'Database constraint violation: duplicate value for field.',
    );
  });

  test('joins every Mongoose ValidationError sub-message', () => {
    const err = {
      name: 'ValidationError',
      errors: {
        fullName: { message: 'Path `fullName` is required.' },
        averageScore: { message: 'averageScore must be between 0 and 100.' },
      },
    };
    assert.equal(
      describeRowError(err),
      'Database validation failed: Path `fullName` is required.; averageScore must be between 0 and 100.',
    );
  });

  test('falls back to the raw error message for anything else', () => {
    assert.equal(describeRowError(new Error('cohort is closed')), 'cohort is closed');
  });

  test('never returns an empty or generic "upload failed" message', () => {
    const err = {};
    const message = describeRowError(err);
    assert.ok(message.length > 0);
    assert.notEqual(message.toLowerCase(), 'upload failed');
  });
});
