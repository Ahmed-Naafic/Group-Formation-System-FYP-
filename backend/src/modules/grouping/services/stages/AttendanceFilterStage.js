// Tags the bottom thresholdPct% of students (by attendance) as scatter-priority.
// Scatter students are spread across groups first so no single group absorbs
// all low-attendance students.
class AttendanceFilterStage {
  static run(buckets, thresholdPct = 25) {
    const { all } = buckets;

    if (all.length === 0 || thresholdPct <= 0) {
      return { ...buckets, scatterIds: new Set() };
    }

    const sorted = [...all].sort((a, b) => a.attendance - b.attendance);
    const cutoffIdx = Math.floor(all.length * (thresholdPct / 100));

    if (cutoffIdx === 0) {
      return { ...buckets, scatterIds: new Set() };
    }

    // All students at or below the boundary attendance value are scatter-tagged.
    // Using value (not index) captures ties at the boundary correctly.
    const cutoffAttendance = sorted[cutoffIdx - 1].attendance;
    const scatterIds = new Set(
      all
        .filter(s => s.attendance <= cutoffAttendance)
        .map(s => s._id.toString()),
    );

    return { ...buckets, scatterIds };
  }
}

module.exports = AttendanceFilterStage;
