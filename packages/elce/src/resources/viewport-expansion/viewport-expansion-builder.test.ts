import type { StoryDoc } from 'codplay/scene/types'
import { describe, expect, it } from 'vitest'
import { ELCE_EDITOR_SETTINGS } from '../../config/editor-settings'
import { contentOpenEvent } from '../../builders/scene-functions/viewport-expansion'
import { addViewportExpansionToStory } from './viewport-expansion-builder'
import { createViewportExpansionStyleSheet } from './viewport-expansion-style'

describe('Viewport expansion builder', () => {
  it('keeps the configured media move to the viewport host', () => {
    const story: StoryDoc<string> = {
      id: 'story-image-expansion',
      persos: [{
        id: 'image-expansion',
        type: 'img',
        initial: { src: 'image.svg', move: { target: 'section-media' } },
      }],
    }

    const expandedStory = addViewportExpansionToStory(
      story,
      ELCE_EDITOR_SETTINGS.player.interactions.viewportExpansion,
    )
    const image = expandedStory.persos.find((perso) => perso.id === 'image-expansion')
    const host = expandedStory.persos.find((perso) => perso.id === `${story.id}-viewport-expansion-host`)
    const openAction = image?.actions?.[contentOpenEvent(story.id, 'image-expansion')]
    const openHostAction = host?.actions?.[`${story.id}:viewport-expansion:open-host`]
    const closeHostAction = host?.actions?.[`${story.id}:viewport-expansion:close-host`]
    const settings = ELCE_EDITOR_SETTINGS.player.interactions.viewportExpansion

    expect(host?.initial).toMatchObject({ style: { opacity: 1 } })
    expect(createViewportExpansionStyleSheet(settings)).toContain('z-index: 19;')
    expect(openAction).toMatchObject({
      move: {
        target: `${story.id}:viewport-expansion:media`,
        reparent: true,
        transition: { duration: 320, ease: 'outCubic' },
      },
    })
    expect(openHostAction).toMatchObject({ style: { opacity: 1 } })
    expect(closeHostAction).toMatchObject({
      style: {
        opacity: {
          from: 1,
          to: 0,
          duration: settings.backdropClose.durationMs,
          ease: settings.backdropClose.ease,
        },
      },
    })
    expect(settings.backdropClose.durationMs).toBeLessThan(settings.durationMs)
  })
})
