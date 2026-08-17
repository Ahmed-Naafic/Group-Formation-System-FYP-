// Runs async fn(item, index) over items with at most `limit` in flight at
// once — a worker-pool, not a batch-then-wait chunker, so a fast row
// doesn't sit blocked behind a slow one in the same batch. Results are
// returned in the same order as items regardless of completion order.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await fn(items[i], i);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

module.exports = mapWithConcurrency;
