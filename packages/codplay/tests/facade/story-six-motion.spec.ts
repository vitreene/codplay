/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { CodPlay, type CodPlayFrameScheduler } from '../../src'
import { SceneBuilder } from '../../src/scene/compiled'
import { RuntimeEngine } from '../../src/runtime/engine'
import { createCoreRuntimeCatalog } from '../../src/runtime/catalog'
import { HtmlPlayerRunner } from '../../src/runtime/runner-html'
import {
  CAROUSEL_EVENTS_BY_STORY_ID,
} from '../../../demos/src/v2/demos/position/carousel'
import {
  POSITION_STORY_SIX_ID,
  POSITION_VIEW_SIX_INITIALIZE_EVENT,
} from '../../../demos/src/v2/demos/position/constants'
import { createScene } from '../../../demos/src/v2/demos/position/main'

/** Creates a scheduler whose frame advancement stays under test control. */
function createManualScheduler(): CodPlayFrameScheduler {
  return {
    request: () => 1,
    cancel: () => undefined,
  }
}

describe('story six target availability', () => {
  let codplay: CodPlay | undefined

  afterEach(() => {
    codplay?.destroy()
    codplay = undefined
    document.body.replaceChildren()
  })

  it('keeps the first move when its destination is mounted only at LAST', async () => {
    const root = document.createElement('main')
    document.body.append(root)
    codplay = new CodPlay({
      frameScheduler: createManualScheduler(),
      pauseOnDocumentHidden: false,
    })
    const build = codplay.build({ scene: createScene() })
    expect(build.ok).toBe(true)
    if (!build.ok) return

    const instance = codplay.instances.create({
      instanceId: 'story-six-target-availability-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })

    codplay.engine.advance(0)
    await instance.events.emit(
      {
        name: CAROUSEL_EVENTS_BY_STORY_ID[POSITION_STORY_SIX_ID].enter,
        visibility: 'story',
      },
      { scope: 'story', storyId: POSITION_STORY_SIX_ID },
    )
    await instance.events.emit(
      { name: POSITION_VIEW_SIX_INITIALIZE_EVENT, visibility: 'story' },
      { scope: 'story', storyId: POSITION_STORY_SIX_ID },
    )
    await instance.telco.play()

    codplay.engine.advance(1_200)
    const firstMove = instance.presentation.get()?.items.find((item) => (
      item.itemId === `${POSITION_STORY_SIX_ID}:position-view-six-item-qa`
    ))
    expect(firstMove?.activeSegmentId).toBeDefined()

    codplay.engine.advance(2_075)
    const settledMove = instance.presentation.get()?.items.find((item) => (
      item.itemId === `${POSITION_STORY_SIX_ID}:position-view-six-item-qa`
    ))
    expect(settledMove?.activeSegmentId).toBeDefined()
    expect(settledMove?.progress).toBeCloseTo(1)
  })

  it('captures the late destination branch in the real runner boundary', async () => {
    const root = document.createElement('main')
    document.body.append(root)
    const catalog = createCoreRuntimeCatalog()
    const build = new SceneBuilder(catalog.validationSnapshot()).build(createScene())
    expect(build.ok).toBe(true)
    if (!build.ok) return

    const runner = new HtmlPlayerRunner({
      id: 'story-six-target-boundary-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
      catalog,
      engine: new RuntimeEngine(catalog),
    })
    try {
      expect(runner.init().ok).toBe(true)
      runner.advance(0)
      await runner.player.emitEventime(
        {
          name: CAROUSEL_EVENTS_BY_STORY_ID[POSITION_STORY_SIX_ID].enter,
          visibility: 'story',
        },
        { scope: 'story', storyId: POSITION_STORY_SIX_ID },
      )
      await runner.player.emitEventime(
        { name: POSITION_VIEW_SIX_INITIALIZE_EVENT, visibility: 'story' },
        { scope: 'story', storyId: POSITION_STORY_SIX_ID },
      )
      runner.play()
      runner.advance(1_200)

      const motionSystem = (runner as unknown as {
        motionSystem?: {
          graph?: {
            tracksByItem: ReadonlyMap<string, {
              segments: readonly Readonly<{
                from: { targetId: string; parentItemId?: string; localPose: unknown }
                to: { targetId: string; parentItemId?: string; localPose: unknown; context?: ReadonlyMap<string, unknown> }
                startAt: number
                endAt: number
                retargets?: readonly unknown[]
              }>[]
            }>
          }
        }
      }).motionSystem
      const qaSegment = motionSystem?.graph?.tracksByItem.get(`${POSITION_STORY_SIX_ID}:position-view-six-item-qa`)?.segments[0]
      expect(qaSegment).toBeDefined()
      expect(qaSegment?.from.parentItemId).toBe(`${POSITION_STORY_SIX_ID}:position-view-six-transfer-q`)
      expect(qaSegment?.to.parentItemId).toBe(`${POSITION_STORY_SIX_ID}:position-view-six-transfer-k`)
      expect(qaSegment?.to.context?.has(`${POSITION_STORY_SIX_ID}:position-view-six-transfer-k`)).toBe(true)
      expect(qaSegment?.to.context?.has(`${POSITION_STORY_SIX_ID}:position-view-six-transfer-k-frame`)).toBe(true)
      expect(qaSegment?.retargets ?? []).toHaveLength(0)

      const kFrameSegment = motionSystem?.graph?.tracksByItem.get(
        `${POSITION_STORY_SIX_ID}:position-view-six-transfer-k-frame`,
      )?.segments[0]
      expect(kFrameSegment?.startAt).toBe(2_000)
      expect(kFrameSegment?.endAt).toBe(9_275)

      const boundaries = (runner as unknown as {
        presentationMotionBoundaries: readonly Readonly<{
          intents: readonly Readonly<{ itemId: string }>[]
          before: { items: ReadonlyMap<string, unknown> }
          afterStart?: { items: ReadonlyMap<string, unknown> }
          after: { items: ReadonlyMap<string, unknown> }
        }>[]
      }).presentationMotionBoundaries
      const qa = `${POSITION_STORY_SIX_ID}:position-view-six-item-qa`
      const boundary = boundaries.find((candidate) => candidate.intents.some((intent) => intent.itemId === qa))
      expect(boundary).toBeDefined()
      expect(boundary?.before.items.has(qa)).toBe(true)
      expect(boundary?.afterStart?.items.has(qa)).toBe(false)
      expect(boundary?.afterStart?.items.has(`${POSITION_STORY_SIX_ID}:position-view-six-transfer-k`)).toBe(false)
      expect(boundary?.after.items.has(qa)).toBe(true)
      expect(boundary?.after.items.has(`${POSITION_STORY_SIX_ID}:position-view-six-transfer-k`)).toBe(true)
      expect(boundary?.after.items.has(`${POSITION_STORY_SIX_ID}:position-view-six-transfer-k-frame`)).toBe(true)
    } finally {
      runner.destroy()
    }
  })
})
