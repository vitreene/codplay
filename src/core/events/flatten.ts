import { RUNTIME_EVENT_SOURCE } from './constants'
import type { EventNode, RuntimeEventSource, TimelineEvent } from './types'

export type FlattenOptions = {
  source?: RuntimeEventSource
  trackId?: string
  startIndex?: number
  baseMs?: number
}

/**
 * Builds a deterministic runtime event identifier.
 */
function buildEventId(index: number, ms: number): string {
  return `evt-${index}-${ms}`
}

/**
 * Flattens nested event nodes into timeline events with absolute milliseconds.
 */
export function flattenEventNodes(eventNodes: EventNode[], options: FlattenOptions = {}): TimelineEvent[] {
  const output: TimelineEvent[] = []
  const source = options.source ?? RUNTIME_EVENT_SOURCE.story
  const trackId = options.trackId
  const baseMs = options.baseMs ?? 0
  let index = options.startIndex ?? 0

  /**
   * Visits one node and all its descendants in declaration order.
   */
  function visit(node: EventNode, parentMs: number): void {
    const absoluteMs = parentMs + node.startAt
    const event: TimelineEvent = {
      id: buildEventId(index, absoluteMs),
      ms: absoluteMs,
      name: node.name,
      payload: node.payload,
      index,
      source,
      trackId
    }

    output.push(event)
    index += 1

    const children = node.events ?? []
    for (const child of children) {
      visit(child, absoluteMs)
    }
  }

  for (const node of eventNodes) {
    visit(node, baseMs)
  }

  return output
}
