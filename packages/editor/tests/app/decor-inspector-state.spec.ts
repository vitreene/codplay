import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { controllerMachine } from '../../src/app/controller/controller-machine'
import type { EditorScene } from '../../src/app/commands/types'
import {
  authoringToolsState,
  defaultInspectorPanel,
  rootSettingsState,
  scenePanelTarget,
} from '../../src/app/layout/decor-inspector/decor-inspector-state'

/** A fine-grid root with one zone, a zone-placed block and a capsule. */
function inspectorScene(): EditorScene {
  return {
    id: 'inspector',
    meta: { title: 'Inspector', durationMs: 5_000, durationSource: 'arbitrary', timeUnit: 'ms', capsuleOrder: 'forward' },
    rootCapsule: { kind: 'card', distribution: { mode: 'stagger', staggerInMs: 0, staggerOutMs: 0 }, grid: { rows: 90, cols: 160 } },
    items: [
      { id: 'zoned', type: 'bloc', parentId: null, order: 'a', visible: true, contentId: null, initialDecorId: 'zoned-decor', keyframes: [] },
      {
        id: 'capsule', type: 'capsule', parentId: null, order: 'b', visible: true, contentId: null, initialDecorId: 'capsule-decor', keyframes: [],
        capsule: { kind: 'grille', grid: { rows: 1, cols: 1 }, distribution: { mode: 'stagger', staggerInMs: 0, staggerOutMs: 0 } },
      },
    ],
    contents: {},
    decors: {
      'zoned-decor': { id: 'zoned-decor', zoneId: 'zone' },
      'capsule-decor': { id: 'capsule-decor', offset: { translate: { x: 0, y: 0 }, width: 20, height: 20 } },
    },
    zones: {
      zone: {
        id: 'zone', capsuleId: null, name: 'zone',
        surfaces: { landscape: { row: 1, col: 1, rowSpan: 10, colSpan: 10 }, portrait: { row: 1, col: 1, rowSpan: 10, colSpan: 10 } },
      },
    },
    markerTracks: {},
  }
}

/** Controller context holding the scene, a selection and an authoring mode. */
function contextWith(itemIds: string[], mode: 'zone' | 'block' | null) {
  const actor = createActor(controllerMachine)
  actor.start()
  actor.send({ type: 'SCENE_LOADED', scene: inspectorScene() })
  if (itemIds.length > 0) actor.send({ type: 'SELECT_ITEM', itemIds })
  if (mode !== null) actor.send({ type: 'SET_AUTHORING_MODE', mode })
  return actor.getSnapshot().context
}

describe('Decor inspector display rules', () => {
  it('opens the scene settings for the root and a capsule, the palette for any other item', () => {
    const scene = inspectorScene()
    expect(scenePanelTarget(null, { itemIds: [], keyframeId: null })).toBeNull()
    expect(scenePanelTarget(scene, { itemIds: [], keyframeId: null })).toBe('root')
    expect(scenePanelTarget(scene, { itemIds: ['capsule'], keyframeId: null })).toBe('capsule')
    expect(scenePanelTarget(scene, { itemIds: ['zoned'], keyframeId: null })).toBeNull()
    expect(defaultInspectorPanel('root')).toBe('capsule')
    expect(defaultInspectorPanel(null)).toBe('decor')
  })

  it('offers the offset tool only in block mode, for an item placed by its zone', () => {
    expect(authoringToolsState(contextWith(['zoned'], 'block'), false, 0).offsetTool).toEqual({ pressed: false })
    expect(authoringToolsState(contextWith(['zoned'], 'zone'), false, 0).offsetTool).toBeNull()
    expect(authoringToolsState(contextWith(['capsule'], 'block'), false, 0).offsetTool).toBeNull()
    expect(authoringToolsState(contextWith(['zoned'], 'block'), true, 0).disabled).toBe(true)
  })

  it('refuses the free root grid while root zones exist, and enables the zone toggle on the fine grid', () => {
    const state = rootSettingsState(inspectorScene(), false, false)
    expect(state.modes.map((mode) => [mode.value, mode.pressed, mode.disabled])).toEqual([
      ['transform', false, true],
      ['fine-grid', true, false],
    ])
    expect(state.modes[0]!.title).toBe('Retirer les zones racine avant de passer en grille 1 × 1')
    expect(state.zones).toEqual({ label: 'Afficher les zones', pressed: false, disabled: false })
    expect(rootSettingsState(inspectorScene(), false, true).modes.every((mode) => mode.disabled)).toBe(true)
  })
})
