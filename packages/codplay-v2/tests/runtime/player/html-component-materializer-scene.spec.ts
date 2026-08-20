import { describe, expect, it } from 'vitest'
import { MOUNT_PLACEMENT_PARENT } from '../../../src/runtime/player'
import { buildSolvedGraph } from '../../../src/runtime/player'
import { HtmlComponentMaterializer } from '../../../src/runtime/runner'
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
})
