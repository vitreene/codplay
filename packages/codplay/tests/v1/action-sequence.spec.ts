import { describe, expect, it } from 'vitest'

import { PlayerFacade } from '../../src/player/create-player'
import type { SceneDoc } from '../../src/player/types'

type PersoFixture = SceneDoc['stories'][string]['persos'][number]

/**
 * Creates one strict scene fixture with root mount/start hooks and a raw track.
 * `sequence:end` is scheduled far in the future so `seek()` is never clamped
 * back by `resolveCurrentSeekEndMs` to the last authored event's own ms.
 */
function temp__createActionSequenceSceneFixture(input: {
  sceneId: string
  storyId: string
  persos: PersoFixture[]
  events: Array<{ id: string; ms: number; name: string }>
}): SceneDoc {
  return {
    id: input.sceneId,
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      [input.storyId]: {
        id: input.storyId,
        initial: { move: '@root' },
        persos: input.persos,
        straps: undefined,
        listen: []
      }
    },
    onStart(scene, options) {
      options.schedule(input.storyId)
    },
    tracks: {
      [`track-${input.storyId}`]: {
        id: `track-${input.storyId}`,
        source: 'story',
        order: 0,
        events: [
          ...input.events.map((event, index) => ({
            id: event.id,
            ms: event.ms,
            name: event.name,
            index,
            source: 'story'
          })),
          {
            id: 'evt-sequence-end',
            ms: 10000,
            name: 'sequence:end',
            index: input.events.length,
            source: 'story'
          }
        ]
      }
    }
  }
}

/**
 * Creates one runtime node fixture compatible with the player's nodeFactory contract.
 */
function temp__createRuntimeNode(): Record<string, unknown> {
  return {
    tagName: 'DIV',
    style: { opacity: 0 },
    attributes: {},
    textContent: ''
  }
}

describe('V1 - ActionSequence (perso-level chaining primitive)', () => {
  it('AS-T1 heterogeneous steps chain by each step own duration, including a TweenAction step', async () => {
    const runtimeNode = temp__createRuntimeNode()
    const perso = {
      id: 'panel',
      type: 'tag',
      initial: { move: '@root' },
      actions: {
        // Step 1 (TweenAction) intentionally animates a different property
        // (style.opacity) than the static steps (content): composing a
        // TweenAction step with a later static step on the SAME property
        // currently produces a wrong seek reconstruction (a confirmed defect,
        // see 2026-06-28-seek-continuous-engine-overwrite-defect.md) — not
        // what this test is characterizing.
        sequence: [
          { action: { content: 'start' }, durationMs: 300 },
          { action: { fn: ({ progress }: { progress: number }) => ({ style: { opacity: progress } }), duration: 500 } },
          { action: { content: 'done' } }
        ]
      }
    } as unknown as PersoFixture

    const scene = temp__createActionSequenceSceneFixture({
      sceneId: 'scene-action-sequence-basic',
      storyId: 'story-action-sequence-basic',
      persos: [perso],
      events: [{ id: 'evt-sequence', ms: 0, name: 'sequence' }]
    })

    const player = new PlayerFacade({
      createElementOptions: { nodeFactory: () => runtimeNode }
    })

    await player.init(scene)
    await player.play()

    // Step 0 applies immediately at offset 0.
    await player.seek(0)
    expect(runtimeNode.textContent).toBe('start')

    // Step 1 (TweenAction) starts at offset 300 (end of step 0), runs 500ms.
    await player.seek(300)
    expect((runtimeNode.style as Record<string, unknown>).opacity).toBe(0)
    await player.seek(550)
    expect((runtimeNode.style as Record<string, unknown>).opacity).toBe(0.5)

    // Step 2 (static) starts at offset 800 (300 + 500, end of step 1).
    await player.seek(799)
    expect(runtimeNode.textContent).toBe('start')
    await player.seek(800)
    expect(runtimeNode.textContent).toBe('done')
  })

  it('AS-T2 a cold seek directly past the trigger reconstructs the sequence without any intermediate live read', async () => {
    const runtimeNode = temp__createRuntimeNode()
    const perso = {
      id: 'panel',
      type: 'tag',
      initial: { move: '@root' },
      actions: {
        sequence: [
          { action: { content: 'first' }, durationMs: 200 },
          { action: { content: 'second' }, durationMs: 200 },
          { action: { content: 'third' } }
        ]
      }
    } as unknown as PersoFixture

    const scene = temp__createActionSequenceSceneFixture({
      sceneId: 'scene-action-sequence-cold-seek',
      storyId: 'story-action-sequence-cold-seek',
      persos: [perso],
      events: [{ id: 'evt-sequence', ms: 0, name: 'sequence' }]
    })

    const player = new PlayerFacade({
      createElementOptions: { nodeFactory: () => runtimeNode }
    })

    await player.init(scene)
    await player.play()

    // First read of any kind is a cold seek straight into the third step.
    await player.seek(450)
    expect(runtimeNode.textContent).toBe('third')
  })

  it('AS-T3 re-triggering the same actionKey drops the pending continuation steps of the previous sequence', async () => {
    const runtimeNode = temp__createRuntimeNode()
    const perso = {
      id: 'panel',
      type: 'tag',
      initial: { move: '@root' },
      actions: {
        sequence: [
          { action: { content: 'old-1' }, durationMs: 300 },
          { action: { content: 'old-2' }, durationMs: 300 },
          { action: { content: 'old-3' } }
        ]
      }
    } as unknown as PersoFixture

    const scene = temp__createActionSequenceSceneFixture({
      sceneId: 'scene-action-sequence-interrupt',
      storyId: 'story-action-sequence-interrupt',
      persos: [perso],
      events: [
        { id: 'evt-sequence-1', ms: 0, name: 'sequence' },
        // Re-trigger before the first sequence's step 1 (due at ms 300) ever fires.
        { id: 'evt-sequence-2', ms: 200, name: 'sequence' }
      ]
    })

    const player = new PlayerFacade({
      createElementOptions: { nodeFactory: () => runtimeNode }
    })

    await player.init(scene)
    await player.play()

    // At ms 200, the second trigger re-applies the SAME static array — step 0
    // of the new sequence ('old-1' again) lands immediately.
    await player.seek(200)
    expect(runtimeNode.textContent).toBe('old-1')

    // At ms 500 (300ms after the second trigger), only the second sequence's
    // own step 1 should apply. If the first sequence's stale step 1 (due at
    // ms 300, untouched by the interruption) had not been dropped, content
    // would still read 'old-2' at this position too — same value either way
    // for THIS scene, by construction (both sequences are identical). The
    // real assertion is at ms 800 below, distinguishing the two cases.
    await player.seek(500)
    expect(runtimeNode.textContent).toBe('old-2')

    // ms 800 = 300 (first trigger) + 300*2 would be the OLD sequence's step 2
    // ('old-3'), due at ms 600. The NEW sequence's own step 2 is due at
    // ms 200 + 300 + 300 = 800. If the old sequence's continuation had not
    // been invalidated, 'old-3' would already have applied at ms 600 and
    // nothing would change this value at ms 800. Seeking to ms 600 must NOT
    // show 'old-3' — it must still show 'old-2' from the new sequence.
    await player.seek(600)
    expect(runtimeNode.textContent).toBe('old-2')

    await player.seek(800)
    expect(runtimeNode.textContent).toBe('old-3')
  })

  it('AS-T4 a static step retires the previous TweenAction step of the same chain instead of being overwritten by it at seek', async () => {
    const runtimeNode = temp__createRuntimeNode()
    const perso = {
      id: 'panel',
      type: 'tag',
      initial: { move: '@root' },
      actions: {
        // Step 0 (TweenAction) and step 1 (static) intentionally touch the
        // SAME property (content) — this used to be silently overwritten by
        // the TweenAction's stale re-evaluation at any seek past its own
        // end, because the global seek pass runs after the whole track
        // replay, out of chronological order. Each ActionSequence step now
        // explicitly retires whatever the previous step of the same chain
        // left active in TweenRunner before applying its own action — see
        // 2026-06-28-seek-continuous-engine-overwrite-defect.md.
        sequence: [
          { action: { fn: ({ progress }: { progress: number }) => ({ content: String(progress) }), duration: 300 } },
          { action: { content: 'done' } }
        ]
      }
    } as unknown as PersoFixture

    const scene = temp__createActionSequenceSceneFixture({
      sceneId: 'scene-action-sequence-tween-then-static-same-property',
      storyId: 'story-action-sequence-tween-then-static-same-property',
      persos: [perso],
      events: [{ id: 'evt-sequence', ms: 0, name: 'sequence' }]
    })

    const player = new PlayerFacade({
      createElementOptions: { nodeFactory: () => runtimeNode }
    })

    await player.init(scene)
    await player.play()

    // Mid-flight: the TweenAction is genuinely active, its value is correct.
    await player.seek(150)
    expect(runtimeNode.textContent).toBe('0.5')

    // Step 1 (static) starts at offset 300 (end of step 0) and must win —
    // not just at the exact boundary, but at any later seek too, since the
    // TweenAction step is now retired rather than merely "not yet evaluated".
    await player.seek(300)
    expect(runtimeNode.textContent).toBe('done')
    await player.seek(1000)
    expect(runtimeNode.textContent).toBe('done')
  })
})
