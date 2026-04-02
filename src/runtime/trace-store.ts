import type { AnimationTraceEntry } from '../animation/types'
import type { ListTraceEntry } from './list-plugin/types'
import type { MediaTraceEntry } from './media-sync'
import type { WaitTraceEntry } from './wait-flow'

export type RuntimeTraceStatus = 'applied' | 'rejected' | 'info' | 'error'

export type RuntimeTraceRow = {
  traceId: string
  traceMs: number
  scope: string
  eventName: string
  status: RuntimeTraceStatus
  sourceId?: string
  correlationId?: string
  payload?: Record<string, unknown>
}

export type RuntimeTraceFilters = {
  scope?: string
  eventName?: string
  status?: RuntimeTraceStatus
  sourceId?: string
  correlationId?: string
  sinceMs?: number
  untilMs?: number
  limit?: number
}

export type RuntimeTraceStore = {
  append: (row: Omit<RuntimeTraceRow, 'traceId' | 'traceMs'> & { traceId?: string; traceMs?: number }) => RuntimeTraceRow
  appendMany: (rows: Array<Omit<RuntimeTraceRow, 'traceId' | 'traceMs'> & { traceId?: string; traceMs?: number }>) => RuntimeTraceRow[]
  list: (filters?: RuntimeTraceFilters) => RuntimeTraceRow[]
  clear: () => void
  size: () => number
  exportJson: (filters?: RuntimeTraceFilters) => string
  exportNdjson: (filters?: RuntimeTraceFilters) => string
}

export type RuntimeTraceStoreOptions = {
  maxEntries?: number
  nowProvider?: () => number
  traceIdFactory?: () => string
}

type TraceRowInput = Omit<RuntimeTraceRow, 'traceId' | 'traceMs'> & {
  traceId?: string
  traceMs?: number
}

/**
 * Applies retention constraints by dropping oldest rows first.
 */
function enforceRetention(rows: RuntimeTraceRow[], maxEntries: number): void {
  if (maxEntries <= 0) {
    rows.length = 0
    return
  }

  const overflow = rows.length - maxEntries
  if (overflow > 0) {
    rows.splice(0, overflow)
  }
}

/**
 * Checks whether one row matches the provided filters.
 */
function matchesFilters(row: RuntimeTraceRow, filters: RuntimeTraceFilters): boolean {
  if (filters.scope !== undefined && row.scope !== filters.scope) {
    return false
  }

  if (filters.eventName !== undefined && row.eventName !== filters.eventName) {
    return false
  }

  if (filters.status !== undefined && row.status !== filters.status) {
    return false
  }

  if (filters.sourceId !== undefined && row.sourceId !== filters.sourceId) {
    return false
  }

  if (filters.correlationId !== undefined && row.correlationId !== filters.correlationId) {
    return false
  }

  if (filters.sinceMs !== undefined && row.traceMs < filters.sinceMs) {
    return false
  }

  if (filters.untilMs !== undefined && row.traceMs > filters.untilMs) {
    return false
  }

  return true
}

/**
 * Creates one in-memory trace store with retention and export helpers.
 */
export function createRuntimeTraceStore(options: RuntimeTraceStoreOptions = {}): RuntimeTraceStore {
  const rows: RuntimeTraceRow[] = []
  const nowProvider = options.nowProvider ?? (() => Date.now())
  const maxEntries = options.maxEntries ?? 1000
  const traceIdFactory = options.traceIdFactory
  let nextTraceIndex = 1

  /**
   * Creates one trace identifier when the caller does not provide one.
   */
  function createTraceId(): string {
    if (traceIdFactory) {
      return traceIdFactory()
    }

    const traceId = `trace-${nextTraceIndex}`
    nextTraceIndex += 1
    return traceId
  }

  /**
   * Appends one trace row and enforces retention.
   */
  function append(input: TraceRowInput): RuntimeTraceRow {
    const row: RuntimeTraceRow = {
      traceId: input.traceId ?? createTraceId(),
      traceMs: input.traceMs ?? nowProvider(),
      scope: input.scope,
      eventName: input.eventName,
      status: input.status,
      sourceId: input.sourceId,
      correlationId: input.correlationId,
      payload: input.payload
    }

    rows.push(row)
    enforceRetention(rows, maxEntries)
    return row
  }

  /**
   * Appends multiple trace rows in order.
   */
  function appendMany(inputs: TraceRowInput[]): RuntimeTraceRow[] {
    return inputs.map((input) => append(input))
  }

  /**
   * Returns trace rows filtered by optional criteria.
   */
  function list(filters: RuntimeTraceFilters = {}): RuntimeTraceRow[] {
    const filteredRows = rows.filter((row) => matchesFilters(row, filters))
    const limit = filters.limit
    if (limit === undefined || limit < 0) {
      return filteredRows.map((row) => ({ ...row }))
    }

    return filteredRows.slice(0, limit).map((row) => ({ ...row }))
  }

  /**
   * Removes all rows from the store.
   */
  function clear(): void {
    rows.length = 0
  }

  /**
   * Returns the current number of retained rows.
   */
  function size(): number {
    return rows.length
  }

  /**
   * Exports trace rows as one JSON array string.
   */
  function exportJson(filters: RuntimeTraceFilters = {}): string {
    return JSON.stringify(list(filters), null, 2)
  }

  /**
   * Exports trace rows in NDJSON format.
   */
  function exportNdjson(filters: RuntimeTraceFilters = {}): string {
    return list(filters)
      .map((row) => JSON.stringify(row))
      .join('\n')
  }

  return {
    append,
    appendMany,
    list,
    clear,
    size,
    exportJson,
    exportNdjson
  }
}

/**
 * Appends animation trace entries into the runtime trace store.
 */
export function appendAnimationTraceEntries(
  traceStore: RuntimeTraceStore,
  entries: AnimationTraceEntry[],
  correlationId?: string
): RuntimeTraceRow[] {
  return traceStore.appendMany(
    entries.map((entry) => ({
      traceId: entry.traceId,
      scope: 'animation',
      eventName: entry.eventName,
      status: entry.status,
      sourceId: entry.transitionId,
      correlationId,
      payload: {
        eventId: entry.eventId,
        property: entry.property
      }
    }))
  )
}

/**
 * Appends wait-flow trace entries into the runtime trace store.
 */
export function appendWaitTraceEntries(
  traceStore: RuntimeTraceStore,
  entries: WaitTraceEntry[],
  correlationId?: string
): RuntimeTraceRow[] {
  return traceStore.appendMany(
    entries.map((entry) => ({
      traceId: entry.traceId,
      scope: 'scenario',
      eventName: entry.eventName,
      status: 'applied',
      sourceId: entry.waitId,
      correlationId,
      payload: {
        mode: entry.mode,
        ...entry.payload
      }
    }))
  )
}

/**
 * Appends list-plugin trace entries into the runtime trace store.
 */
export function appendListTraceEntries(
  traceStore: RuntimeTraceStore,
  entries: ListTraceEntry[],
  correlationId?: string
): RuntimeTraceRow[] {
  return traceStore.appendMany(
    entries.map((entry) => ({
      traceId: entry.traceId,
      scope: 'list',
      eventName: entry.eventName,
      status: 'applied',
      sourceId: entry.runtimeListId,
      correlationId,
      payload: entry.payload
    }))
  )
}

/**
 * Appends media-sync trace entries into the runtime trace store.
 */
export function appendMediaTraceEntries(
  traceStore: RuntimeTraceStore,
  entries: MediaTraceEntry[],
  correlationId?: string
): RuntimeTraceRow[] {
  return traceStore.appendMany(
    entries.map((entry) => ({
      traceId: entry.traceId,
      scope: 'media',
      eventName: entry.eventName,
      status: 'applied',
      sourceId: entry.runtimeItemId,
      correlationId,
      payload: entry.payload
    }))
  )
}
