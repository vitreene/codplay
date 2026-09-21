import type { CompiledResourceManifest, SceneDoc } from 'codplay';
import {
	AVATAR_GESTURE_MOTION_NAMES,
	AVATAR_ENGINE,
	AVATAR_MOOD_MOTION_NAMES,
	THREE_PRELOAD_STRATEGIES,
} from '@codplay/component-v2';
import { MOUTH_CUES, phraseWordsFR, PRESTON_TO_TH } from '../rive/avatar-data/phrase-fr';

const AVATAR_SCENE_ID = 'avatar-v2';
const AVATAR_STAGE_ID = 'avatar-stage';
const AVATAR_HOST_ID = 'avatar-three-host';
const AVATAR_ID = 'avatar';
const SCENE_END_MS = 18_500;
// The walk clip advances Hips by 1.62 local z-units. With the avatar's
// three-quarter rotation, this is the host-space offset that brings its last
// frame back to the host origin.
const AVATAR_ENTRY_POSITION = [-0.354, 0, -1.581] as const;

const AVATAR_MOOD_ACTIONS = Object.fromEntries(AVATAR_MOOD_MOTION_NAMES.map((name) => [`avatar:mood:${name}`, {}]));

const AVATAR_GESTURE_ACTIONS = Object.fromEntries([
	...AVATAR_GESTURE_MOTION_NAMES.map((name) => [`avatar:gesture:${name}`, {}]),
	...['handup', 'index', 'point', 'ok', 'thumbup', 'thumbdown', 'side', 'shrug', 'namaste', 'release'].map((name) => [
		`avatar:gesture:${name}`,
		{},
	]),
]);

export const AVATAR_SRC = '/avatars/avatarsdk.glb';
export const AVATAR_WALK_SRC = '/avatars/hero-walk.fbx';

/** Builds the Avatar V2 scene from data-only author declarations. */
export function createScene(): SceneDoc<string> {
	return {
		id: AVATAR_SCENE_ID,
		stories: {
			main: {
				id: 'main',
				persos: [
					{
						id: AVATAR_STAGE_ID,
						type: 'tag',
						initial: {
							tag: 'div',
							move: '@root',
							attr: { id: AVATAR_STAGE_ID },
							style: {
								position: 'relative',
								width: 'min(720px, 100%)',
								height: '100%',
								minHeight: '0',
								overflow: 'hidden',
								background: '#111827',
								borderRadius: '14px',
							},
						},
						actions: {},
					},
					{
						id: AVATAR_HOST_ID,
						type: 'three-scene-host',
						initial: {
							move: { target: AVATAR_STAGE_ID },
							width: 720,
							height: 720,
							background: '#111827',
							renderer: { alpha: true, antialias: true, preserveDrawingBuffer: true },
						},
						actions: {},
					},
					{
						id: 'camera',
						type: 'three-camera',
						initial: {
							rel: { host: AVATAR_HOST_ID },
							kind: 'perspective',
							position: [0, 1.45, 4.15],
							lookAt: [0, 1.35, 0],
							fov: 16,
							near: 0.1,
							far: 100,
						},
						actions: {},
					},
					{
						id: 'ambient-light',
						type: 'three-light',
						initial: {
							rel: { host: AVATAR_HOST_ID },
							kind: 'ambient',
							color: '#ffffff',
							intensity: 1.8,
						},
						actions: {},
					},
					{
						id: 'key-light',
						type: 'three-light',
						initial: {
							rel: { host: AVATAR_HOST_ID },
							kind: 'directional',
							color: '#dbeafe',
							intensity: 2.2,
							position: [1.5, 3, 3],
						},
						actions: {},
					},
					{
						id: AVATAR_ID,
						type: 'avatar',
						initial: {
							rel: { host: AVATAR_HOST_ID },
							src: AVATAR_SRC,
							morphPrefix: 'Wolf3D_Head_',
							retarget: {
								Neck: { z: -0.01, rx: -0.15 },
								Neck1: { z: -0.01, rx: -0.15 },
								Neck2: { z: -0.01, rx: -0.15 },
								LeftShoulder: { rz: -0.3 },
								RightShoulder: { rz: 0.3 },
								scaleToEyesLevel: 1.0,
								origin: { y: -0.1 },
							},
							mood: 'neutral',
							modelRotationY: 0.22,
							position: AVATAR_ENTRY_POSITION,
							animations: {
								walk: {
									src: AVATAR_WALK_SRC,
									format: 'fbx',
									mode: 'animation',
								},
							},
						},
						actions: {},
					},
					{
						id: 'avatar-motion',
						type: 'avatar-motion',
						initial: {
							rel: { host: AVATAR_HOST_ID, target: AVATAR_ID },
							motion: 'walk',
							speed: 0.75,
							loop: false,
						},
						actions: {
							'avatar:motion:walk': {},
							'avatar:motion:release': {},
						},
					},
					{
						id: 'avatar-mood',
						type: 'avatar-mood',
						initial: {
							rel: { host: AVATAR_HOST_ID, target: AVATAR_ID },
							mood: 'neutral',
						},
						actions: AVATAR_MOOD_ACTIONS,
					},
					{
						id: 'avatar-idle',
						type: 'avatar-idle',
						initial: {
							rel: { host: AVATAR_HOST_ID, target: AVATAR_ID },
							pose: 'neutral',
							blink: true,
							breathe: false,
							headDrift: true,
						},
						actions: {},
					},
					{
						id: 'avatar-gaze',
						type: 'avatar-gaze',
						initial: {
							rel: { host: AVATAR_HOST_ID, target: AVATAR_ID },
							enabled: true,
							contact: 1,
							durationMs: 800,
						},
						actions: {
							'avatar:gaze:on': {},
							'avatar:gaze:off': {},
						},
					},
					{
						id: 'avatar:viseme',
						type: 'avatar-lip-sync',
						initial: {
							rel: { host: AVATAR_HOST_ID, target: AVATAR_ID },
							viseme: null,
							weight: 1,
						},
						actions: {},
					},
					{
						id: 'avatar-gesture',
						type: 'avatar-gesture',
						initial: {
							rel: { host: AVATAR_HOST_ID, target: AVATAR_ID },
							gesture: null,
						},
						actions: AVATAR_GESTURE_ACTIONS,
					},
					{
						id: 'audio',
						type: 'media',
						initial: {
							tag: 'audio',
							src: '/assets/1_7b_e.mp3',
							master: true,
							move: { target: AVATAR_STAGE_ID },
							video: { style: { display: 'none' } },
						},
						actions: { 'audio:start': { broadcast: { type: 'START' } } },
					},
					{
						id: 'caption',
						type: 'tag',
						initial: {
							tag: 'p',
							content: '',
							move: '@root',
							attr: { id: 'avatar-caption' },
							style: {
								position: 'absolute',
								bottom: '12px',
								left: '50%',
								transform: 'translateX(-50%)',
								zIndex: '2',
								margin: '0',
								padding: '4px 10px',
								color: '#fff',
								fontSize: '15px',
								background: 'rgba(0,0,0,0.55)',
								borderRadius: '4px',
								minHeight: '1.6em',
								textAlign: 'center',
								pointerEvents: 'none',
							},
						},
						actions: { 'subtitle:word': {} },
					},
				],
				eventimes: [
					{ name: 'scene:start', startAt: 0 },
					{ name: 'audio:start', startAt: 0 },
					{ name: 'avatar:motion:walk', startAt: 0, data: { speed: 0.75, loop: false } },
					{ name: 'avatar:motion:release', startAt: 2_000 },
					{ name: 'avatar:gesture:nod_yes', startAt: 3_900, data: { durationMs: 1_200 } },
					{ name: 'avatar:gesture:release', startAt: 5_400 },
					{ name: 'avatar:gesture:wave_left', startAt: 5_700, data: { durationMs: 2_200 } },
					{ name: 'avatar:gesture:release', startAt: 8_300 },
					{ name: 'avatar:mood:happy', startAt: 4_600 },
					{ name: 'avatar:mood:neutral', startAt: 8_800 },
					{ name: 'avatar:gesture:wave_right', startAt: 8_700, data: { durationMs: 2_200 } },
					{ name: 'avatar:gesture:release', startAt: 11_300 },
					{ name: 'avatar:gesture:thumbup_right', startAt: 11_700, data: { durationMs: 1_900 } },
					{ name: 'avatar:gesture:release', startAt: 14_000 },
					{ name: 'avatar:gesture:celebrate', startAt: 14_400, data: { durationMs: 2_200 } },
					{ name: 'avatar:gesture:release', startAt: 17_000 },
					{ name: 'avatar:gesture:bow', startAt: 17_300, data: { durationMs: 1_000 } },
					{ name: 'avatar:gesture:release', startAt: 18_400 },
					{ name: 'avatar:gaze:off', startAt: 5_400, data: { durationMs: 800 } },
					{ name: 'avatar:gaze:on', startAt: 9_600, data: { contact: 1, durationMs: 800 } },
					...buildVisemeEventimes(),
					...buildWordEventimes(),
					{ name: 'sequence:end', startAt: SCENE_END_MS },
				],
			},
		},
	};
}

/** Converts the prepared speech alignment into Avatar lip-sync actions. */
function buildVisemeEventimes() {
	return MOUTH_CUES.map((cue) => ({
		name: 'avatar:viseme',
		startAt: Math.round(cue.start * 1000),
		data: {
			viseme: PRESTON_TO_TH[cue.value] ?? null,
			durationMs: Math.round((cue.end - cue.start) * 1000),
		},
	}));
}

/** Converts the prepared word alignment into the demo caption stream. */
function buildWordEventimes() {
	return phraseWordsFR.map((word) => ({
		name: 'subtitle:word',
		startAt: word.startMs,
		data: { content: word.word },
	}));
}

/** Adds the Avatar component set to the shared Three engine. */
export const engineCapabilities = AVATAR_ENGINE;

/** Prepares the model through the Three.js preload boundary. */
export const preloadStrategies = THREE_PRELOAD_STRATEGIES;

/** Declares the GLB with the Three.js resource strategy. */
export const preloadManifest: CompiledResourceManifest = {
	entries: [
		{
			url: AVATAR_SRC,
			type: 'three-glb',
			policy: { cache: 'default', priority: 'high' },
		},
		{
			url: AVATAR_WALK_SRC,
			type: 'three-fbx',
			policy: { cache: 'default', priority: 'normal' },
		},
	],
};
