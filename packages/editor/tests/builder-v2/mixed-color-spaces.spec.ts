/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { CodPlay } from 'codplay'
import type { EditorScene } from '../../src/app/commands/types'
import { buildSceneDocV2, EDITOR_V2_STORY_ID } from '../../src/builder-v2'
import { parseColor } from 'ace'
import { alignColorSpaces, resolveDecorationStyleAtTime } from '../../src/builder-v2/decor-resolution'
import { EDITOR_ENGINE_OPTIONS } from '../../src/item-presentation/engine-options'

/** One item going from an sRGB hex background to the oklch background the palette writes. */
function mixedColorScene(): EditorScene {
  return {
    id: 'mixed-color-spaces',
    meta: { title: 'Mixed colors', durationMs: 1_000, durationSource: 'arbitrary', timeUnit: 'ms', capsuleOrder: 'forward' },
    rootDecorId: 'root',
    decors: {
      root: { id: 'root' },
      first: { id: 'first', offset: { translate: { x: 10, y: 5 }, width: 20, height: 12 }, style: { 'background-color': '#dd7744' } },
      second: { id: 'second', style: { 'background-color': 'oklch(0.6437 0.1859 148.1)' } },
    },
    contents: { content: { id: 'content', type: 'text', text: 'mixed' } },
    items: [{
      id: 'item', type: 'text', parentId: null, order: 'a', visible: true, contentId: 'content', initialDecorId: 'first',
      keyframes: [
        { id: 'first-kf', timeMs: 0, decorId: 'first', channel: 'pose' },
        { id: 'second-kf', timeMs: 1_000, decorId: 'second', channel: 'decor' },
      ],
    }],
    zones: {},
    markerTracks: {},
  }
}

describe('Builder — color endpoints in different spaces', () => {
  let codplay: CodPlay | undefined
  afterEach(() => { codplay?.destroy(); codplay = undefined; document.body.replaceChildren() })

  it('converts only the sRGB endpoint of a mixed pair, keeping its alpha', () => {
    const [from, to] = alignColorSpaces(parseColor('#dd774480'), parseColor('oklch(0.5 0.1 200)'))
    expect(from).toMatchObject({ kind: 'color', space: 'oklch', alpha: expect.closeTo(0.502, 3) })
    expect(to).toEqual(parseColor('oklch(0.5 0.1 200)'))
    const srgbPair = [parseColor('#ff0000'), parseColor('#0000ff')]
    expect(alignColorSpaces(srgbPair[0], srgbPair[1])).toEqual(srgbPair)
    expect(alignColorSpaces('10cqw', '20cqw')).toEqual(['10cqw', '20cqw'])
  })

  it('resolves the interpolated decoration style between the two keyframes', () => {
    const scene = mixedColorScene()
    const style = resolveDecorationStyleAtTime(scene, scene.items[0]!, 500)
    expect(style['background-color']).toMatchObject({ kind: 'color', space: 'oklch' })
  })

  it('emits an oklch tween that the CodPlay player resolves', async () => {
    const built = buildSceneDocV2(mixedColorScene())
    if (!built.ok) throw new Error(JSON.stringify(built.diagnostics))
    const tween = Object.values(built.sceneDoc.stories[EDITOR_V2_STORY_ID]!.persos.find((perso) => perso.id === 'item')!.actions)
      .map((action) => (action as { style?: Record<string, { from?: unknown; to?: unknown }> }).style?.['background-color'])
      .find((value) => value?.from !== undefined)
    expect(tween).toMatchObject({ from: { space: 'oklch' }, to: { space: 'oklch' } })

    codplay = new CodPlay({ engine: EDITOR_ENGINE_OPTIONS, pauseOnDocumentHidden: false })
    const compiled = codplay.build({ scene: built.sceneDoc })
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
    const root = document.createElement('div')
    document.body.append(root)
    const instance = codplay.instances.create({ instanceId: 'mixed-color-spaces', ...compiled, root })
    await instance.telco.seek(500 + built.preRollMs)
    const state = instance.snapshot.get()?.states.find((entry) => entry.target.persoId === 'item')?.state
    expect((state?.style as Record<string, unknown>)['background-color']).toMatchObject({ kind: 'color', space: 'oklch' })
  })
})
