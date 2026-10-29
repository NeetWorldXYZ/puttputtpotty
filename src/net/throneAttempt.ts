/** One clock per mounted round; deferred disposal tolerates React's effect replay. */
export class ThroneAttempt {
  private pending: Promise<{ startedAt: string }> | null = null;
  private cancellation: Promise<void> | null = null;
  private complete = false;
  private active = false;
  constructor(private begin: () => Promise<{ startedAt: string }>, private cancel: (clock: string) => Promise<unknown>) {}
  mount() { this.active = true; }
  dispose() {
    this.active = false;
    queueMicrotask(() => { if (!this.active) void this.concede().catch(() => {}); });
  }
  start() { return this.pending ??= this.begin(); }
  finish() { this.complete = true; }
  concede(): Promise<void> {
    if (this.complete || !this.pending) return Promise.resolve();
    if (this.cancellation) return this.cancellation;
    this.cancellation = this.pending.then(async ({ startedAt }) => {
      await this.cancel(startedAt);
      this.complete = true;
    }, () => {}).finally(() => { this.cancellation = null; });
    return this.cancellation;
  }
}
