import '../shared/demo-shell.css'

import { animate, engine } from 'animejs'

import type { SceneDef } from '../../builder/types'
import { createAnimationAdapter, type AnimeImplementation } from '../../animation/adapter'
import { CodPlay } from '../../creator'
import type { SceneDoc } from '../../player/types'
import { createSequenceCommandPanel } from './codplay-scene-demo/sequence-command-panel'
import { createTraceLogPanel } from '../shared/trace-log-panel'
import type { PlayerSceneDemoConfig } from '../shared/demo-scene-types'

type StoryEventimeLike = {
	name: string;
	startAt: number;
	events?: StoryEventimeLike[];
}

function createAnimeImplementation(): AnimeImplementation {
	engine.useDefaultMainLoop = false

	return (parameters) => {
		const targets = parameters.targets
		const animationParameters = { ...parameters }
		delete animationParameters.targets

		const animationTargets = targets as Parameters<typeof animate>[0]
		const typedAnimationParameters = animationParameters as Parameters<typeof animate>[1]
		return animate(animationTargets, typedAnimationParameters)
	}
}

function renderAnimeFrameFromPlayerTicker(): void {
	engine.update()
}

function isDomNode(nodeRef: unknown): nodeRef is Node {
	return typeof globalThis.Node !== 'undefined' && nodeRef instanceof globalThis.Node
}

function readTransitionDurationMs(value: unknown): number {
	if (typeof value !== 'object' || value === null) {
		return 0
	}

	const transition = value as Record<string, unknown>
	const duration =
		typeof transition.duration === 'number' && Number.isFinite(transition.duration) ? transition.duration : 0
	const delay = typeof transition.delay === 'number' && Number.isFinite(transition.delay) ? transition.delay : 0
	return Math.max(0, duration + delay)
}

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

function visitEventimes(eventimes: StoryEventimeLike[] | undefined, parentStartAt: number, visitor: (eventName: string, eventMs: number) => void): void {
	if (!Array.isArray(eventimes)) {
		return
	}

	for (const eventime of eventimes) {
		const eventMs = Math.max(0, parentStartAt + eventime.startAt)
		visitor(eventime.name, eventMs)
		visitEventimes(eventime.events, eventMs, visitor)
	}
}

function resolveSceneSeekMaxMs(scene: SceneDoc): number {
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

	let maxTimelineMs = 0
	for (const story of Object.values(scene.stories)) {
		visitEventimes(story.eventimes, 0, (eventName, eventMs) => {
			const actionDurationMs = actionDurationByEventName.get(eventName) ?? 0
			maxTimelineMs = Math.max(maxTimelineMs, eventMs + actionDurationMs)
		})
	}

	const tracks = scene.tracks
	if (typeof tracks === 'object' && tracks !== null) {
		for (const rawTrack of Object.values(tracks)) {
			if (typeof rawTrack !== 'object' || rawTrack === null) {
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
	}

	return Math.max(1, Math.round(maxTimelineMs))
}

function mountDemoRootNodes(containerNode: HTMLDivElement, studio: CodPlay, rootNodeIds: string[]): void {
	const registry = studio.player.getRuntimeRegistry()
	const rootNodes: Node[] = []

	for (const rootNodeId of rootNodeIds) {
		const nodeRef = registry.getNodeById(rootNodeId)
		if (!isDomNode(nodeRef)) {
			continue
		}

		rootNodes.push(nodeRef)
	}

	containerNode.replaceChildren(...rootNodes)
}

/**
 * Renders one shared CodPlay demo shell for one scene-based scenario.
 */
export async function runCodPlaySceneDemo(config: PlayerSceneDemoConfig): Promise<void> {
	const appNode = globalThis.document.querySelector<HTMLDivElement>('#app')
	if (appNode === null) {
		throw new Error('Expected #app root element')
	}

	const seekMaxMsFromScene = resolveSceneSeekMaxMs(config.scene)
	const demoLinksMarkup = (config.demoLinks ?? [])
		.map((link) => `<a class="demo-link${link.active ? ' demo-link-active' : ''}" href="${link.href}">${link.label}</a>`)
		.join('')
	const actionButtonsMarkup = (config.actions ?? [])
		.map((action) => `<button id="${action.id}" class="demo-button ${action.className ?? 'demo-button-secondary'}" type="button">${action.label}</button>`)
		.join('')

	appNode.innerHTML = `
    <main class="demo-shell">
      <aside>
        <p class="eyebrow">CodPlay V1</p>
        ${demoLinksMarkup.length > 0 ? `<nav class="demo-links">${demoLinksMarkup}</nav>` : ''}
        <h1>${config.title}</h1>
        <p class="subtitle">${config.subtitle}</p>
        <div class="demo-controls">
          <button id="demo-play-button" class="demo-button" type="button">Play</button>
          <button id="demo-rewind-button" class="demo-button demo-button-secondary" type="button">Rewind</button>
          <label class="demo-progress-control" for="demo-seek-range">
            <span>Seek</span>
            <input id="demo-seek-range" class="demo-progress-range" type="range" min="0" max="${seekMaxMsFromScene}" step="10" value="0" />
            <span id="demo-seek-label" class="demo-progress-label">0ms / ${Math.max(0, Math.round(seekMaxMsFromScene))}ms</span>
          </label>
        </div>
        ${actionButtonsMarkup.length > 0 ? `<div class="demo-controls demo-actions">${actionButtonsMarkup}</div>` : ''}
        <div id="player-state" class="player-state"></div>
        <div id="player-trace" class="player-state player-trace"></div>
      </aside>
      <div class="container" id="demo-container"></div>
    </main>
  `

	const containerNode = globalThis.document.querySelector<HTMLDivElement>('#demo-container')
	if (containerNode === null) {
		throw new Error('Expected #demo-container element')
	}
	const demoContainerNode = containerNode
	demoContainerNode.style.position = 'relative'

	const animationAdapter = createAnimationAdapter(createAnimeImplementation(), {
		renderFrame: () => {
			renderAnimeFrameFromPlayerTicker()
		}
	})
	const studio = new CodPlay({
		animationAdapter,
	})

	const playerStateNode = globalThis.document.querySelector<HTMLDivElement>('#player-state')
	if (playerStateNode === null) {
		throw new Error('Expected #player-state element')
	}
	const playerTraceNode = globalThis.document.querySelector<HTMLDivElement>('#player-trace')
	if (playerTraceNode === null) {
		throw new Error('Expected #player-trace element')
	}
	const playButtonNode = globalThis.document.querySelector<HTMLButtonElement>('#demo-play-button')
	if (playButtonNode === null) {
		throw new Error('Expected #demo-play-button element')
	}
	const rewindButtonNode = globalThis.document.querySelector<HTMLButtonElement>('#demo-rewind-button')
	if (rewindButtonNode === null) {
		throw new Error('Expected #demo-rewind-button element')
	}
	const seekRangeNode = globalThis.document.querySelector<HTMLInputElement>('#demo-seek-range')
	if (seekRangeNode === null) {
		throw new Error('Expected #demo-seek-range element')
	}
	const seekLabelNode = globalThis.document.querySelector<HTMLSpanElement>('#demo-seek-label')
	if (seekLabelNode === null) {
		throw new Error('Expected #demo-seek-label element')
	}

	const actionButtonNodes = new Map<string, HTMLButtonElement>()
	for (const action of config.actions ?? []) {
		const actionButtonNode = globalThis.document.querySelector<HTMLButtonElement>(`#${action.id}`)
		if (actionButtonNode === null) {
			throw new Error(`Expected #${action.id} element`)
		}
		actionButtonNodes.set(action.id, actionButtonNode)
	}

	const traceLogPanel = createTraceLogPanel(playerTraceNode)
	const compileResult = studio.builder.compile({ scene: config.scene as unknown as SceneDef })
	if (!compileResult.ok) {
		throw new Error(`[demo] compile failed: ${compileResult.error.code}`)
	}
	const compiledScene = compileResult.data.compiledScene
	const resourceManifest = compileResult.data.resourceManifest

	async function resetDemoRuntime(): Promise<void> {
		mountedRuntimeRevision = -1
		const destroyResult = await studio.player.destroy()
		if (!destroyResult.ok) {
			throw new Error(`[demo] destroy failed: ${destroyResult.error.code}`)
		}

		const replayInitResult = await studio.player.init({
			mountTarget: demoContainerNode,
			compiledScene,
			resourceManifest,
		})
		if (!replayInitResult.ok) {
			throw new Error(`[demo] init failed: ${replayInitResult.error.code}`)
		}

		mountDemoRootNodes(demoContainerNode, studio, config.rootNodeIds)
		const nextState = studio.player.getState()
		mountedRuntimeRevision = nextState.runtimeRevision
		commandPanel.syncFromState(nextState)
	}

	const commandPanel = createSequenceCommandPanel({
		player: studio.player,
		seekMaxMsFromScene,
		playButtonNode,
		rewindButtonNode,
		seekRangeNode,
		seekLabelNode,
		playerStateNode,
		rewindAction: resetDemoRuntime,
		actions: config.actions,
		actionButtonNodes,
	})

	let mountedRuntimeRevision = -1

	studio.player.onChange((state) => {
		if (state.runtimeRevision !== mountedRuntimeRevision) {
			mountDemoRootNodes(containerNode, studio, config.rootNodeIds)
			mountedRuntimeRevision = state.runtimeRevision
		}
		commandPanel.syncFromState(state)
	})

	studio.player.onTrace((row) => {
		traceLogPanel.push(row)
	})

	const initResult = await studio.player.init({
		mountTarget: demoContainerNode,
		compiledScene,
		resourceManifest,
	})
	if (!initResult.ok) {
		throw new Error(`[demo] init failed: ${initResult.error.code}`)
	}

	mountDemoRootNodes(demoContainerNode, studio, config.rootNodeIds)
	const initialState = studio.player.getState()
	mountedRuntimeRevision = initialState.runtimeRevision
	commandPanel.syncFromState(initialState)
}
