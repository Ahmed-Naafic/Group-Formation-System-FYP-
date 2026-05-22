// Priority order for leader selection within a group:
// 1. HIGH performer who has never been a leader
// 2. HIGH performer (any)
// 3. MEDIUM performer who has never been a leader
// 4. MEDIUM performer (any)
// 5. LOW performer who has never been a leader
// 6. Any student who has never been a leader
// 7. First student (last resort — everyone has been a leader)
const LEADER_PREDICATES = [
  m => m.performanceCategory === 'HIGH'   && !m.hasBeenLeader,
  m => m.performanceCategory === 'HIGH',
  m => m.performanceCategory === 'MEDIUM' && !m.hasBeenLeader,
  m => m.performanceCategory === 'MEDIUM',
  m => m.performanceCategory === 'LOW'    && !m.hasBeenLeader,
  m => !m.hasBeenLeader,
  () => true,
];

function pickLeader(members) {
  for (const pred of LEADER_PREDICATES) {
    const candidate = members.find(pred);
    if (candidate) return candidate;
  }
  return members[0];
}

class LeaderAssignmentStage {
  // Accepts the array of groups from GroupAssemblyStage.
  // Returns [{ members, leaderId }] — one entry per group.
  static run(groups) {
    return groups.map(members => ({
      members,
      leaderId: pickLeader(members)._id,
    }));
  }
}

module.exports = LeaderAssignmentStage;
