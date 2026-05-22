import { Player } from '../../../player'
import type { PlayerStateSnapshot } from '../../../player/types'
import type { PlayerSceneDemoAction } from '../../shared/demo-scene-types'

/**
 * Creates one command panel controller for the public CodPlay player surface.
 */
export function createSequenceCommandPanel(input: {
	player: Player;
	seekMaxMsFromScene: number;
	playButtonNode: HTMLButtonElement;
	rewindButtonNode: HTMLButtonElement;
	seekRangeNode: HTMLInputElement;
	seekLabelNode: HTMLSpanElement;
	playerStateNode: HTMLDivElement;
	rewindAction?: () => Promise<void>;
	actions?: PlayerSceneDemoAction[];
	actionButtonNodes: Map<string, HTMLButtonElement>;
}): {
	syncFromState: (state?: PlayerStateSnapshot) => void;
} {
	let commandInFlight = false
	let progressLoopFrameId: number | null = null
	const seekThrottleMs = 90
	let pendingSeekTargetMs: number | null = null
	let seekThrottleTimer: ReturnType<typeof globalThis.setTimeout> | null = null
	let lastSeekDispatchMs = 0
	let seekInteractionActive = false
	// Keep the slider scale stable while the user scrubs, even if master-driven progress updates arrive.
	let seekScaleLockMaxMs: number | null = null

	function syncSeekLabel(timelineMs: number, maxTimelineMs: number): void {
		input.seekLabelNode.textContent = `${formatTimelineMs(timelineMs)} / ${formatTimelineMs(maxTimelineMs)}`
	}

	function renderPlayerState(state: PlayerStateSnapshot): void {
		input.playerStateNode.textContent = `status=${state.status} timelineMs=${Math.round(state.timelineMs)} revision=${state.runtimeRevision}`
	}

	function syncActionButtons(state: PlayerStateSnapshot): void {
		for (const action of input.actions ?? []) {
			input.actionButtonNodes.get(action.id)!.disabled = commandInFlight || !state.initialized
		}
	}

	function readSeekTargetMsFromRange(): number {
		const rawValue = Number(input.seekRangeNode.value)
		if (!Number.isFinite(rawValue)) {
			return 0
		}

		return Math.max(0, Math.round(rawValue))
	}

	function syncControlState(state: PlayerStateSnapshot = input.player.getState()): void {
		const canPlay = state.sequenceEnded || state.status === 'ready' || state.status === 'paused'
		const canPause = !state.sequenceEnded && state.status === 'playing'
		const canRewind =
			!state.sequenceEnded && state.initialized && (state.status === 'ready' || state.status === 'paused' || state.status === 'playing')
		const canSeek =
			!state.sequenceEnded &&
			state.initialized &&
			(state.status === 'paused' ||
				state.status === 'playing' ||
				state.status === 'seeking')

		const seekMaxMs =
			seekScaleLockMaxMs !== null
				? seekScaleLockMaxMs
				: Math.round(state.horizon.seekEndMs)
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

	async function runControlCommand(
		commandName: string,
		command: () => Promise<{ ok: boolean; error?: { code: string } } | { ok: true; data: undefined } | { ok: false; error: { code: string } }>,
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

	async function runRewindFlow(): Promise<void> {
		if (input.rewindAction) {
			await input.rewindAction()
			return
		}

		const stateBefore = input.player.getState()
		if (stateBefore.status === 'playing') {
			await runControlCommand('pause', () => input.player.pause())
		}

		await runControlCommand('seek:0', () => input.player.seek({ timelineMs: 0 }))
	}

	async function runSeekFlow(targetTimelineMs: number): Promise<void> {
		const stateBefore = input.player.getState()
		if (stateBefore.status === 'playing') {
			await runControlCommand('pause', () => input.player.pause())
		}

		await runControlCommand('seek', () => input.player.seek({ timelineMs: targetTimelineMs }))
	}

	function resolveNowMs(): number {
		if (typeof globalThis.performance !== 'undefined') {
			return globalThis.performance.now()
		}

		return Date.now()
	}

	function runPendingSeekNow(): void {
		if (commandInFlight || pendingSeekTargetMs === null) {
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

	function scheduleThrottledSeekDispatch(): void {
		if (pendingSeekTargetMs === null || seekThrottleTimer !== null) {
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
		if (input.player.getState().status === 'playing' || commandInFlight) {
			return
		}

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

		if (input.player.getState().status === 'playing' && !commandInFlight) {
			// Lock the current progress scale before pausing so a live master update does not jump the handle.
			seekScaleLockMaxMs = Number(input.seekRangeNode.max)
			void runControlCommand('pause', () => input.player.pause())
		}
	})

	input.seekRangeNode.addEventListener('pointerup', () => {
		seekInteractionActive = false
		seekScaleLockMaxMs = null
		syncControlState()
	})

	input.seekRangeNode.addEventListener('pointercancel', () => {
		seekInteractionActive = false
		seekScaleLockMaxMs = null
		syncControlState()
	})

	input.seekRangeNode.addEventListener('blur', () => {
		seekInteractionActive = false
		seekScaleLockMaxMs = null
		syncControlState()
	})

	input.seekRangeNode.addEventListener('change', () => {
		seekInteractionActive = false
		seekScaleLockMaxMs = null
		if (input.player.getState().status === 'playing' || commandInFlight) {
			syncControlState()
			return
		}

		if (commandInFlight) {
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
			void runControlCommand(`emit:${action.event.name}`, () => input.player.emit({
				name: action.event.name,
				data: action.event.payload,
				cascade: action.event.cascade
			}))
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

function formatTimelineMs(value: number): string {
	return `${Math.max(0, Math.round(value))}ms`
}
