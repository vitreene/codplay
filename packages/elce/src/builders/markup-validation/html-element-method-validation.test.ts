import { describe, expect, it } from 'vitest'
import type { SceneDoc } from 'codplay/scene/types'
import { validateHtmlElementMethodActions } from './html-element-method-validation'

describe('HTML element method author validation', () => {
  it('accepts the supported focus, blur and prevent-scroll forms', () => {
    const warnings = validateHtmlElementMethodActions({
      scene: sceneWithMethods([
        ['focus'],
        ['focus', 'preventscroll'],
        ['blur'],
      ]),
    })

    expect(warnings).toEqual([])
  })

  it('warns for ambiguous, repeated, and incomplete method lists', () => {
    const warnings = validateHtmlElementMethodActions({
      scene: sceneWithMethods([
        ['focus', 'blur'],
        ['focus', 'focus'],
        ['preventscroll'],
      ]),
    })

    expect(warnings).toHaveLength(3)
    expect(warnings.every((warning) => warning.includes('sera ignorée'))).toBe(true)
  })
})

/** Builds one author scene with the supplied method instruction lists. */
function sceneWithMethods(methods: readonly (readonly string[])[]): SceneDoc<string> {
  return {
    id: 'author-method-validation',
    stories: {
      main: {
        id: 'main',
        persos: methods.map((method, index) => ({
          id: `perso-${index}`,
          type: 'tag',
          actions: { [`action-${index}`]: { htmlElementMethod: method } },
        })),
      },
    },
  }
}
