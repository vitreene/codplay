import { describe, expect, it } from 'vitest'

import { createSequenceCommandPanel as createPlayerSequenceCommandPanel } from '../../src/demos/player/player-scene-demo/sequence-command-panel'
import { createSequenceCommandPanel as createCodPlaySequenceCommandPanel } from '../../src/demos/codplay/codplay-scene-demo/sequence-command-panel'
import type { PlayerStateSnapshot } from '../../src/player/types'

type Listener = () => void

type FakeButtonNode = {
	disabled: boolean
	textContent: string
	addEventListener: (_eventName: string, _listener: Listener) => void
}

type FakeInputNode = {
	disabled: boolean
	value: string
	max: string
	addEventListener: (_eventName: string, _listener: Listener) => void
}

type FakeTextNode = {
	textContent: string
}

/**
 * Creates one inert button-like node for panel tests.
 */
function createButtonNode(): FakeButtonNode {
	return {
		disabled: false,
		textContent: '',
		addEventListener: () => {
			return
		}
	}
}

/**
 * Creates one inert range-like node for panel tests.
 */
function createInputNode(): FakeInputNode {
	return {
		disabled: false,
		value: '0',
		max: '0',
		addEventListener: () => {
			return
		}
	}
}

/**
 * Creates one player snapshot fixture with explicit progress and seek horizons.
 */
function createStateFixture(input: {
	status: PlayerStateSnapshot['status']
	timelineMs: number
	progressEndMs: number
	seekEndMs: number
}): PlayerStateSnapshot {
	return {
		status: input.status,
		initialized: true,
		sequenceEnded: false,
		sceneId: 'scene-fixture',
		timelineMs: input.timelineMs,
		horizon: {
			playedEndMs: 1200,
			projectedMasterEndMs: input.progressEndMs,
			authorEndMs: input.progressEndMs,
			progressEndMs: input.progressEndMs,
			seekEndMs: input.seekEndMs
		},
		runtimeRevision: 1
	}
}

/**
 * Creates one minimal public player stub.
 */
function createPublicPlayerStub(state: PlayerStateSnapshot) {
	return {
		getState: () => state,
		play: async () => ({ ok: true as const, data: undefined }),
		pause: async () => ({ ok: true as const, data: undefined }),
		seek: async () => ({ ok: true as const, data: undefined }),
		emit: async () => ({ ok: true as const, data: undefined })
	}
}

/**
 * Creates one minimal facade player stub.
 */
function createFacadePlayerStub(state: PlayerStateSnapshot) {
	return {
		getState: () => state,
		play: async () => ({ ok: true as const }),
		pause: async () => ({ ok: true as const }),
		rewind: async () => ({ ok: true as const }),
		seek: async () => ({ ok: true as const }),
		emit: async () => ({ ok: true as const })
	}
}

describe('sequence command panels', () => {
	it('uses the real seek ceiling while playing in the facade demo panel', () => {
		const state = createStateFixture({
			status: 'playing',
			timelineMs: 1800,
			progressEndMs: 6000,
			seekEndMs: 2400
		})

		const seekRangeNode = createInputNode()
		const panel = createPlayerSequenceCommandPanel({
			player: createFacadePlayerStub(state) as never,
			seekMaxMsFromScene: 6000,
			playButtonNode: createButtonNode() as never,
			rewindButtonNode: createButtonNode() as never,
			seekRangeNode: seekRangeNode as never,
			seekLabelNode: { textContent: '' } as never,
			playerStateNode: { textContent: '' } as never,
			actions: [],
			actionButtonNodes: new Map()
		})

		panel.syncFromState(state)

		expect(seekRangeNode.max).toBe('2400')
	})

	it('uses the real seek ceiling while playing in the public demo panel', () => {
		const state = createStateFixture({
			status: 'playing',
			timelineMs: 1800,
			progressEndMs: 6000,
			seekEndMs: 2400
		})

		const seekRangeNode = createInputNode()
		const panel = createCodPlaySequenceCommandPanel({
			player: createPublicPlayerStub(state) as never,
			seekMaxMsFromScene: 6000,
			playButtonNode: createButtonNode() as never,
			rewindButtonNode: createButtonNode() as never,
			seekRangeNode: seekRangeNode as never,
			seekLabelNode: { textContent: '' } as never,
			playerStateNode: { textContent: '' } as never,
			actions: [],
			actionButtonNodes: new Map()
		})

		panel.syncFromState(state)

		expect(seekRangeNode.max).toBe('2400')
	})
})
