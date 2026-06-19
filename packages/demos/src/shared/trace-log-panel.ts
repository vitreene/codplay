import { RUNTIME_TRACE_STATUS } from 'codplay/runtime/trace-constants'
import type { RuntimeTraceRow } from 'codplay/runtime/trace-store'

type TracePayload = Record<string, unknown>

/**
 * Reads one payload value as string when available.
 */
function readString(payload: TracePayload, key: string): string | undefined {
	const value = payload[key]
	return typeof value === 'string' ? value : undefined
}

/**
 * Reads one payload value as number when available.
 */
function readNumber(payload: TracePayload, key: string): number | undefined {
	const value = payload[key]
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/**
 * Builds one compact payload summary for fallback trace messages.
 */
function formatCompactPayload(payload: TracePayload): string {
	const entries = Object.entries(payload)
	if (entries.length === 0) {
		return ''
	}

	const summary = entries
		.slice(0, 4)
		.map(([key, value]) => `${key}=${String(value)}`)
		.join(' ')
	const suffix = entries.length > 4 ? ' ...' : ''
	return ` ${summary}${suffix}`
}

/**
 * Builds one human-readable trace message according to event type.
 */
function formatTraceMessage(row: RuntimeTraceRow): string {
	const payload = (row.payload ?? {}) as TracePayload

	if (row.status === RUNTIME_TRACE_STATUS.rejected || row.status === RUNTIME_TRACE_STATUS.error) {
		const code = readString(payload, 'code')
		const message = readString(payload, 'message')
		return `${row.eventName}${code ? ` code=${code}` : ''}${message ? ` message=${message}` : ''}`
	}

	switch (row.eventName) {
		case 'player:init:started': {
			const sceneId = readString(payload, 'sceneId')
			return `init start scene=${sceneId ?? '?'}`
		}

		case 'player:init:done': {
			const mountedStoryCount = readNumber(payload, 'mountedStoryCount')
			const runtimeElementCount = readNumber(payload, 'runtimeElementCount')
			const runtimeRevision = readNumber(payload, 'runtimeRevision')
			return `init done mounted=${mountedStoryCount ?? '?'} nodes=${runtimeElementCount ?? '?'} rev=${runtimeRevision ?? '?'}`
		}

		case 'player:play': {
			const startTimelineMs = readNumber(payload, 'startTimelineMs')
			return `play start timeline=${startTimelineMs ?? '?'}ms`
		}

		case 'player:event:applied': {
			const eventName = readString(payload, 'eventName')
			const appliedCommitCount = readNumber(payload, 'appliedCommitCount')
			const appliedActionsCount = readNumber(payload, 'appliedActionsCount')
			const animationAppliedCount = readNumber(payload, 'animationAppliedCount')
			const conflictCount = readNumber(payload, 'conflictCount')
			return `apply ${eventName ?? '?'} commits=${appliedCommitCount ?? '?'} actions=${appliedActionsCount ?? '?'} anim=${animationAppliedCount ?? '?'} conflicts=${conflictCount ?? '?'}`
		}

		default:
			return `${row.eventName}${formatCompactPayload(payload)}`
	}
}

/**
 * Formats one trace row into one compact readable line.
 */
function formatTraceRow(row: RuntimeTraceRow, firstTraceMs: number): string {
	const deltaMs = Math.max(0, Math.round(row.traceMs - firstTraceMs))
	const status = row.status.toUpperCase().padEnd(8, ' ')
	const message = formatTraceMessage(row)
	return `+${String(deltaMs).padStart(4, ' ')}ms ${status} ${message}`
}

/**
 * Formats one trace row in lightweight mode: time + event name, warn on errors.
 */
function formatTraceRowCompact(row: RuntimeTraceRow, firstTraceMs: number): string {
	const deltaMs = Math.max(0, Math.round(row.traceMs - firstTraceMs))
	const time = `+${String(deltaMs).padStart(4, ' ')}ms`
	const isError = row.status === RUNTIME_TRACE_STATUS.rejected || row.status === RUNTIME_TRACE_STATUS.error
	if (isError) {
		const payload = (row.payload ?? {}) as Record<string, unknown>
		const code = typeof payload['code'] === 'string' ? ` code=${payload['code']}` : ''
		return `${time} !! ${row.eventName}${code}`
	}
	return `${time} ${row.eventName}`
}

/**
 * Creates one retained trace panel controller for the shared demo shell.
 */
export function createTraceLogPanel(node: HTMLDivElement, options: { maxLines?: number; compact?: boolean } | number = {}): {
	push: (row: RuntimeTraceRow) => void;
} {
	const resolvedOptions = typeof options === 'number' ? { maxLines: options } : options
	const maxLines = resolvedOptions.maxLines ?? 14
	const compact = resolvedOptions.compact ?? false

	const traceLines: string[] = []
	let firstTraceMs: number | null = null

	return {
		push: (row) => {
			if (firstTraceMs === null) {
				firstTraceMs = row.traceMs
			}

			const line = compact
				? formatTraceRowCompact(row, firstTraceMs)
				: formatTraceRow(row, firstTraceMs)
			traceLines.push(line)
			if (traceLines.length > maxLines) {
				traceLines.shift()
			}

			node.textContent = traceLines.join('\n')
		}
	}
}
