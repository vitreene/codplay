import { describe, expect, it } from 'vitest'
import { MOUNT_PLACEMENT_PARENT } from '../../../src/runtime/player'
import { buildSolvedGraph } from '../../../src/runtime/player'
import { HtmlComponentMaterializer } from '../../../src/runtime/runner-html'
import { HTML_TRANSIENT_NODE_ATTRIBUTE } from '../../../src/runtime/runner-html/transient-node'
import type { SolvedPerso, SolvedScene } from '../../../src/runtime/player'

type TestNode = {
  children: unknown[]
  parentNode: TestNode | null
  getAttribute: (name: string) => string | null
  setAttribute: (name: string, value: string) => void
  removeAttribute: (name: string) => void
}

function node(): TestNode {
  const attributes = new Map<string, string>()
  return {
    children: [],
    parentNode: null,
    getAttribute: (name) => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: (name) => attributes.delete(name),
  }
}

function perso(
  key: string,
  target: { id: string; kind: 'root' | 'outlet' | 'perso' },
  parentKey?: string,
  mounted = true,
): SolvedPerso {
  return {
    key,
    storyId: 'main',
    persoId: key.replace('main:', ''),
    type: 'tag',
    state: {},
    moveIssues: [],
    placement: {
      kind: MOUNT_PLACEMENT_PARENT,
      mounted,
      targetId: target.id,
      target,
      parentKey,
    },
  }
}

function scene(
  persos: readonly SolvedPerso[],
  childrenByTarget: Readonly<Record<string, readonly string[]>>,
): SolvedScene {
  return {
    scene: {} as SolvedScene['scene'],
    timeMs: 0,
    sceneState: {},
    storyStates: {},
    persos: Object.fromEntries(persos.map((item) => [item.key, item])),
    graph: { ...buildSolvedGraph(Object.fromEntries(persos.map((item) => [item.key, item]))), childrenByTarget },
    moveIssues: [],
  }
}

describe('HtmlComponentMaterializer scene materialization', () => {
  it('mounts, reorders and detaches nodes for outlet targets', () => {
    const root = node()
    const outlet = node()
    const first = node()
    const second = node()
    const outletTarget = { id: 'outlet', kind: 'outlet' as const }
    const rootTarget = { id: 'root', kind: 'root' as const }
    const nodes = {
      persoNodes: new Map([
        ['main:first', first],
        ['main:second', second],
      ]),
      targetNodes: new Map([
        ['root', root],
        ['outlet', outlet],
      ]),
    }
    const materializer = new HtmlComponentMaterializer(nodes)

    materializer.materializeScene(scene([
      perso('main:first', outletTarget),
      perso('main:second', outletTarget),
    ], { outlet: ['main:first', 'main:second'] }))
    expect(outlet.children).toEqual([first, second])

    materializer.materializeScene(scene([
      perso('main:first', rootTarget),
      perso('main:second', outletTarget),
    ], { root: ['main:first'], outlet: ['main:second'] }))
    expect(root.children).toEqual([first])
    expect(outlet.children).toEqual([second])

    materializer.materializeScene(scene([
      perso('main:first', rootTarget),
      perso('main:second', outletTarget, undefined, false),
    ], { root: ['main:first'] }))
    expect(second.parentNode).toBeNull()
  })

  it('resolves a perso target through the solved parent key', () => {
    const parent = node()
    const child = node()
    const parentTarget = { id: 'parent', kind: 'perso' as const }
    const materializer = new HtmlComponentMaterializer({
      persoNodes: new Map([
        ['main:parent', parent],
        ['main:child', child],
      ]),
      targetNodes: new Map([['root', node()]]),
    })

    materializer.materializeScene(scene([
      perso('main:parent', { id: 'root', kind: 'root' }),
      perso('main:child', parentTarget, 'main:parent'),
    ], { root: ['main:parent'], parent: ['main:child'] }))

    expect(parent.children).toEqual([child])
  })

  it('uses the solved structural order for the commit', () => {
    const root = node()
    const first = node()
    const second = node()
    const materializer = new HtmlComponentMaterializer({
      persoNodes: new Map([
        ['main:first', first],
        ['main:second', second],
      ]),
      targetNodes: new Map([['list', root]]),
    })

    materializer.materializeScene(scene([
      perso('main:first', { id: 'list', kind: 'root' }),
      perso('main:second', { id: 'list', kind: 'root' }),
    ], { list: ['main:second', 'main:first'] }), {
      moveDeltas: [],
    })

    expect(root.children).toEqual([second, first])
  })

  it('preserves transient preview roots across repeated frame materialization', () => {
    const root = node()
    const body = node()
    const first = node()
    const dragged = node()
    const third = node()
    const ghost = node()
    root.children = [first, ghost, third]
    first.parentNode = root
    ghost.parentNode = root
    third.parentNode = root
    body.children = [dragged]
    dragged.parentNode = body
    dragged.setAttribute(HTML_TRANSIENT_NODE_ATTRIBUTE, '')
    ghost.setAttribute(HTML_TRANSIENT_NODE_ATTRIBUTE, '')

    const materializer = new HtmlComponentMaterializer({
      persoNodes: new Map([
        ['main:first', first],
        ['main:dragged', dragged],
        ['main:third', third],
      ]),
      targetNodes: new Map([['root', root]]),
    })
    const activeScene = scene([
      perso('main:first', { id: 'root', kind: 'root' }),
      perso('main:dragged', { id: 'root', kind: 'root' }),
      perso('main:third', { id: 'root', kind: 'root' }),
    ], { root: ['main:first', 'main:dragged', 'main:third'] })

    materializer.materializeScene(activeScene)
    materializer.materializeScene(activeScene)

    expect(root.children).toEqual([first, ghost, third])
    expect(dragged.parentNode).toBe(body)

    dragged.removeAttribute(HTML_TRANSIENT_NODE_ATTRIBUTE)
    ghost.removeAttribute(HTML_TRANSIENT_NODE_ATTRIBUTE)
    root.children = [first, third]
    first.parentNode = root
    third.parentNode = root
    ghost.parentNode = null
    body.children = []
    dragged.parentNode = null

    materializer.invalidateStructure()
    materializer.materializeScene(activeScene)

    expect(root.children).toEqual([first, dragged, third])
    expect(dragged.parentNode).toBe(root)
  })

  it('mounts and detaches every real root of a fragment without an envelope node', () => {
    const root = node()
    const first = node()
    const second = node()
    const materializer = new HtmlComponentMaterializer({
      persoNodes: new Map([
        ['main:fragment', [first, second]],
      ]),
      targetNodes: new Map([['root', root]]),
    })

    materializer.materializeScene(scene([
      perso('main:fragment', { id: 'root', kind: 'root' }),
    ], { root: ['main:fragment'] }))

    expect(root.children).toEqual([first, second])
    expect(first.parentNode).toBe(root)
    expect(second.parentNode).toBe(root)

    materializer.materializeScene(scene([
      perso('main:fragment', { id: 'root', kind: 'root' }, undefined, false),
    ], { root: [] }))

    expect(root.children).toEqual([])
    expect(first.parentNode).toBeNull()
    expect(second.parentNode).toBeNull()
  })
})
