export class DeadLetterQueue {
  constructor() {
    this.items = [];
    this.replayedKeys = new Set();
  }

  enqueue({ message, error, idempotencyKey }) {
    const item = {
      id: `dlq-${this.items.length + 1}`,
      message,
      error: String(error?.message || error || "unknown"),
      idempotencyKey: idempotencyKey || message?.messageId || null,
      enqueuedAt: Date.now(),
      replayCount: 0
    };

    this.items.push(item);
    return item;
  }

  list() {
    return [...this.items];
  }

  async replay(handler, { maxItems = Infinity } = {}) {
    if (typeof handler !== "function") {
      throw new Error("handler must be a function.");
    }

    let attempted = 0;
    let success = 0;
    const failed = [];

    for (const item of this.items) {
      if (attempted >= maxItems) {
        break;
      }

      const key = item.idempotencyKey;
      if (key && this.replayedKeys.has(key)) {
        continue;
      }

      attempted += 1;
      item.replayCount += 1;

      try {
        await handler(item.message);
        success += 1;
        if (key) {
          this.replayedKeys.add(key);
        }
      } catch (error) {
        failed.push({ id: item.id, error: String(error?.message || error) });
      }
    }

    return {
      attempted,
      success,
      failed,
      successRate: attempted === 0 ? 1 : success / attempted
    };
  }
}
