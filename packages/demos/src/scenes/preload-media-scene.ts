import type { SceneDoc } from 'codplay/player/types'

/**
 * Validates the preload module: audio at 0s, video at 2s, two images at 4s and 5s.
 * All static styles live in /preload-media-demo.css, loaded via preload before the scene starts.
 */
export function createPreloadMediaScene(): SceneDoc {
  return {
    id: 'preload-media-scene',
    rootStories: ['preload-media-story'],
    stories: {
      'preload-media-story': {
        id: 'preload-media-story',
        entries: ['media-shell'],
        persos: [
          {
            id: 'media-shell',
            type: 'layout',
            initial: {
              markup: `
                <div class="preload-media-shell">
                  <div class="preload-media-grid">
                    <div data-part="media-shell:cell-audio" class="preload-media-cell preload-media-cell--audio"></div>
                    <div data-part="media-shell:cell-video" class="preload-media-cell"></div>
                    <div data-part="media-shell:cell-img-a" class="preload-media-cell"></div>
                    <div data-part="media-shell:cell-img-b" class="preload-media-cell"></div>
                  </div>
                </div>
              `,
            },
            actions: {},
          },
          {
            id: 'media-audio',
            type: 'media',
            initial: {
              tag: 'video',
              src: '/assets/uBMXdJ0AyY.mp3',
              master: false,
              className: 'preload-media-audio',
              video: { style: { display: 'none' } },
              move: { parentId: 'media-shell:cell-audio' },
            },
            actions: {
              'media:audio:start': {
                broadcast: { type: 'START' },
              },
            },
          },
          {
            id: 'media-video',
            type: 'media',
            initial: {
              tag: 'video',
              src: '/assets/LcXkmXyuZQ.mp4',
              master: false,
              className: 'preload-media-video',
              video: { style: { objectFit: 'cover', display: 'block' } },
              move: { parentId: 'media-shell:cell-video' },
            },
            actions: {
              'media:video:start': {
                broadcast: { type: 'START' },
              },
            },
          },
          {
            id: 'media-img-a',
            type: 'img',
            initial: {
              src: '/assets/35c8ec5a07fc.jpg',
              className: 'preload-media-item',
              img: { style: { objectFit: 'cover' } },
              move: { parentId: 'media-shell:cell-img-a' },
              style: { opacity: 0 },
            },
            actions: {
              'media:img-a:show': {
                style: { opacity: 1 },
              },
            },
          },
          {
            id: 'media-img-b',
            type: 'img',
            initial: {
              src: '/assets/28970388742_2f75d527d6_z.jpg',
              className: 'preload-media-item',
              img: { style: { objectFit: 'cover' } },
              move: { parentId: 'media-shell:cell-img-b' },
              style: { opacity: 0 },
            },
            actions: {
              'media:img-b:show': {
                style: { opacity: 1 },
              },
            },
          },
        ],
        eventimes: [
          { name: 'media:audio:start', startAt: 0 },
          { name: 'media:video:start', startAt: 2000 },
          { name: 'media:img-a:show', startAt: 4000 },
          { name: 'media:img-b:show', startAt: 5000 },
          { name: 'sequence:end', startAt: 30000 },
        ],
      },
    },
  } as unknown as SceneDoc
}
