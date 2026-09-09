/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { SceneBuilder } from '../../src/scene/compiled'
import { RuntimeEngine } from '../../src/runtime/engine'
import { createCoreRuntimeCatalog } from '../../src/runtime/catalog'
import { HtmlPlayerRunner } from '../../src/runtime/runner-html'
import {
  CAROUSEL_EVENTS_BY_STORY_ID,
} from '../../../demos/src/v2/demos/position/carousel'
import {
  POSITION_STORY_FIVE_ID,
  POSITION_VIEW_FIVE_INITIALIZE_EVENT,
} from '../../../demos/src/v2/demos/position/constants'
import { createScene } from '../../../demos/src/v2/demos/position/main'

describe('story five first move', () => {
  let runner: HtmlPlayerRunner | undefined

  afterEach(() => {
    runner?.destroy()
    runner = undefined
    document.body.replaceChildren()
  })

  it('captures the first K-to-Q move on the first play path', async () => {
    const root = document.createElement('main')
    document.body.append(root)
    const catalog = createCoreRuntimeCatalog()
    const build = new SceneBuilder(catalog.validationSnapshot()).build(createScene())
    expect(build.ok).toBe(true)
    if (!build.ok) return

    runner = new HtmlPlayerRunner({
      id: 'story-five-first-move-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
      catalog,
      engine: new RuntimeEngine(catalog),
    })
    expect(runner.init().ok).toBe(true)
    runner.advance(0)
    await runner.player.emitEventime(
      {
        name: CAROUSEL_EVENTS_BY_STORY_ID[POSITION_STORY_FIVE_ID].enter,
        visibility: 'story',
      },
      { scope: 'story', storyId: POSITION_STORY_FIVE_ID },
    )
    await runner.player.emitEventime(
      { name: POSITION_VIEW_FIVE_INITIALIZE_EVENT, visibility: 'story' },
      { scope: 'story', storyId: POSITION_STORY_FIVE_ID },
    )
    runner.play()
    runner.advance(2_450)

    const itemId = `${POSITION_STORY_FIVE_ID}:position-view-five-item`
    const sourceId = `${POSITION_STORY_FIVE_ID}:position-view-five-source-container`
    const targetId = `${POSITION_STORY_FIVE_ID}:position-view-five-target-container`
    const boundaries = (runner as unknown as {
      presentationMotionBoundaries: readonly Readonly<{
        intents: readonly Readonly<{ itemId: string }>[]
        before: { items: ReadonlyMap<string, unknown> }
        afterStart?: { items: ReadonlyMap<string, unknown> }
        after: { items: ReadonlyMap<string, unknown> }
      }>[]
    }).presentationMotionBoundaries
    const boundary = boundaries.find((candidate) => candidate.intents.some((intent) => intent.itemId === itemId))
    const motionSystem = (runner as unknown as {
      motionSystem?: {
        graph?: {
          tracksByItem: ReadonlyMap<string, {
            segments: readonly Readonly<{
              from: { targetId: string; parentItemId?: string; localPose: { origin: readonly [number, number] }; fallbackRootPose: { origin: readonly [number, number] } }
              to: { targetId: string; parentItemId?: string; localPose: { origin: readonly [number, number] }; fallbackRootPose: { origin: readonly [number, number] } }
              startAt: number
              endAt: number
              presentationMode: string
              retargets?: readonly unknown[]
            }>[]
          }>
        }
      }
    }).motionSystem
    const segment = motionSystem?.graph?.tracksByItem.get(itemId)?.segments.at(-1)

    expect(boundary).toBeDefined()
    expect(boundary?.before.items.has(itemId)).toBe(true)
    expect(boundary?.before.items.has(sourceId)).toBe(true)
    expect(boundary?.before.items.has(targetId)).toBe(true)
    expect(boundary?.afterStart?.items.has(targetId)).toBe(true)
    expect(boundary?.after.items.has(targetId)).toBe(true)
    expect(segment?.startAt).toBe(2_450)
    expect(segment?.endAt).toBe(4_450)
    expect(segment?.presentationMode).toBe('reparent')
    expect(segment?.from.targetId).toBe('position:view-five:k')
    expect(segment?.to.targetId).toBe('position:view-five:q')
    expect(segment?.from.parentItemId).toBe(sourceId)
    expect(segment?.to.parentItemId).toBe(targetId)
    expect(segment?.retargets ?? []).toHaveLength(0)
  })
})
