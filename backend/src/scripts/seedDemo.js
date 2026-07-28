'use strict';

// Load .env before anything else (same pattern as server.js)
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

// ── Model imports ─────────────────────────────────────────────────────────────
const User               = require('../modules/user/models/User');
const Faculty            = require('../modules/faculty/models/Faculty');
const Department         = require('../modules/department/models/Department');
const Course             = require('../modules/course/models/Course');
const AcademicYear       = require('../modules/academicYear/models/AcademicYear');
const Semester           = require('../modules/semester/models/Semester');
const Cohort             = require('../modules/cohort/models/Cohort');
const Student            = require('../modules/student/models/Student');
const CourseOffering     = require('../modules/courseOffering/models/CourseOffering');
const InstructorAssignment = require('../modules/instructorAssignment/models/InstructorAssignment');
const Attendance         = require('../modules/attendance/models/Attendance');
const Group              = require('../modules/group/models/Group');
const GroupHistory       = require('../modules/grouping/models/GroupHistory');
const PerformanceSettings = require('../modules/performance/models/PerformanceSettings');
const GroupGenerationService = require('../modules/grouping/services/GroupGenerationService');
const attendanceRepository   = require('../modules/attendance/repositories/attendanceRepository');

const BCRYPT_ROUNDS = 12;

// ── Seed data ─────────────────────────────────────────────────────────────────

const INSTRUCTORS = [
  { fullName: 'Dr. Hassan Abdi',   email: 'dr.hassan@just.edu.so', password: 'Inst@12345' },
  { fullName: 'Dr. Farah Nuur',    email: 'dr.farah@just.edu.so',  password: 'Inst@12345' },
  { fullName: 'Dr. Amina Warsame', email: 'dr.amina@just.edu.so',  password: 'Inst@12345' },
];

const COURSES = [
  { name: 'Databases',            code: 'DB401'  },
  { name: 'Computer Networks',    code: 'NET301' },
  { name: 'Software Project',     code: 'SP501'  },
  { name: 'Web Development',      code: 'WD201'  },
  { name: 'Artificial Intelligence', code: 'AI401' },
];

// 60 Somali student names — unique, correctly spelled
// Ordered: 15 HIGH (0-14), 25 MEDIUM (15-39), 15 LOW (40-54), 5 UNGRADED (55-59)
const STUDENT_DATA = [
  // ── HIGH (15) ── averageScore 78–95
  { fullName: 'Abdi Hassan Warsame',    score: 95 },
  { fullName: 'Faadumo Nuur Osman',     score: 92 },
  { fullName: 'Mohamed Ibrahim Ali',    score: 91 },
  { fullName: 'Khadija Ahmed Hassan',   score: 89 },
  { fullName: 'Yusuf Omar Abdi',        score: 88 },
  { fullName: 'Safia Jama Farah',       score: 87 },
  { fullName: 'Ahmed Musse Nuur',       score: 85 },
  { fullName: 'Hodan Abdullahi Omar',   score: 84 },
  { fullName: 'Abdifatah Farah Hussein',score: 83 },
  { fullName: 'Amina Yusuf Abdulle',    score: 82 },
  { fullName: 'Guled Ibrahim Aden',     score: 80 },
  { fullName: 'Maryam Hassan Isse',     score: 80 },
  { fullName: 'Mahad Ali Mohamed',      score: 79 },
  { fullName: 'Deeqo Omar Warsame',     score: 78 },
  { fullName: 'Sharif Abdi Farah',      score: 78 },

  // ── MEDIUM (25) ── averageScore 51–74
  { fullName: 'Fartun Ahmed Jama',      score: 74 },
  { fullName: 'Ibrahim Nuur Mohamed',   score: 73 },
  { fullName: 'Luul Hassan Abdi',       score: 72 },
  { fullName: 'Abdirahman Osman Yusuf', score: 71 },
  { fullName: 'Nimco Farah Ali',        score: 70 },
  { fullName: 'Saciid Ibrahim Musse',   score: 69 },
  { fullName: 'Qali Mohamed Hassan',    score: 68 },
  { fullName: 'Omar Abdulle Nuur',      score: 67 },
  { fullName: 'Ifrah Yusuf Aden',       score: 66 },
  { fullName: 'Mukhtar Ali Osman',      score: 65 },
  { fullName: 'Suad Hassan Farah',      score: 64 },
  { fullName: 'Abdullahi Jama Omar',    score: 63 },
  { fullName: 'Zamzam Farah Abdi',      score: 62 },
  { fullName: 'Faarax Musse Warsame',   score: 61 },
  { fullName: 'Najma Ahmed Isse',       score: 60 },
  { fullName: 'Ali Hassan Mohamed',     score: 59 },
  { fullName: 'Caasha Nuur Ibrahim',    score: 58 },
  { fullName: 'Yasin Omar Qaasim',      score: 57 },
  { fullName: 'Sahro Abdi Duale',       score: 56 },
  { fullName: 'Idris Farah Hassan',     score: 55 },
  { fullName: 'Sagal Ahmed Warsame',    score: 54 },
  { fullName: 'Mahdi Omar Ali',         score: 53 },
  { fullName: 'Filsan Abdullahi Osman', score: 52 },
  { fullName: 'Burhan Hassan Farah',    score: 52 },
  { fullName: 'Nasra Ibrahim Nuur',     score: 51 },

  // ── LOW (15) ── averageScore 20–49
  { fullName: 'Abdiqadir Omar Abdi',    score: 46 },
  { fullName: 'Fadumo Hassan Musse',    score: 43 },
  { fullName: 'Liban Nuur Farah',       score: 40 },
  { fullName: 'Rahma Ahmed Aden',       score: 39 },
  { fullName: 'Yoonis Ibrahim Ali',     score: 38 },
  { fullName: 'Asad Mohamed Osman',     score: 35 },
  { fullName: 'Cawo Hassan Jama',       score: 34 },
  { fullName: 'Bashir Abdi Warsame',    score: 33 },
  { fullName: 'Hibo Farah Nuur',        score: 30 },
  { fullName: 'Jamal Yusuf Mohamed',    score: 29 },
  { fullName: 'Samira Omar Hassan',     score: 28 },
  { fullName: 'Warsan Ali Ibrahim',     score: 25 },
  { fullName: 'Tifow Ahmed Abdi',       score: 24 },
  { fullName: 'Khadar Musse Isse',      score: 22 },
  { fullName: 'Shadia Hassan Farah',    score: 20 },

  // ── UNGRADED (5) ── no score yet
  { fullName: 'Naciimo Omar Ali',       score: null },
  { fullName: 'Cumar Hassan Nuur',      score: null },
  { fullName: 'Ruun Mohamed Aden',      score: null },
  { fullName: 'Leyla Yusuf Omar',       score: null },
  { fullName: 'Jaceyl Abdi Farah',      score: null },
];

// Returns performance category for a given score using the thresholds (high=75, medium=50)
function category(score) {
  if (score === null) return null;
  if (score >= 75)   return 'HIGH';
  if (score >= 50)   return 'MEDIUM';
  return 'LOW';
}

// ── Attendance helpers ────────────────────────────────────────────────────────

// Build attendance percentages for 60 students for one offering.
// scatterIndices: student indices (0-based) that get attendance < 25%.
// Everyone else gets a realistic higher attendance.
function buildAttendancePcts(scatterIndices, seed) {
  const set = new Set(scatterIndices);
  // Use a simple LCG for reproducible "random-looking" values
  let r = seed;
  const rng = () => { r = (r * 1664525 + 1013904223) & 0xffffffff; return Math.abs(r) / 0x80000000; };

  return STUDENT_DATA.map((_, i) => {
    if (set.has(i)) {
      // Below threshold: 5–24%
      return Math.floor(rng() * 20) + 5;
    }
    // Above threshold: 30–100%, realistic spread
    return Math.floor(rng() * 71) + 30;
  });
}

// For Sem 7: 18 students scattered (indices chosen to include some from every category)
// Deliberately picks LOW students + some MEDIUM + 1-2 HIGH for realism
const SEM7_DB_SCATTER    = [40,41,42,43,44,45,46,47,48,49,50,51,52,53,54, 22,23,32,1];  // 19 — trim to 18
const SEM7_NET_SCATTER   = [40,41,42,43,44,45,46,47,48,49,50,51,52,53,54, 20,21,30];    // 18
const SEM7_SP_SCATTER    = [40,41,42,43,44,45,46,47,48,49,50,51,52,53,54, 25,26,33];    // 18

// For Sem 6 history (WD and AI): 15 scattered
const SEM6_WD_SCATTER    = [40,41,42,43,44,45,46,47,48,49,50,51,52,53,54];
const SEM6_AI_SCATTER    = [40,41,42,43,44,45,46,47,48,49,51,52,53,54, 28,16];

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log('\n[seed] Connected to MongoDB');

  // ── WIPE (preserve admin account) ────────────────────────────────────────────

  console.log('\n[seed] Wiping collections …');

  // Find admin so we can preserve it
  const admin = await User.findOne({ role: 'admin', deletedAt: null });
  if (!admin) { console.error('[seed] No admin user found. Run the server once to seed admin first.'); process.exit(1); }
  console.log(`       Admin preserved: ${admin.email} (${admin._id})`);

  // Drop student and instructor users
  await User.deleteMany({ role: { $in: ['student', 'instructor'] } });

  // Drop all operational collections
  await Promise.all([
    mongoose.connection.db.collection('students').deleteMany({}),
    mongoose.connection.db.collection('groups').deleteMany({}),
    mongoose.connection.db.collection('grouphistories').deleteMany({}),
    mongoose.connection.db.collection('workspaces').deleteMany({}),
    mongoose.connection.db.collection('attendances').deleteMany({}),
    mongoose.connection.db.collection('tasks').deleteMany({}),
    mongoose.connection.db.collection('submissions').deleteMany({}),
    mongoose.connection.db.collection('feedbacks').deleteMany({}),
    mongoose.connection.db.collection('notifications').deleteMany({}),
    mongoose.connection.db.collection('auditlogs').deleteMany({}),
    mongoose.connection.db.collection('faculties').deleteMany({}),
    mongoose.connection.db.collection('departments').deleteMany({}),
    mongoose.connection.db.collection('courses').deleteMany({}),
    mongoose.connection.db.collection('academicyears').deleteMany({}),
    mongoose.connection.db.collection('semesters').deleteMany({}),
    mongoose.connection.db.collection('cohorts').deleteMany({}),
    mongoose.connection.db.collection('courseofferings').deleteMany({}),
    mongoose.connection.db.collection('performancesettings').deleteMany({}),
  ]);
  console.log('       Done.\n');

  // ── INSTRUCTORS ───────────────────────────────────────────────────────────────

  console.log('[seed] Creating instructors …');
  const instructorDocs = [];
  for (const inst of INSTRUCTORS) {
    const passwordHash = await bcrypt.hash(inst.password, BCRYPT_ROUNDS);
    const doc = await User.create({
      email: inst.email, fullName: inst.fullName,
      passwordHash, role: 'instructor',
      mustChangePassword: false, isActive: true,
    });
    instructorDocs.push(doc);
    console.log(`       + ${inst.fullName} (${inst.email})`);
  }
  const [drHassan, drFarah, drAmina] = instructorDocs;

  // ── ACADEMIC STRUCTURE ────────────────────────────────────────────────────────

  console.log('\n[seed] Creating academic structure …');
  const faculty = await Faculty.create({
    name: 'Faculty of Engineering and Technology',
    createdBy: admin._id,
  });

  const dept = await Department.create({
    facultyId: faculty._id,
    name: 'Software Engineering',
    createdBy: admin._id,
  });

  const courseDocs = {};
  for (const c of COURSES) {
    const doc = await Course.create({
      departmentId: dept._id, name: c.name, code: c.code, createdBy: admin._id,
    });
    courseDocs[c.code] = doc;
  }
  console.log(`       Faculty: ${faculty.name}`);
  console.log(`       Department: ${dept.name}`);
  console.log(`       Courses: ${COURSES.map(c => c.code).join(', ')}`);

  // ── ACADEMIC YEAR + SEMESTERS ─────────────────────────────────────────────────

  console.log('\n[seed] Creating academic year and semesters …');
  const academicYear = await AcademicYear.create({
    name: '2025/2026',
    startDate: new Date('2025-09-01'),
    endDate:   new Date('2026-06-30'),
    status: 'active',
    createdBy: admin._id,
  });

  const sem6 = await Semester.create({
    academicYearId: academicYear._id,
    name: 'Semester 6',
    startDate: new Date('2025-09-01'),
    endDate:   new Date('2026-01-31'),
    status: 'completed',
    createdBy: admin._id,
  });

  const sem7 = await Semester.create({
    academicYearId: academicYear._id,
    name: 'Semester 7',
    startDate: new Date('2026-02-01'),
    endDate:   new Date('2026-06-30'),
    status: 'active',
    createdBy: admin._id,
  });
  console.log(`       ${academicYear.name}: Semester 6 (completed), Semester 7 (active)`);

  // ── COHORT ────────────────────────────────────────────────────────────────────

  console.log('\n[seed] Creating cohort CA226 …');
  const cohort = await Cohort.create({
    name: 'CA226',
    departmentId: dept._id,
    yearOfEntry: 2022,
    description: 'Software Engineering entry cohort of 2022',
    createdBy: admin._id,
  });

  // ── PERFORMANCE SETTINGS ──────────────────────────────────────────────────────

  await PerformanceSettings.create({
    thresholds: { high: 75, medium: 50 },
    updatedBy: admin._id,
    updatedAt: new Date(),
  });
  console.log('       PerformanceSettings: high=75, medium=50');

  // ── STUDENTS (60) ─────────────────────────────────────────────────────────────

  console.log('\n[seed] Creating 60 students in CA226 …');
  const studentDocs = [];

  for (let i = 0; i < STUDENT_DATA.length; i++) {
    const { fullName, score } = STUDENT_DATA[i];
    const studentId   = `2022SW${String(i + 1).padStart(4, '0')}`;
    const tempPw      = `Temp@${String(1001 + i).padStart(4, '0')}`;
    const passwordHash = await bcrypt.hash(tempPw, BCRYPT_ROUNDS);

    const user = await User.create({
      studentId, fullName,
      passwordHash, role: 'student',
      mustChangePassword: true, isActive: true,
    });

    const perf = category(score);
    const student = await Student.create({
      userId: user._id,
      cohortId: cohort._id,
      fullName,
      averageScore: score,
      performanceCategory: perf,
    });

    studentDocs.push(student);
  }

  const counts = {
    HIGH:     studentDocs.filter(s => s.performanceCategory === 'HIGH').length,
    MEDIUM:   studentDocs.filter(s => s.performanceCategory === 'MEDIUM').length,
    LOW:      studentDocs.filter(s => s.performanceCategory === 'LOW').length,
    UNGRADED: studentDocs.filter(s => s.performanceCategory === null).length,
  };
  console.log(`       Created: ${studentDocs.length} students`);
  console.log(`       HIGH=${counts.HIGH}  MEDIUM=${counts.MEDIUM}  LOW=${counts.LOW}  UNGRADED=${counts.UNGRADED}`);

  // ── SEM 7 COURSE OFFERINGS (active) ──────────────────────────────────────────

  console.log('\n[seed] Creating Semester 7 course offerings …');
  const off_db  = await CourseOffering.create({
    courseId: courseDocs['DB401']._id,  cohortId: cohort._id,
    semesterId: sem7._id,
    status: 'active', createdBy: admin._id,
  });
  const off_net = await CourseOffering.create({
    courseId: courseDocs['NET301']._id, cohortId: cohort._id,
    semesterId: sem7._id,
    status: 'active', createdBy: admin._id,
  });
  const off_sp  = await CourseOffering.create({
    courseId: courseDocs['SP501']._id,  cohortId: cohort._id,
    semesterId: sem7._id,
    status: 'active', createdBy: admin._id,
  });
  await InstructorAssignment.insertMany([
    { courseOfferingId: off_db._id,  instructorId: drHassan._id, startDate: off_db.createdAt,  endDate: null, assignedBy: admin._id },
    { courseOfferingId: off_net._id, instructorId: drFarah._id,  startDate: off_net.createdAt, endDate: null, assignedBy: admin._id },
    { courseOfferingId: off_sp._id,  instructorId: drAmina._id,  startDate: off_sp.createdAt,  endDate: null, assignedBy: admin._id },
  ]);
  console.log('       DB401 (Dr. Hassan) | NET301 (Dr. Farah) | SP501 (Dr. Amina)');

  // ── SEM 7 ATTENDANCE ──────────────────────────────────────────────────────────

  console.log('\n[seed] Creating Semester 7 attendance records …');

  async function createAttendance(offeringId, pcts, updatedBy) {
    const docs = studentDocs.map((s, i) => ({
      studentId: s._id,
      courseOfferingId: offeringId,
      percentage: pcts[i],
      updatedBy,
    }));
    await Attendance.insertMany(docs);
    const below = pcts.filter(p => p < 25).length;
    console.log(`       Offering ${offeringId}: ${pcts.length} records, ${below} below 25% threshold`);
  }

  const db_pcts  = buildAttendancePcts(SEM7_DB_SCATTER.slice(0, 18),  42);
  const net_pcts = buildAttendancePcts(SEM7_NET_SCATTER,               77);
  const sp_pcts  = buildAttendancePcts(SEM7_SP_SCATTER,                99);

  await createAttendance(off_db._id,  db_pcts,  drHassan._id);
  await createAttendance(off_net._id, net_pcts, drFarah._id);
  await createAttendance(off_sp._id,  sp_pcts,  drAmina._id);

  // ── SEM 6 COURSE OFFERINGS (completed) + GROUP HISTORY ───────────────────────

  console.log('\n[seed] Creating Semester 6 course offerings …');
  const off_wd = await CourseOffering.create({
    courseId: courseDocs['WD201']._id, cohortId: cohort._id,
    semesterId: sem6._id,
    status: 'completed', createdBy: admin._id,
  });
  const off_ai = await CourseOffering.create({
    courseId: courseDocs['AI401']._id, cohortId: cohort._id,
    semesterId: sem6._id,
    status: 'completed', createdBy: admin._id,
  });
  await InstructorAssignment.insertMany([
    { courseOfferingId: off_wd._id, instructorId: drHassan._id, startDate: off_wd.createdAt, endDate: null, assignedBy: admin._id },
    { courseOfferingId: off_ai._id, instructorId: drFarah._id,  startDate: off_ai.createdAt, endDate: null, assignedBy: admin._id },
  ]);
  console.log('       WD201 (Dr. Hassan, completed) | AI401 (Dr. Farah, completed)');

  // Create Sem 6 attendance records (so the engine has data for history generation)
  const wd_pcts = buildAttendancePcts(SEM6_WD_SCATTER, 13);
  const ai_pcts = buildAttendancePcts(SEM6_AI_SCATTER, 55);

  await Attendance.insertMany(studentDocs.map((s, i) => ({
    studentId: s._id, courseOfferingId: off_wd._id,
    percentage: wd_pcts[i], updatedBy: drHassan._id,
  })));
  await Attendance.insertMany(studentDocs.map((s, i) => ({
    studentId: s._id, courseOfferingId: off_ai._id,
    percentage: ai_pcts[i], updatedBy: drFarah._id,
  })));

  // ── Generate Sem 6 groups (for history) ──────────────────────────────────────

  console.log('\n[seed] Generating Semester 6 groups for pair-avoidance history …');

  async function generateSem6History(offering, courseName, pcts, priorHistory) {
    // Build student objects with attendance merged
    const students = studentDocs.map((s, i) => ({
      ...s.toObject(),
      attendance: pcts[i],
    }));

    // Generate using the pure algorithm (no auth, no DB read)
    const { assembledGroups, summary } = GroupGenerationService.generateFromData(
      students, priorHistory, 4, { attendanceThreshold: 25 },
    );

    const generationId  = new mongoose.Types.ObjectId();
    const generatedAt   = new Date(offering.createdAt || Date.now());
    const cohortIdStr   = cohort._id;

    // Save as archived groups
    const groupDocs = [];
    for (let i = 0; i < assembledGroups.length; i++) {
      const { members, leaderId } = assembledGroups[i];
      const g = await Group.create({
        courseOfferingId:   offering._id,
        name:               `${courseName} Group ${i + 1}`,
        leaderId,
        memberIds:          members.map(m => m._id),
        generatedAt,
        generationId,
        generationOptions:  { groupSize: 4, attendanceThreshold: 25 },
        status:             'archived',
        createdBy:          admin._id,
      });
      groupDocs.push(g);
    }

    // Write GroupHistory (with cohortId — used for cross-semester pair-avoidance)
    const historyDocs = assembledGroups.map(({ members, leaderId }) => ({
      courseOfferingId: offering._id,
      cohortId:         cohortIdStr,
      generationId,
      memberIds:        members.map(m => m._id),
      leaderId,
      generatedAt,
      groupSize: 4,
      options: { attendanceThreshold: 25 },
    }));
    await GroupHistory.insertMany(historyDocs);

    console.log(`       ${courseName}: ${assembledGroups.length} groups archived, ${historyDocs.length} history records written`);
    console.log(`         Breakdown: HIGH=${summary.breakdown.HIGH} MEDIUM=${summary.breakdown.MEDIUM} LOW=${summary.breakdown.LOW} UNGRADED=${summary.breakdown.UNGRADED}`);

    return historyDocs; // return for use as prior history in next generation
  }

  // WD201 first — no prior history
  const wdHistory = await generateSem6History(off_wd, 'Web Development', wd_pcts, []);

  // AI401 second — uses WD201 history for pair-avoidance
  await generateSem6History(off_ai, 'Artificial Intelligence', ai_pcts, wdHistory);

  // ── FINAL COUNTS ──────────────────────────────────────────────────────────────

  console.log('\n[seed] ══ SUMMARY ══════════════════════════════════════════');
  const [
    userCount, studentCount, cohortCount, offeringCount,
    attendanceCount, groupCount, historyCount,
  ] = await Promise.all([
    User.countDocuments({ deletedAt: null }),
    Student.countDocuments({ deletedAt: null }),
    Cohort.countDocuments({ deletedAt: null }),
    CourseOffering.countDocuments({ deletedAt: null }),
    Attendance.countDocuments({}),
    Group.countDocuments({ deletedAt: null }),
    GroupHistory.countDocuments({}),
  ]);

  console.log(`  Users         : ${userCount} (1 admin + 3 instructors + 60 students)`);
  console.log(`  Students      : ${studentCount}  [HIGH:${counts.HIGH} MEDIUM:${counts.MEDIUM} LOW:${counts.LOW} UNGRADED:${counts.UNGRADED}]`);
  console.log(`  Cohorts       : ${cohortCount}   (CA226 - Software Engineering 2022)`);
  console.log(`  CourseOfferings: ${offeringCount}  (3 active Sem7 + 2 completed Sem6)`);
  console.log(`  Attendance    : ${attendanceCount} records (5 offerings × 60 students)`);
  console.log(`  Groups (archived): ${groupCount}`);
  console.log(`  GroupHistory  : ${historyCount} records (Sem6 pair-avoidance history)`);
  console.log('\n  Semester 7 active offerings (ready to generate groups):');
  console.log('    DB401   — Databases            — Dr. Hassan Abdi');
  console.log('    NET301  — Computer Networks     — Dr. Farah Nuur');
  console.log('    SP501   — Software Project      — Dr. Amina Warsame');
  console.log('\n  Semester 6 completed offerings (groups archived, history written):');
  console.log('    WD201   — Web Development       — Dr. Hassan Abdi');
  console.log('    AI401   — Artificial Intelligence — Dr. Farah Nuur');
  console.log('\n  Credentials:');
  console.log(`    Admin        : ${admin.email} / Admin@123456`);
  console.log('    Instructors  : dr.hassan@just.edu.so / dr.farah@just.edu.so / dr.amina@just.edu.so  pw: Inst@12345');
  console.log('    Students     : studentId 2022SW0001–2022SW0060  pw: Temp@1001–Temp@1060');
  console.log('[seed] ════════════════════════════════════════════════════════\n');

  await mongoose.disconnect();
  console.log('[seed] Done. MongoDB disconnected.\n');
}

main().catch((err) => {
  console.error('[seed] Fatal error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
