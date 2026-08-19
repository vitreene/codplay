import { describe, expect, it } from 'vitest'
import { MOUNT_PLACEMENT_PARENT } from '../../../src/runtime/player'
import { LayoutDomBackend, buildSolvedGraph } from '../../../src/runtime/player'
import type { SolvedPerso, SolvedScene } from '../../../src/runtime/player'

type TestNode = {
  children: unknown[]
  parentNode: TestNode | null
}

function node(): TestNode {
  return { children: [], parentNode: null }
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

describe('LayoutDomBackend', () => {
  it('mounts, reorders and detaches nodes for outlet targets', () => {
    const root = node()
    const outlet = node()
    const first = node()
    const second = node()
    const backend = new LayoutDomBackend()
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

    backend.project(scene([
      perso('main:first', outletTarget),
      perso('main:second', outletTarget),
    ], { outlet: ['main:first', 'main:second'] }), nodes)
    expect(outlet.children).toEqual([first, second])

    backend.project(scene([
      perso('main:first', rootTarget),
      perso('main:second', outletTarget),
    ], { root: ['main:first'], outlet: ['main:second'] }), nodes)
    expect(root.children).toEqual([first])
    expect(outlet.children).toEqual([second])

    backend.project(scene([
      perso('main:first', rootTarget),
      perso('main:second', outletTarget, undefined, false),
    ], { root: ['main:first'] }), nodes)
    expect(second.parentNode).toBeNull()
  })

  it('resolves a perso target through the solved parent key', () => {
    const parent = node()
    const child = node()
    const parentTarget = { id: 'parent', kind: 'perso' as const }
    const backend = new LayoutDomBackend()

    backend.project(scene([
      perso('main:parent', { id: 'root', kind: 'root' }),
      perso('main:child', parentTarget, 'main:parent'),
    ], { root: ['main:parent'], parent: ['main:child'] }), {
      persoNodes: new Map([
        ['main:parent', parent],
        ['main:child', child],
      ]),
      targetNodes: new Map([['root', node()]]),
    })

    expect(parent.children).toEqual([child])
  })

  it('synchronizes authored state before structural writes', () => {
    const root = node()
    const child = node()
    const backend = new LayoutDomBackend({
      persoNodes: new Map([['main:child', child]]),
      targetNodes: new Map([['root', root]]),
    })
    const order: string[] = []

    backend.project(scene([
      perso('main:child', { id: 'root', kind: 'root' }),
    ], { root: ['main:child'] }), {
      moveDeltas: [],
      authoredSync: () => order.push('authored'),
    })
    order.push(child.parentNode === root ? 'structural' : 'missing')

    expect(order).toEqual(['authored', 'structural'])
  })

  it('uses module-owned child order for the structural commit', () => {
    const root = node()
    const first = node()
    const second = node()
    const backend = new LayoutDomBackend({
      persoNodes: new Map([
        ['main:first', first],
        ['main:second', second],
      ]),
      targetNodes: new Map([['list', root]]),
    })

    backend.project(scene([
      perso('main:first', { id: 'list', kind: 'root' }),
      perso('main:second', { id: 'list', kind: 'root' }),
    ], { list: ['main:first', 'main:second'] }), {
      moveDeltas: [],
      layoutState: { childrenByTarget: { list: ['main:second', 'main:first'] } },
    })

    expect(root.children).toEqual([second, first])
  })
})
