import type { SceneDoc } from '../../player/types'

type StoryEventimeLike = {
	name: string
	startAt: number
	events?: StoryEventimeLike[]
}

/**
 * Reads one style transition duration and delay in milliseconds.
 */
function readTransitionDurationMs(value: unknown): number {
	if (typeof value !== 'object' || value === null) {
		return 0
	}

	const transition = value as Record<string, unknown>
	if (transition.ignoreDuration === true) {
		return 0
	}

	const duration = typeof transition.duration === 'number' && Number.isFinite(transition.duration) ? transition.duration : 0
	const delay = typeof transition.delay === 'number' && Number.isFinite(transition.delay) ? transition.delay : 0
	return Math.max(0, duration + delay)
}

/**
 * Resolves one action payload max style transition duration.
 */
function resolveActionDurationMs(action: unknown): number {
	if (typeof action !== 'object' || action === null) {
		return 0
	}

	const style = (action as { style?: unknown }).style
	if (typeof style !== 'object' || style === null) {
		return 0
	}

	let maxDurationMs = 0
	for (const styleValue of Object.values(style as Record<string, unknown>)) {
		maxDurationMs = Math.max(maxDurationMs, readTransitionDurationMs(styleValue))
	}

	return maxDurationMs
}

/**
 * Visits nested story eventimes depth-first to compute a deterministic seek horizon.
 */
function visitEventimes(
	eventimes: StoryEventimeLike[] | undefined,
	parentStartAt: number,
	visitor: (eventName: string, eventMs: number) => void,
): void {
	if (!Array.isArray(eventimes)) {
		return
	}

	for (const eventime of eventimes) {
		const eventMs = Math.max(0, parentStartAt + eventime.startAt)
		visitor(eventime.name, eventMs)
		visitEventimes(eventime.events, eventMs, visitor)
	}
}

/**
 * Resolves one deterministic seek horizon from scene stories and tracks.
 */
export function resolveSceneSeekMaxMs(scene: SceneDoc): number {
	const actionDurationByEventName = new Map<string, number>()
	for (const story of Object.values(scene.stories)) {
		for (const perso of story.persos) {
			for (const [eventName, action] of Object.entries(perso.actions)) {
				const currentDurationMs = actionDurationByEventName.get(eventName) ?? 0
				const nextDurationMs = resolveActionDurationMs(action)
				actionDurationByEventName.set(eventName, Math.max(currentDurationMs, nextDurationMs))
			}
		}
	}

	const trackEntries = Object.entries(scene.tracks ?? {})
	const hasMasterTracks = trackEntries.some(([, rawTrack]) => {
		if (typeof rawTrack !== 'object' || rawTrack === null) {
			return false
		}

		return (rawTrack as { role?: unknown }).role === 'master'
	})

	const contributesToHorizon = (storyId: string): boolean => {
		if (!hasMasterTracks) {
			return true
		}

		const story = scene.stories[storyId]
		const trackId = story?.trackId ?? storyId
		const rawTrack = scene.tracks?.[trackId]
		return typeof rawTrack === 'object' && rawTrack !== null && (rawTrack as { role?: unknown }).role === 'master'
	}

	let maxTimelineMs = 0
	for (const story of Object.values(scene.stories)) {
		if (!contributesToHorizon(story.id)) {
			continue
		}

		visitEventimes(story.eventimes, 0, (eventName, eventMs) => {
			const actionDurationMs = actionDurationByEventName.get(eventName) ?? 0
			maxTimelineMs = Math.max(maxTimelineMs, eventMs + actionDurationMs)
		})
	}

	for (const [, rawTrack] of trackEntries) {
		if (typeof rawTrack !== 'object' || rawTrack === null) {
			continue
		}

		if (hasMasterTracks && (rawTrack as { role?: unknown }).role !== 'master') {
			continue
		}

		const track = rawTrack as { events?: unknown }
		const events = Array.isArray(track.events) ? track.events : []
		for (const rawEvent of events) {
			if (typeof rawEvent !== 'object' || rawEvent === null) {
				continue
			}

			const event = rawEvent as { ms?: unknown; name?: unknown }
			const eventMsRaw = typeof event.ms === 'number' && Number.isFinite(event.ms) ? event.ms : 0
			const eventMs = Math.max(0, eventMsRaw)
			const eventName = typeof event.name === 'string' ? event.name : ''
			const actionDurationMs = actionDurationByEventName.get(eventName) ?? 0
			maxTimelineMs = Math.max(maxTimelineMs, eventMs + actionDurationMs)
		}
	}

	return Math.max(1, Math.round(maxTimelineMs))
}
