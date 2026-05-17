import { PlayerFacade } from '../../../player/create-player'
import type { PlayerStateSnapshot } from '../../../player/types'
import type { PlayerSceneDemoAction } from '../../shared/demo-scene-types'

type SeekablePlayer = {
	seek?: (targetTimelineMs: number) => Promise<{ ok: boolean; error?: { code: string } }>;
}

/**
 * Creates one command panel controller for transport, seek and extra emit actions.
 */
export function createSequenceCommandPanel(input: {
	player: PlayerFacade;
	seekMaxMsFromScene: number;
	playButtonNode: HTMLButtonElement;
	rewindButtonNode: HTMLButtonElement;
	seekRangeNode: HTMLInputElement;
	seekLabelNode: HTMLSpanElement;
	playerStateNode: HTMLDivElement;
	actions?: PlayerSceneDemoAction[];
	actionButtonNodes: Map<string, HTMLButtonElement>;
}): {
	syncFromState: (state?: PlayerStateSnapshot) => void;
} {
	const playerAsSeekable = input.player as SeekablePlayer
	const seekCommand = typeof playerAsSeekable.seek === 'function' ? playerAsSeekable.seek.bind(input.player) : null
	let commandInFlight = false
	let progressLoopFrameId: number | null = null
	const seekThrottleMs = 90
	let pendingSeekTargetMs: number | null = null
	let seekThrottleTimer: ReturnType<typeof globalThis.setTimeout> | null = null
	let lastSeekDispatchMs = 0
	let seekInteractionActive = false

	/**
	 * Synchronizes the seek label with the displayed cursor and max horizon.
	 */
	function syncSeekLabel(timelineMs: number, maxTimelineMs: number): void {
		input.seekLabelNode.textContent = `${formatTimelineMs(timelineMs)} / ${formatTimelineMs(maxTimelineMs)}`
	}

	/**
	 * Renders the compact player state summary in the sidebar.
	 */
	function renderPlayerState(state: PlayerStateSnapshot): void {
		input.playerStateNode.textContent = `status=${state.status} timelineMs=${Math.round(state.timelineMs)} revision=${state.runtimeRevision}`
	}

	/**
	 * Enables or disables custom action buttons according to current player state.
	 */
	function syncActionButtons(state: PlayerStateSnapshot): void {
		for (const action of input.actions ?? []) {
			input.actionButtonNodes.get(action.id)!.disabled = commandInFlight || !state.initialized
		}
	}

	/**
	 * Synchronizes all command controls from one player state snapshot.
	 */
	function syncControlState(state: PlayerStateSnapshot = input.player.getState()): void {
		const canPlay = state.status === 'ready' || state.status === 'paused'
		const canPause = state.status === 'playing'
		const canRewind =
			state.initialized && (state.status === 'ready' || state.status === 'paused' || state.status === 'playing')
		const canSeek =
			seekCommand !== null &&
			state.initialized &&
			(state.status === 'paused' ||
				state.status === 'playing' ||
				state.status === 'seeking')

		const seekMaxMs =
			state.status === 'ready'
				? Math.max(input.seekMaxMsFromScene, Math.round(state.timelineMs))
				: Math.max(Math.round(state.timelineEndMs), Math.round(state.timelineMs))
		const clampedTimelineMs = Math.min(Math.max(0, Math.round(state.timelineMs)), seekMaxMs)
		const interactionTimelineMs = Math.min(readSeekTargetMsFromRange(), seekMaxMs)
		const pendingTimelineMs = pendingSeekTargetMs === null ? null : Math.min(pendingSeekTargetMs, seekMaxMs)
		const displayedTimelineMs = seekInteractionActive ? interactionTimelineMs : (pendingTimelineMs ?? clampedTimelineMs)

		input.playButtonNode.disabled = commandInFlight || (!canPlay && !canPause)
		input.playButtonNode.textContent = canPause ? 'Pause' : 'Play'
		input.rewindButtonNode.disabled = commandInFlight || !canRewind
		input.seekRangeNode.disabled = !canSeek
		input.seekRangeNode.max = String(seekMaxMs)
		input.seekRangeNode.value = String(displayedTimelineMs)
		syncSeekLabel(displayedTimelineMs, seekMaxMs)
		syncActionButtons(state)
	}

	/**
	 * Keeps the seek label and state summary fresh while playback is running.
	 */
	function syncProgressLoop(): void {
		if (typeof globalThis.requestAnimationFrame !== 'function') {
			return
		}

		if (progressLoopFrameId !== null) {
			return
		}

		progressLoopFrameId = globalThis.requestAnimationFrame(() => {
			progressLoopFrameId = null
			const state = input.player.getState()
			renderPlayerState(state)
			syncControlState(state)

			if (state.status === 'playing') {
				syncProgressLoop()
			}
		})
	}

	/**
	 * Runs one serialized player command and updates button states around it.
	 */
	async function runControlCommand(
		commandName: string,
		command: () => Promise<{ ok: boolean; error?: { code: string } }>,
	): Promise<void> {
		if (commandInFlight) {
			return
		}

		commandInFlight = true
		syncControlState()

		try {
			const result = await command()
			if (!result.ok) {
				throw new Error(`[demo] ${commandName} failed: ${result.error?.code ?? 'UNKNOWN_ERROR'}`)
			}
		} finally {
			commandInFlight = false
			syncControlState()
		}
	}

	/**
	 * Rewinds the sequence while preserving the existing pause-before-rewind behavior.
	 */
	async function runRewindFlow(): Promise<void> {
		const stateBefore = input.player.getState()
		if (stateBefore.status === 'playing') {
			await runControlCommand('pause', () => input.player.pause())
		}

		await runControlCommand('rewind', () => input.player.rewind())
	}

	/**
	 * Seeks after pausing live playback so the current path stays deterministic.
	 */
	async function runSeekFlow(targetTimelineMs: number): Promise<void> {
		const stateBefore = input.player.getState()
		if (stateBefore.status === 'playing') {
			await runControlCommand('pause', () => input.player.pause())
		}

		if (seekCommand === null) {
			return
		}

		await runControlCommand('seek', () => seekCommand(targetTimelineMs))
	}

	/**
	 * Reads and sanitizes the current seek target from the range input.
	 */
	function readSeekTargetMsFromRange(): number {
		const rawValue = Number(input.seekRangeNode.value)
		if (!Number.isFinite(rawValue)) {
			return 0
		}

		return Math.max(0, Math.round(rawValue))
	}

	/**
	 * Resolves one monotonic timestamp used by the seek throttle.
	 */
	function resolveNowMs(): number {
		if (typeof globalThis.performance !== 'undefined') {
			return globalThis.performance.now()
		}

		return Date.now()
	}

	/**
	 * Flushes the latest pending seek target immediately when throttling allows it.
	 */
	function runPendingSeekNow(): void {
		if (seekCommand === null || commandInFlight || pendingSeekTargetMs === null) {
			return
		}

		const targetTimelineMs = pendingSeekTargetMs
		pendingSeekTargetMs = null
		lastSeekDispatchMs = resolveNowMs()

		void runSeekFlow(targetTimelineMs).finally(() => {
			if (pendingSeekTargetMs !== null) {
				scheduleThrottledSeekDispatch()
			}
		})
	}

	/**
	 * Delays seek dispatch slightly to keep pointer scrubbing responsive.
	 */
	function scheduleThrottledSeekDispatch(): void {
		if (seekCommand === null || pendingSeekTargetMs === null) {
			return
		}

		if (seekThrottleTimer !== null) {
			return
		}

		const nowMs = resolveNowMs()
		const elapsedMs = nowMs - lastSeekDispatchMs
		const waitMs = Math.max(0, seekThrottleMs - elapsedMs)

		seekThrottleTimer = globalThis.setTimeout(() => {
			seekThrottleTimer = null
			runPendingSeekNow()
		}, waitMs)
	}

	input.playButtonNode.addEventListener('click', () => {
		const state = input.player.getState()
		if (state.status === 'playing') {
			void runControlCommand('pause', () => input.player.pause())
			return
		}

		void runControlCommand('play', () => input.player.play())
	})

	input.rewindButtonNode.addEventListener('click', () => {
		void runRewindFlow()
	})

	input.seekRangeNode.addEventListener('input', () => {
		seekInteractionActive = true
		const clampedSeekValueMs = readSeekTargetMsFromRange()
		pendingSeekTargetMs = clampedSeekValueMs

		const seekMaxMs = Number(input.seekRangeNode.max)
		const clampedSeekMaxMs = Number.isFinite(seekMaxMs) ? seekMaxMs : input.seekMaxMsFromScene
		syncSeekLabel(clampedSeekValueMs, clampedSeekMaxMs)

		scheduleThrottledSeekDispatch()
	})

	input.seekRangeNode.addEventListener('pointerdown', () => {
		seekInteractionActive = true
	})

	input.seekRangeNode.addEventListener('pointerup', () => {
		seekInteractionActive = false
		syncControlState()
	})

	input.seekRangeNode.addEventListener('pointercancel', () => {
		seekInteractionActive = false
		syncControlState()
	})

	input.seekRangeNode.addEventListener('blur', () => {
		seekInteractionActive = false
		syncControlState()
	})

	input.seekRangeNode.addEventListener('change', () => {
		seekInteractionActive = false

		if (seekCommand === null || commandInFlight) {
			return
		}

		pendingSeekTargetMs = readSeekTargetMsFromRange()
		if (seekThrottleTimer !== null) {
			globalThis.clearTimeout(seekThrottleTimer)
			seekThrottleTimer = null
		}

		runPendingSeekNow()
	})

	for (const action of input.actions ?? []) {
		input.actionButtonNodes.get(action.id)!.addEventListener('click', () => {
			void runControlCommand(`emit:${action.event.name}`, () => input.player.emit(action.event))
		})
	}

	return {
		syncFromState: (state = input.player.getState()) => {
			renderPlayerState(state)
			syncControlState(state)

			if (state.status === 'playing') {
				syncProgressLoop()
			}
		}
	}
}

/**
 * Formats one timeline value for the seek UI.
 */
function formatTimelineMs(value: number): string {
	return `${Math.max(0, Math.round(value))}ms`
}
