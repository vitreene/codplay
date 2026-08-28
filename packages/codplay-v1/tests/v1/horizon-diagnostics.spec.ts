import { describe, expect, it, vi } from 'vitest'

import { createAnimationAdapter, type AnimeImplementation } from '../../src/animation/adapter'
import { BuilderFacade } from '../../src/builder/create-builder'
import { Player } from '../../src/player'
import { PlayerFacade } from '../../src/player/create-player'
import { createStrapTrackId } from '../../src/player/create-player-utils'
import type { StrapCollection } from '../../src/player/strap-types'
import type { SceneDoc } from '../../src/player/types'
import type { RuntimeTraceRow } from '../../src/runtime/trace-store'

/**
 * Creates one anime implementation that applies values immediately.
 */
function createApplyingAnimeImplementation() {
	return vi.fn<AnimeImplementation>(() => ({ pause: vi.fn() }))
}

/**
 * Creates one minimal scene where a support track schedules one future helper event.
 */
function createSupportCounterScene(input: { strapTrackRole?: string } = {}): SceneDoc {
	const supportCounterTrackId = createStrapTrackId('support-story', 'support-counter')
	return {
		id: 'support-counter-scene',
		initial: undefined,
		straps: undefined,
		listen: [],
		stories: {
			'support-story': {
				id: 'support-story',
				trackId: 'support-track',
				initial: { move: '@root' },
				persos: [
					{
						id: 'support-node',
						type: 'tag',
						initial: { content: 'support', move: '@root' },
						actions: {}
					}
				],
				straps: supportCounterStraps,
				listen: [
					{
						on: 'support:start',
						straps: ['support-counter']
					}
				],
				eventimes: [
					{
						name: 'support:start',
						startAt: 0
					}
				]
			}
		},
		tracks: {
			'master-track': {
				role: 'master',
				events: [
					{
						id: 'evt-master-anchor',
						ms: 200,
						name: 'master:anchor',
						index: 0,
						source: 'story'
					}
				]
			},
			'support-track': {
				role: 'support'
			},
			[supportCounterTrackId]: {
				...(input.strapTrackRole ? { role: input.strapTrackRole } : {})
			}
		},
		onStart(scene, options) {
			options.schedule('support-story')
		}
	}
}

const supportCounterStraps: StrapCollection = {
	'support-counter': ({ context }) => {
		return [context.planned.wait(1000, { event: { name: 'support:future', cascade: true } })]
	}
}

/**
 * Creates one scene that persists strap updates and relies on them after seek.
 */
function createStateReplayScene(): SceneDoc {
	return {
		id: 'state-replay-scene',
		initial: undefined,
		straps: undefined,
		listen: [
			{
				on: 'arm',
				straps: ['arm-state']
			},
			{
				on: 'fire',
				straps: ['render-state']
			}
		],
		stories: {
			'state-story': {
				id: 'state-story',
				initial: { move: '@root' },
				persos: [
					{
						id: 'result-node',
						type: 'tag',
						initial: { content: 'idle', move: '@root' },
						actions: {
							'result-node': null
						}
					}
				],
				straps: undefined,
				listen: []
			}
		},
		tracks: {}
	}
}

/**
 * Creates one scene whose support track contains one past event beyond the master projection.
 */
function createPlayProgressionScene(): SceneDoc {
	return {
		id: 'play-progression-scene',
		initial: undefined,
		straps: undefined,
		listen: [],
		stories: {
			'progress-story': {
				id: 'progress-story',
				trackId: 'support-track',
				initial: { move: '@root' },
				persos: [
					{
						id: 'progress-node',
						type: 'tag',
						initial: { content: 'progress', move: '@root' },
						actions: {}
					}
				],
				straps: undefined,
				listen: [],
				eventimes: []
			}
		},
		tracks: {
			'master-track': {
				role: 'master',
				events: [
					{
						id: 'evt-master-anchor',
						ms: 200,
						name: 'master:anchor',
						index: 0,
						source: 'story'
					}
				]
			},
			'support-track': {
				role: 'support',
				events: [
					{
						id: 'evt-support-progression',
						ms: 1000,
						name: 'support:progression',
						index: 0,
						source: 'story'
					}
				]
			}
		},
		onStart(scene, options) {
			options.schedule('progress-story')
		}
	}
}

const stateReplayStraps: StrapCollection = {
	'arm-state': () => ({
		update: {
			armed: true
		}
	}),
	'render-state': ({ state }) => ({
		events: [
			{
				name: 'result-node',
				data: {
					content: state.armed === true ? 'armed' : 'disarmed'
				}
			}
		]
	})
}

const helperStateReplayStraps: StrapCollection = {
	'arm-state': ({ context }) => {
		return [context.planned.wait(0, {
			update: {
				armed: true
			}
		})]
	},
	'render-state': ({ state }) => ({
		events: [
			{
				name: 'result-node',
				data: {
					content: state.armed === true ? 'armed' : 'disarmed'
				}
			}
		]
	})
}

const helperJitStateReplayStraps: StrapCollection = {
	'arm-state': ({ context }) => {
		context.live.wait(0, {
			update: {
				armed: true
			}
		}, { mode: 'jit' })

		return {}
	},
	'render-state': ({ state }) => ({
		events: [
			{
				name: 'result-node',
				data: {
					content: state.armed === true ? 'armed' : 'disarmed'
				}
			}
		]
	})
}

const helperRepeatStateReplayStraps: StrapCollection = {
	'arm-state': ({ context }) => {
		return [context.planned.repeat({ everyMs: 1, times: 2 }, ({ index }) => {
			if (index === 0) {
				return
			}

			return {
				update: {
					armed: true
				}
			}
		})]
	},
	'render-state': ({ state }) => ({
		events: [
			{
				name: 'result-node',
				data: {
					content: state.armed === true ? 'armed' : 'disarmed'
				}
			}
		]
	})
}

const helperLoopStateReplayStraps: StrapCollection = {
	'arm-state': ({ context }) => {
		return [context.planned.loop({
			eachMs: 1,
			until: { type: 'times', max: 1 }
		}, ({ index }) => {
			if (index !== 0) {
				return
			}

			return {
				update: {
					armed: true
				}
			}
		})]
	},
	'render-state': ({ state }) => ({
		events: [
			{
				name: 'result-node',
				data: {
					content: state.armed === true ? 'armed' : 'disarmed'
				}
			}
		]
	})
}

describe('horizon diagnostics', () => {
	it('extends the visible sequence duration during play when a past non-master event is replayed', async () => {
		const player = new PlayerFacade({
			createElementOptions: {
				nodeFactory: () => ({ tagName: 'DIV', style: {}, attributes: {} }) as never
			}
		})

		expect(await player.init(createPlayProgressionScene())).toEqual({ ok: true, data: undefined })
		expect(await player.seek({ timelineMs: 1000 })).toEqual({ ok: true, data: undefined })
		expect(await player.play()).toEqual({ ok: true, data: undefined })

		expect(player.getState().horizon.playedEndMs).toBe(1000)
		expect(player.getState().horizon.progressEndMs).toBe(1000)
		expect(await player.pause()).toEqual({ ok: true, data: undefined })
	})

	it('keeps playedEndMs stable during seek replay and filters future support-track events', async () => {
		const builder = new BuilderFacade()
		const player = new Player({
			animationAdapter: createAnimationAdapter(createApplyingAnimeImplementation()),
			createElementOptions: {
				nodeFactory: () => ({ tagName: 'DIV', style: {}, attributes: {} }) as never
			}
		})
		const traces: RuntimeTraceRow[] = []
		player.onTrace((row) => {
			traces.push(row)
		})

		const compileResult = builder.compile({ scene: createSupportCounterScene() })
		expect(compileResult.ok).toBe(true)
		if (!compileResult.ok) {
			throw new Error('support scene compile failed')
		}

		expect(await player.init({
			mountTarget: {},
			compiledScene: compileResult.data.compiledScene,
			resourceManifest: compileResult.data.resourceManifest,
			strapCollection: supportCounterStraps
		})).toEqual({ ok: true, data: undefined })

		expect(await player.play()).toEqual({ ok: true, data: undefined })
		expect(await player.pause()).toEqual({ ok: true, data: undefined })

		const playedEndMsBeforeSeek = player.getState().horizon.playedEndMs
		expect(player.getState().horizon.projectedMasterEndMs).toBe(200)
		expect(player.getState().horizon.authorEndMs).toBe(1000)

		expect(await player.seek({ timelineMs: 1000 })).toEqual({ ok: true, data: undefined })

		expect(player.getState().timelineMs).toBe(1000)
		expect(player.getState().horizon.playedEndMs).toBe(playedEndMsBeforeSeek)
		expect(
			traces.some(
				(row) =>
					row.eventName === 'player:seek:replay:event' && row.payload?.eventName === 'support:future'
			)
		).toBe(false)
		expect(
			traces.some(
				(row) =>
					row.eventName === 'player:seek:replay:event' && row.payload?.eventName === 'master:anchor'
			)
		).toBe(true)
	})

	it('keeps authorEndMs canonical while master-projected seek stays clamped to master tracks', async () => {
		const builder = new BuilderFacade()
		const player = new Player({
			animationAdapter: createAnimationAdapter(createApplyingAnimeImplementation()),
			runtimePolicy: { seekPolicy: 'master-projected' },
			createElementOptions: {
				nodeFactory: () => ({ tagName: 'DIV', style: {}, attributes: {} }) as never
			}
		})

		const compileResult = builder.compile({ scene: createSupportCounterScene() })
		expect(compileResult.ok).toBe(true)
		if (!compileResult.ok) {
			throw new Error('support scene compile failed')
		}

		expect(await player.init({
			mountTarget: {},
			compiledScene: compileResult.data.compiledScene,
			resourceManifest: compileResult.data.resourceManifest,
			strapCollection: supportCounterStraps
		})).toEqual({ ok: true, data: undefined })

		expect(await player.play()).toEqual({ ok: true, data: undefined })
		expect(await player.pause()).toEqual({ ok: true, data: undefined })

		expect(player.getState().horizon).toMatchObject({
			projectedMasterEndMs: 200,
			authorEndMs: 1000,
			seekEndMs: 200
		})
	})

	it('recomputes progressEndMs from playedEndMs when seek starts', async () => {
		const player = new PlayerFacade({
			animationAdapter: createAnimationAdapter(createApplyingAnimeImplementation()),
			createElementOptions: {
				nodeFactory: () => ({ tagName: 'DIV', style: {}, attributes: {} }) as never
			}
		})

		const snapshots: Array<ReturnType<PlayerFacade['getState']>> = []
		player.onStateChange((state) => {
			snapshots.push(state)
		})

		expect(await player.init(createSupportCounterScene())).toEqual({ ok: true })

		expect(await player.play()).toEqual({ ok: true })
		expect(await player.pause()).toEqual({ ok: true })
		expect(await player.emit({
			name: 'quiz:decor:probe',
			ms: 1000,
			source: 'system',
			trackId: 'support-track'
		})).toEqual({ ok: true })

		expect(player.getState().horizon.playedEndMs).toBe(1000)
		expect(player.getState().horizon.progressEndMs).toBe(1000)

		expect(await player.seek({ timelineMs: 1500 })).toEqual({ ok: true })

		const seekingSnapshots = snapshots.filter((state) => state.status === 'seeking')
		const seekingSnapshot = seekingSnapshots[seekingSnapshots.length - 1]
		expect(seekingSnapshot?.horizon.progressEndMs).toBe(1000)
		expect(seekingSnapshot?.horizon.seekEndMs).toBe(1000)
	})

	it('lets one strap track extend projectedMasterEndMs only when its role is explicitly master', async () => {
		const builder = new BuilderFacade()
		const player = new Player({
			animationAdapter: createAnimationAdapter(createApplyingAnimeImplementation()),
			createElementOptions: {
				nodeFactory: () => ({ tagName: 'DIV', style: {}, attributes: {} }) as never
			}
		})

		const compileResult = builder.compile({ scene: createSupportCounterScene({ strapTrackRole: 'master' }) })
		expect(compileResult.ok).toBe(true)
		if (!compileResult.ok) {
			throw new Error('support scene compile failed')
		}

		expect(await player.init({
			mountTarget: {},
			compiledScene: compileResult.data.compiledScene,
			resourceManifest: compileResult.data.resourceManifest,
			strapCollection: supportCounterStraps
		})).toEqual({ ok: true, data: undefined })

		expect(await player.play()).toEqual({ ok: true, data: undefined })
		expect(await player.pause()).toEqual({ ok: true, data: undefined })

		expect(player.getState().horizon).toMatchObject({
			projectedMasterEndMs: 1000,
			authorEndMs: 1000
		})
	})

	it('replays materialized strap updates so later interactions keep the rebuilt author state', async () => {
		const builder = new BuilderFacade()
		const player = new Player({
			animationAdapter: createAnimationAdapter(createApplyingAnimeImplementation()),
			createElementOptions: {
				nodeFactory: () => ({ tagName: 'DIV', style: {}, attributes: {} }) as never
			}
		})

		const compileResult = builder.compile({ scene: createStateReplayScene() })
		expect(compileResult.ok).toBe(true)
		if (!compileResult.ok) {
			throw new Error('state replay scene compile failed')
		}

		expect(await player.init({
			mountTarget: {},
			compiledScene: compileResult.data.compiledScene,
			resourceManifest: compileResult.data.resourceManifest,
			strapCollection: stateReplayStraps
		})).toEqual({ ok: true, data: undefined })

		expect(await player.play()).toEqual({ ok: true, data: undefined })
		expect(await player.emit({ name: 'arm' })).toEqual({ ok: true, data: undefined })
		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(await player.pause()).toEqual({ ok: true, data: undefined })
		const replayTargetMs = Math.max(1, Math.ceil(player.getState().timelineMs))
		expect(await player.seek({ timelineMs: replayTargetMs })).toEqual({ ok: true, data: undefined })
		expect(await player.play()).toEqual({ ok: true, data: undefined })

		expect(await player.emit({ name: 'fire' })).toEqual({ ok: true, data: undefined })
		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(await player.pause()).toEqual({ ok: true, data: undefined })

		const resultNode = player.getRuntimeRegistry().getNodeById('result-node') as { textContent?: string } | null
		expect(resultNode?.textContent).toBe('armed')
	})

	it('replays materialized helper updates so later interactions keep the rebuilt author state', async () => {
		const builder = new BuilderFacade()
		const player = new Player({
			animationAdapter: createAnimationAdapter(createApplyingAnimeImplementation()),
			createElementOptions: {
				nodeFactory: () => ({ tagName: 'DIV', style: {}, attributes: {} }) as never
			}
		})

		const compileResult = builder.compile({ scene: createStateReplayScene() })
		expect(compileResult.ok).toBe(true)
		if (!compileResult.ok) {
			throw new Error('helper state replay scene compile failed')
		}

		expect(await player.init({
			mountTarget: {},
			compiledScene: compileResult.data.compiledScene,
			resourceManifest: compileResult.data.resourceManifest,
			strapCollection: helperStateReplayStraps
		})).toEqual({ ok: true, data: undefined })

		expect(await player.play()).toEqual({ ok: true, data: undefined })
		expect(await player.emit({ name: 'arm' })).toEqual({ ok: true, data: undefined })
		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(await player.pause()).toEqual({ ok: true, data: undefined })
		const replayTargetMs = Math.max(1, Math.ceil(player.getState().timelineMs))
		expect(await player.seek({ timelineMs: replayTargetMs })).toEqual({ ok: true, data: undefined })
		expect(await player.play()).toEqual({ ok: true, data: undefined })

		expect(await player.emit({ name: 'fire' })).toEqual({ ok: true, data: undefined })
		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(await player.pause()).toEqual({ ok: true, data: undefined })

		const resultNode = player.getRuntimeRegistry().getNodeById('result-node') as { textContent?: string } | null
		expect(resultNode?.textContent).toBe('armed')
	})

	it('replays materialized helper jit wait updates so later interactions keep the rebuilt author state', async () => {
		const builder = new BuilderFacade()
		const player = new Player({
			animationAdapter: createAnimationAdapter(createApplyingAnimeImplementation()),
			createElementOptions: {
				nodeFactory: () => ({ tagName: 'DIV', style: {}, attributes: {} }) as never
			}
		})

		const compileResult = builder.compile({ scene: createStateReplayScene() })
		expect(compileResult.ok).toBe(true)
		if (!compileResult.ok) {
			throw new Error('helper jit state replay scene compile failed')
		}

		expect(await player.init({
			mountTarget: {},
			compiledScene: compileResult.data.compiledScene,
			resourceManifest: compileResult.data.resourceManifest,
			strapCollection: helperJitStateReplayStraps
		})).toEqual({ ok: true, data: undefined })

		expect(await player.play()).toEqual({ ok: true, data: undefined })
		expect(await player.emit({ name: 'arm' })).toEqual({ ok: true, data: undefined })
		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(await player.pause()).toEqual({ ok: true, data: undefined })
		const replayTargetMs = Math.max(1, Math.ceil(player.getState().timelineMs))
		expect(await player.seek({ timelineMs: replayTargetMs })).toEqual({ ok: true, data: undefined })
		expect(await player.play()).toEqual({ ok: true, data: undefined })

		expect(await player.emit({ name: 'fire' })).toEqual({ ok: true, data: undefined })
		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(await player.pause()).toEqual({ ok: true, data: undefined })

		const resultNode = player.getRuntimeRegistry().getNodeById('result-node') as { textContent?: string } | null
		expect(resultNode?.textContent).toBe('armed')
	})

	it('replays materialized helper repeat updates so later interactions keep the rebuilt author state', async () => {
		const builder = new BuilderFacade()
		const player = new Player({
			animationAdapter: createAnimationAdapter(createApplyingAnimeImplementation()),
			createElementOptions: {
				nodeFactory: () => ({ tagName: 'DIV', style: {}, attributes: {} }) as never
			}
		})

		const compileResult = builder.compile({ scene: createStateReplayScene() })
		expect(compileResult.ok).toBe(true)
		if (!compileResult.ok) {
			throw new Error('helper repeat state replay scene compile failed')
		}

		expect(await player.init({
			mountTarget: {},
			compiledScene: compileResult.data.compiledScene,
			resourceManifest: compileResult.data.resourceManifest,
			strapCollection: helperRepeatStateReplayStraps
		})).toEqual({ ok: true, data: undefined })

		expect(await player.play()).toEqual({ ok: true, data: undefined })
		expect(await player.emit({ name: 'arm' })).toEqual({ ok: true, data: undefined })
		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(await player.pause()).toEqual({ ok: true, data: undefined })
		const replayTargetMs = Math.max(1, Math.ceil(player.getState().timelineMs))
		expect(await player.seek({ timelineMs: replayTargetMs })).toEqual({ ok: true, data: undefined })
		expect(await player.play()).toEqual({ ok: true, data: undefined })

		expect(await player.emit({ name: 'fire' })).toEqual({ ok: true, data: undefined })
		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(await player.pause()).toEqual({ ok: true, data: undefined })

		const resultNode = player.getRuntimeRegistry().getNodeById('result-node') as { textContent?: string } | null
		expect(resultNode?.textContent).toBe('armed')
	})

	it('replays materialized helper loop updates so later interactions keep the rebuilt author state', async () => {
		const builder = new BuilderFacade()
		const player = new Player({
			animationAdapter: createAnimationAdapter(createApplyingAnimeImplementation()),
			createElementOptions: {
				nodeFactory: () => ({ tagName: 'DIV', style: {}, attributes: {} }) as never
			}
		})

		const compileResult = builder.compile({ scene: createStateReplayScene() })
		expect(compileResult.ok).toBe(true)
		if (!compileResult.ok) {
			throw new Error('helper loop state replay scene compile failed')
		}

		expect(await player.init({
			mountTarget: {},
			compiledScene: compileResult.data.compiledScene,
			resourceManifest: compileResult.data.resourceManifest,
			strapCollection: helperLoopStateReplayStraps
		})).toEqual({ ok: true, data: undefined })

		expect(await player.play()).toEqual({ ok: true, data: undefined })
		expect(await player.emit({ name: 'arm' })).toEqual({ ok: true, data: undefined })
		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(await player.pause()).toEqual({ ok: true, data: undefined })
		const replayTargetMs = Math.max(1, Math.ceil(player.getState().timelineMs))
		expect(await player.seek({ timelineMs: replayTargetMs })).toEqual({ ok: true, data: undefined })
		expect(await player.play()).toEqual({ ok: true, data: undefined })

		expect(await player.emit({ name: 'fire' })).toEqual({ ok: true, data: undefined })
		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(await player.pause()).toEqual({ ok: true, data: undefined })

		const resultNode = player.getRuntimeRegistry().getNodeById('result-node') as { textContent?: string } | null
		expect(resultNode?.textContent).toBe('armed')
	})
})
