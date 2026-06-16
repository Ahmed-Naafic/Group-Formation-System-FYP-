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

// Post-assignment tier rebalancing for a single performance tier (including null = UNGRADED).
// Conflict avoidance can cluster same-tier students into fewer groups than ideal.
// This pass enforces max(tier-count per group) - min ≤ 1 by moving or swapping:
//   - Move:  when src group is larger than dst — preserves ±1 size balance
//   - Swap:  when groups are equal-sized — swaps a tier student out of src with a
//            non-tier student out of dst, keeping both group sizes unchanged
// In both cases the student(s) chosen minimise new conflict-pair memberships.
function rebalanceTier(groups, tier, avoidPairs) {
  let changed = true;
  while (changed) {
    changed = false;

    const counts = groups.map(g => g.filter(s => s.performanceCategory === tier).length);
    const maxCount = Math.max(...counts);
    const minCount = Math.min(...counts);
    if (maxCount - minCount <= 1) break;

    const srcIdx = counts.indexOf(maxCount);
    const dstIdx = counts.indexOf(minCount);

    if (groups[srcIdx].length > groups[dstIdx].length) {
      // Plain move: src is the larger group, so moving one student keeps sizes within ±1.
      let bestI = -1, bestConflicts = Infinity;
      for (let i = 0; i < groups[srcIdx].length; i++) {
        const s = groups[srcIdx][i];
        if (s.performanceCategory !== tier) continue;
        let c = 0;
        for (const m of groups[dstIdx]) {
          const k = [s._id.toString(), m._id.toString()].sort().join('|');
          if (avoidPairs.has(k)) c++;
        }
        if (c < bestConflicts) { bestConflicts = c; bestI = i; }
      }
      if (bestI === -1) break;
      const [student] = groups[srcIdx].splice(bestI, 1);
      groups[dstIdx].push(student);
      changed = true;
    } else {
      // Swap: groups are equal-sized (or dst is larger — rare).
      // Exchange the best tier-student from src with the best non-tier-student from
      // dst so that group sizes remain unchanged.
      const srcCandidates = groups[srcIdx].map((s, i) => ({ s, i })).filter(x => x.s.performanceCategory === tier);
      const dstCandidates = groups[dstIdx].map((s, i) => ({ s, i })).filter(x => x.s.performanceCategory !== tier);
      if (!srcCandidates.length || !dstCandidates.length) break;

      let bestSI = srcCandidates[0].i, bestDI = dstCandidates[0].i, bestScore = Infinity;
      for (const { s: ss, i: si } of srcCandidates) {
        for (const { s: ds, i: di } of dstCandidates) {
          let score = 0;
          // Conflicts ss would face in dst (excluding ds, which is leaving)
          for (const m of groups[dstIdx]) {
            if (m === ds) continue;
            const k = [ss._id.toString(), m._id.toString()].sort().join('|');
            if (avoidPairs.has(k)) score++;
          }
          // Conflicts ds would face in src (excluding ss, which is leaving)
          for (const m of groups[srcIdx]) {
            if (m === ss) continue;
            const k = [ds._id.toString(), m._id.toString()].sort().join('|');
            if (avoidPairs.has(k)) score++;
          }
          // Tier-displacement penalty: avoid moving ds if it is the ONLY remaining
          // member of its tier in dstGroup (removing it would leave a zero of that
          // tier — the exact problem we are solving here). Weight 500: lower than
          // a history conflict (1000) but high enough to strongly prefer MEDIUM or
          // UNGRADED candidates over equally-sparse-tier candidates (HIGH/LOW).
          const dsTierCountInDst = groups[dstIdx].filter(m => m.performanceCategory === ds.performanceCategory).length;
          if (dsTierCountInDst === 1) score += 500;
          if (score < bestScore) { bestScore = score; bestSI = si; bestDI = di; }
        }
      }
      const tmp = groups[srcIdx][bestSI];
      groups[srcIdx][bestSI] = groups[dstIdx][bestDI];
      groups[dstIdx][bestDI] = tmp;
      changed = true;
    }
  }
  return groups;
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
    rebalance(groups, avoidPairs);

    // Tier rebalance for sparse tiers (UNGRADED, LOW, HIGH).
    // Conflict avoidance overrides the same-tier-spread penalty and can leave
    // some groups with zero students from a sparse tier. This pass enforces
    // max(tier-count) - min ≤ 1 by moving or swapping the least-conflicting
    // candidate.
    //
    // ORDER IS CRITICAL: each pass can displace students of other tiers via
    // swaps. HIGH runs LAST so its balance cannot be broken by subsequent
    // passes. A group with no HIGH performer is the most visible balance
    // failure — it is never acceptable at this student scale.
    rebalanceTier(groups, null,     avoidPairs);  // UNGRADED
    rebalanceTier(groups, 'LOW',    avoidPairs);  // LOW
    rebalanceTier(groups, 'HIGH',   avoidPairs);  // HIGH — must run last

    return groups;
  }
}

module.exports = GroupAssemblyStage;
