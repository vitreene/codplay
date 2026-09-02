import type { SceneDoc } from 'codplay/scene/types';

/** Total duration declared by the terminal event of the media scene. */
export const SCENE_DURATION_MS = 8_000;

const AUDIO_START_EVENT = 'media:audio:start';
const VIDEO_START_EVENT = 'media:video:start';
const IMAGE_A_SHOW_EVENT = 'media:img-a:show';
const IMAGE_B_SHOW_EVENT = 'media:img-b:show';

type ScenePerso = SceneDoc['stories']['main']['persos'][number];

/** Creates the V2 transposition of the V1 preload-media scene. */
export function createScene(): SceneDoc {
	return {
		id: 'preload-media-scene',
		stories: {
			main: {
				id: 'main',
				initial: { move: '@root' },
				persos: [
					createMediaLayout(),
					createAudioPerso(),
					createVideoPerso(),
					createImagePerso('a', '/assets/35c8ec5a07fc.jpg', 'media-container:cell-img-a'),
					createImagePerso('b', '/assets/28970388742_2f75d527d6_z.jpg', 'media-container:cell-img-b'),
				],
				eventimes: [
					{ name: AUDIO_START_EVENT, startAt: 0 },
					{ name: VIDEO_START_EVENT, startAt: 2_000 },
					{ name: IMAGE_A_SHOW_EVENT, startAt: 4_000 },
					{ name: IMAGE_B_SHOW_EVENT, startAt: 5_000 },
				],
			},
		},
		eventimes: [{ name: 'sequence:end', startAt: SCENE_DURATION_MS }],
	};
}

/** Creates the four-cell layout used by the media and image persos. */
function createMediaLayout(): ScenePerso {
	return {
		id: 'media-container',
		type: 'layout',
		initial: {
			move: '@root',
			markup: `
        <div class="preload-media-container">
          <div class="preload-media-grid">
            <div data-part="media-container:cell-audio" class="preload-media-cell preload-media-cell--audio"></div>
            <div data-part="media-container:cell-video" class="preload-media-cell"></div>
            <div data-part="media-container:cell-img-a" class="preload-media-cell"></div>
            <div data-part="media-container:cell-img-b" class="preload-media-cell"></div>
          </div>
        </div>
      `,
		},
		actions: {},
	};
}

/** Creates the hidden audio source that starts at the beginning of the scene. */
function createAudioPerso(): ScenePerso {
	return {
		id: 'media-audio',
		type: 'media',
		initial: {
			tag: 'video',
			src: '/assets/uBMXdJ0AyY.mp3',
			master: false,
			className: 'preload-media-audio',
			video: { style: { display: 'none' } },
			move: { target: 'media-container:cell-audio' },
		},
		actions: {
			[AUDIO_START_EVENT]: { broadcast: { type: 'START' } },
		},
	};
}

/** Creates the visible video source that starts after two seconds. */
function createVideoPerso(): ScenePerso {
	return {
		id: 'media-video',
		type: 'media',
		initial: {
			tag: 'video',
			src: '/assets/LcXkmXyuZQ.mp4',
			master: false,
			className: 'preload-media-video',
			video: {
				style: { objectFit: 'cover', display: 'block' },
				attr: { controls: true },
			},
			move: { target: 'media-container:cell-video' },
		},
		actions: {
			[VIDEO_START_EVENT]: {
				broadcast: { type: 'START' },
			},
		},
	};
}

/** Creates one initially hidden image revealed by its authored timeline event. */
function createImagePerso(imageId: 'a' | 'b', src: string, target: string): ScenePerso {
	const showEvent = imageId === 'a' ? IMAGE_A_SHOW_EVENT : IMAGE_B_SHOW_EVENT;
	return {
		id: `media-img-${imageId}`,
		type: 'img',
		initial: {
			src,
			className: 'preload-media-item',
			img: { style: { objectFit: 'cover' } },
			move: { target },
			style: { opacity: 0 },
		},
		actions: {
			[showEvent]: { style: { opacity: 1 } },
		},
	};
}
