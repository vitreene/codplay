import './player-poc-demo.css';

import { animate, engine } from 'animejs';

import { createAnimationAdapter, type AnimeImplementation } from '../animation/adapter';
import { PlayerFacade } from '../player/create-player';
import type { PlayerStateSnapshot, PlayerPublicEventInput, SceneDoc } from '../player/types';
import { RUNTIME_TRACE_STATUS } from '../runtime/trace-constants';
import type { RuntimeTraceRow } from '../runtime/trace-store';

type TracePayload = Record<string, unknown>;

type SeekablePlayer = {
	seek?: (targetTimelineMs: number) => Promise<{ ok: boolean; error?: { code: string } }>;
};

type StoryEventimeLike = {
	name: string;
	startAt: number;
	events?: StoryEventimeLike[];
};

export type PlayerSceneDemoLink = {
	label: string;
	href: string;
	active?: boolean;
};

export type PlayerSceneDemoAction = {
	id: string;
	label: string;
	event: PlayerPublicEventInput;
	className?: string;
};

export type PlayerSceneDemoConfig = {
	title: string;
	subtitle: string;
	scene: SceneDoc;
	rootNodeIds: string[];
	demoLinks?: PlayerSceneDemoLink[];
	actions?: PlayerSceneDemoAction[];
};

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
 * Reads one style transition object duration and delay in milliseconds.
 */
function readTransitionDurationMs(value: unknown): number {
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
function resolveActionDurationMs(action: unknown): number {
	if (typeof action !== 'object' || action === null) {
		return 0;
	}

	const style = (action as { style?: unknown }).style;
	if (typeof style !== 'object' || style === null) {
		return 0;
	}

	let maxDurationMs = 0;
	for (const styleValue of Object.values(style as Record<string, unknown>)) {
		maxDurationMs = Math.max(maxDurationMs, readTransitionDurationMs(styleValue));
	}

	return maxDurationMs;
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
		return;
	}

	for (const eventime of eventimes) {
		const eventMs = Math.max(0, parentStartAt + eventime.startAt);
		visitor(eventime.name, eventMs);
		visitEventimes(eventime.events, eventMs, visitor);
	}
}

/**
 * Resolves one deterministic seek horizon from explicit tracks and story eventimes.
 */
function resolveSceneSeekMaxMs(scene: SceneDoc): number {
	const actionDurationByEventName = new Map<string, number>();
	for (const story of Object.values(scene.stories)) {
		for (const perso of story.persos) {
			for (const [eventName, action] of Object.entries(perso.actions)) {
				const currentDurationMs = actionDurationByEventName.get(eventName) ?? 0;
				const nextDurationMs = resolveActionDurationMs(action);
				actionDurationByEventName.set(eventName, Math.max(currentDurationMs, nextDurationMs));
			}
		}
	}

	let maxTimelineMs = 0;
	for (const story of Object.values(scene.stories)) {
		visitEventimes(story.eventimes, 0, (eventName, eventMs) => {
			const actionDurationMs = actionDurationByEventName.get(eventName) ?? 0;
			maxTimelineMs = Math.max(maxTimelineMs, eventMs + actionDurationMs);
		});
	}

	const tracks = scene.tracks;
	if (typeof tracks === 'object' && tracks !== null) {
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
	}

	return Math.max(1, Math.round(maxTimelineMs));
}

/**
 * Formats one timeline value for the seek UI.
 */
function formatTimelineMs(value: number): string {
	return `${Math.max(0, Math.round(value))}ms`;
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
 * Renders one shared player demo shell for one scene-based scenario.
 */
export async function runPlayerSceneDemo(config: PlayerSceneDemoConfig): Promise<void> {
	const appNode = globalThis.document.querySelector<HTMLDivElement>('#app');
	if (appNode === null) {
		throw new Error('Expected #app root element');
	}

	const seekMaxMsFromScene = resolveSceneSeekMaxMs(config.scene);
	const demoLinksMarkup = (config.demoLinks ?? [])
		.map(
			(link) =>
				`<a class="demo-link${link.active ? ' demo-link-active' : ''}" href="${link.href}">${link.label}</a>`,
		)
		.join('');
	const actionButtonsMarkup = (config.actions ?? [])
		.map(
			(action) =>
				`<button id="${action.id}" class="demo-button ${action.className ?? 'demo-button-secondary'}" type="button">${action.label}</button>`,
		)
		.join('');

	appNode.innerHTML = `
    <main class="demo-shell">
      <aside>
        <p class="eyebrow">Runtime V1</p>
        ${demoLinksMarkup.length > 0 ? `<nav class="demo-links">${demoLinksMarkup}</nav>` : ''}
        <h1>${config.title}</h1>
        <p class="subtitle">${config.subtitle}</p>
        <div class="demo-controls">
          <button id="demo-play-button" class="demo-button" type="button">Play</button>
          <button id="demo-rewind-button" class="demo-button demo-button-secondary" type="button">Rewind</button>
          <label class="demo-progress-control" for="demo-seek-range">
            <span>Seek</span>
            <input id="demo-seek-range" class="demo-progress-range" type="range" min="0" max="${seekMaxMsFromScene}" step="10" value="0" />
            <span id="demo-seek-label" class="demo-progress-label">0ms / ${formatTimelineMs(seekMaxMsFromScene)}</span>
          </label>
        </div>
        ${actionButtonsMarkup.length > 0 ? `<div class="demo-controls demo-actions">${actionButtonsMarkup}</div>` : ''}
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

	const animationAdapter = createAnimationAdapter(createAnimeImplementation(), {
		renderFrame: () => {
			renderAnimeFrameFromPlayerTicker();
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

	const actionButtonNodes = new Map<string, HTMLButtonElement>();
	for (const action of config.actions ?? []) {
		const actionButtonNode = globalThis.document.querySelector<HTMLButtonElement>(`#${action.id}`);
		if (actionButtonNode === null) {
			throw new Error(`Expected #${action.id} element`);
		}

		actionButtonNodes.set(action.id, actionButtonNode);
	}

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
		seekLabelNode.textContent = `${formatTimelineMs(timelineMs)} / ${formatTimelineMs(maxTimelineMs)}`;
	}

	function renderPlayerState(state: PlayerStateSnapshot): void {
		playerStateNode.textContent = `status=${state.status} timelineMs=${Math.round(state.timelineMs)} revision=${state.runtimeRevision}`;
	}

	function syncActionButtons(state: PlayerStateSnapshot): void {
		for (const action of config.actions ?? []) {
			actionButtonNodes.get(action.id)!.disabled = commandInFlight || !state.initialized;
		}
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
		const displayedTimelineMs = seekInteractionActive ? interactionTimelineMs : (pendingTimelineMs ?? clampedTimelineMs);

		playButtonNode.disabled = commandInFlight || !canPlay;
		rewindButtonNode.disabled = commandInFlight || !canRewind;
		seekRangeNode.disabled = !canSeek;
		seekRangeNode.max = String(seekMaxMs);
		seekRangeNode.value = String(displayedTimelineMs);
		syncSeekLabel(displayedTimelineMs, seekMaxMs);
		syncActionButtons(state);
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

	for (const action of config.actions ?? []) {
		actionButtonNodes.get(action.id)!.addEventListener('click', () => {
			void runControlCommand(`emit:${action.event.name}`, () => player.emit(action.event));
		});
	}

	player.onStateChange((state) => {
		if (state.runtimeRevision !== mountedRuntimeRevision) {
			mountDemoRootNodes(containerNode, player, config.rootNodeIds);
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

	const initResult = await player.init(config.scene);
	if (!initResult.ok) {
		throw new Error(`[demo] init failed: ${initResult.error.code}`);
	}

	mountDemoRootNodes(containerNode, player, config.rootNodeIds);
	const initialState = player.getState();
	mountedRuntimeRevision = initialState.runtimeRevision;
	renderPlayerState(initialState);
	syncControlState(initialState);
}
