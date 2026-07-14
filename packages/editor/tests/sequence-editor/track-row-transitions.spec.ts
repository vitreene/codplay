// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { SequenceEditorController } from '../../src/sequence-editor/controller'
import { mountSequenceEditor } from '../../src/sequence-editor/mount'
import type { EditorScene } from '../../src/sequence-editor/types'

// jsdom n'implémente pas ResizeObserver (https://github.com/jsdom/jsdom/issues/3368) — même stub
// que `mount.spec.ts`.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver
  }
})

/**
 * Un kf FIXE le décor à son instant : `transitionIn` le PRÉCÈDE (bande à gauche, se termine AU
 * kf) ; `transitionOut` le SUIT (bande à droite, débute AU kf) — `2026-06-11-sequence-editor-
 * grid-spec.md` §2.2 "Sémantique des transitions". kf-intro porte les deux à la fois (le fondu
 * d'apparition ET la dissolution vers kf-outro) pour vérifier qu'ils coexistent sans collision —
 * l'exclusivité (§7 Q1) ne s'applique qu'à une PAIRE adjacente, jamais à un seul keyframe.
 */
function sceneWithTransitions(): EditorScene {
  return {
    id: 'scene-transitions',
    meta: { title: 'Transitions', durationMs: 2000, durationSource: 'arbitrary', timeUnit: 's', capsuleOrder: 'forward' },
    items: [
      {
        id: 'item-1',
        type: 'text',
        label: 'Item',
        parentId: null,
        order: 'a',
        visible: true,
        contentId: null,
        initialDecorId: 'decor-1',
        keyframes: [
          {
            id: 'kf-intro',
            timeMs: 500,
            name: 'intro',
            decorId: 'decor-1',
            transitionIn: { kind: 'named', name: 'fade', durationMs: 400 },
            transitionOut: { kind: 'interpolated', durationMs: 300, easing: 'linear' },
          },
          { id: 'kf-outro', timeMs: 1500, name: 'outro', decorId: 'decor-1' },
        ],
      },
    ],
    contents: {},
    decors: { 'decor-1': { id: 'decor-1' } },
    zones: {},
    markerTracks: {},
  }
}

describe('renderTrackRows — bandes de transition (transitionIn précède, transitionOut suit)', () => {
  let container: HTMLElement
  let controller: SequenceEditorController

  afterEach(() => {
    controller?.destroy()
  })

  it('dessine une bande transitionIn qui se termine exactement à la position du kf, et une bande transitionOut qui en débute exactement', () => {
    container = document.createElement('div')
    controller = new SequenceEditorController(sceneWithTransitions())
    const handle = mountSequenceEditor(container, controller)

    const bands = Array.from(container.querySelectorAll<SVGRectElement>('.seq-row__transition'))
    expect(bands).toHaveLength(2)

    const kfX = controller.msToPixel(500)
    const { pixelsPerMs } = controller.getViewport()

    const introBand = bands.find((b) => b.classList.contains('seq-row__transition--named'))!
    const outroBand = bands.find((b) => b.classList.contains('seq-row__transition--interp'))!
    expect(introBand).toBeDefined()
    expect(outroBand).toBeDefined()

    const introX = Number(introBand.getAttribute('x'))
    const introW = Number(introBand.getAttribute('width'))
    const outroX = Number(outroBand.getAttribute('x'))
    const outroW = Number(outroBand.getAttribute('width'))

    // transitionIn (400ms, named) : se termine AU kf — son bord droit coïncide avec kfX.
    expect(introX + introW).toBeCloseTo(kfX, 0)
    expect(introW).toBeCloseTo(400 * pixelsPerMs, 0)

    // transitionOut (300ms, interpolated) : débute AU kf — son bord gauche coïncide avec kfX.
    expect(outroX).toBeCloseTo(kfX, 0)
    expect(outroW).toBeCloseTo(300 * pixelsPerMs, 0)

    handle.destroy()
  })

  it('ne dessine aucune bande pour un keyframe sans transition explicite', () => {
    container = document.createElement('div')
    controller = new SequenceEditorController(sceneWithTransitions())
    const handle = mountSequenceEditor(container, controller)

    // kf-outro ne porte ni transitionIn ni transitionOut — seules les 2 bandes de kf-intro existent.
    expect(container.querySelectorAll('.seq-row__transition')).toHaveLength(2)

    handle.destroy()
  })
})
