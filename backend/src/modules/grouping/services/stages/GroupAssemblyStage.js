// ── Helpers ───────────────────────────────────────────────────────────────────

// Fisher-Yates shuffle — returns a new shuffled array, never mutates input.
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Composite score for placing a student into a group. Three priorities:
//   1. Conflict penalty (1000): avoid students who were paired in history
//   2. Same-tier penalty (10): spread HIGH/MEDIUM/LOW/UNGRADED across groups
//   3. Size score (1): fill smaller groups first
// Weights ensure priority 1 >> 2 >> 3.
function groupScore(student, group, avoidPairs) {
  const sid = student._id.toString();
  let conflicts = 0;
  let sameTier  = 0;
  for (const member of group) {
    const key = [sid, member._id.toString()].sort().join('|');
    if (avoidPairs.has(key)) conflicts++;
    if (member.performanceCategory === student.performanceCategory) sameTier++;
  }
  return conflicts * 1000 + sameTier * 10 + group.length;
}

// Returns the index of the best group for this student.
// Group indices are shuffled so ties are broken randomly (no systematic bias
// toward the first group).
function bestGroupIdx(student, groups, avoidPairs) {
  const indices = shuffle(Array.from({ length: groups.length }, (_, i) => i));
  let bestIdx   = indices[0];
  let bestScore = Infinity;
  for (const i of indices) {
    const score = groupScore(student, groups[i], avoidPairs);
    if (score < bestScore) { bestScore = score; bestIdx = i; }
  }
  return bestIdx;
}

// Takes arrays of students (one per tier) and interleaves them round-robin:
// [tier0[0], tier1[0], tier2[0], tier3[0], tier0[1], tier1[1], ...]
// This ensures the assignment order alternates tiers, which — combined with
// the size tiebreaker in bestGroupIdx — produces balanced performance mixes.
function interleaveRoundRobin(tiers) {
  const queues = tiers.map(t => [...t]);
  const result = [];
  let anyLeft  = true;
  while (anyLeft) {
    anyLeft = false;
    for (const q of queues) {
      if (q.length > 0) { result.push(q.shift()); anyLeft = true; }
    }
  }
  return result;
}

// Post-assignment size rebalancing.
// After conflict-aware assignment, group sizes may diverge when conflict
// avoidance forces students into specific groups. This pass moves one student
// at a time from the largest group to the smallest until no group differs from
// the floor size by more than 1. The student moved is always the one with the
// fewest additional conflicts in the destination.
function rebalance(groups, avoidPairs) {
  const N      = groups.reduce((sum, g) => sum + g.length, 0);
  const target = Math.floor(N / groups.length);

  let moved = true;
  while (moved) {
    moved = false;

    const maxSize = Math.max(...groups.map(g => g.length));
    const minSize = Math.min(...groups.map(g => g.length));
    if (maxSize - minSize <= 1) break;

    const srcIdx = groups.findIndex(g => g.length === maxSize);
    const dstIdx = groups.findIndex(g => g.length === minSize);

    // Only rebalance if destination is below target — avoids over-compression.
    if (groups[dstIdx].length >= target) break;

    // Pick the student in src whose move to dst introduces the fewest conflicts.
    let bestIdx     = 0;
    let bestConflicts = Infinity;
    for (let i = 0; i < groups[srcIdx].length; i++) {
      const student = groups[srcIdx][i];
      let conflicts = 0;
      for (const member of groups[dstIdx]) {
        const key = [student._id.toString(), member._id.toString()].sort().join('|');
        if (avoidPairs.has(key)) conflicts++;
      }
      if (conflicts < bestConflicts) { bestConflicts = conflicts; bestIdx = i; }
    }

    const [student] = groups[srcIdx].splice(bestIdx, 1);
    groups[dstIdx].push(student);
    moved = true;
  }

  return groups;
}

// ── Stage ─────────────────────────────────────────────────────────────────────

class GroupAssemblyStage {
  // Returns an array of groups, where each group is an array of student objects.
  static run(buckets, avoidPairs, groupSize) {
    const { HIGH, MEDIUM, LOW, UNGRADED, scatterIds } = buckets;
    const N = HIGH.length + MEDIUM.length + LOW.length + UNGRADED.length;

    if (N === 0) return [];

    const numGroups = Math.max(1, Math.round(N / groupSize));
    const groups    = Array.from({ length: numGroups }, () => []);

    // Shuffle each tier independently so results vary across runs.
    const tiers = [
      shuffle(HIGH),
      shuffle(MEDIUM),
      shuffle(LOW),
      shuffle(UNGRADED),
    ];

    // Split each tier into scatter and non-scatter lists.
    const scatterByTier    = tiers.map(t => t.filter(s =>  scatterIds.has(s._id.toString())));
    const nonScatterByTier = tiers.map(t => t.filter(s => !scatterIds.has(s._id.toString())));

    // Assign scatter students first so they land in different groups before
    // non-scatter students fill the remaining slots.
    for (const student of interleaveRoundRobin(scatterByTier)) {
      groups[bestGroupIdx(student, groups, avoidPairs)].push(student);
    }

    // Assign non-scatter students in interleaved tier order.
    for (const student of interleaveRoundRobin(nonScatterByTier)) {
      groups[bestGroupIdx(student, groups, avoidPairs)].push(student);
    }

    // Rebalance sizes: after conflict-driven assignment, some groups may be
    // larger than others. Move the least-conflicting student from the biggest
    // group to the smallest until sizes are within ±1 of target.
    return rebalance(groups, avoidPairs);
  }
}

module.exports = GroupAssemblyStage;
