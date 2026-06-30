// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { utils } from 'animejs'

import { createAnimationAdapter, type AnimeImplementation } from '../../src/animation/adapter'
import type { AnimationAdapter, TransitionRequest } from '../../src/animation/types'
import { PlayerFacade } from '../../src/player/create-player'
import type { SceneDoc } from '../../src/player/types'
import { createListFlipModule } from '../../src/runtime/modules/list-flip'

const originalGetBoundingClientRect = globalThis.HTMLElement?.prototype.getBoundingClientRect

/** Builds one DOMRect-like object for deterministic jsdom geometry. */
function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    x: left,
    y: top,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({ left, top, width, height })
  } as DOMRect
}

/** Installs deterministic geometry for list and outlet overlay-world fixtures. */
function installGeometryStub(): void {
  globalThis.HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
    const node = this as HTMLElement
    const inlineLeft = Number.parseFloat(node.style.left)
    const inlineTop = Number.parseFloat(node.style.top)
    const inlineWidth = Number.parseFloat(node.style.width)
    const inlineHeight = Number.parseFloat(node.style.height)

    if (Number.isFinite(inlineLeft) && Number.isFinite(inlineTop)) {
      return rect(
        inlineLeft,
        inlineTop,
        Number.isFinite(inlineWidth) ? inlineWidth : 40,
        Number.isFinite(inlineHeight) ? inlineHeight : 20
      )
    }

    if (node.id === 'source-list') {
      return rect(10, 20, 80, 80)
    }
    if (node.id === 'target-list') {
      return rect(200, 20, 80, 80)
    }
    if (node.getAttribute('data-part') === 'layout:source-outlet') {
      return rect(10, 130, 80, 80)
    }
    if (node.getAttribute('data-part') === 'layout:target-outlet') {
      return rect(200, 130, 80, 80)
    }
    if (node.id === 'moving-item') {
      return node.parentElement?.id === 'target-list'
        ? rect(210, 30, 40, 20)
        : rect(20, 30, 40, 20)
    }
    if (node.id === 'outlet-moving-item') {
      return node.parentElement?.getAttribute('data-part') === 'layout:target-outlet'
        ? rect(210, 140, 40, 20)
        : rect(20, 140, 40, 20)
    }
    if (node.id === 'neighbor-item') {
      return node.parentElement?.id === 'source-list' && node.previousElementSibling === null
        ? rect(20, 30, 40, 20)
        : rect(20, 60, 40, 20)
    }

    return rect(0, 0, 100, 100)
  }
}

/** Creates a minimal list-to-list overlay-world scene with a static source baseline. */
function createOverlayWorldSeekScene(): SceneDoc {
  return {
    id: 'scene-overlay-world-seek-baseline',
    listen: [],
    stories: {
      'story-main': {
        id: 'story-main',
        initial: { move: '@root' },
        persos: [
          {
            id: 'source-list',
            type: 'list',
            initial: { move: '@root' },
            actions: {}
          },
          {
            id: 'target-list',
            type: 'list',
            initial: { move: '@root' },
            actions: {}
          },
          {
            id: 'moving-item',
            type: 'tag',
            initial: {
              tag: 'button',
              content: 'Move me',
              move: { parentId: 'source-list' }
            },
            actions: {
              'item:move': {
                move: { parentId: 'target-list', flipMode: 'overlay-world', duration: 740, easing: 'easeInOutQuad' }
              }
            }
          },
          {
            id: 'neighbor-item',
            type: 'tag',
            initial: {
              tag: 'button',
              content: 'Stay here',
              move: { parentId: 'source-list' }
            },
            actions: {}
          }
        ],
        eventimes: [
          { name: 'item:move', startAt: 1000 },
          { name: 'sequence:end', startAt: 3000 }
        ],
        listen: []
      }
    },
    tracks: {},
    onStart(_scene, options) {
      options.schedule('story-main')
    }
  } as SceneDoc
}

/** Creates an anime bridge whose seek is intentionally inert. */
function createNoopSeekAnimeImplementation(): AnimeImplementation {
  return () => ({
    pause: () => undefined,
    seek: () => undefined,
    revert: () => undefined
  })
}

/** Creates an adapter that records every transition batch without mutating DOM state. */
function createRecordingAdapter(recordedBatches: TransitionRequest[][]): AnimationAdapter {
  return {
    run(transitions) {
      recordedBatches.push(transitions)
      return transitions.map((transition) => ({
        transitionId: transition.transitionId,
        target: transition.target,
        stop: () => undefined
      }))
    },
    stop: () => undefined,
    pause: () => undefined,
    resume: () => undefined,
    seek: () => undefined
  }
}

afterEach(() => {
  if (originalGetBoundingClientRect !== undefined) {
    globalThis.HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
  }
  document.body.innerHTML = ''
})

describe('V1 - overlay-world seek baseline', () => {
  it('replays a static initial.move perso from its source baseline, not from its targetMs parent', async () => {
    installGeometryStub()

    const recordedBatches: TransitionRequest[][] = []
    const player = new PlayerFacade({ animationAdapter: createRecordingAdapter(recordedBatches) })

    expect(await player.init(createOverlayWorldSeekScene())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })

    recordedBatches.length = 0
    expect(await player.seek(1200)).toEqual({ ok: true })

    const translateTransition = recordedBatches
      .flat()
      .find((transition) =>
        transition.transitionId.startsWith('flip-overlay-moving-item-') && transition.property === 'translate'
      )

    expect(translateTransition).toMatchObject({
      from: '0px 0px',
      to: '190px 0px',
      duration: 740,
      easing: 'easeInOutQuad'
    })
  })

  it('produces a y transition for source-list neighbors during a live overlay-world move', async () => {
    installGeometryStub()

    const recordedBatches: TransitionRequest[][] = []
    const player = new PlayerFacade({ animationAdapter: createRecordingAdapter(recordedBatches) })

    expect(await player.init(createOverlayWorldSeekScene())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })

    recordedBatches.length = 0
    expect(await player.emit({ name: 'item:move', data: {} })).toEqual({ ok: true })

    const neighborYTransition = recordedBatches
      .flat()
      .find((transition) => transition.property === 'y' && transition.target === player.getRuntimeRegistry().getNodeById('neighbor-item'))

    expect(neighborYTransition).toBeDefined()
    expect(neighborYTransition?.from).toBeCloseTo(30, 0)
    expect(neighborYTransition?.to).toBeCloseTo(0, 0)
  })

  it('does not replay local FLIP y values on source-list neighbors during overlay-world seek replay', async () => {
    installGeometryStub()

    const player = new PlayerFacade({
      animationAdapter: createAnimationAdapter(createNoopSeekAnimeImplementation())
    })

    expect(await player.init(createOverlayWorldSeekScene())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })
    expect(await player.seek(1200)).toEqual({ ok: true })

    const neighborNode = player.getRuntimeRegistry().getNodeById('neighbor-item') as HTMLElement
    expect(Number(utils.get(neighborNode, 'y', false))).toBe(0)
  })

  it('builds overlay-world transitions when the target is a runtime node, not a list', () => {
    installGeometryStub()

    const sourceOutlet = document.createElement('div')
    sourceOutlet.setAttribute('data-part', 'layout:source-outlet')
    const targetOutlet = document.createElement('div')
    targetOutlet.setAttribute('data-part', 'layout:target-outlet')
    const movingNode = document.createElement('button')
    movingNode.id = 'outlet-moving-item'
    sourceOutlet.appendChild(movingNode)
    document.body.append(sourceOutlet, targetOutlet)

    const parentById = new Map<string, string | null>([
      ['outlet-moving-item', 'layout:source-outlet']
    ])
    const nodeById = new Map<string, Element>([
      ['outlet-moving-item', movingNode],
      ['layout:source-outlet', sourceOutlet],
      ['layout:target-outlet', targetOutlet]
    ])
    const listFlipModule = createListFlipModule({
      warnOnce: () => undefined,
      getNodeById: (id) => nodeById.get(id) ?? null,
      getListById: () => null,
      getParentListId: (id) => parentById.get(id) ?? null,
      isMounted: () => true
    })

    const session = listFlipModule.prepareMove({
      persoId: 'outlet-moving-item',
      move: { parentId: 'layout:target-outlet', flipMode: 'overlay-world' },
      eventId: 'evt-outlet-move',
      eventName: 'item:move-outlet',
      eventSeq: 1
    })

    expect(session).not.toBeNull()
    targetOutlet.appendChild(movingNode)
    parentById.set('outlet-moving-item', 'layout:target-outlet')

    const translateTransition = (session?.commit() ?? [])
      .find((transition) =>
        transition.transitionId.startsWith('flip-overlay-outlet-moving-item-') && transition.property === 'translate'
      )

    expect(translateTransition).toMatchObject({
      from: '0px 0px',
      to: '190px 0px'
    })

    const overlayPhotos = document.querySelectorAll('[data-runtime-flip-overlay-photo]')
    expect(overlayPhotos).toHaveLength(1)
    expect(overlayPhotos[0]?.getAttribute('data-runtime-flip-overlay-photo')).toBe('old')
  })

  it('uses transform translate modifiers for attracted overlay-world trajectories', () => {
    installGeometryStub()

    const sourceOutlet = document.createElement('div')
    sourceOutlet.setAttribute('data-part', 'layout:source-outlet')
    const targetOutlet = document.createElement('div')
    targetOutlet.setAttribute('data-part', 'layout:target-outlet')
    const movingNode = document.createElement('button')
    movingNode.id = 'outlet-moving-item'
    sourceOutlet.appendChild(movingNode)
    document.body.append(sourceOutlet, targetOutlet)

    const parentById = new Map<string, string | null>([
      ['outlet-moving-item', 'layout:source-outlet']
    ])
    const nodeById = new Map<string, Element>([
      ['outlet-moving-item', movingNode],
      ['layout:source-outlet', sourceOutlet],
      ['layout:target-outlet', targetOutlet]
    ])
    const listFlipModule = createListFlipModule({
      warnOnce: () => undefined,
      getNodeById: (id) => nodeById.get(id) ?? null,
      getListById: () => null,
      getParentListId: (id) => parentById.get(id) ?? null,
      isMounted: () => true
    })

    const session = listFlipModule.prepareMove({
      persoId: 'outlet-moving-item',
      move: { parentId: 'layout:target-outlet', flipMode: 'overlay-world', attraction: 100 },
      eventId: 'evt-outlet-move',
      eventName: 'item:move-outlet',
      eventSeq: 1
    })

    expect(session).not.toBeNull()
    targetOutlet.appendChild(movingNode)
    parentById.set('outlet-moving-item', 'layout:target-outlet')

    const transitions = session?.commit() ?? []
    const translateTransition = transitions.find((transition) =>
      transition.transitionId.startsWith('flip-overlay-outlet-moving-item-') && transition.property === 'translate'
    )

    expect(translateTransition).toMatchObject({
      from: 0,
      to: 1,
      finalValue: '190px 0px'
    })
    expect(typeof translateTransition?.modifier).toBe('function')
  })
})
