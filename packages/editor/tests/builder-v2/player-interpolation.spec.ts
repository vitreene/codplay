/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { CodPlay } from 'codplay'
import { parseColor } from 'ace'
import { buildSceneDocV2, EDITOR_V2_STORY_ID } from '../../src/builder-v2'
import type { EditorScene } from '../../src/app/commands/types'

/** Builds the smallest editor scene whose second keyframe changes color and geometry together. */
function interpolationScene(): EditorScene {
  return {
    id: 'editor-v2-player-interpolation',
    meta: {
      title: 'Editor V2 player interpolation',
      durationMs: 1_000,
      durationSource: 'arbitrary',
      timeUnit: 'ms',
      capsuleOrder: 'forward',
    },
    rootDecorId: 'root',
    decors: {
      root: { id: 'root' },
      first: {
        id: 'first',
        offset: { translate: { x: 10, y: 5 }, width: 20, height: 12, rotate: 0 },
        style: { 'background-color': '#ff0000' },
      },
      second: {
        id: 'second',
        offset: { translate: { x: 30, y: 25 }, width: 40, height: 22, rotate: 15 },
        style: { 'background-color': '#0000ff' },
      },
    },
    contents: { content: { id: 'content', type: 'text', text: 'interpolation' } },
    items: [{
      id: 'item',
      type: 'text',
      parentId: null,
      order: 'mmm',
      visible: true,
      contentId: 'content',
      initialDecorId: 'first',
      keyframes: [
        { id: 'first-kf', timeMs: 0, decorId: 'first' },
        { id: 'second-kf', timeMs: 1_000, decorId: 'second' },
      ],
    }],
    zones: {},
    markerTracks: {},
  }
}

describe('editor V2 player interpolation', () => {
  let codplay: CodPlay | undefined

  afterEach(() => {
    codplay?.destroy()
    codplay = undefined
    document.body.replaceChildren()
  })

  it('keeps color and geometry in one logical snapshot and presents both in HTML', async () => {
    codplay = new CodPlay({ pauseOnDocumentHidden: false })
    const built = buildSceneDocV2(interpolationScene())
    expect(built.ok).toBe(true)
    if (!built.ok) return

    const root = document.createElement('div')
    Object.defineProperty(root, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, x: 0, y: 0, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    document.body.append(root)
    const compiled = codplay.build({ scene: built.sceneDoc })
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    const instance = codplay.instances.create({
      instanceId: 'editor-v2-player-interpolation',
      compiledScene: compiled.compiledScene,
      functions: compiled.functions,
      root,
      mountTargets: [{ id: 'root-host', kind: 'root', storyId: EDITOR_V2_STORY_ID }],
    })

    await instance.telco.seek(500)
    const snapshot = instance.snapshot.get()
    const state = snapshot?.states.find((entry) => entry.target.persoId === 'item')?.state
    const style = state?.style as Record<string, unknown> | undefined
    expect(style?.x).toMatchObject({ kind: 'length', value: 20 })
    expect(style?.y).toMatchObject({ kind: 'length', value: 15 })
    expect(style?.width).toMatchObject({ kind: 'length', value: 30 })
    expect(style?.height).toMatchObject({ kind: 'length', value: 17 })
    expect(style?.rotate).toBe(7.5)
    expect(style?.['background-color']).toEqual(expect.objectContaining({ kind: 'color' }))

    const item = root.querySelector<HTMLElement>('[data-item-id="story-main:item"]')
    expect(item).not.toBeNull()
    expect(item?.style.transform).toBe('translate(160px, 120px) rotate(7.5deg)')
    expect(item?.style.width).toBe('240px')
    expect(item?.style.height).toBe('136px')
    expect(item?.style.backgroundColor).toBe(`rgb(${parseColor('#800080').coords.map((value) => Math.round(value * 255)).join(', ')})`)
  })
})
