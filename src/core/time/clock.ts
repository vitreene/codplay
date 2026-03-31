export type NowProvider = () => number

export type Clock = {
  nowMs: () => number
  reset: (baseMs?: number) => void
}

/**
 * Computes the elapsed milliseconds from the current origin.
 */
function getElapsedMs(nowProvider: NowProvider, originMs: number): number {
  return nowProvider() - originMs
}

/**
 * Implements a relative clock used by the ticker and runtime pipelines.
 */
export class TimeClock implements Clock {
  private readonly nowProvider: NowProvider
  private originMs: number
  private baseMs = 0

  /**
   * Configures the clock with an injectable time provider.
   */
  constructor(nowProvider: NowProvider = () => Date.now()) {
    this.nowProvider = nowProvider
    this.originMs = this.nowProvider()
  }

  /**
   * Returns the current relative timeline time in milliseconds.
   */
  nowMs(): number {
    return this.baseMs + getElapsedMs(this.nowProvider, this.originMs)
  }

  /**
   * Resets the clock origin and optionally applies a new timeline base.
   */
  reset(nextBaseMs = 0): void {
    this.originMs = this.nowProvider()
    this.baseMs = nextBaseMs
  }
}

/**
 * Creates a clock instance through a functional factory.
 */
export function createClock(nowProvider: NowProvider = () => Date.now()): Clock {
  return new TimeClock(nowProvider)
}
