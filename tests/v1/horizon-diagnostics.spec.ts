import { describe, expect, it, vi } from 'vitest'

import { createAnimationAdapter, type AnimeImplementation } from '../../src/animation/adapter'
import { BuilderFacade } from '../../src/builder/create-builder'
import { Player } from '../../src/player'
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
function createSupportCounterScene(): SceneDoc {
	return {
		id: 'support-counter-scene',
		rootStories: ['support-story'],
		initial: undefined,
		straps: undefined,
		listen: [],
		stories: {
			'support-story': {
				id: 'support-story',
				trackId: 'support-track',
				entries: ['support-node'],
				initial: undefined,
				persos: [
					{
						id: 'support-node',
						type: 'text',
						initial: { content: 'support' },
						actions: {}
					}
				],
				straps: undefined,
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
			}
		},
		init(scene, options) {
			options.mount(scene.rootStories[0])
		},
		onStart(scene, options) {
			options.schedule(scene.rootStories[0])
		}
	}
}

const supportCounterStraps: StrapCollection = {
	'support-counter': ({ context }) => {
		context.helpers.delay(1000, { name: 'support:future', cascade: true })
		return {}
	}
}

describe('horizon diagnostics', () => {
	it('shows that support helper tracks lose their role and can extend author horizon only', async () => {
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

		const helperTrackRow = traces.find((row) => row.eventName === 'player:track:ensure' && row.payload?.trackId === 'strap-support-story-support:future-1')
		expect(helperTrackRow?.payload?.role).toBeUndefined()

		const authorPollutionRow = traces.find((row) => {
			if (row.eventName !== 'player:horizon:sync') {
				return false
			}

			const projectedMasterEndMs = row.payload?.projectedMasterEndMs
			const authorEndMs = row.payload?.authorEndMs
			return projectedMasterEndMs === 200 && authorEndMs === 1000
		})

		expect(authorPollutionRow).toBeDefined()
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
})
