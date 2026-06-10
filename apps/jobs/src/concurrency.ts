// Run an async worker over items with a bounded number in flight at once. No external dependency:
// a fixed pool of workers pulls from a shared cursor until the list is drained. Order of completion
// is not guaranteed; results are not collected (workers act for their side effects).
export async function forEachWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  const limit = Math.max(1, Math.min(concurrency, items.length));

  async function runWorker(): Promise<void> {
    for (;;) {
      const current = index;
      index += 1;
      const item = items[current];
      if (current >= items.length || item === undefined) return;
      await worker(item);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runWorker()));
}
