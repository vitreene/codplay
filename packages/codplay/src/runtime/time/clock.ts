/** Provides the current wall-clock time in milliseconds. */
export type NowProvider = () => number

/** Minimal relative clock contract used by the V2 ticker. */
export type Clock = {
  nowMs: () => number
  reset: (baseMs?: number) => void
}

/** Computes elapsed milliseconds from one clock origin. */
function getElapsedMs(nowProvider: NowProvider, originMs: number): number {
  return nowProvider() - originMs
}

/** Implements a relative clock with an injectable time source. */
export class TimeClock implements Clock {
  private readonly nowProvider: NowProvider
  private originMs: number
  private baseMs = 0

  /** Creates a clock anchored to the supplied time provider. */
  constructor(nowProvider: NowProvider = () => Date.now()) {
    this.nowProvider = nowProvider
    this.originMs = this.nowProvider()
  }

  /** Returns the current relative timeline time. */
  nowMs(): number {
    return this.baseMs + getElapsedMs(this.nowProvider, this.originMs)
  }

  /** Resets the origin and optionally changes the relative base. */
  reset(nextBaseMs = 0): void {
    this.originMs = this.nowProvider()
    this.baseMs = nextBaseMs
  }
}
