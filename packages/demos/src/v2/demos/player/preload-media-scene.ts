import type { SceneDoc } from '../../../../../codplay-v2/src/scene/types'
import audioUrl from '../../../../../public/assets/uBMXdJ0AyY.mp3?url'
import videoUrl from '../../../../../public/assets/LcXkmXyuZQ.mp4?url'
import imageAUrl from '../../../../../public/assets/35c8ec5a07fc.jpg?url'
import imageBUrl from '../../../../../public/assets/28970388742_2f75d527d6_z.jpg?url'

/** Static image URLs added to the external preload manifest for the tag persos. */
export const PRELOAD_MEDIA_IMAGE_URLS = [imageAUrl, imageBUrl] as const

/** Fixed video window used by this validation asset. */
export const PRELOAD_MEDIA_VIDEO_START_MS = 1000
export const PRELOAD_MEDIA_VIDEO_DURATION_MS = 5890
export const PRELOAD_MEDIA_SCENE_END_MS = PRELOAD_MEDIA_VIDEO_START_MS + PRELOAD_MEDIA_VIDEO_DURATION_MS

/** Builds the V2 adaptation of the preload-media validation scene. */
export function createPreloadMediaScene(): SceneDoc {
  return {
    id: 'v2-preload-media-scene',
    stories: {
      main: {
        id: 'main',
        persos: [
          {
            id: 'media-shell',
            type: 'layout',
            initial: {
              move: '@root',
              markup: `
                <section class="preload-media-shell">
                  <div data-part="outlet" class="preload-media-grid" aria-label="médias préchargés"></div>
                </section>
              `,
            },
            actions: {},
          },
          {
            id: 'media-audio',
            type: 'media',
            initial: {
              tag: 'audio',
              src: audioUrl,
              master: true,
              className: 'preload-media-audio',
              style: { display: 'none' },
              move: { target: 'outlet' },
            },
            actions: {
              'media:audio:start': { broadcast: { type: 'START' } },
            },
          },
          {
            id: 'media-video',
            type: 'media',
            initial: {
              tag: 'video',
              src: videoUrl,
              controls: true,
              master: false,
              className: 'preload-media-video',
              style: { opacity: 0 },
              move: { target: 'outlet' },
            },
            actions: {
              'media:video:start': {
                style: { opacity: 1 },
                broadcast: { type: 'START', endAt: PRELOAD_MEDIA_VIDEO_DURATION_MS },
              },
            },
          },
          {
            id: 'media-img-a',
            type: 'tag',
            initial: {
              tag: 'img',
              attr: { src: imageAUrl, alt: 'Image préchargée A' },
              className: 'preload-media-item',
              style: { opacity: 0 },
              move: { target: 'outlet' },
            },
            actions: {
              'media:img-a:show': { style: { opacity: 1 } },
            },
          },
          {
            id: 'media-img-b',
            type: 'tag',
            initial: {
              tag: 'img',
              attr: { src: imageBUrl, alt: 'Image préchargée B' },
              className: 'preload-media-item',
              style: { opacity: 0 },
              move: { target: 'outlet' },
            },
            actions: {
              'media:img-b:show': { style: { opacity: 1 } },
            },
          },
        ],
        eventimes: [
          { name: 'media:audio:start', startAt: 0 },
          { name: 'media:video:start', startAt: PRELOAD_MEDIA_VIDEO_START_MS },
          { name: 'media:img-a:show', startAt: 1500 },
          { name: 'media:img-b:show', startAt: 2000 },
          { name: 'sequence:end', startAt: PRELOAD_MEDIA_SCENE_END_MS },
        ],
      },
    },
  }
}
