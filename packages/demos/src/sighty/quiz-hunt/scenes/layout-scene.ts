import type { SceneDoc } from 'codplay/scene/types'

/** Composes the content, basket, and full-scene result overlay outlets. */
export const layoutScene: SceneDoc<string> = {
  id: 'quiz-hunt-layout',
  stories: {
    main: {
      id: 'main',
      initial: { move: '@root' },
      persos: [
        {
          id: 'quiz-hunt-layout-frame',
          type: 'layout',
          initial: {
            move: '@root',
            className: 'quiz-hunt-layout',
            markup: `<div id="quiz-hunt-layout-root" class="quiz-hunt-layout">
              <div id="quiz-hunt-layout-main-zone" class="quiz-hunt-main-zone" data-part="quiz-hunt:layout:content"></div>
              <div id="quiz-hunt-layout-basket-host" data-part="quiz-hunt:layout:basket"></div>
              <div id="quiz-hunt-layout-result-host" data-part="quiz-hunt:layout:result"></div>
            </div>`,
          },
          actions: {},
        },
        createLayoutSlot('slot-content', 'quiz-hunt:layout:content'),
        createLayoutSlot('slot-basket', 'quiz-hunt:layout:basket'),
        createLayoutSlot('slot-result', 'quiz-hunt:layout:result'),
      ],
    },
  },
}

/** Creates one named Sighty slot in the matching game layout outlet. */
function createLayoutSlot(name: string, target: string) {
  return {
    id: `quiz-hunt-${name}`,
    name,
    type: 'slot' as const,
    initial: { move: { target } },
    actions: {},
  }
}
