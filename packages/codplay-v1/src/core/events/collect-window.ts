import type { TimelineEvent } from './types'

/**
 * Collects events included in the current execution window.
 */
export function collectEventsWindow(
  events: TimelineEvent[],
  prevMs: number,
  nowMs: number,
  marginMs: number
): TimelineEvent[] {
  if (nowMs < prevMs) {
    return []
  }

  const maxMs = nowMs + marginMs
  return events.filter((event) => event.ms > prevMs && event.ms <= maxMs)
}
