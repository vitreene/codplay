// @vitest-environment jsdom

import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'
import { createZoneEditorV2 } from '@codplay/selection-frame/v2'
import type { ZoneEditorState } from '@codplay/selection-frame/v2'
import { EDITOR_V2_STORY_ID } from '../src/builder-v2/types'
import { createEmptyEditorScene } from '../src/app/scenes/editor-scene'
import { EditorActionsFacade } from '../src/app/facades/editor-actions-facade'
import type { EditorPlayerPresentationFrame } from '../src/app/commands/editor-player-command-facade'
import { controllerMachine } from '../src/app/controller/controller-machine'
import { createSceneSelectionHandler } from '../src/app/bridges/scene-selection'

/** Creates primary pointer events for the DOM gesture paths exercised by this test. */
function pointerEvent(type: 'pointerdown' | 'pointerup', clientX: number, clientY: number): PointerEvent {
  const event = new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY })
  Object.defineProperties(event, {
    isPrimary: { value: true },
    pointerId: { value: 1 },
    buttons: { value: type === 'pointerdown' ? 1 : 0 },
  })
  return event as unknown as PointerEvent
}

describe('scene item selection', () => {
  it('keeps an item hit from also starting a zone trace or creating an undo step', () => {
    const actor = createActor(controllerMachine).start()
    const actions = new EditorActionsFacade(actor)
    let zoneEditor: ReturnType<typeof createZoneEditorV2> | undefined
    let unsubscribeCommits: (() => void) | undefined
    let onScenePointerDown: ((event: PointerEvent) => void) | undefined
    const documentCommits: unknown[] = []

    try {
      actions.loadScene(createEmptyEditorScene())
      actions.runCommand({ name: 'createItem', args: { geometry: {} } })
      const scene = actor.getSnapshot().context.scene!
      const itemId = scene.items[0]!.id
      actions.loadScene(scene)

      const sceneRoot = document.createElement('section')
      sceneRoot.id = 'editor-scene-region'
      Object.defineProperties(sceneRoot, {
        clientWidth: { configurable: true, value: 400 },
        clientHeight: { configurable: true, value: 400 },
        getBoundingClientRect: {
          configurable: true,
          value: () => ({ x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 400, width: 400, height: 400, toJSON: () => ({}) }),
        },
      })
      document.body.append(sceneRoot)

      const presentation: EditorPlayerPresentationFrame = {
        timeMs: 0,
        playerTimeMs: 0,
        items: [{
          itemId: `${EDITOR_V2_STORY_ID}:${itemId}`,
          pose: { origin: { x: 100, y: 100 }, matrix: { a: 1, b: 0, c: 0, d: 1 }, localWidth: 100, localHeight: 100 },
          representation: 'source',
          progress: 0,
        }],
      }
      const coordination = {
        getSceneHost: () => sceneRoot,
        presentation: { get: () => presentation },
      }

      zoneEditor = createZoneEditorV2({
        sceneRoot,
        getPose: () => ({
          origin: { x: 0, y: 0 },
          matrix: { a: 1, b: 0, c: 0, d: 1 },
          localWidth: 400,
          localHeight: 400,
        }),
        initialState: { grid: { rows: 90, cols: 160 }, zones: [] },
        onZonesChange: (state: ZoneEditorState) => actions.runTransaction([{
          name: 'setZonesSurface',
          args: {
            capsuleId: null,
            orientation: 'landscape',
            zones: state.zones.map(({ id, name, row, col, rowSpan, colSpan }) => ({
              id,
              name,
              area: { row, col, rowSpan, colSpan },
            })),
          },
        }]),
        onSelectionChange: () => {},
      })

      const commitSubscription = actor.on('documentCommitted', (change) => documentCommits.push(change.afterScene))
      unsubscribeCommits = () => commitSubscription.unsubscribe()
      onScenePointerDown = createSceneSelectionHandler(actor, actions, coordination)
      document.addEventListener('pointerdown', onScenePointerDown, true)
      const gridBackground = sceneRoot.querySelector<HTMLElement>('[data-zone-editor-grid-background]')!
      Object.assign(gridBackground, {
        setPointerCapture: () => {},
        hasPointerCapture: () => false,
        releasePointerCapture: () => {},
      })

      gridBackground.dispatchEvent(pointerEvent('pointerdown', 150, 150))
      gridBackground.dispatchEvent(pointerEvent('pointerup', 150, 150))

      expect(actor.getSnapshot().context.selection.itemIds).toEqual([itemId])
      expect(zoneEditor.getState().zones).toEqual([])
      expect(documentCommits).toHaveLength(0)
      expect(actions.getHistoryState()).toEqual({ canUndo: false, canRedo: false })

      gridBackground.dispatchEvent(pointerEvent('pointerdown', 300, 300))
      gridBackground.dispatchEvent(pointerEvent('pointerup', 300, 300))

      expect(actor.getSnapshot().context.selection.itemIds).toEqual([])
      expect(zoneEditor.getState().zones).toHaveLength(1)
      expect(actions.getHistoryState()).toEqual({ canUndo: true, canRedo: false })
      expect(documentCommits).toHaveLength(1)
    } finally {
      if (onScenePointerDown !== undefined) {
        document.removeEventListener('pointerdown', onScenePointerDown, true)
      }
      unsubscribeCommits?.()
      zoneEditor?.destroy()
      actions.destroy()
      actor.stop()
      document.body.replaceChildren()
    }
  })
})
