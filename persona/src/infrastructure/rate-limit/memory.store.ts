import {
  Clock,
  RateLimitStore,
  RateLimitVerdict,
  systemClock,
} from '../../domain/interfaces/rate-limit';
import { Bucket, idleMs, pour } from './token-bucket';

const SWEEP_INTERVAL_MS = 60 * 1000;

// The fallback store: correct for one process, wrong for two, and empty after a
// restart. Good enough for unit tests and local work, which is why config.ts
// refuses to let production run on it.
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, Bucket & { expiresAt: number }>();
  private readonly timer: NodeJS.Timeout;

  constructor(private readonly clock: Clock = systemClock) {
    this.timer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    this.timer.unref();
  }

  async consume(
    key: string,
    capacity: number,
    rate: number,
    now: number,
  ): Promise<RateLimitVerdict> {
    const { bucket, verdict } = pour(this.buckets.get(key), capacity, rate, now);
    this.buckets.set(key, { ...bucket, expiresAt: now + idleMs(bucket, capacity, rate) });
    return verdict;
  }

  async reset(key: string): Promise<void> {
    this.buckets.delete(key);
  }

  async close(): Promise<void> {
    clearInterval(this.timer);
    this.buckets.clear();
  }

  // Drops buckets that have refilled, so an idle key does not sit in the map
  // forever. Public for the same reason the repositories' deleteExpired is:
  // it is a real operation, and a test should not have to wait out a timer to
  // watch it happen.
  sweep(): void {
    const now = this.clock.now();
    for (const [key, bucket] of this.buckets) {
      if (bucket.expiresAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}
