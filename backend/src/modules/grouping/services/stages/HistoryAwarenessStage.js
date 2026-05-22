// Builds a set of "avoid pairs" from all past GroupHistory documents.
// A pair is two students who shared any group in any previous generation.
// Look-back is unlimited (all history). Future enhancement: windowed look-back.
//
// Pairs are stored as "smallerId|largerId" (lexicographic) so each pair has
// exactly one canonical key regardless of insertion order.
class HistoryAwarenessStage {
  static run(historyDocs) {
    const avoidPairs = new Set();

    for (const doc of historyDocs) {
      const ids = doc.memberIds.map(id => id.toString());
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          avoidPairs.add([ids[i], ids[j]].sort().join('|'));
        }
      }
    }

    return avoidPairs;
  }
}

module.exports = HistoryAwarenessStage;
