import { describe, expect, it } from 'vitest'
import { buildSolvedGraph, resolvePresentationOrder, traverseSolvedGraph } from '../../../src/runtime/player'
import type { SolvedPerso, SolvedScene } from '../../../src/runtime/player'

/** Creates one solved root, child and grandchild with distinct outlet targets. */
function hierarchy(): Readonly<Record<string, SolvedPerso>> {
  const root: SolvedPerso = {
    key: 'main:root',
    storyId: 'main',
    persoId: 'root',
    type: 'layout',
    state: {},
    placement: {
      kind: 'root',
      mounted: true,
      targetId: 'root-target',
      target: { id: 'root-target', kind: 'root', storyId: 'main' },
    },
    moveIssues: [],
  }
  const child: SolvedPerso = {
    key: 'main:child',
    storyId: 'main',
    persoId: 'child',
    type: 'layout',
    state: {},
    placement: {
      kind: 'parent',
      mounted: true,
      targetId: 'root-content',
      target: { id: 'root-content', kind: 'outlet', storyId: 'main', ownerId: 'main:root' },
    },
    moveIssues: [],
  }
  const grandchild: SolvedPerso = {
    ...child,
    key: 'main:grandchild',
    persoId: 'grandchild',
    placement: {
      ...child.placement,
      targetId: 'child-content',
      target: { id: 'child-content', kind: 'outlet', storyId: 'main', ownerId: 'main:child' },
    },
  }
  return { [root.key]: root, [child.key]: child, [grandchild.key]: grandchild }
}

/** Creates the smallest scene wrapper around a solved graph. */
function scene(persos: Readonly<Record<string, SolvedPerso>>): SolvedScene {
  return {
    scene: {} as SolvedScene['scene'],
    timeMs: 0,
    sceneState: {},
    storyStates: {},
    persos,
    graph: buildSolvedGraph(persos),
    moveIssues: [],
  }
}

describe('Solved presentation graph', () => {
  it('traverses nested outlets parent-first instead of inferring ancestry from target names', () => {
    const solved = scene(hierarchy())

    expect(solved.graph.childrenByParent).toEqual({
      'main:root': ['main:child'],
      'main:child': ['main:grandchild'],
    })
    expect(traverseSolvedGraph(solved)).toEqual([
      'main:root',
      'main:child',
      'main:grandchild',
    ])
  })

  it('rejects a module order that temporarily places an item in another target', () => {
    const solved = scene(hierarchy())

    expect(() => resolvePresentationOrder(solved, {
      'root-content': ['main:grandchild'],
    })).toThrow(/outside its solved target/)
  })
})
