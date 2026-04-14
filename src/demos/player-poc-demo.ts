import './player-poc-demo.css';

import { animate } from 'animejs';

import { createAnimationAdapter, type AnimeImplementation } from '../animation/adapter';
import { PlayerFacade } from '../player/create-player';
import type { SceneDoc } from '../player/types';
import type { RuntimeTraceRow } from '../runtime/trace-store';

type TracePayload = Record<string, unknown>;

/**
 * Builds an animejs wrapper compatible with runtime animation adapter.
 */
function createAnimeImplementation(): AnimeImplementation {
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
 * Creates one minimal scene used for first real Player processing tests.
 */
function createDemoScene(): SceneDoc {
	return {
		id: 'scene-demo',
		initialStoryId: 'story-demo',
		stories: {
			'story-demo': {
				id: 'story-demo',
				items: {
					'demo-box': {
						id: 'demo-box',
						type: 'text',
						initial: {
							id: 'demo-box',
							tag: 'div',
							className: 'demo-box',
							content: 'DEMO',
							style: {
								backgroundColor: '#c80f17',
								color: '#ffffff',
								width: '180px',
								height: '180px',
								display: 'grid',
								placeItems: 'center',
								fontWeight: 700,
								letterSpacing: '0.08em',
							},
						},
						actions: {
							'demo:rotate': {
								style: {
									rotate: {
										to: 180,
										duration: 2000,
									},
								},
							},
						},
					},
				},
			},
		},
		tracks: {
			'track-demo': {
				id: 'track-demo',
				source: 'story',
				order: 0,
				events: [
					{
						id: 'evt-demo-rotate',
						ms: 0,
						name: 'demo:rotate',
						index: 0,
						source: 'story',
					},
				],
			},
		},
	};
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

	if (row.status === 'rejected' || row.status === 'error') {
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
			const activeStoryId = readString(payload, 'activeStoryId');
			const runtimeElementCount = readNumber(payload, 'runtimeElementCount');
			const runtimeRevision = readNumber(payload, 'runtimeRevision');
			return `init done story=${activeStoryId ?? '?'} nodes=${runtimeElementCount ?? '?'} rev=${runtimeRevision ?? '?'}`;
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

	appNode.innerHTML = `
    <main class="demo-shell">
    <aside>
      <p class="eyebrow">Runtime V1</p>
      <h1>Player POC</h1>
      <p class="subtitle">Div rouge "DEMO" animee a 180 degres en 2 secondes.</p>
      <div class="demo-controls">
        <button id="demo-play-button" class="demo-button" type="button">Play</button>
        <button id="demo-rewind-button" class="demo-button demo-button-secondary" type="button">Rewind</button>
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

	const demoNode = globalThis.document.createElement('div');
	containerNode.append(demoNode);

	const animationAdapter = createAnimationAdapter(createAnimeImplementation());
	const player = new PlayerFacade({
		animationAdapter,
		createElementOptions: {
			nodeFactory: () => demoNode,
		},
	});

	const playerStateNode = globalThis.document.querySelector<HTMLDivElement>('#player-state');
	if (playerStateNode === null) {
		throw new Error('Expected #player-state element');
	}

	const playerTraceNode = globalThis.document.querySelector<HTMLDivElement>('#player-trace');
	if (playerTraceNode === null) {
		throw new Error('Expected #player-trace element');
	}

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

	const traceLines: string[] = [];
	let firstTraceMs: number | null = null;
	let commandInFlight = false;

	function syncControlState(): void {
		const state = player.getState();
		const canPlay = state.status === 'ready' || state.status === 'paused';
		const canRewind = state.initialized && (state.status === 'ready' || state.status === 'paused' || state.status === 'playing');

		playButtonNode.disabled = commandInFlight || !canPlay;
		rewindButtonNode.disabled = commandInFlight || !canRewind;
	}

	async function runControlCommand(
		commandName: string,
		command: () => Promise<{ ok: boolean; error?: { code: string } }>
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

	player.onStateChange((state) => {
		playerStateNode.textContent = `status=${state.status} timelineMs=${Math.round(state.timelineMs)} revision=${state.runtimeRevision}`;
		syncControlState();
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

	const initResult = await player.init(createDemoScene());
	if (!initResult.ok) {
		throw new Error(`[demo] init failed: ${initResult.error.code}`);
	}

	syncControlState();
}
