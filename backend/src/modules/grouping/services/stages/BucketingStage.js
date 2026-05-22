// Splits students into four performance buckets.
// UNGRADED (null performanceCategory) is kept separate — not silently merged
// into MEDIUM — so the caller knows how many ungraded students were involved.
class BucketingStage {
  static run(students) {
    const HIGH    = [];
    const MEDIUM  = [];
    const LOW     = [];
    const UNGRADED = [];

    for (const s of students) {
      switch (s.performanceCategory) {
        case 'HIGH':   HIGH.push(s);     break;
        case 'MEDIUM': MEDIUM.push(s);   break;
        case 'LOW':    LOW.push(s);      break;
        default:       UNGRADED.push(s); break;
      }
    }

    return { HIGH, MEDIUM, LOW, UNGRADED, all: students };
  }
}

module.exports = BucketingStage;
