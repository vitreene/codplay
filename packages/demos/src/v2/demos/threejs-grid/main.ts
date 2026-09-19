import type { SceneDoc } from 'codplay';

const THREE_GRID_SCENE_ID = 'threejs-grid';
const THREE_GRID_TARGET = { scene: THREE_GRID_SCENE_ID };
const THREE_GRID_ANIMATION_DURATION_MS = 8_000;
const THREE_GRID_CAMERA_DURATION_MS = 7_000;

type ThreeTweenInput = Readonly<{
	progress: number;
}>;

/** Interpolates one color channel and returns the resulting CSS color. */
function interpolateColor(
	from: readonly [number, number, number],
	to: readonly [number, number, number],
	progress: number,
): string {
	return `#${from
		.map((channel, index) =>
			Math.round(channel + (to[index] - channel) * progress)
				.toString(16)
				.padStart(2, '0'),
		)
		.join('')}`;
}

/** Produces a camera dolly that recedes and then advances on its own period. */
function resolveCameraFrame({ progress }: ThreeTweenInput): Readonly<Record<string, unknown>> {
	const distance = Math.sin(progress * Math.PI) * 12.5;
	return {
		position: [0, 0, 6 + distance],
	};
}

/** Produces one ambient-light color for the logical Three.js tween. */
function resolveAmbientLightFrame({ progress }: ThreeTweenInput): Readonly<Record<string, unknown>> {
	return {
		color: interpolateColor([0, 0, 255], [255, 64, 128], progress),
	};
}

/** Produces one point-light position and color for the logical Three.js tween. */
function resolvePointLightFrame({ progress }: ThreeTweenInput): Readonly<Record<string, unknown>> {
	const angle = progress * Math.PI * 2;
	return {
		position: [Math.cos(angle) * 3, 3 + Math.sin(angle * 2), 6 + Math.sin(angle) * 2],
		color: interpolateColor([219, 234, 254], [255, 138, 76], progress),
	};
}

/** Creates the first V2 Three.js vertical with separate scene, camera, lights and grid persos. */
export function createScene(): SceneDoc<string> {
	return {
		id: THREE_GRID_SCENE_ID,
		stories: {
			main: {
				id: 'main',
				persos: [
					{
						id: 'scene',
						type: 'three-scene-host',
						initial: {
							move: '@root',
							width: 720,
							height: 540,
							background: '#0f172a',
						},
					},
					{
						id: 'camera',
						type: 'three-camera',
						initial: {
							move: '@root',
							rel: { target: THREE_GRID_TARGET },
							kind: 'perspective',
							position: [0, 0, 6],
							lookAt: [0, 0, 0],
							fov: 50,
							near: 0.1,
							far: 100,
						},
						actions: {
							'camera:move': {
								duration: THREE_GRID_CAMERA_DURATION_MS,
								ease: 'linear',
								fn: resolveCameraFrame,
							},
						},
					},
					{
						id: 'ambient-light',
						type: 'three-light',
						initial: {
							move: '@root',
							rel: { target: THREE_GRID_TARGET },
							kind: 'ambient',
							color: '#0000ff',
							intensity: 1,
						},
						actions: {
							'ambient:color': {
								duration: THREE_GRID_ANIMATION_DURATION_MS,
								ease: 'linear',
								fn: resolveAmbientLightFrame,
							},
						},
					},
					{
						id: 'point-light',
						type: 'three-light',
						initial: {
							move: '@root',
							rel: { target: THREE_GRID_TARGET },
							kind: 'point',
							color: '#dbeafe',
							intensity: 5.5,
							distance: 20,
							decay: 0.4,
							position: [3, 3, 6],
						},
						actions: {
							'point:move-and-color': {
								duration: THREE_GRID_ANIMATION_DURATION_MS,
								ease: 'linear',
								fn: resolvePointLightFrame,
							},
						},
					},
					{
						id: 'grid',
						type: 'three-instanced-grid',
						initial: {
							move: '@root',
							rel: { target: THREE_GRID_TARGET },
							gridSize: 4,
							cellSize: 0.5,
							expansion: 4,
							delayMaxMs: 500,
							durationMs: 2_000,
							holdMs: 500,
							rotationPeriodMs: 9_000,
							rotationXPeriodMs: 12_000,
							color: '#64748b',
							opacity: 0.35,
						},
						actions: {
							'grid:start': { animate: true },
						},
					},
				],
				eventimes: [
					{ name: 'grid:start', startAt: 0 },
					{ name: 'camera:move', startAt: 0 },
					{ name: 'ambient:color', startAt: 0 },
					{ name: 'point:move-and-color', startAt: 0 },
				],
			},
		},
	};
}
