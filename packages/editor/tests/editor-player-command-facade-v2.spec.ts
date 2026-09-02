/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { CodPlay } from 'codplay'
import { buildSceneDocV2 } from '../src/builder-v2/build-scene'
import { EditorPlayerCommandFacade } from '../src/app/commands/editor-player-command-facade'

/** Creates the two-keyframe V2 scene used to exercise author-time handoff. */
function editorScene() {
  return {
    id: 'editor-player-facade-v2',
    meta: {
      title: 'Editor player facade V2',
      durationMs: 5_000,
      durationSource: 'arbitrary' as const,
      timeUnit: 'ms' as const,
      capsuleOrder: 'forward' as const,
    },
    items: [{
      id: 'item',
      type: 'text' as const,
      parentId: null,
      order: 'a',
      visible: true,
      contentId: 'content',
      initialDecorId: 'first',
      keyframes: [
        { id: 'first-kf', timeMs: 0, decorId: 'first' },
        { id: 'last-kf', timeMs: 5_000, decorId: 'last' },
      ],
    }],
    contents: { content: { id: 'content', type: 'text' as const, text: 'item' } },
    decors: {
      first: { id: 'first', offset: { translate: { x: 10, y: 10 }, width: 20, height: 20 } },
      last: { id: 'last', offset: { translate: { x: 50, y: 50 }, width: 20, height: 20 } },
    },
    zones: {},
    markerTracks: {},
  }
}

/** Creates one initialized public V2 instance for the facade boundary. */
function createInstance(codplay: CodPlay, instanceId: string): ReturnType<CodPlay['instances']['create']> {
  const built = buildSceneDocV2(editorScene())
  if (!built.ok) throw new Error('Editor V2 scene did not build.')
  const compiled = codplay.build({ scene: built.sceneDoc })
  if (!compiled.ok) throw new Error('Editor V2 scene did not compile.')
  const root = document.createElement('div')
  Object.defineProperty(root, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
  })
  document.body.append(root)
  return codplay.instances.create({
    instanceId,
    compiledScene: compiled.compiledScene,
    functions: compiled.functions,
    root,
  })
}

describe('EditorPlayerCommandFacade V2', () => {
  let codplay: CodPlay | undefined

  afterEach(() => {
    codplay?.destroy()
    codplay = undefined
    document.body.replaceChildren()
  })

  it('clamps author seeks to the authored scene duration across an instance replacement', async () => {
    codplay = new CodPlay({ pauseOnDocumentHidden: false })
    const facade = new EditorPlayerCommandFacade()
    const first = createInstance(codplay, 'first')
    facade.bind(first, 0, 5_000)

    const firstSeek = await facade.execute({ type: 'seek', timelineMs: 1_250 })
    expect(firstSeek).toMatchObject({ ok: true, progress: { timelineMs: 1_250 } })

    const replacement = createInstance(codplay, 'replacement')
    facade.bind(replacement, 0, 5_000)
    codplay.instances.destroy(first.instanceId)

    // A fresh V2 instance has a zero discovered horizon until its first frame, but the
    // EditorScene duration remains authoritative for the editor's author-time seek.
    const replacementSeek = await facade.execute({ type: 'seek', timelineMs: 1_250 })
    expect(replacementSeek).toMatchObject({ ok: true, progress: { timelineMs: 1_250 } })
    facade.destroy()
  })
})
