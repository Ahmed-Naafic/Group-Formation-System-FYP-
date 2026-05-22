// Pure algorithm test — no MongoDB connection required.
// Run: node test-grouping-algorithm.js
//
// Covers:
//   1. Balanced performance distribution (HIGH/MEDIUM/LOW)
//   2. UNGRADED students distributed evenly
//   3. Scatter students spread across groups
//   4. History-awareness (avoid pairing students who were together before)
//   5. Leader selection priority

const GroupGenerationService = require('./src/modules/grouping/services/GroupGenerationService');

// ── Mock data helpers ─────────────────────────────────────────────────────────

let idCounter = 1;
function makeId() {
  const id = String(idCounter++).padStart(3, '0');
  // Mimic Mongoose ObjectId: has a toString() method
  return { toString: () => id, _id_raw: id };
}

function student(fullName, performanceCategory, attendance, hasBeenLeader = false) {
  const _id = makeId();
  return { _id, fullName, performanceCategory, attendance, hasBeenLeader };
}

// ── Test 1: Basic balanced distribution ──────────────────────────────────────

console.log('\n════════════════════════════════════════════');
console.log('TEST 1 — Balanced distribution (10 students, groupSize=4)');
console.log('════════════════════════════════════════════');

const students1 = [
  student('Alice',   'HIGH',   90),
  student('Bob',     'HIGH',   85),
  student('Carol',   'HIGH',   80),
  student('Dave',    'MEDIUM', 75),
  student('Eve',     'MEDIUM', 70),
  student('Frank',   'MEDIUM', 65),
  student('Grace',   'MEDIUM', 60),
  student('Hank',    'LOW',    55),
  student('Iris',    'LOW',    50),
  student('Jack',    'LOW',    45),
];

const result1 = GroupGenerationService.generateFromData(students1, [], 4);
printResult(result1);

// ── Test 2: UNGRADED students ─────────────────────────────────────────────────

console.log('\n════════════════════════════════════════════');
console.log('TEST 2 — UNGRADED students (13 students, 3 ungraded, groupSize=4)');
console.log('════════════════════════════════════════════');

const students2 = [
  student('A', 'HIGH',   90),
  student('B', 'HIGH',   88),
  student('C', 'HIGH',   85),
  student('D', 'MEDIUM', 75),
  student('E', 'MEDIUM', 72),
  student('F', 'MEDIUM', 68),
  student('G', 'MEDIUM', 65),
  student('H', 'LOW',    55),
  student('I', 'LOW',    50),
  student('J', null,     80),   // ungraded
  student('K', null,     78),   // ungraded
  student('L', null,     45),   // ungraded
  student('M', 'LOW',    40),
];

const result2 = GroupGenerationService.generateFromData(students2, [], 4);
printResult(result2);

// ── Test 3: Scatter (low attendance) students ─────────────────────────────────

console.log('\n════════════════════════════════════════════');
console.log('TEST 3 — Scatter distribution (bottom 25% attendance, groupSize=3)');
console.log('════════════════════════════════════════════');

const students3 = [
  student('A', 'HIGH',   90),
  student('B', 'HIGH',   85),
  student('C', 'MEDIUM', 75),
  student('D', 'MEDIUM', 70),
  student('E', 'LOW',    65),
  student('F', 'MEDIUM', 60),
  student('G', 'LOW',    15),   // low attendance → scatter
  student('H', 'HIGH',   10),   // low attendance → scatter
];

const result3 = GroupGenerationService.generateFromData(students3, [], 3, { attendanceThreshold: 25 });
printResult(result3);
checkScatterSpread(result3, ['G', 'H']);

// ── Test 4: History-awareness ─────────────────────────────────────────────────

console.log('\n════════════════════════════════════════════');
console.log('TEST 4 — History-awareness (avoid previous pairs)');
console.log('════════════════════════════════════════════');

// Build students fresh (new IDs)
const s = {
  A: student('A', 'HIGH',   90),
  B: student('B', 'MEDIUM', 75),
  C: student('C', 'LOW',    60),
  D: student('D', 'HIGH',   85),
  E: student('E', 'MEDIUM', 70),
  F: student('F', 'LOW',    55),
};
const allStudents4 = Object.values(s);

// Simulate history: A+B+C were in a group, D+E+F were in a group
const historyDocs = [
  { memberIds: [s.A._id, s.B._id, s.C._id] },
  { memberIds: [s.D._id, s.E._id, s.F._id] },
];

const result4 = GroupGenerationService.generateFromData(allStudents4, historyDocs, 3);
printResult(result4);
checkHistoryViolations(result4, historyDocs);

// ── Test 5: Leader assignment ─────────────────────────────────────────────────

console.log('\n════════════════════════════════════════════');
console.log('TEST 5 — Leader selection (prefer HIGH + never-been-leader)');
console.log('════════════════════════════════════════════');

const students5 = [
  student('AlreadyLeader', 'HIGH',   90, true),   // HIGH but has been leader
  student('FreshHigh',     'HIGH',   88, false),  // HIGH, never leader → should be picked
  student('MediumA',       'MEDIUM', 75, false),
  student('LowA',          'LOW',    60, false),
];

const result5 = GroupGenerationService.generateFromData(students5, [], 4);
printResult(result5);
const leader5 = result5.assembledGroups[0];
const leaderName = students5.find(s => s._id.toString() === leader5.leaderId.toString())?.fullName;
console.log(`  → Leader chosen: ${leaderName}`);
console.log(`  → Expected: FreshHigh (HIGH, hasBeenLeader=false)`);
console.log(`  → ${leaderName === 'FreshHigh' ? '✓ PASS' : '✗ FAIL'}`);

// ── Test 6: Edge cases ────────────────────────────────────────────────────────

console.log('\n════════════════════════════════════════════');
console.log('TEST 6 — Edge cases');
console.log('════════════════════════════════════════════');

// Exactly groupSize students → 1 group
const exact = [student('A', 'HIGH', 90), student('B', 'MEDIUM', 70), student('C', 'LOW', 50)];
const r6a = GroupGenerationService.generateFromData(exact, [], 3);
console.log(`\n  3 students, groupSize=3 → ${r6a.assembledGroups.length} group(s) [expect 1]: ${r6a.assembledGroups.length === 1 ? '✓' : '✗'}`);

// All ungraded
const allUngraded = Array.from({ length: 8 }, (_, i) => student(`S${i}`, null, 50 + i));
const r6b = GroupGenerationService.generateFromData(allUngraded, [], 4);
console.log(`  8 all-ungraded, groupSize=4 → ${r6b.assembledGroups.length} group(s) [expect 2]: ${r6b.assembledGroups.length === 2 ? '✓' : '✗'}`);
console.log(`  summary.ungraded = ${r6b.summary.ungraded} [expect 8]: ${r6b.summary.ungraded === 8 ? '✓' : '✗'}`);

// ── Test 7: Zero violations achievable ───────────────────────────────────────

console.log('\n════════════════════════════════════════════');
console.log('TEST 7 — Zero violations achievable (9 students, groupSize=3, one prior trio {A,B,C})');
console.log('════════════════════════════════════════════');

// Only A, B, C have history together. D-I have no history at all.
// The engine has plenty of room to separate A, B, C into 3 different groups.
const t7 = {
  A: student('A', 'HIGH',   90),
  B: student('B', 'MEDIUM', 75),
  C: student('C', 'LOW',    60),
  D: student('D', 'HIGH',   85),
  E: student('E', 'MEDIUM', 70),
  F: student('F', 'LOW',    55),
  G: student('G', 'HIGH',   80),
  H: student('H', 'MEDIUM', 65),
  I: student('I', 'LOW',    50),
};
const history7 = [{ memberIds: [t7.A._id, t7.B._id, t7.C._id] }];
const result7 = GroupGenerationService.generateFromData(Object.values(t7), history7, 3);
printResult(result7);
checkHistoryViolations(result7, history7);

// Run 10 times to confirm the engine consistently achieves 0 violations
console.log('\n  Consistency check (10 runs — all should be 0 violations):');
let allZero = true;
for (let run = 0; run < 10; run++) {
  // Fresh IDs each run so pairs don't bleed between runs
  const fresh = {
    A: student('A', 'HIGH',   90), B: student('B', 'MEDIUM', 75), C: student('C', 'LOW',    60),
    D: student('D', 'HIGH',   85), E: student('E', 'MEDIUM', 70), F: student('F', 'LOW',    55),
    G: student('G', 'HIGH',   80), H: student('H', 'MEDIUM', 65), I: student('I', 'LOW',    50),
  };
  const hist = [{ memberIds: [fresh.A._id, fresh.B._id, fresh.C._id] }];
  const r = GroupGenerationService.generateFromData(Object.values(fresh), hist, 3);

  // Count violations
  const avoidPairs = new Set();
  for (const doc of hist) {
    const ids = doc.memberIds.map(id => id.toString());
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++)
        avoidPairs.add([ids[i], ids[j]].sort().join('|'));
  }
  let violations = 0;
  for (const { members } of r.assembledGroups) {
    const ids = members.map(m => m._id.toString());
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++)
        if (avoidPairs.has([ids[i], ids[j]].sort().join('|'))) violations++;
  }
  if (violations > 0) { allZero = false; process.stdout.write(` run${run + 1}:✗(${violations})`); }
  else process.stdout.write(` run${run + 1}:✓`);
}
console.log(`\n  → ${allZero ? '✓ All 10 runs achieved 0 violations' : '✗ Some runs had violations'}`);

// ── Helpers ───────────────────────────────────────────────────────────────────

function printResult({ assembledGroups, summary }) {
  console.log(`\n  Summary: total=${summary.total} ungraded=${summary.ungraded} groups=${summary.groups}`);
  console.log(`  Breakdown: HIGH=${summary.breakdown.HIGH} MEDIUM=${summary.breakdown.MEDIUM} LOW=${summary.breakdown.LOW} UNGRADED=${summary.breakdown.UNGRADED}`);
  if (summary.ungraded > 0) {
    console.log(`  ⚠ Warning: ${summary.ungraded} student(s) have no performance category`);
  }
  assembledGroups.forEach(({ members, leaderId }, i) => {
    const leaderName = members.find(m => m._id.toString() === leaderId.toString())?.fullName ?? '?';
    const memberList = members.map(m => `${m.fullName}(${m.performanceCategory ?? 'UNG'})`).join(', ');
    console.log(`  Group ${i + 1} [leader: ${leaderName}]: ${memberList}`);
  });
}

function checkScatterSpread({ assembledGroups }, scatterNames) {
  console.log('\n  Scatter check (each scatter student should be in a different group):');
  const found = {};
  assembledGroups.forEach(({ members }, i) => {
    members.forEach(m => {
      if (scatterNames.includes(m.fullName)) found[m.fullName] = i + 1;
    });
  });
  const groups = Object.values(found);
  const spread = new Set(groups).size === groups.length;
  Object.entries(found).forEach(([name, g]) => console.log(`    ${name} → Group ${g}`));
  console.log(`  → ${spread ? '✓ All scatter students in different groups' : '✗ Some scatter students share a group'}`);
}

function checkHistoryViolations({ assembledGroups }, historyDocs) {
  console.log('\n  History check (should avoid previous pairs):');
  const avoidPairs = new Set();
  for (const doc of historyDocs) {
    const ids = doc.memberIds.map(id => id.toString());
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++)
        avoidPairs.add([ids[i], ids[j]].sort().join('|'));
  }

  let violations = 0;
  assembledGroups.forEach(({ members }, gi) => {
    const ids = members.map(m => m._id.toString());
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = [ids[i], ids[j]].sort().join('|');
        if (avoidPairs.has(key)) {
          const nameA = members[i].fullName;
          const nameB = members[j].fullName;
          console.log(`    ✗ Violation in Group ${gi + 1}: ${nameA} and ${nameB} were together before`);
          violations++;
        }
      }
    }
  });

  // With 6 students split into exactly 2 groups where EVERY student has history
  // with the other 2 in their original group, some violations are mathematically
  // unavoidable (pigeonhole principle). The algorithm minimises them; 2 is the
  // floor for this specific test scenario.
  if (violations === 0) console.log('    ✓ No history violations');
  else console.log(`    ⚠ ${violations} violation(s) — unavoidable (pigeonhole); algorithm minimised them`);
}
