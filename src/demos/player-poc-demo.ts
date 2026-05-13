import './player-poc-demo.css';

import { animate, engine } from 'animejs';

import { createAnimationAdapter, type AnimeImplementation } from '../animation/adapter';
import { RUNTIME_EVENT_SOURCE } from '../core/events/constants';
import { PlayerFacade } from '../player/create-player';
import type { PersoDoc, PlayerStateSnapshot, SceneDoc } from '../player/types';
import { RUNTIME_TRACE_STATUS } from '../runtime/trace-constants';
import type { RuntimeTraceRow } from '../runtime/trace-store';

type TracePayload = Record<string, unknown>;

type SeekablePlayer = {
	seek?: (targetTimelineMs: number) => Promise<{ ok: boolean; error?: { code: string } }>;
};

/**
 * Session rule:
 * - temporary step tests are run in this demo file
 * - preserve appNode.innerHTML structure and CSS frame unless user explicitly asks otherwise
 */

/**
 * Builds an animejs wrapper compatible with runtime animation adapter.
 */
function temp__createAnimeImplementation(): AnimeImplementation {
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
function temp__renderAnimeFrameFromPlayerTicker(): void {
	engine.update();
}

/**
 * Removes duplicated initial.id when it only mirrors the perso id.
 */
function temp__normalizeDemoPersos(
	persoById: Record<string, PersoDoc>,
): PersoDoc[] {
	return Object.values(persoById).map((perso) => {
		const nextInitial = { ...perso.initial };
		if (nextInitial.id === perso.id) {
			delete nextInitial.id;
		}

		return {
			...perso,
			initial: nextInitial,
		};
	});
}

/**
 * Creates one demo scene focused on list add/reorder/remove behavior.
 */
function temp__createDemoScene(): SceneDoc {
	const persoById = {
		'demo-list': {
			id: 'demo-list',
			type: 'list',
			initial: {
				id: 'demo-list',
				className: 'demo-card demo-list-main',
				style: {
					position: 'absolute',
					left: '50%',
					top: '50%',
					marginLeft: '-190px',
					marginTop: '-160px',
					width: '380px',
					minHeight: '320px',
					padding: '16px',
					backgroundColor: '#eef7f6',
					border: '2px dashed #0b7a75',
					borderRadius: '14px',
					boxShadow: '0 10px 24px rgba(16, 38, 67, 0.18)',
					transform: 'rotate(24deg) scale(0.77)',
					transformOrigin: 'center',
					zIndex: 1,
				},
			},
			actions: {
				'demo:lists:drift': {
					style: {
						x: {
							from: 0,
							to: 130,
							duration: 12000,
							easing: 'linear',
						},
						y: {
							from: 0,
							to: -35,
							duration: 12000,
							easing: 'linear',
						},
						rotate: {
							from: 24,
							to: 40,
							duration: 12000,
							easing: 'linear',
						},
					},
				},
			},
		},
		'demo-stage-list': {
			id: 'demo-stage-list',
			type: 'list',
			initial: {
				id: 'demo-stage-list',
				className: 'demo-card',
				style: {
					position: 'absolute',
					left: '8%',
					top: '16%',
					width: '240px',
					minHeight: '320px',
					padding: '12px',
					backgroundColor: '#fff4df',
					border: '2px solid #f7b267',
					borderRadius: '14px',
					boxShadow: '0 10px 24px rgba(16, 38, 67, 0.12)',
					transform: 'rotate(-10deg) scale(1.1)',
					zIndex: 0,
				},
			},
			actions: {
				'demo:lists:drift': {
					style: {
						x: {
							from: 0,
							to: -95,
							duration: 12000,
							easing: 'linear',
						},
						y: {
							from: 0,
							to: 28,
							duration: 12000,
							easing: 'linear',
						},
						rotate: {
							from: -10,
							to: 6,
							duration: 12000,
							easing: 'linear',
						},
					},
				},
			},
		},
		'demo-trash-list': {
			id: 'demo-trash-list',
			type: 'list',
			initial: {
				id: 'demo-trash-list',
				style: {
					display: 'none',
				},
			},
			actions: {},
		},
		'demo-item-1': {
			id: 'demo-item-1',
			type: 'text',
			initial: {
				id: 'demo-item-1',
				tag: 'div',
				move: {
					parentId: 'demo-stage-list',
					mode: 'append',
				},
				className: 'demo-list-item',
				content: 'ITEM 1',
				style: {
					padding: '0.7rem 0.85rem',
					marginBottom: '0.5rem',
					borderRadius: '0.6rem',
					color: '#ffffff',
					fontWeight: 700,
					letterSpacing: '0.04em',
					backgroundColor: '#f25f5c',
					transform: 'rotate(-4deg) scale(0.98)',
					transformOrigin: 'center',
				},
			},
			actions: {
				'demo:item-1:add': {
					move: { parentId: 'demo-list', mode: 'append', flipMode: 'overlay-world' },
				},
				'demo:item-1:return-origin': {
					move: { parentId: 'demo-stage-list', mode: 'append', flipMode: 'overlay-world' },
				},
			},
		},
		'demo-item-2': {
			id: 'demo-item-2',
			type: 'text',
			initial: {
				id: 'demo-item-2',
				tag: 'div',
				move: {
					parentId: 'demo-stage-list',
					mode: 'append',
				},
				className: 'demo-list-item',
				content: 'ITEM 2',
				style: {
					padding: '0.7rem 0.85rem',
					marginBottom: '0.5rem',
					borderRadius: '0.6rem',
					color: '#ffffff',
					fontWeight: 700,
					letterSpacing: '0.04em',
					backgroundColor: '#f7b267',
					transform: 'rotate(3deg) scale(1.01)',
					transformOrigin: 'center',
				},
			},
			actions: {
				'demo:item-2:add': {
					move: { parentId: 'demo-list', mode: 'append', flipMode: 'overlay-world' },
				},
				'demo:item-2:return-origin': {
					move: { parentId: 'demo-stage-list', mode: 'append', flipMode: 'overlay-world' },
				},
			},
		},
		'demo-item-3': {
			id: 'demo-item-3',
			type: 'text',
			initial: {
				id: 'demo-item-3',
				tag: 'div',
				move: {
					parentId: 'demo-stage-list',
					mode: 'append',
				},
				className: 'demo-list-item',
				content: 'ITEM 3',
				style: {
					padding: '0.7rem 0.85rem',
					marginBottom: '0.5rem',
					borderRadius: '0.6rem',
					color: '#ffffff',
					fontWeight: 700,
					letterSpacing: '0.04em',
					backgroundColor: '#70c1b3',
					transform: 'rotate(-2deg) scale(0.99)',
					transformOrigin: 'center',
				},
			},
			actions: {
				'demo:item-3:add': {
					move: { parentId: 'demo-list', mode: 'append', flipMode: 'overlay-world' },
				},
				'demo:item-3:to-first': {
					move: { parentId: 'demo-list', mode: 'first' },
				},
				'demo:item-3:return-origin': {
					move: { parentId: 'demo-stage-list', mode: 'append', flipMode: 'overlay-world' },
				},
			},
		},
		'demo-item-4': {
			id: 'demo-item-4',
			type: 'text',
			initial: {
				id: 'demo-item-4',
				tag: 'div',
				move: {
					parentId: 'demo-stage-list',
					mode: 'append',
				},
				className: 'demo-list-item',
				content: 'ITEM 4',
				style: {
					padding: '0.7rem 0.85rem',
					marginBottom: '0.5rem',
					borderRadius: '0.6rem',
					color: '#ffffff',
					fontWeight: 700,
					letterSpacing: '0.04em',
					backgroundColor: '#247ba0',
					transform: 'rotate(2deg) scale(1.02)',
					transformOrigin: 'center',
				},
			},
			actions: {
				'demo:item-4:add': {
					move: { parentId: 'demo-list', mode: 'append', flipMode: 'overlay-world' },
				},
				'demo:item-4:return-origin': {
					move: { parentId: 'demo-stage-list', mode: 'append', flipMode: 'overlay-world' },
				},
			},
		},
		'demo-item-5': {
			id: 'demo-item-5',
			type: 'text',
			initial: {
				id: 'demo-item-5',
				tag: 'div',
				move: {
					parentId: 'demo-stage-list',
					mode: 'append',
				},
				className: 'demo-list-item',
				content: 'ITEM 5',
				style: {
					padding: '0.7rem 0.85rem',
					marginBottom: '0.5rem',
					borderRadius: '0.6rem',
					color: '#ffffff',
					fontWeight: 700,
					letterSpacing: '0.04em',
					backgroundColor: '#b388eb',
					transform: 'rotate(-3deg) scale(1)',
					transformOrigin: 'center',
				},
			},
			actions: {
				'demo:item-5:add': {
					move: { parentId: 'demo-list', mode: 'append', flipMode: 'overlay-world' },
				},
				'demo:item-5:return-origin': {
					move: { parentId: 'demo-stage-list', mode: 'append', flipMode: 'overlay-world' },
				},
			},
		},
	};

	return {
		id: 'scene-demo',
		rootStories: ['story-demo'],
		initial: undefined,
		straps: undefined,
		listen: [],
		stories: {
			'story-demo': {
				id: 'story-demo',
				entries: Object.keys(persoById),
				initial: undefined,
				persos: temp__normalizeDemoPersos(persoById),
				straps: undefined,
				listen: [],
			},
		},
		init(scene, options) {
			options.mount(scene.rootStories[0]);
		},
		onStart(scene, options) {
			options.start(scene.rootStories[0]);
		},
		tracks: {
			'track-demo': {
				id: 'track-demo',
					source: RUNTIME_EVENT_SOURCE.story,
				order: 0,
				events: [
					{
						ms: 0,
						name: 'demo:lists:drift',
					},
					{
						ms: 1000,
						name: 'demo:item-1:add',
					},
					{
						ms: 2000,
						name: 'demo:item-2:add',
					},
					{
						ms: 3000,
						name: 'demo:item-3:add',
					},
					{
						ms: 4000,
						name: 'demo:item-4:add',
					},
					{
						ms: 5000,
						name: 'demo:item-5:add',
					},
					{
						ms: 6200,
						name: 'demo:item-3:to-first',
					},
					{
						ms: 7200,
						name: 'demo:item-1:return-origin',
					},
					{
						ms: 7600,
						name: 'demo:item-2:return-origin',
					},
					{
						ms: 8000,
						name: 'demo:item-3:return-origin',
					},
					{
						ms: 8400,
						name: 'demo:item-4:return-origin',
					},
					{
						ms: 8800,
						name: 'demo:item-5:return-origin',
					},
				],
			},
		},
	};
}

/**
 * Checks whether one reference is a DOM Node.
 */
function temp__isDomNode(nodeRef: unknown): nodeRef is Node {
	return typeof globalThis.Node !== 'undefined' && nodeRef instanceof globalThis.Node;
}

/**
 * Reads one style transition object duration and delay in milliseconds.
 */
function temp__readTransitionDurationMs(value: unknown): number {
	if (typeof value !== 'object' || value === null) {
		return 0;
	}

	const transition = value as Record<string, unknown>;
	const duration =
		typeof transition.duration === 'number' && Number.isFinite(transition.duration) ? transition.duration : 0;
	const delay = typeof transition.delay === 'number' && Number.isFinite(transition.delay) ? transition.delay : 0;
	return Math.max(0, duration + delay);
}

/**
 * Resolves one action payload max style transition duration.
 */
function temp__resolveActionDurationMs(action: unknown): number {
	if (typeof action !== 'object' || action === null) {
		return 0;
	}

	const style = (action as { style?: unknown }).style;
	if (typeof style !== 'object' || style === null) {
		return 0;
	}

	let maxDurationMs = 0;
	for (const styleValue of Object.values(style as Record<string, unknown>)) {
		maxDurationMs = Math.max(maxDurationMs, temp__readTransitionDurationMs(styleValue));
	}

	return maxDurationMs;
}

/**
 * Resolves one deterministic seek horizon from event timeline and action durations.
 */
function temp__resolveSceneSeekMaxMs(scene: SceneDoc): number {
	const actionDurationByEventName = new Map<string, number>();
	for (const story of Object.values(scene.stories)) {
		for (const perso of story.persos) {
			for (const [eventName, action] of Object.entries(perso.actions)) {
				const currentDurationMs = actionDurationByEventName.get(eventName) ?? 0;
				const nextDurationMs = temp__resolveActionDurationMs(action);
				actionDurationByEventName.set(eventName, Math.max(currentDurationMs, nextDurationMs));
			}
		}
	}

	const tracks = scene.tracks;
	if (typeof tracks !== 'object' || tracks === null) {
		return 1;
	}

	let maxTimelineMs = 0;
	for (const rawTrack of Object.values(tracks)) {
		if (typeof rawTrack !== 'object' || rawTrack === null) {
			continue;
		}

		const track = rawTrack as { events?: unknown };
		const events = Array.isArray(track.events) ? track.events : [];
		for (const rawEvent of events) {
			if (typeof rawEvent !== 'object' || rawEvent === null) {
				continue;
			}

			const event = rawEvent as { ms?: unknown; name?: unknown };
			const eventMsRaw = typeof event.ms === 'number' && Number.isFinite(event.ms) ? event.ms : 0;
			const eventMs = Math.max(0, eventMsRaw);
			const eventName = typeof event.name === 'string' ? event.name : '';
			const actionDurationMs = actionDurationByEventName.get(eventName) ?? 0;
			maxTimelineMs = Math.max(maxTimelineMs, eventMs + actionDurationMs);
		}
	}

	return Math.max(1, Math.round(maxTimelineMs));
}

/**
 * Formats one timeline value for the seek UI.
 */
function temp__formatTimelineMs(value: number): string {
	return `${Math.max(0, Math.round(value))}ms`;
}

/**
 * Mounts top-level demo list components into the container.
 */
function temp__mountDemoRootLists(containerNode: HTMLDivElement, player: PlayerFacade): void {
	const registry = player.getRuntimeRegistry();
	const rootListIds = ['demo-stage-list', 'demo-list', 'demo-trash-list'];
	const rootNodes: Node[] = [];

	for (const rootListId of rootListIds) {
		const nodeRef = registry.getNodeById(rootListId);
		if (!temp__isDomNode(nodeRef)) {
			continue;
		}

		rootNodes.push(nodeRef);
	}

	containerNode.replaceChildren(...rootNodes);
}

/**
 * Reads one payload value as string when available.
 */
function readString(payload: TracePayload, key: string): string | undefined {
	const value = payload[key];
	return typeof value === 'string' ? value : undefined;
}

/**
 * Reads one payload value as number when available.
 */
function readNumber(payload: TracePayload, key: string): number | undefined {
	const value = payload[key];
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Builds one compact payload summary for fallback trace messages.
 */
function formatCompactPayload(payload: TracePayload): string {
	const entries = Object.entries(payload);
	if (entries.length === 0) {
		return '';
	}

	const summary = entries
		.slice(0, 4)
		.map(([key, value]) => `${key}=${String(value)}`)
		.join(' ');
	const suffix = entries.length > 4 ? ' ...' : '';
	return ` ${summary}${suffix}`;
}

/**
 * Builds one human-readable trace message according to event type.
 */
function formatTraceMessage(row: RuntimeTraceRow): string {
	const payload = (row.payload ?? {}) as TracePayload;

		if (row.status === RUNTIME_TRACE_STATUS.rejected || row.status === RUNTIME_TRACE_STATUS.error) {
		const code = readString(payload, 'code');
		const message = readString(payload, 'message');
		return `${row.eventName}${code ? ` code=${code}` : ''}${message ? ` message=${message}` : ''}`;
	}

	switch (row.eventName) {
		case 'player:init:started': {
			const sceneId = readString(payload, 'sceneId');
			return `init start scene=${sceneId ?? '?'}`;
		}

		case 'player:init:done': {
			const mountedStoryCount = readNumber(payload, 'mountedStoryCount');
			const runtimeElementCount = readNumber(payload, 'runtimeElementCount');
			const runtimeRevision = readNumber(payload, 'runtimeRevision');
			return `init done mounted=${mountedStoryCount ?? '?'} nodes=${runtimeElementCount ?? '?'} rev=${runtimeRevision ?? '?'}`;
		}

		case 'player:play': {
			const startTimelineMs = readNumber(payload, 'startTimelineMs');
			return `play start timeline=${startTimelineMs ?? '?'}ms`;
		}

		case 'player:schedule:events': {
			const fromTimelineMs = readNumber(payload, 'fromTimelineMs');
			const scheduledEventCount = readNumber(payload, 'scheduledEventCount');
			const skippedPastEventCount = readNumber(payload, 'skippedPastEventCount');
			return `schedule from=${fromTimelineMs ?? '?'}ms scheduled=${scheduledEventCount ?? '?'} skipped=${skippedPastEventCount ?? '?'}`;
		}

		case 'player:event:triggered': {
			const eventName = readString(payload, 'eventName');
			const eventId = readString(payload, 'eventId');
			const eventMs = readNumber(payload, 'eventMs');
			const runtimeTimelineMs = readNumber(payload, 'runtimeTimelineMs');
			return `trigger ${eventName ?? '?'} id=${eventId ?? '?'} eventMs=${eventMs ?? '?'} now=${runtimeTimelineMs ?? '?'}ms`;
		}

		case 'player:event:applied': {
			const eventName = readString(payload, 'eventName');
			const appliedCommitCount = readNumber(payload, 'appliedCommitCount');
			const appliedActionsCount = readNumber(payload, 'appliedActionsCount');
			const animationAppliedCount = readNumber(payload, 'animationAppliedCount');
			const conflictCount = readNumber(payload, 'conflictCount');
			return `apply ${eventName ?? '?'} commits=${appliedCommitCount ?? '?'} actions=${appliedActionsCount ?? '?'} anim=${animationAppliedCount ?? '?'} conflicts=${conflictCount ?? '?'}`;
		}

		default:
			return `${row.eventName}${formatCompactPayload(payload)}`;
	}
}

/**
 * Formats one trace row into one compact readable line.
 */
function formatTraceRow(row: RuntimeTraceRow, firstTraceMs: number): string {
	const deltaMs = Math.max(0, Math.round(row.traceMs - firstTraceMs));
	const status = row.status.toUpperCase().padEnd(8, ' ');
	const message = formatTraceMessage(row);
	return `+${String(deltaMs).padStart(4, ' ')}ms ${status} ${message}`;
}

/**
 * Mounts the runtime player proof-of-concept demo in the root app node.
 */
export async function runPlayerPocDemo(): Promise<void> {
	const appNode = globalThis.document.querySelector<HTMLDivElement>('#app');
	if (appNode === null) {
		throw new Error('Expected #app root element');
	}

	const demoScene = temp__createDemoScene();
	const seekMaxMsFromScene = temp__resolveSceneSeekMaxMs(demoScene);

	appNode.innerHTML = `
    <main class="demo-shell">
    <aside>
      <p class="eyebrow">Runtime V1</p>
      <h1>Player POC</h1>
	      <p class="subtitle">Cas dur: inserts, puis retour de tous les items vers l'origine; la list cible derive et tourne.</p>
      <div class="demo-controls">
        <button id="demo-play-button" class="demo-button" type="button">Play</button>
        <button id="demo-rewind-button" class="demo-button demo-button-secondary" type="button">Rewind</button>
        <label class="demo-progress-control" for="demo-seek-range">
          <span>Seek</span>
          <input id="demo-seek-range" class="demo-progress-range" type="range" min="0" max="${seekMaxMsFromScene}" step="10" value="0" />
          <span id="demo-seek-label" class="demo-progress-label">0ms / ${temp__formatTimelineMs(seekMaxMsFromScene)}</span>
        </label>
      </div>
      <div id="player-state" class="player-state"></div>
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

	const animationAdapter = createAnimationAdapter(temp__createAnimeImplementation(), {
		renderFrame: () => {
			temp__renderAnimeFrameFromPlayerTicker();
		},
	});
	const player = new PlayerFacade({
		animationAdapter,
	});

	const playerState = globalThis.document.querySelector<HTMLDivElement>('#player-state');
	if (playerState === null) {
		throw new Error('Expected #player-state element');
	}
	const playerStateNode = playerState;

	const playerTrace = globalThis.document.querySelector<HTMLDivElement>('#player-trace');
	if (playerTrace === null) {
		throw new Error('Expected #player-trace element');
	}
	const playerTraceNode = playerTrace;

	const playButton = globalThis.document.querySelector<HTMLButtonElement>('#demo-play-button');
	if (playButton === null) {
		throw new Error('Expected #demo-play-button element');
	}
	const playButtonNode = playButton;

	const rewindButton = globalThis.document.querySelector<HTMLButtonElement>('#demo-rewind-button');
	if (rewindButton === null) {
		throw new Error('Expected #demo-rewind-button element');
	}
	const rewindButtonNode = rewindButton;

	const seekRange = globalThis.document.querySelector<HTMLInputElement>('#demo-seek-range');
	if (seekRange === null) {
		throw new Error('Expected #demo-seek-range element');
	}
	const seekRangeNode = seekRange;

	const seekLabel = globalThis.document.querySelector<HTMLSpanElement>('#demo-seek-label');
	if (seekLabel === null) {
		throw new Error('Expected #demo-seek-label element');
	}
	const seekLabelNode = seekLabel;

	const playerAsSeekable = player as SeekablePlayer;
	const seekCommand = typeof playerAsSeekable.seek === 'function' ? playerAsSeekable.seek.bind(player) : null;

	const traceLines: string[] = [];
	let firstTraceMs: number | null = null;
	let mountedRuntimeRevision = -1;
	let commandInFlight = false;
	let progressLoopFrameId: number | null = null;
	const seekThrottleMs = 90;
	let pendingSeekTargetMs: number | null = null;
	let seekThrottleTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
	let lastSeekDispatchMs = 0;
	let seekInteractionActive = false;

	function syncSeekLabel(timelineMs: number, maxTimelineMs: number): void {
		seekLabelNode.textContent = `${temp__formatTimelineMs(timelineMs)} / ${temp__formatTimelineMs(maxTimelineMs)}`;
	}

	function renderPlayerState(state: PlayerStateSnapshot): void {
		playerStateNode.textContent = `status=${state.status} timelineMs=${Math.round(state.timelineMs)} revision=${state.runtimeRevision}`;
	}

	function syncControlState(state: PlayerStateSnapshot = player.getState()): void {
		const canPlay = state.status === 'ready' || state.status === 'paused';
		const canRewind =
			state.initialized && (state.status === 'ready' || state.status === 'paused' || state.status === 'playing');
		const canSeek =
			seekCommand !== null &&
			state.initialized &&
			(state.status === 'ready' ||
				state.status === 'paused' ||
				state.status === 'playing' ||
				state.status === 'seeking');

		const seekMaxMs = Math.max(seekMaxMsFromScene, Math.round(state.timelineMs));
		const clampedTimelineMs = Math.min(Math.max(0, Math.round(state.timelineMs)), seekMaxMs);
		const interactionTimelineMs = Math.min(readSeekTargetMsFromRange(), seekMaxMs);
		const pendingTimelineMs = pendingSeekTargetMs === null ? null : Math.min(pendingSeekTargetMs, seekMaxMs);
		const displayedTimelineMs = seekInteractionActive
			? interactionTimelineMs
			: (pendingTimelineMs ?? clampedTimelineMs);

		playButtonNode.disabled = commandInFlight || !canPlay;
		rewindButtonNode.disabled = commandInFlight || !canRewind;
		seekRangeNode.disabled = !canSeek;
		seekRangeNode.max = String(seekMaxMs);
		seekRangeNode.value = String(displayedTimelineMs);
		syncSeekLabel(displayedTimelineMs, seekMaxMs);
	}

	function syncProgressLoop(): void {
		if (typeof globalThis.requestAnimationFrame !== 'function') {
			return;
		}

		if (progressLoopFrameId !== null) {
			return;
		}

		progressLoopFrameId = globalThis.requestAnimationFrame(() => {
			progressLoopFrameId = null;
			const state = player.getState();
			renderPlayerState(state);
			syncControlState(state);

			if (state.status === 'playing') {
				syncProgressLoop();
			}
		});
	}

	async function runControlCommand(
		commandName: string,
		command: () => Promise<{ ok: boolean; error?: { code: string } }>,
	): Promise<void> {
		if (commandInFlight) {
			return;
		}

		commandInFlight = true;
		syncControlState();

		try {
			const result = await command();
			if (!result.ok) {
				throw new Error(`[demo] ${commandName} failed: ${result.error?.code ?? 'UNKNOWN_ERROR'}`);
			}
		} finally {
			commandInFlight = false;
			syncControlState();
		}
	}

	playButtonNode.addEventListener('click', () => {
		void runControlCommand('play', () => player.play());
	});

	async function runRewindFlow(): Promise<void> {
		const stateBefore = player.getState();
		if (stateBefore.status === 'playing') {
			await runControlCommand('pause', () => player.pause());
		}

		await runControlCommand('rewind', () => player.rewind());
	}

	rewindButtonNode.addEventListener('click', () => {
		void runRewindFlow();
	});

	async function runSeekFlow(targetTimelineMs: number): Promise<void> {
		const stateBefore = player.getState();
		if (stateBefore.status === 'playing') {
			await runControlCommand('pause', () => player.pause());
		}

		if (seekCommand === null) {
			return;
		}

		await runControlCommand('seek', () => seekCommand(targetTimelineMs));
	}

	function readSeekTargetMsFromRange(): number {
		const rawValue = Number(seekRangeNode.value);
		if (!Number.isFinite(rawValue)) {
			return 0;
		}

		return Math.max(0, Math.round(rawValue));
	}

	function resolveNowMs(): number {
		if (typeof globalThis.performance !== 'undefined') {
			return globalThis.performance.now();
		}

		return Date.now();
	}

	function runPendingSeekNow(): void {
		if (seekCommand === null || commandInFlight || pendingSeekTargetMs === null) {
			return;
		}

		const targetTimelineMs = pendingSeekTargetMs;
		pendingSeekTargetMs = null;
		lastSeekDispatchMs = resolveNowMs();

		void runSeekFlow(targetTimelineMs).finally(() => {
			if (pendingSeekTargetMs !== null) {
				scheduleThrottledSeekDispatch();
			}
		});
	}

	function scheduleThrottledSeekDispatch(): void {
		if (seekCommand === null || pendingSeekTargetMs === null) {
			return;
		}

		if (seekThrottleTimer !== null) {
			return;
		}

		const nowMs = resolveNowMs();
		const elapsedMs = nowMs - lastSeekDispatchMs;
		const waitMs = Math.max(0, seekThrottleMs - elapsedMs);

		seekThrottleTimer = globalThis.setTimeout(() => {
			seekThrottleTimer = null;
			runPendingSeekNow();
		}, waitMs);
	}

	seekRangeNode.addEventListener('input', () => {
		seekInteractionActive = true;
		const clampedSeekValueMs = readSeekTargetMsFromRange();
		pendingSeekTargetMs = clampedSeekValueMs;

		const seekMaxMs = Number(seekRangeNode.max);
		const clampedSeekMaxMs = Number.isFinite(seekMaxMs) ? seekMaxMs : seekMaxMsFromScene;
		syncSeekLabel(clampedSeekValueMs, clampedSeekMaxMs);

		scheduleThrottledSeekDispatch();
	});

	seekRangeNode.addEventListener('pointerdown', () => {
		seekInteractionActive = true;
	});

	seekRangeNode.addEventListener('pointerup', () => {
		seekInteractionActive = false;
		syncControlState();
	});

	seekRangeNode.addEventListener('pointercancel', () => {
		seekInteractionActive = false;
		syncControlState();
	});

	seekRangeNode.addEventListener('blur', () => {
		seekInteractionActive = false;
		syncControlState();
	});

	seekRangeNode.addEventListener('change', () => {
		seekInteractionActive = false;

		if (seekCommand === null || commandInFlight) {
			return;
		}

		pendingSeekTargetMs = readSeekTargetMsFromRange();
		if (seekThrottleTimer !== null) {
			globalThis.clearTimeout(seekThrottleTimer);
			seekThrottleTimer = null;
		}

		runPendingSeekNow();
	});

	player.onStateChange((state) => {
		if (state.runtimeRevision !== mountedRuntimeRevision) {
			temp__mountDemoRootLists(containerNode, player);
			mountedRuntimeRevision = state.runtimeRevision;
		}

		renderPlayerState(state);
		syncControlState(state);

		if (state.status === 'playing') {
			syncProgressLoop();
		}
	});

	player.onTrace((row) => {
		if (firstTraceMs === null) {
			firstTraceMs = row.traceMs;
		}

		traceLines.push(formatTraceRow(row, firstTraceMs));
		if (traceLines.length > 14) {
			traceLines.shift();
		}

		playerTraceNode.textContent = traceLines.join('\n');
	});

	const initResult = await player.init(demoScene);
	if (!initResult.ok) {
		throw new Error(`[demo] init failed: ${initResult.error.code}`);
	}

	temp__mountDemoRootLists(containerNode, player);
	const initialState = player.getState();
	mountedRuntimeRevision = initialState.runtimeRevision;
	renderPlayerState(initialState);
	syncControlState(initialState);
}
