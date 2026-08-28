import '../shared/demo-shell.css';

import { animate, engine } from 'animejs';

import { createAnimationAdapter, type AnimeImplementation } from 'codplay-v1/animation/adapter';
import { PlayerFacade } from 'codplay-v1/player/create-player';
import type { PlayerApi } from 'codplay-v1/player/player';
import type { ApiResult } from 'codplay-v1/builder/types';
import { createTelco } from 'codplay-v1/telco/create-telco';
import { createDemoRemoteV1 } from '@codplay/remote';
import { createTraceLogPanel } from '../shared/trace-log-panel';
import { resolveSceneSeekMaxMs } from '../shared/resolve-scene-seek-max-ms';
import { buildDemoLinksMarkup } from '../shared/demo-registry';
import type { PlayerSceneDemoConfig } from '../shared/demo-scene-types';

/**
 * Adapts one low-level `PlayerFacade` to the public `PlayerApi` shape consumed
 * by `createTelco`, so the shared demo remote can drive it like any other
 * player. Only the subset of `PlayerApi` that `createTelco` actually calls is
 * meaningfully implemented; the rest is present only to satisfy the type.
 */
function adaptPlayerFacadeToPlayerApi(facade: PlayerFacade): PlayerApi {
	const toApiResult = async (command: Promise<{ ok: boolean; error?: { code: string; message: string } }>): Promise<ApiResult<void>> => {
		const result = await command;
		return result.ok ? { ok: true, data: undefined } : { ok: false, error: result.error as { code: string; message: string } };
	};

	return {
		init: async () => ({ ok: true, data: undefined }),
		play: () => toApiResult(facade.play()),
		pause: () => toApiResult(facade.pause()),
		resume: () => toApiResult(facade.play()),
		stop: () => toApiResult(facade.destroy()),
		destroy: () => toApiResult(facade.destroy()),
		rewind: () => toApiResult(facade.rewind()),
		seek: (input) => toApiResult(facade.seek(input.timelineMs)),
		emit: (input) => toApiResult(facade.emit({ name: input.name, payload: input.data, cascade: input.cascade })),
		getState: () => facade.getState(),
		getRate: () => facade.getRate(),
		setRate: (rate) => { facade.setRate(rate); },
		onChange: (listener) => facade.onStateChange(listener),
		onTrace: (listener) => facade.onTrace(listener),
		subscribeToNode: () => () => {},
		schedule: null as unknown as PlayerApi['schedule'],
	};
}

/**
 * Builds an animejs wrapper compatible with the runtime animation adapter.
 */
function createAnimeImplementation(): AnimeImplementation {
	engine.useDefaultMainLoop = false;

	return (parameters) => {
		const targets = parameters.targets;
		const animationParameters = { ...parameters };
		delete animationParameters.targets;

		const animationTargets = targets as Parameters<typeof animate>[0];
		const typedAnimationParameters = animationParameters as Parameters<typeof animate>[1];
		return animate(animationTargets, typedAnimationParameters);
	};
}

/**
 * Renders animejs animations from the player ticker loop.
 */
function renderAnimeFrameFromPlayerTicker(): void {
	engine.update();
}

/**
 * Checks whether one reference is a DOM Node.
 */
function isDomNode(nodeRef: unknown): nodeRef is Node {
	return typeof globalThis.Node !== 'undefined' && nodeRef instanceof globalThis.Node;
}

/**
 * Mounts configured root runtime nodes into the presentation container.
 */
function mountDemoRootNodes(containerNode: HTMLDivElement, player: PlayerFacade, rootNodeIds: string[]): void {
	const registry = player.getRuntimeRegistry();
	const rootNodes: Node[] = [];

	for (const rootNodeId of rootNodeIds) {
		const nodeRef = registry.getNodeById(rootNodeId);
		if (!isDomNode(nodeRef)) {
			continue;
		}

		rootNodes.push(nodeRef);
	}

	containerNode.replaceChildren(...rootNodes);
}

function syncInteractionLock(containerNode: HTMLDivElement, status: string): void {
	const locked = status === 'paused' || status === 'seeking';
	containerNode.style.pointerEvents = locked ? 'none' : 'auto';
	if (locked) {
		containerNode.setAttribute('inert', '');
		return;
	}

	containerNode.removeAttribute('inert');
}

/**
 * Subscribes one callback to the next animation frame, cancellable.
 */
function subscribeOnTick(callback: () => void): () => void {
	const frameId = globalThis.requestAnimationFrame(callback);
	return () => { globalThis.cancelAnimationFrame(frameId); };
}

type PlayerDemoConfig = PlayerSceneDemoConfig & { rootNodeIds: string[] }

/**
 * Renders one shared player demo layout for one scene-based scenario.
 */
export async function runPlayerSceneDemo(config: PlayerDemoConfig): Promise<void> {
	const appNode = globalThis.document.querySelector<HTMLDivElement>('#app');
	if (appNode === null) {
		throw new Error('Expected #app root element');
	}

	const seekMaxMsFromScene = resolveSceneSeekMaxMs(config.scene);
	const demoLinksMarkup = buildDemoLinksMarkup(config.activeDemo, config.demoLinks);

	appNode.innerHTML = `
    <main class="demo-shell">
      <aside>
        <p class="eyebrow">Runtime V1</p>
        ${demoLinksMarkup.length > 0 ? `<nav class="demo-links">${demoLinksMarkup}</nav>` : ''}
        <h1>${config.title}</h1>
        <p class="subtitle">${config.subtitle}</p>
        <div id="demo-remote-slot"></div>
        <div id="player-trace" class="player-state player-trace"></div>
      </aside>
      <div class="container" id="demo-container"></div>
    </main>
  `;

	const containerNode = globalThis.document.querySelector<HTMLDivElement>('#demo-container');
	if (containerNode === null) {
		throw new Error('Expected #demo-container element');
	}

	containerNode.style.position = 'relative';

	const remoteSlotNode = globalThis.document.querySelector<HTMLDivElement>('#demo-remote-slot');
	if (remoteSlotNode === null) {
		throw new Error('Expected #demo-remote-slot element');
	}

	const playerTrace = globalThis.document.querySelector<HTMLDivElement>('#player-trace');
	if (playerTrace === null) {
		throw new Error('Expected #player-trace element');
	}
	const playerTraceNode = playerTrace;

	const animationAdapter = createAnimationAdapter(createAnimeImplementation(), {
		renderFrame: () => {
			renderAnimeFrameFromPlayerTicker();
		},
	});
	const player = new PlayerFacade({
		animationAdapter,
		createElementOptions: {
			emitRuntimeEvent: (event) => {
				void player.emit({
					name: event.name,
					payload: event.data,
					scopeStoryId: event.scopeStoryId,
					source: event.source,
					ms: event.ms,
					cascade: event.cascade,
				})
			},
		},
	});

	const telco = createTelco(adaptPlayerFacadeToPlayerApi(player), { subscribeOnTick });

	const remote = createDemoRemoteV1({
		telco,
		seekMaxMsFromScene,
		actions: config.actions,
		emit:
			(config.actions?.length ?? 0) > 0 ?
				async (event) => {
					await player.emit({
						name: event.name,
						payload: event.payload,
						cascade: event.cascade,
						scopeStoryId: event.scopeStoryId,
					});
				}
			: undefined,
	});
	remoteSlotNode.appendChild(remote.element);

	const traceLogPanel = createTraceLogPanel(playerTraceNode);

	let mountedRuntimeRevision = -1;
	player.onStateChange((state) => {
		if (state.runtimeRevision !== mountedRuntimeRevision) {
			mountDemoRootNodes(containerNode, player, config.rootNodeIds);
			mountedRuntimeRevision = state.runtimeRevision;
		}

		syncInteractionLock(containerNode, state.status);
	});

	player.onTrace((row) => {
		traceLogPanel.push(row);
	});

	const initResult = await player.init(config.scene);
	if (!initResult.ok) {
		throw new Error(`[demo] init failed: ${initResult.error.code}`);
	}

	mountDemoRootNodes(containerNode, player, config.rootNodeIds);
	const initialState = player.getState();
	mountedRuntimeRevision = initialState.runtimeRevision;
	syncInteractionLock(containerNode, initialState.status);
	remote.sync();
}
