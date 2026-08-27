import type { SceneDoc } from '../../../../../codplay-v2/src/scene/types'

const MOVE_START_MS = 800
const MOVE_DURATION_MS = 1400

/** Returns one declarative scene with a list reorder and measured layout ancestors. */
export function createListScene(): SceneDoc {
  return {
    id: 'html-runner-list-flip',
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'source-layout',
          type: 'layout',
          initial: {
            move: '@root',
            markup: '<section class="flip-box flip-box--source"><span class="flip-box__tag">PARENT A</span><h2>FIRST / SOURCE</h2><div class="flip-box__outlet flip-box__outlet--source" data-part="source-outlet"></div></section>',
          },
          actions: {},
        }, {
          id: 'target-layout',
          type: 'layout',
          initial: {
            move: '@root',
            markup: '<section class="flip-box flip-box--target"><span class="flip-box__tag">PARENT B</span><h2>LAST / TARGET</h2><div class="flip-box__outlet" data-part="target-outlet"></div></section>',
          },
          actions: {},
        }, {
          id: 'target-list',
          type: 'list',
          initial: {
            tag: 'section',
            move: { target: 'target-outlet' },
            className: 'flip-list',
          },
          actions: {},
        }, {
          id: 'item-b',
          type: 'tag',
          initial: {
            tag: 'article',
            move: { target: 'target-list' },
            className: 'flip-item flip-item--b',
            content: 'B / sibling',
          },
          actions: {},
        }, {
          id: 'item-c',
          type: 'tag',
          initial: {
            tag: 'article',
            move: { target: 'target-list' },
            className: 'flip-item flip-item--c',
            content: 'C / sibling',
          },
          actions: {},
        }, {
          id: 'item-a',
          type: 'tag',
          initial: {
            tag: 'article',
            move: { target: 'target-list' },
            className: 'flip-item flip-item--a',
            content: 'A / mover',
          },
          actions: {
            transfer: {
              move: {
                target: 'target-list',
                mode: 'first',
                transition: { duration: MOVE_DURATION_MS, ease: 'linear' },
              },
            },
          },
        }],
        listen: [],
        eventimes: [{ name: 'transfer', startAt: MOVE_START_MS }],
      },
    },
  }
}

/** Returns one declarative scene with a parent and child world overlay. */
export function createNestedOverlayScene(): SceneDoc {
  return {
    id: 'html-runner-nested-overlay-flip',
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'overlay-source-layout',
          type: 'layout',
          initial: {
            move: '@root',
            markup: '<section class="flip-box flip-box--source overlay-stage"><span class="flip-box__tag">OVERLAY SOURCE</span><h2>PARENT / FIRST</h2><div class="flip-box__outlet overlay-stage__outlet" data-part="source-outlet"></div></section>',
          },
          actions: {},
        }, {
          id: 'overlay-target-layout',
          type: 'layout',
          initial: {
            move: '@root',
            markup: '<section class="flip-box flip-box--target overlay-stage"><span class="flip-box__tag">LAYOUT CUT</span><h2>HOST / LAST</h2><div class="flip-box__outlet" data-part="target-outlet"></div></section>',
          },
          actions: {},
        }, {
          id: 'overlay-target-list',
          type: 'list',
          initial: {
            tag: 'section',
            move: { target: 'target-outlet' },
            className: 'flip-list flip-list--overlay',
          },
          actions: {},
        }, {
          id: 'overlay-parent',
          type: 'layout',
          initial: {
            move: { target: 'source-outlet' },
            markup: '<article class="nested-overlay-parent"><span class="nested-overlay-parent__label">P / reparent overlay</span><div class="nested-overlay-parent__outlet" data-part="parent-outlet-a"></div><div class="nested-overlay-parent__outlet nested-overlay-parent__outlet--last" data-part="parent-outlet-b"></div></article>',
          },
          actions: {
            transfer: {
              move: {
                target: 'overlay-target-list',
                mode: 'first',
                transition: { duration: MOVE_DURATION_MS, ease: 'linear' },
              },
            },
          },
        }, {
          id: 'overlay-child',
          type: 'tag',
          initial: {
            tag: 'div',
            move: { target: 'parent-outlet-a' },
            className: 'nested-overlay-child',
            content: 'Q / nested reparent',
          },
          actions: {
            transfer: {
              move: {
                target: 'parent-outlet-b',
                transition: { duration: MOVE_DURATION_MS, ease: 'linear' },
              },
            },
          },
        }, {
          id: 'overlay-b',
          type: 'tag',
          initial: {
            tag: 'article',
            move: { target: 'overlay-target-list' },
            className: 'flip-item flip-item--b',
            content: 'B / local sibling',
          },
          actions: {},
        }, {
          id: 'overlay-c',
          type: 'tag',
          initial: {
            tag: 'article',
            move: { target: 'overlay-target-list' },
            className: 'flip-item flip-item--c',
            content: 'C / local sibling',
          },
          actions: {},
        }],
        listen: [],
        eventimes: [{ name: 'transfer', startAt: MOVE_START_MS }],
      },
    },
  }
}
