import { describe, expect, it } from 'vitest'
import { preparePath } from '../../../src/ace'
import {
  buildMotionGraph,
  composeMotionPose,
  createMotionRootPose,
  resolvePresentationFrame,
  type LayoutItemSnapshot,
  type LayoutSnapshot,
  type MotionBoundary,
  type MotionIntent,
  type RelativeMotionPose,
} from '../../../src/runtime/motion'

const IDENTITY_MATRIX = Object.freeze({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })

/** Defines one item in the synthetic logical layout used by graph tests. */
type ItemDefinition = Readonly<{
  id: string
  parentId?: string
  targetId: string
  x: number
  y?: number
}>

describe('motion graph', () => {
  it('resolves one reparented item between independently moving source and destination parents', () => {
    const initial = snapshot(0, [
      item('Q', 'root', 0),
      item('K', 'root', 300),
      item('C', 'Q:content', 10, 'Q'),
    ])
    const afterParentMove = snapshot(0, [
      item('Q', 'root', 100),
      item('K', 'root', 300),
      item('C', 'Q:content', 10, 'Q'),
    ])
    const beforeTransfer = snapshot(500, [
      item('Q', 'root', 100),
      item('K', 'root', 300),
      item('C', 'Q:content', 10, 'Q'),
    ])
    const afterTransfer = snapshot(500, [
      item('Q', 'root', 100),
      item('K', 'root', 200),
      item('C', 'K:content', 20, 'K'),
    ])
    const graph = buildMotionGraph([
      boundary('parent-source', 0, initial, afterParentMove, [intent('Q', 0, 1000)]),
      boundary('transfer', 500, beforeTransfer, afterTransfer, [
        intent('K', 500, 1000),
        intent('C', 500, 1000),
      ]),
    ])

    expect(originX(resolvePresentationFrame(graph, afterTransfer, 500), 'C')).toBeCloseTo(60)
    expect(resolvePresentationFrame(graph, afterTransfer, 750).items.get('C')?.representation).toBe('reparent')
    expect(originX(resolvePresentationFrame(graph, afterTransfer, 1000), 'Q')).toBeCloseTo(100)
    expect(originX(resolvePresentationFrame(graph, afterTransfer, 1000), 'K')).toBeCloseTo(250)
    expect(originX(resolvePresentationFrame(graph, afterTransfer, 1000), 'C')).toBeCloseTo(190)
    expect(originX(resolvePresentationFrame(graph, afterTransfer, 1500), 'C')).toBeCloseTo(220)
  })

  it('composes a reparented child against the destination ancestor current pose', () => {
    const beforeParent = snapshot(100, [
      item('C', 'root', 0),
      item('D', 'root', 300),
      item('K', 'D:content', 10, 'D'),
    ])
    const afterParent = snapshot(9100, [
      item('C', 'root', 100),
      item('D', 'root', 300),
      item('K', 'D:content', 10, 'D'),
    ])
    const beforeReparent = snapshot(100, [
      item('C', 'root', 0),
      item('D', 'root', 300),
      item('K', 'D:content', 10, 'D'),
    ])
    const afterReparent = snapshot(100, [
      item('C', 'root', 0),
      item('D', 'root', 300),
      item('K', 'C:content', 10, 'C'),
    ])
    const graph = buildMotionGraph([
      boundary('destination-parent-pose', 100, beforeParent, afterParent, [{
        ...intent('C', 100, 9000),
        targetReflow: false,
      }]),
      boundary('child-reparent', 100, beforeReparent, afterReparent, [{
        ...intent('K', 100, 8000),
        targetReflow: true,
      }]),
    ])

    const frame = resolvePresentationFrame(graph, afterReparent, 8100)

    expect(graph.tracksByItem.has('C')).toBe(true)
    expect(graph.tracksByItem.has('K')).toBe(true)
    expect(originX(frame, 'C')).toBeCloseTo(88.888, 2)
    // K ends against C's interpolated pose, not against C's FIRST pose.
    expect(originX(frame, 'K')).toBeCloseTo(98.888, 2)
  })

  it('holds an action pose during its delay and resolves it from the same graph', () => {
    const before = snapshot(0, [item('A', 'root', 0)])
    const after = snapshot(0, [item('A', 'root', 100)])
    const graph = buildMotionGraph([
      boundary('delayed-action', 0, before, after, [{
        ...intent('A', 0, 1000),
        delay: 200,
      }]),
    ])

    expect(originX(resolvePresentationFrame(graph, after, 100), 'A')).toBeCloseTo(0)
    expect(originX(resolvePresentationFrame(graph, after, 700), 'A')).toBeCloseTo(50)
    expect(originX(resolvePresentationFrame(graph, after, 1200), 'A')).toBeCloseTo(100)
    expect(graph.tracksByItem.get('A')?.segments[0]?.endAt).toBe(1200)
  })

  it('keeps unchanged descendants out of the presentation frame', () => {
    const before = snapshot(0, nestedDefinitions(0))
    const after = snapshot(0, nestedDefinitions(100))
    const graph = buildMotionGraph([
      boundary('deep-parent', 0, before, after, [intent('P1', 0, 1000)]),
    ])
    const frame = resolvePresentationFrame(graph, after, 500)

    expect([...graph.tracksByItem.keys()]).toEqual(['P1'])
    expect(originX(frame, 'P1')).toBeCloseTo(50)
    expect(frame.items.has('P5')).toBe(false)
  })

  it('keeps an independently animated context ancestor out of the FLIP tracks', () => {
    const before = snapshot(100, [
      item('C', 'root', 0),
      item('D', 'root', 300),
      item('M', 'C:content', 10, 'C'),
    ])
    const after = snapshot(100, [
      item('C', 'root', 100),
      item('D', 'root', 300),
      item('M', 'D:content', 10, 'D'),
    ])
    const graph = buildMotionGraph([
      boundary('move-child', 100, before, after, [intent('M', 100, 1000)]),
    ])

    expect([...graph.tracksByItem.keys()]).toEqual(['M'])
    const frame = resolvePresentationFrame(graph, after, 500)
    expect(frame.items.has('C')).toBe(false)
    expect(frame.items.get('M')?.representation).toBe('reparent')
  })

  it('prepares only the affected branch for frame resolution', () => {
    const before = snapshot(0, [
      item('A', 'root', 0),
      item('A-child', 'A:content', 10, 'A'),
      item('unrelated', 'other', 500),
    ])
    const after = snapshot(0, [
      item('A', 'root', 100),
      item('A-child', 'A:content', 10, 'A'),
      item('unrelated', 'other', 500),
    ])
    const graph = buildMotionGraph([
      boundary('branch', 0, before, after, [intent('A', 0, 1000)]),
    ])

    expect(graph.presentationItemIds).toEqual(['A'])
    expect(resolvePresentationFrame(graph, after, 500).items.has('unrelated')).toBe(false)
  })

  it('retargets from the already resolved pose when a second boundary overlaps the first', () => {
    const beforeFirst = snapshot(0, [item('A', 'root', 0), item('B', 'root', 0)])
    const afterFirst = snapshot(0, [item('A', 'root', 100), item('B', 'root', 0)])
    const beforeSecond = snapshot(500, [item('A', 'root', 100), item('B', 'root', 0)])
    const afterSecond = snapshot(500, [item('A', 'root', 200), item('B', 'root', 100)])
    const graph = buildMotionGraph([
      boundary('first', 0, beforeFirst, afterFirst, [intent('A', 0, 1000)]),
      boundary('second', 500, beforeSecond, afterSecond, [intent('B', 500, 1000)]),
    ])

    expect(originX(resolvePresentationFrame(graph, afterFirst, 499), 'A')).toBeCloseTo(49.9)
    expect(originX(resolvePresentationFrame(graph, afterSecond, 500), 'A')).toBeCloseTo(50)
    expect(originX(resolvePresentationFrame(graph, afterSecond, 750), 'A')).toBeCloseTo(125)
    expect(originX(resolvePresentationFrame(graph, afterSecond, 1500), 'A')).toBeCloseTo(200)
    expect(graph.tracksByItem.get('A')?.segments).toHaveLength(1)
  })

  it('retargets a curved direct path without a positional jump at a sibling boundary', () => {
    const beforeFirst = snapshot(0, [item('A', 'root', 0), item('B', 'root', 0)])
    const afterFirst = snapshot(0, [item('A', 'root', 100), item('B', 'root', 0)])
    const beforeSecond = snapshot(500, [item('A', 'root', 100), item('B', 'root', 0)])
    const afterSecond = snapshot(500, [item('A', 'root', 200), item('B', 'root', 100)])
    const graph = buildMotionGraph([
      boundary('curved-first', 0, beforeFirst, afterFirst, [{
        ...intent('A', 0, 1000),
        path: preparePath({ control: [0.5, 1] }),
      }]),
      boundary('curved-second', 500, beforeSecond, afterSecond, [intent('B', 500, 1000)]),
    ])

    const beforeBoundary = resolvePresentationFrame(graph, afterFirst, 499.999)
    const atBoundary = resolvePresentationFrame(graph, afterSecond, 500)
    const beforeRect = beforeBoundary.items.get('A')?.pose.rect
    const boundaryRect = atBoundary.items.get('A')?.pose.rect
    if (beforeRect === undefined || boundaryRect === undefined) throw new Error('Curved retarget test item is missing.')

    expect(boundaryRect.left).toBeCloseTo(beforeRect.left, 3)
    expect(boundaryRect.top).toBeCloseTo(beforeRect.top, 3)
    expect(graph.tracksByItem.get('A')?.segments).toHaveLength(1)
    expect(graph.tracksByItem.get('A')?.segments[0]?.path).toBeDefined()
  })

  it('returns the same absolute frame independently of evaluation history', () => {
    const before = snapshot(0, [item('A', 'root', 0)])
    const after = snapshot(0, [item('A', 'root', 100)])
    const graph = buildMotionGraph([
      boundary('absolute', 0, before, after, [intent('A', 0, 1000)]),
    ])

    const directSeek = resolvePresentationFrame(graph, after, 820)
    resolvePresentationFrame(graph, after, 100)
    resolvePresentationFrame(graph, after, 700)
    const playLikeEvaluation = resolvePresentationFrame(graph, after, 820)

    expect(playLikeEvaluation).toEqual(directSeek)
  })

  it('changes graph revision when geometry changes at otherwise identical boundaries', () => {
    const before = snapshot(0, [item('A', 'root', 0)])
    const firstAfter = snapshot(0, [item('A', 'root', 100)])
    const secondAfter = snapshot(0, [item('A', 'root', 200)])
    const firstGraph = buildMotionGraph([
      boundary('geometry', 0, before, firstAfter, [intent('A', 0, 1000)]),
    ])
    const secondGraph = buildMotionGraph([
      boundary('geometry', 0, before, secondAfter, [intent('A', 0, 1000)]),
    ])

    expect(secondGraph.revision).not.toBe(firstGraph.revision)
  })

  it('keeps same-target reflow local and honors an explicit overlay presentation', () => {
    const before = snapshot(0, [item('A', 'list', 0), item('B', 'list', 20)])
    const after = snapshot(0, [item('A', 'list', 20), item('B', 'list', 0)])
    const localGraph = buildMotionGraph([
      boundary('local-list', 0, before, after, [intent('A', 0, 1000)]),
    ])
    const overlayGraph = buildMotionGraph([
      boundary('forced-overlay', 0, before, after, [{
        ...intent('A', 0, 1000),
        presentationMode: 'reparent',
      }]),
    ])

    expect(resolvePresentationFrame(localGraph, after, 500).items.get('A')?.representation).toBe('local')
    expect(resolvePresentationFrame(localGraph, after, 500).items.get('B')?.representation).toBe('local')
    expect(resolvePresentationFrame(overlayGraph, after, 500).items.get('A')?.representation).toBe('reparent')
  })
})

/** Creates one synthetic layout snapshot and derives all root poses recursively. */
function snapshot(timeMs: number, definitions: readonly ItemDefinition[]): LayoutSnapshot {
  const byId = new Map(definitions.map((definition) => [definition.id, definition]))
  const items = new Map<string, LayoutItemSnapshot>()
  const visiting = new Set<string>()
  for (const definition of definitions) resolve(definition.id)
  return Object.freeze({ timeMs, revision: JSON.stringify(definitions), items })

  function resolve(id: string): LayoutItemSnapshot {
    const existing = items.get(id)
    if (existing !== undefined) return existing
    if (visiting.has(id)) throw new Error(`Synthetic layout cycle: ${id}`)
    const definition = byId.get(id)
    if (definition === undefined) throw new Error(`Synthetic layout item is missing: ${id}`)
    visiting.add(id)
    const localPose = relativePose(definition.x, definition.y ?? 0)
    const parentPose = definition.parentId === undefined
      ? createMotionRootPose()
      : resolve(definition.parentId).rootPose
    const resolved = Object.freeze({
      itemId: id,
      ...(definition.parentId === undefined ? {} : { parentItemId: definition.parentId }),
      targetId: definition.targetId,
      localPose,
      rootPose: composeMotionPose(parentPose, localPose),
    })
    items.set(id, resolved)
    visiting.delete(id)
    return resolved
  }
}

/** Creates one synthetic translation-only local pose. */
function relativePose(x: number, y: number): RelativeMotionPose {
  return Object.freeze({ origin: [x, y] as const, matrix: IDENTITY_MATRIX, width: 10, height: 10 })
}

/** Creates one direct intent using a linear easing for exact assertions. */
function intent(itemId: string, startAt: number, duration: number, delay = 0): MotionIntent {
  return Object.freeze({ id: `${itemId}:${startAt}`, itemId, startAt, duration, delay, ease: 'linear', presentationMode: 'local' })
}

/** Creates one immutable synthetic event boundary. */
function boundary(
  id: string,
  timeMs: number,
  before: LayoutSnapshot,
  after: LayoutSnapshot,
  intents: readonly MotionIntent[],
): MotionBoundary {
  return Object.freeze({ id, timeMs, before, after, intents: Object.freeze([...intents]) })
}

/** Creates one concise synthetic item definition. */
function item(id: string, targetId: string, x: number, parentId?: string): ItemDefinition {
  return Object.freeze({ id, targetId, x, ...(parentId === undefined ? {} : { parentId }) })
}

/** Creates a five-level hierarchy whose root is the only moving attachment. */
function nestedDefinitions(rootX: number): readonly ItemDefinition[] {
  return [
    item('P1', 'root', rootX),
    item('P2', 'P1:content', 10, 'P1'),
    item('P3', 'P2:content', 10, 'P2'),
    item('P4', 'P3:content', 10, 'P3'),
    item('P5', 'P4:content', 10, 'P4'),
  ]
}

/** Reads one resolved root origin for an assertion. */
function originX(frame: ReturnType<typeof resolvePresentationFrame>, itemId: string): number {
  const itemPresentation = frame.items.get(itemId)
  if (itemPresentation === undefined) throw new Error(`Presentation item is missing: ${itemId}`)
  return itemPresentation.pose.origin.x
}
