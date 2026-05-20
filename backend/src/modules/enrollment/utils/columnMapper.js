const { PassThrough } = require('stream');
const csv = require('csv-parser');
const XLSX = require('xlsx');

// ── Column alias table ────────────────────────────────────────────────────────
// Keys are lower-cased, trimmed, collapsed-space versions of header names.
// Values are internal field names used throughout the app.
const FIELD_ALIASES = {
  // studentId
  studentid: 'studentId',
  student_id: 'studentId',
  'student id': 'studentId',
  studentno: 'studentId',
  student_no: 'studentId',
  'student no': 'studentId',
  id: 'studentId',

  // fullName
  fullname: 'fullName',
  full_name: 'fullName',
  'full name': 'fullName',
  name: 'fullName',
  studentname: 'fullName',
  student_name: 'fullName',
  'student name': 'fullName',

  // midterm
  midterm: 'midterm',
  mid_term: 'midterm',
  'mid term': 'midterm',
  midtermscore: 'midterm',
  midterm_score: 'midterm',
  'midterm score': 'midterm',
  mid: 'midterm',

  // final
  final: 'final',
  finalexam: 'final',
  final_exam: 'final',
  'final exam': 'final',
  finalscore: 'final',
  final_score: 'final',
  'final score': 'final',

  // coursework
  coursework: 'coursework',
  course_work: 'coursework',
  'course work': 'coursework',
  cw: 'coursework',
  assignment: 'coursework',
  assignments: 'coursework',
  courseworkscore: 'coursework',
  'coursework score': 'coursework',

  // attendance
  attendance: 'attendance',
  'attendance%': 'attendance',
  attendancepct: 'attendance',
  attendance_pct: 'attendance',
  'attendance pct': 'attendance',
  'attendance percentage': 'attendance',
  attend: 'attendance',
  att: 'attendance',

  // email
  email: 'email',
  emailaddress: 'email',
  email_address: 'email',
  'email address': 'email',
  mail: 'email',
};

function normaliseKey(key) {
  return String(key).toLowerCase().trim().replace(/\s+/g, ' ');
}

function normaliseRow(rawRow) {
  const out = {};
  for (const [key, value] of Object.entries(rawRow)) {
    const internal = FIELD_ALIASES[normaliseKey(key)];
    if (internal) out[internal] = value;
  }
  return out;
}

// ── Format parsers ────────────────────────────────────────────────────────────

function parseCsv(buffer) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const stream = new PassThrough();
    stream
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
    stream.end(buffer);
  });
}

function parseXlsx(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  // raw:true keeps numbers as numbers; defval:null fills empty cells with null
  return XLSX.utils.sheet_to_json(sheet, { raw: true, defval: null });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parses a file buffer and returns an array of normalised row objects.
 * @param {Buffer} buffer
 * @param {string} mimetype  - from multer's req.file.mimetype
 * @param {string} filename  - original file name (fallback for mimetype detection)
 */
async function parse(buffer, mimetype, filename) {
  const isXlsx =
    mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimetype === 'application/vnd.ms-excel' ||
    (filename && filename.toLowerCase().endsWith('.xlsx'));

  const rawRows = isXlsx ? parseXlsx(buffer) : await parseCsv(buffer);
  return rawRows.map(normaliseRow);
}

module.exports = { parse };
