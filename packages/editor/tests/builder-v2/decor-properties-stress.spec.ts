/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { CodPlay } from 'codplay'
import { buildSceneDocV2, EDITOR_V2_STORY_ID } from '../../src/builder-v2'
import { resolveCurrentPatch } from '../../src/app/bridges/decor-editor-bridge'
import type { Content, Decor, EditorScene } from '../../src/app/commands/types'

const SOURCE_STYLE: Record<string, string> = {
  'background-color': '#ff0000',
  border: '1px solid #ff0000',
  'border-color': '#ff0000',
  'border-width': '1px',
  'border-radius': '2px',
  padding: '4px',
  'font-family': 'Arial',
  'font-size': '12px',
  'font-weight': '400',
  'font-style': 'normal',
  'text-align': 'left',
  color: '#111111',
  'object-fit': 'contain',
  display: 'block',
}

const TARGET_STYLE: Record<string, string> = {
  'background-color': '#0000ff',
  border: '4px dashed #0000ff',
  'border-color': '#0000ff',
  'border-width': '4px',
  'border-radius': '8px',
  padding: '12px',
  'font-family': 'Georgia',
  'font-size': '24px',
  'font-weight': '700',
  'font-style': 'italic',
  'text-align': 'right',
  color: '#eeeeee',
  'object-fit': 'cover',
  display: 'flex',
}

const STRESS_STYLE_PROPERTIES = Object.keys(TARGET_STYLE)

/** Builds a scene containing every currently exposed CSS field plus open CSS values. */
function stressScene(): EditorScene {
  const source: Decor = {
    id: 'stress-source',
    style: SOURCE_STYLE,
    classes: ['stress-source', 'stress-shared'],
    offset: {
      translate: { x: 10, y: 5 },
      width: 20,
      height: 12,
      rotate: 0,
      scale: { x: 1, y: 1 },
      rotationOrigin: { fx: 0.25, fy: 0.25 },
    },
    custom: 'filter: blur(0px); --custom-source: source;',
  }
  const target: Decor = {
    id: 'stress-target',
    style: {
      ...TARGET_STYLE,
      '--future-decor-token': 'target-state',
    },
    classes: ['stress-target', 'stress-shared'],
    offset: {
      translate: { x: 30, y: 25 },
      width: 40,
      height: 22,
      rotate: 15,
      scale: { x: 1.2, y: 0.8 },
      rotationOrigin: { fx: 0.75, fy: 0.75 },
    },
    custom: 'filter: blur(4px); --custom-source: target;',
    zoneId: 'stress-zone',
    path: 'M 0 0 A 0.65 0.65 0 0 1 1 0',
  }
  return {
    id: 'editor-v2-decor-properties-stress',
    meta: {
      title: 'Editor V2 Decor property stress test',
      durationMs: 1_000,
      durationSource: 'arbitrary',
      timeUnit: 'ms',
      capsuleOrder: 'forward',
    },
    rootDecorId: 'stress-root',
    decors: {
      'stress-root': { id: 'stress-root' },
      'stress-source': source,
      'stress-target': target,
    },
    contents: {
      content: { id: 'content', type: 'text', text: 'Decor stress' },
    },
    items: [{
      id: 'stress-item',
      type: 'text',
      parentId: null,
      order: 'mmm',
      visible: true,
      contentId: 'content',
      initialDecorId: source.id,
      keyframes: [
        { id: 'stress-source-kf', timeMs: 0, decorId: source.id },
        { id: 'stress-target-kf', timeMs: 1_000, decorId: target.id },
      ],
    }],
    zones: {
      'stress-zone': {
        id: 'stress-zone',
        name: 'Stress zone',
        surfaces: {
          horizontal: { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
          vertical: { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
        },
      },
    },
    markerTracks: {},
  }
}

/** Returns the logical state of one compiled runtime item. */
function itemState(instance: { snapshot: { get: () => { states: readonly { target: { persoId: string }; state: Readonly<Record<string, unknown>> }[] } | null } }): Readonly<Record<string, unknown>> {
  const state = instance.snapshot.get()?.states.find((entry) => entry.target.persoId === 'stress-item')?.state
  if (state === undefined) throw new Error('The stress item is absent from the CodPlay snapshot.')
  return state
}

describe('editor V2 Decor property stress path', () => {
  let codplay: CodPlay | undefined

  afterEach(() => {
    codplay?.destroy()
    codplay = undefined
    document.body.replaceChildren()
  })

  it('keeps every authored CSS property in the compiled action and CodPlay state', async () => {
    codplay = new CodPlay({ pauseOnDocumentHidden: false })
    const built = buildSceneDocV2(stressScene())
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'EDITOR_V2_ZONE_DEFERRED' }),
    ]))

    const perso = built.sceneDoc.stories[EDITOR_V2_STORY_ID]!.persos.find((candidate) => candidate.id === 'stress-item')!
    const actionStyleProperties = new Set(
      Object.values(perso.actions ?? {}).flatMap((action) => (
        action && typeof action === 'object' && 'style' in action && action.style && typeof action.style === 'object'
          ? Object.keys(action.style)
          : []
      )),
    )
    for (const property of STRESS_STYLE_PROPERTIES) {
      expect(actionStyleProperties, `missing compiled style property ${property}`).toContain(property)
    }
    expect(actionStyleProperties).toContain('--future-decor-token')
    expect(actionStyleProperties).toContain('filter')
    expect(actionStyleProperties).toContain('--custom-source')

    const root = document.createElement('div')
    document.body.append(root)
    const compiled = codplay.build({ scene: built.sceneDoc })
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    const instance = codplay.instances.create({
      instanceId: 'editor-v2-decor-properties-stress',
      compiledScene: compiled.compiledScene,
      functions: compiled.functions,
      root,
      mountTargets: [{ id: 'stress-host', kind: 'root', storyId: EDITOR_V2_STORY_ID }],
    })

    await instance.telco.seek(500 + built.preRollMs)
    const midpointStyle = itemState(instance).style as Record<string, unknown>
    expect(midpointStyle).toHaveProperty('border')
    expect(midpointStyle).toHaveProperty('border-color')
    expect(midpointStyle).toHaveProperty('font-family')
    expect(midpointStyle).toHaveProperty('object-fit')
    expect(midpointStyle).toHaveProperty('filter')

    await instance.telco.seek(1_000 + built.preRollMs)
    const destinationState = itemState(instance)
    const destinationStyle = destinationState.style as Record<string, unknown>
    for (const property of [...STRESS_STYLE_PROPERTIES, '--future-decor-token', 'filter', '--custom-source']) {
      expect(destinationStyle, `missing CodPlay style property ${property}`).toHaveProperty(property)
    }
    expect(destinationStyle['font-family']).toBe('Georgia')
    expect(destinationStyle['font-style']).toBe('italic')
    expect(destinationStyle['text-align']).toBe('right')
    expect(destinationStyle['object-fit']).toBe('cover')
    expect(destinationStyle['--future-decor-token']).toBe('target-state')
    expect(destinationStyle['--custom-source']).toBe('target')
    expect(destinationStyle.x).toMatchObject({ kind: 'length', value: 30 })
    expect(destinationStyle.y).toMatchObject({ kind: 'length', value: 25 })
    expect(destinationStyle.width).toMatchObject({ kind: 'length', value: 40 })
    expect(destinationStyle.height).toMatchObject({ kind: 'length', value: 22 })
    expect(destinationStyle.rotate).toBe(15)
    expect(destinationStyle.scaleX).toBe(1.2)
    expect(destinationStyle.scaleY).toBe(0.8)
    expect(destinationStyle['transform-origin']).toBe('75% 75%')
    // Zone is deliberately outside the current builder slice; the diagnostic above makes this
    // boundary visible instead of treating the absence as a successful projection.
    expect(perso.initial).not.toHaveProperty('zone')

    expect(perso.actions['stress-item-kf-stress-target-kf-classes']).toEqual({
      className: { add: 'stress-target', remove: 'stress-source' },
    })
    expect(destinationState.className).toContain('stress-target')
    expect(destinationState.className).not.toContain('stress-source')
    expect(perso.actions['stress-item-kf-stress-target-kf']).toHaveProperty('move')
  })

  it('transporte les propriétés Decor connues et futures par structure au bridge', () => {
    const decor = {
      id: 'future-decor',
      style: { border: '2px solid red' },
      classes: [],
      offset: { translate: { x: 1, y: 2 } },
      zoneId: null,
      custom: 'filter: blur(2px);',
      path: 'M 0 0 L 1 1',
      futureModule: { enabled: true, values: { border: 'future' } },
    }
    const content: Content = { id: 'content', type: 'text', text: 'future' }
    const patch = resolveCurrentPatch(decor, content, stressScene()) as Record<string, unknown>

    expect(patch).toMatchObject({
      style: { border: '2px solid red' },
      classes: [],
      offset: { translate: { x: 1, y: 2 } },
      custom: 'filter: blur(2px);',
      path: 'M 0 0 L 1 1',
      text: 'future',
      futureModule: { enabled: true, values: { border: 'future' } },
    })
    expect(patch).toHaveProperty('zone', null)
  })
})
