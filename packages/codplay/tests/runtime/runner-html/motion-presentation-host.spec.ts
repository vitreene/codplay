/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest'
import { HtmlMotionPresentationHost } from '../../../src/runtime/runner-html'
import type { HtmlMatrix, HtmlPose } from '../../../src/runtime/motion/html-types'
import { createMotionRootPose } from '../../../src/runtime/motion'
import type { ItemPresentation, PresentationFrame } from '../../../src/runtime/motion'

const IDENTITY: HtmlMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

/** Finds the unmarked overlay layer by its presentation contract. */
function findTestOverlayLayer(root: Element): HTMLElement | undefined {
  const candidates = root.querySelectorAll<HTMLElement>('*')
  return Array.from(candidates).find((candidate) => (
    candidate.style.position === 'absolute'
      && candidate.style.width === '100%'
      && candidate.style.height === '100%'
      && candidate.style.pointerEvents === 'none'
      && candidate.style.zIndex === '20'
  ))
}

/** Returns one direct ghost from an unmarked overlay layer. */
function findTestGhost(root: Element, index = 0): HTMLElement | undefined {
  return findTestOverlayLayer(root)?.children[index] as HTMLElement | undefined
}

describe('HtmlMotionPresentationHost overlay resources', () => {
  it('reuses a stable overlay node across presentation frames', () => {
    const root = document.createElement('main')
    const source = document.createElement('article')
    source.textContent = 'source'
    root.appendChild(source)
    document.body.appendChild(root)

    const host = new HtmlMotionPresentationHost(root, () => source)
    const frame = createReparentFrame(createPose(0))

    host.commit(frame, () => 'revision-1')
    const firstGhost = findTestGhost(root)
    expect(firstGhost).not.toBeNull()
    expect(firstGhost?.hasAttribute('data-codplay-motion-item')).toBe(false)
    expect(findTestOverlayLayer(root)?.hasAttribute('data-codplay-motion-overlay')).toBe(false)
    expect(source.style.visibility).toBe('hidden')
    expect(firstGhost?.style.visibility).toBe('')

    host.prepareNaturalCapture()
    expect(firstGhost?.style.visibility).toBe('hidden')
    expect(source.style.visibility).toBe('')
    host.commit(frame, () => 'revision-1')
    const secondGhost = findTestGhost(root)

    expect(secondGhost).toBe(firstGhost)
    expect(firstGhost?.style.visibility).toBe('')
    expect(source.style.visibility).toBe('hidden')
    expect(findTestOverlayLayer(root)?.children).toHaveLength(1)
    host.destroy()
    root.remove()
  })

  it('does not toggle source and overlay visibility on every presentation frame', () => {
    const root = document.createElement('main')
    const source = document.createElement('article')
    root.appendChild(source)
    document.body.appendChild(root)

    const host = new HtmlMotionPresentationHost(root, () => source)
    const frame = createReparentFrame(createPose(0))
    host.commit(frame, () => 'revision-1')
    const ghost = findTestGhost(root)
    expect(ghost).not.toBeNull()

    const sourceSetProperty = vi.spyOn(source.style, 'setProperty')
    const sourceRemoveProperty = vi.spyOn(source.style, 'removeProperty')
    const ghostSetProperty = vi.spyOn(ghost!.style, 'setProperty')
    const ghostRemoveProperty = vi.spyOn(ghost!.style, 'removeProperty')

    host.commit(frame, () => 'revision-1')
    host.commit({ ...frame, timeMs: 1, items: new Map([[
      'item',
      { ...frame.items.get('item')!, pose: createPose(1) },
    ]]) }, () => 'revision-1')

    expect(sourceSetProperty.mock.calls.filter(([name]) => name === 'visibility')).toHaveLength(0)
    expect(sourceRemoveProperty.mock.calls.filter(([name]) => name === 'visibility')).toHaveLength(0)
    expect(ghostSetProperty.mock.calls.filter(([name]) => name === 'visibility')).toHaveLength(0)
    expect(ghostRemoveProperty.mock.calls.filter(([name]) => name === 'visibility')).toHaveLength(0)

    host.destroy()
    sourceSetProperty.mockRestore()
    sourceRemoveProperty.mockRestore()
    ghostSetProperty.mockRestore()
    ghostRemoveProperty.mockRestore()
    root.remove()
  })

  it('keeps simultaneous reparent overlays in their own local roots', () => {
    const root = document.createElement('main')
    const firstRoot = document.createElement('section')
    const secondRoot = document.createElement('section')
    const firstSource = document.createElement('article')
    const secondSource = document.createElement('article')
    firstRoot.appendChild(firstSource)
    secondRoot.appendChild(secondSource)
    root.append(firstRoot, secondRoot)
    document.body.appendChild(root)

    const handles = new Map([
      ['first', firstSource],
      ['second', secondSource],
    ])
    const roots = new Map([
      ['first-root', firstRoot],
      ['second-root', secondRoot],
    ])
    const host = new HtmlMotionPresentationHost(
      root,
      (itemId) => handles.get(itemId),
      (rootKey) => roots.get(rootKey ?? ''),
    )
    host.commit(createFrame([
      { ...createItem('first'), motionRootKey: 'first-root', motionRootPose: createPose(0) },
      { ...createItem('second'), motionRootKey: 'second-root', motionRootPose: createPose(100) },
    ]))

    const firstLayer = findTestOverlayLayer(firstRoot)
    const secondLayer = findTestOverlayLayer(secondRoot)
    expect(firstLayer?.children).toHaveLength(1)
    expect(secondLayer?.children).toHaveLength(1)
    expect(firstLayer?.children[0]).not.toBe(secondLayer?.children[0])

    host.commit(createFrame([
      { ...createItem('second'), motionRootKey: 'second-root', motionRootPose: createPose(100) },
    ]))
    expect(findTestOverlayLayer(firstRoot)).toBeUndefined()
    expect(firstSource.style.visibility).toBe('')
    expect(findTestOverlayLayer(secondRoot)?.children).toHaveLength(1)

    host.destroy()
    root.remove()
  })

  it('updates stable template content without creating a replacement node', () => {
    const root = document.createElement('main')
    const source = document.createElement('article')
    source.textContent = 'before'
    root.appendChild(source)
    document.body.appendChild(root)

    const host = new HtmlMotionPresentationHost(root, () => source)
    const frame = createReparentFrame(createPose(0))
    host.commit(frame, () => 'revision-1')
    const ghost = findTestGhost(root)

    source.textContent = 'after'
    host.prepareNaturalCapture()
    host.commit(frame, () => 'revision-2')

    expect(findTestGhost(root)).toBe(ghost)
    expect(ghost?.textContent).toBe('after')
    host.destroy()
    root.remove()
  })

  it('reapplies host-owned dimensions after synchronizing a stable template', () => {
    const root = document.createElement('main')
    const source = document.createElement('article')
    source.textContent = 'before'
    root.appendChild(source)
    document.body.appendChild(root)

    const host = new HtmlMotionPresentationHost(root, () => source)
    const frame = createReparentFrame(createPose(0))
    host.commit(frame, () => 'revision-1')
    const ghost = findTestGhost(root)

    expect(ghost?.style.width).toBe('20px')
    expect(ghost?.style.height).toBe('20px')

    source.textContent = 'after'
    host.prepareNaturalCapture()
    host.commit(frame, () => 'revision-2')

    expect(findTestGhost(root)).toBe(ghost)
    expect(ghost?.style.width).toBe('20px')
    expect(ghost?.style.height).toBe('20px')
    host.destroy()
    root.remove()
  })

  it('never leaves a source and its active projection visible together', () => {
    const root = document.createElement('main')
    const source = document.createElement('article')
    root.appendChild(source)
    document.body.appendChild(root)

    const host = new HtmlMotionPresentationHost(root, () => source)
    const frame = createReparentFrame(createPose(0))
    host.commit(frame)
    const ghost = findTestGhost(root)

    expect(source.style.visibility).toBe('hidden')
    expect(ghost?.style.visibility).toBe('')

    host.prepareNaturalCapture()
    expect(source.style.visibility).toBe('')
    expect(ghost?.style.visibility).toBe('hidden')

    host.commit(frame)
    expect(source.style.visibility).toBe('hidden')
    expect(ghost?.style.visibility).toBe('')

    host.commit({ ...frame, items: new Map() })
    expect(source.style.visibility).toBe('')
    expect(findTestOverlayLayer(root)).toBeUndefined()

    host.destroy()
    root.remove()
  })

  it('does not write neutral transform longhands to an overlay ghost', () => {
    const root = document.createElement('main')
    const source = document.createElement('article')
    root.appendChild(source)
    document.body.appendChild(root)

    const host = new HtmlMotionPresentationHost(root, () => source)
    host.commit(createReparentFrame(createPose(0)))
    const ghost = findTestGhost(root)

    expect(ghost?.style.getPropertyValue('translate')).toBe('')
    expect(ghost?.style.getPropertyValue('rotate')).toBe('')
    expect(ghost?.style.getPropertyValue('scale')).toBe('')
    host.destroy()
    root.remove()
  })

  it('gates authored CSS transitions during a logical seek', () => {
    const root = document.createElement('main')
    document.body.appendChild(root)

    const host = new HtmlMotionPresentationHost(root, () => undefined)
    host.prepareSeek()

    expect(root.hasAttribute('data-codplay-motion-seek')).toBe(true)
    expect([...document.querySelectorAll('style')]
      .some((style) => style.textContent?.includes('[data-codplay-motion-seek] *'))).toBe(true)

    host.completeSeek()
    expect(root.hasAttribute('data-codplay-motion-seek')).toBe(false)
    host.destroy()
    root.remove()
  })

  it('neutralizes a non-default author transform longhand before applying the pose matrix', () => {
    const root = document.createElement('main')
    const source = document.createElement('article')
    source.style.rotate = '20deg'
    root.appendChild(source)
    document.body.appendChild(root)

    const host = new HtmlMotionPresentationHost(root, () => source)
    host.commit(createReparentFrame(createPose(0)))
    const ghost = findTestGhost(root)

    expect(ghost?.style.getPropertyValue('rotate')).toBe('none')
    host.destroy()
    root.remove()
  })

  it('recreates only when the author subtree structure changes', () => {
    const root = document.createElement('main')
    const source = document.createElement('article')
    source.textContent = 'before'
    root.appendChild(source)
    document.body.appendChild(root)

    const host = new HtmlMotionPresentationHost(root, () => source)
    const frame = createReparentFrame(createPose(0))
    host.commit(frame, () => 'revision-1')
    const firstGhost = findTestGhost(root)

    source.replaceChildren(document.createElement('span'))
    host.prepareNaturalCapture()
    host.commit(frame, () => 'revision-2')
    const secondGhost = findTestGhost(root)

    expect(secondGhost).not.toBe(firstGhost)
    expect(findTestOverlayLayer(root)?.children).toHaveLength(1)
    host.destroy()
    root.remove()
  })

  it('reconciles reused ghost order and clears stale hidden descendant markers', () => {
    const root = document.createElement('main')
    const parent = document.createElement('section')
    parent.dataset.itemId = 'parent'
    const child = document.createElement('article')
    child.dataset.itemId = 'child'
    child.textContent = 'child'
    parent.appendChild(child)
    root.appendChild(parent)
    document.body.appendChild(root)

    const handles = new Map([
      ['parent', parent],
      ['child', child],
    ])
    const host = new HtmlMotionPresentationHost(root, (itemId) => handles.get(itemId))

    host.commit(createFrame([createItem('child')]))
    host.prepareNaturalCapture()
    host.commit(createFrame([
      createItem('child', 'parent'),
      createItem('parent'),
    ]))

    const layer = findTestOverlayLayer(root)
    expect(layer).not.toBeNull()
    expect(layer!.children).toHaveLength(2)
    const parentGhost = layer!.children[0] as HTMLElement
    expect(parentGhost.querySelector<HTMLElement>('[data-item-id="child"]')?.parentElement).toBe(parentGhost)
    expect(parentGhost.querySelector<HTMLElement>('[data-item-id="child"]')?.style.visibility).toBe('hidden')

    host.prepareNaturalCapture()
    host.commit(createFrame([createItem('parent')]))

    expect((findTestOverlayLayer(root)?.children[0] as HTMLElement | undefined)
      ?.querySelector<HTMLElement>('[data-item-id="child"]')?.style.visibility).toBe('')
    host.destroy()
    root.remove()
  })

  it('orders an overlay after every selected ancestor across unpresented intermediaries', () => {
    const root = document.createElement('main')
    const parent = document.createElement('section')
    const intermediary = document.createElement('div')
    const child = document.createElement('article')
    parent.appendChild(intermediary)
    intermediary.appendChild(child)
    root.appendChild(parent)
    document.body.appendChild(root)

    const handles = new Map([
      ['parent', parent],
      ['child', child],
    ])
    const host = new HtmlMotionPresentationHost(root, (itemId) => handles.get(itemId))
    host.commit(
      createFrame([
        createItem('child', 'intermediary'),
        createItem('parent'),
      ]),
      undefined,
      {
        timeMs: 0,
        revision: 'layout',
        rootPose: createMotionRootPose(),
        items: new Map([
          ['parent', {
            itemId: 'parent',
            targetId: 'root',
            targetOrder: 0,
            localPose: localPose(0),
            rootPose: createPose(0),
          }],
          ['intermediary', {
            itemId: 'intermediary',
            parentItemId: 'parent',
            targetId: 'parent-content',
            targetOrder: 0,
            localPose: localPose(0),
            rootPose: createPose(0),
          }],
          ['child', {
            itemId: 'child',
            parentItemId: 'intermediary',
            targetId: 'intermediary-content',
            targetOrder: 0,
            localPose: localPose(0),
            rootPose: createPose(0),
          }],
        ]),
      },
    )

    const layer = findTestOverlayLayer(root)
    expect(layer?.children).toHaveLength(2)
    expect((layer?.children[0] as HTMLElement | undefined)?.tagName).toBe('SECTION')
    expect((layer?.children[1] as HTMLElement | undefined)?.tagName).toBe('ARTICLE')

    host.destroy()
    root.remove()
  })

  it('reapplies descendant masking after a natural-capture pass with the same active set', () => {
    const root = document.createElement('main')
    const parent = document.createElement('section')
    parent.dataset.itemId = 'parent'
    const child = document.createElement('article')
    child.dataset.itemId = 'child'
    child.textContent = 'child'
    parent.appendChild(child)
    root.appendChild(parent)
    document.body.appendChild(root)

    const handles = new Map([
      ['parent', parent],
      ['child', child],
    ])
    const host = new HtmlMotionPresentationHost(root, (itemId) => handles.get(itemId))
    const frame = createFrame([
      createItem('child', 'parent'),
      createItem('parent'),
    ])

    host.commit(frame)
    const parentGhost = findTestGhost(root)
    expect(parentGhost?.querySelector('[data-item-id="child"]')
      ?.getAttribute('style')).toContain('visibility: hidden')

    host.prepareNaturalCapture()
    host.commit(frame)

    expect(parentGhost?.querySelector('[data-item-id="child"]')
      ?.getAttribute('style')).toContain('visibility: hidden')
    host.destroy()
    root.remove()
  })

  it('keeps overlay parents behind children and siblings in target order', () => {
    const root = document.createElement('main')
    const parent = document.createElement('section')
    const first = document.createElement('article')
    const second = document.createElement('article')
    parent.id = 'parent'
    first.id = 'first'
    second.id = 'second'
    parent.append(first, second)
    root.appendChild(parent)
    document.body.appendChild(root)

    const handles = new Map([
      ['parent', parent],
      ['first', first],
      ['second', second],
    ])
    const host = new HtmlMotionPresentationHost(root, (itemId) => handles.get(itemId))
    host.commit(
      createFrame([
        createItem('second', 'parent', 1),
        createItem('parent'),
        createItem('first', 'parent', 0),
      ]),
      undefined,
      {
        timeMs: 0,
        revision: 'layout',
        rootPose: createMotionRootPose(),
        items: new Map([
          ['parent', {
            itemId: 'parent',
            targetId: 'root',
            targetOrder: 0,
            localPose: localPose(0),
            rootPose: createPose(0),
          }],
          ['first', {
            itemId: 'first',
            parentItemId: 'parent',
            targetId: 'parent:content',
            targetOrder: 0,
            localPose: localPose(0),
            rootPose: createPose(0),
          }],
          ['second', {
            itemId: 'second',
            parentItemId: 'parent',
            targetId: 'parent:content',
            targetOrder: 1,
            localPose: localPose(0),
            rootPose: createPose(0),
          }],
        ]),
      },
    )

    const layer = findTestOverlayLayer(root)
    expect([...layer!.children].map((node) => node.id))
      .toEqual(['parent', 'first', 'second'])

    host.destroy()
    root.remove()
  })

  it('keeps a mover above both endpoints but below unrelated overlays above its target', () => {
    const root = document.createElement('main')
    const sourceParent = document.createElement('section')
    const targetParent = document.createElement('section')
    const aboveTarget = document.createElement('section')
    const moving = document.createElement('article')
    sourceParent.id = 'source-parent'
    targetParent.id = 'target-parent'
    aboveTarget.id = 'above-target'
    moving.id = 'moving'
    sourceParent.appendChild(moving)
    root.append(sourceParent, targetParent, aboveTarget)
    document.body.appendChild(root)

    const handles = new Map([
      ['source-parent', sourceParent],
      ['target-parent', targetParent],
      ['above-target', aboveTarget],
      ['moving', moving],
    ])
    const host = new HtmlMotionPresentationHost(root, (itemId) => handles.get(itemId))
    host.commit(
      createFrame([
        {
          ...createItem('moving', 'source-parent'),
          overlayStacking: {
            sourceParentItemId: 'source-parent',
            targetParentItemId: 'target-parent',
            sourceAncestorItemIds: ['source-parent'],
            targetAncestorItemIds: ['target-parent'],
            targetId: 'target-parent:content',
            targetOrder: 0,
          },
        },
        createItem('above-target', undefined, 2),
        createItem('target-parent', undefined, 1),
        createItem('source-parent', undefined, 0),
      ]),
      undefined,
      {
        timeMs: 0,
        revision: 'layout',
        rootPose: createMotionRootPose(),
        items: new Map([
          ['source-parent', {
            itemId: 'source-parent',
            targetId: 'root',
            targetOrder: 0,
            localPose: localPose(0),
            rootPose: createPose(0),
          }],
          ['target-parent', {
            itemId: 'target-parent',
            targetId: 'root',
            targetOrder: 1,
            localPose: localPose(0),
            rootPose: createPose(0),
          }],
          ['above-target', {
            itemId: 'above-target',
            targetId: 'root',
            targetOrder: 2,
            localPose: localPose(0),
            rootPose: createPose(0),
          }],
          ['moving', {
            itemId: 'moving',
            parentItemId: 'source-parent',
            targetId: 'source-parent:content',
            targetOrder: 0,
            localPose: localPose(0),
            rootPose: createPose(0),
          }],
        ]),
      },
    )

    const layer = findTestOverlayLayer(root)
    expect([...layer!.children].map((node) => node.id))
      .toEqual(['source-parent', 'target-parent', 'moving', 'above-target'])

    host.destroy()
    root.remove()
  })

  it('keeps a local descendant inside its reparented ancestor ghost', () => {
    const root = document.createElement('main')
    const parent = document.createElement('section')
    const child = document.createElement('article')
    parent.appendChild(child)
    root.appendChild(parent)
    document.body.appendChild(root)

    const handles = new Map([
      ['parent', parent],
      ['child', child],
    ])
    const host = new HtmlMotionPresentationHost(root, (itemId) => handles.get(itemId))
    host.commit(createFrame([
      createItem('parent'),
      { ...createItem('child', 'parent'), representation: 'local' },
    ]))

    const layer = findTestOverlayLayer(root)
    const parentGhost = layer?.children[0] as HTMLElement | undefined
    expect(layer?.children).toHaveLength(1)
    expect(parentGhost?.querySelector('article')?.style.transform).toBe('matrix(1, 0, 0, 1, 0, 0)')
    expect(child.style.transform).toBe('')

    host.destroy()
    root.remove()
  })

  it('resolves a local descendant through the complete non-presented ancestor chain', () => {
    const root = document.createElement('main')
    const parent = document.createElement('section')
    const outer = document.createElement('div')
    const intermediary = document.createElement('div')
    const child = document.createElement('article')
    intermediary.appendChild(child)
    outer.appendChild(intermediary)
    parent.appendChild(outer)
    root.appendChild(parent)
    document.body.appendChild(root)

    const handles = new Map([
      ['parent', parent],
      ['child', child],
    ])
    const host = new HtmlMotionPresentationHost(root, (itemId) => handles.get(itemId))
    host.commit(
      createFrame([
        { ...createItem('parent'), pose: createPose(100) },
        {
          itemId: 'child',
          parentItemId: 'intermediary',
          targetId: 'intermediary-content',
          targetOrder: 0,
          pose: createPose(132),
          representation: 'local',
          progress: 0.5,
        },
      ]),
      undefined,
      {
        timeMs: 0,
        revision: 'layout',
        rootPose: createMotionRootPose(),
        items: new Map([
          ['parent', {
            itemId: 'parent',
            targetId: 'root',
            targetOrder: 0,
            localPose: localPose(0),
            rootPose: createPose(0),
          }],
          ['outer', {
            itemId: 'outer',
            parentItemId: 'parent',
            targetId: 'parent-content',
            targetOrder: 0,
            localPose: localPose(10),
            rootPose: createPose(10),
          }],
          ['intermediary', {
            itemId: 'intermediary',
            parentItemId: 'outer',
            targetId: 'outer-content',
            targetOrder: 0,
            localPose: localPose(20),
            rootPose: createPose(30),
          }],
          ['child', {
            itemId: 'child',
            parentItemId: 'intermediary',
            targetId: 'intermediary-content',
            targetOrder: 0,
            localPose: localPose(2),
            rootPose: createPose(32),
          }],
        ]),
      },
    )

    const parentGhost = findTestGhost(root)
    const childGhost = parentGhost?.querySelector<HTMLElement>('article')
    expect(childGhost?.style.getPropertyValue('transform'))
      .toBe('matrix(1, 0, 0, 1, 0, 0)')
    host.destroy()
    root.remove()
  })

  it('uses the parent-relative local pose before writing a local pose', () => {
    const root = document.createElement('main')
    const source = document.createElement('article')
    root.appendChild(source)
    document.body.appendChild(root)

    const host = new HtmlMotionPresentationHost(root, () => source)
    const pose = createPose(40)
    host.commit(
      createFrame([{ ...createItem('item'), representation: 'local', pose }]),
      undefined,
      {
        timeMs: 0,
        revision: 'layout',
        rootPose: createMotionRootPose(),
        items: new Map([[
          'item',
          {
            itemId: 'item',
            targetId: 'root',
            targetOrder: 0,
            localPose: { origin: [40, 0], layoutOrigin: [40, 0], matrix: IDENTITY, width: 20, height: 20 },
            rootPose: pose,
          },
        ]]),
      },
    )

    expect(source.style.getPropertyValue('transform'))
      .toBe('matrix(1, 0, 0, 1, 0, 0)')
    host.destroy()
    root.remove()
  })

  it('subtracts the untransformed layout slot when the authored pose has a transform', () => {
    const root = document.createElement('main')
    const source = document.createElement('article')
    root.appendChild(source)
    document.body.appendChild(root)

    const host = new HtmlMotionPresentationHost(root, () => source)
    const pose = createPose(40)
    host.commit(
      createFrame([{ ...createItem('item'), representation: 'local', pose }]),
      undefined,
      {
        timeMs: 0,
        revision: 'layout-with-transform',
        rootPose: createMotionRootPose(),
        items: new Map([[
          'item',
          {
            itemId: 'item',
            targetId: 'root',
            targetOrder: 0,
            localPose: {
              origin: [40, 0],
              layoutOrigin: [0, 0],
              matrix: IDENTITY,
              width: 20,
              height: 20,
            },
            rootPose: pose,
          },
        ]]),
      },
    )

    expect(source.style.getPropertyValue('transform'))
      .toBe('matrix(1, 0, 0, 1, 40, 0)')
    host.destroy()
    root.remove()
  })
})

/** Creates the smallest reparent frame accepted by the HTML presentation host. */
function createReparentFrame(pose: HtmlPose): PresentationFrame {
  return {
    timeMs: 0,
    graphRevision: 'graph',
    layoutRevision: 'layout',
    items: new Map([[
      'item',
      {
        itemId: 'item',
        targetId: 'root',
        targetOrder: 0,
        pose,
        representation: 'reparent',
        progress: 0.5,
      },
    ]]),
  }
}

/** Creates one compact presentation frame in caller-defined map order. */
function createFrame(items: readonly ItemPresentation[]): PresentationFrame {
  return {
    timeMs: 0,
    graphRevision: 'graph',
    layoutRevision: 'layout',
    items: new Map(items.map((item) => [item.itemId, item])),
  }
}

/** Creates one reparented item for host lifecycle assertions. */
function createItem(itemId: string, parentItemId?: string, targetOrder = 0): ItemPresentation {
  return {
    itemId,
    parentItemId,
    targetId: parentItemId === undefined ? 'root' : `${parentItemId}:content`,
    targetOrder,
    pose: createPose(0),
    representation: 'reparent',
    progress: 0.5,
  }
}

/** Creates one deterministic pose for a jsdom presentation test. */
function createPose(x: number): HtmlPose {
  return {
    rect: { left: x, top: 0, width: 20, height: 20 },
    origin: { x, y: 0 },
    matrix: IDENTITY,
    parentMatrix: IDENTITY,
    rotationMatrix: IDENTITY,
    scaleX: 1,
    scaleY: 1,
    localWidth: 20,
    localHeight: 20,
    frameWidth: 20,
    frameHeight: 20,
  }
}

/** Creates one translation-only local pose for nested-parent assertions. */
function localPose(x: number): { origin: readonly [number, number]; layoutOrigin: readonly [number, number]; matrix: HtmlMatrix; width: number; height: number } {
  return { origin: [x, 0], layoutOrigin: [x, 0], matrix: IDENTITY, width: 20, height: 20 }
}
