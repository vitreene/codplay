// @vitest-environment jsdom
import { SceneBuilder } from '../../../src/scene/compiled'
import type { AuthorCaptureEndInput, AuthorCaptureTrackInput } from '../../../src/scene/capture'
import type { SceneDoc } from '../../../src/scene/types'
import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import { HtmlPlayerRunner } from '../../../src/runtime/runner-html'
import { expect, it, vi } from 'vitest'

/** Builds a real runner scene whose scroll-container declares a scroll capture. */
function createRunner(root: HTMLElement): HtmlPlayerRunner {
  const catalog = createCoreRuntimeCatalog()
  const scene = {
    id: 'scroll-container-player-integration',
    stories: {
      story: {
        id: 'story',
        initial: { move: '@root' },
        persos: [{
          id: 'viewport',
          type: 'scroll-container',
          initial: {
            tag: 'section',
            move: '@root',
            values: { progress: { axis: 'block', range: 'scrollport' } },
          },
          emit: {
            scroll: {
              event: { name: 'scroll:start' },
              capture: {
                trackCommand: ({ sample }: AuthorCaptureTrackInput) => ({
                  captureState: { progress: sample.progress },
                }),
                endEmit: { name: 'scroll:progress' },
                endCapture: ({ samples }: AuthorCaptureEndInput) => ({
                  events: [{
                    name: 'scroll:closed',
                    data: { sampleCount: samples.length },
                    mode: 'persist-only',
                  }],
                }),
              },
            },
          },
        }],
      },
    },
  } as unknown as SceneDoc
  const build = new SceneBuilder(catalog.validationSnapshot()).build(scene)
  if (!build.ok) throw new Error(build.diagnostics.errors.map((issue) => issue.message).join('\n'))
  return new HtmlPlayerRunner({
    id: 'scroll-container-player-integration',
    compiledScene: build.compiledScene,
    functions: build.functions,
    root,
    catalog,
  })
}

/** Runs one queued animation frame and lets its capture commands settle. */
async function flushProgressFrame(callbacks: FrameRequestCallback[]): Promise<void> {
  callbacks.shift()?.(0)
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0))
}

it('runs the scroll component source through the player capture controller and journal', async () => {
  const frameCallbacks: FrameRequestCallback[] = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frameCallbacks.push(callback)
    return frameCallbacks.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
  const root = document.createElement('div')
  document.body.append(root)
  const runner = createRunner(root)

  expect(runner.init().ok).toBe(true)
  const scrollport = runner.getPersoNode('story:viewport') as HTMLElement
  Object.defineProperties(scrollport, {
    scrollTop: { configurable: true, writable: true, value: 25 },
    scrollHeight: { configurable: true, value: 200 },
    clientHeight: { configurable: true, value: 100 },
  })
  await flushProgressFrame(frameCallbacks)

  scrollport.scrollTop = 75
  scrollport.dispatchEvent(new Event('scroll'))
  await flushProgressFrame(frameCallbacks)
  expect(runner.seek(0).ok).toBe(true)
  await flushProgressFrame(frameCallbacks)
  scrollport.dispatchEvent(new Event('scrollend'))
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0))

  const events = runner.player.trackJournal.getAllEvents()
  expect(events.map((event) => event.name)).toEqual(expect.arrayContaining([
    'scroll:start',
    'scroll:progress',
    'scroll:closed',
  ]))
  expect(events.filter((event) => event.name === 'scroll:start')).toHaveLength(2)
  expect(events.filter((event) => event.name === 'scroll:progress')).toHaveLength(1)
  expect(events.filter((event) => event.name === 'scroll:closed')).toHaveLength(1)
  expect(events.find((event) => event.name === 'scroll:progress')?.data).toMatchObject({
    captureState: { progress: 0.75 },
  })
  expect(events.find((event) => event.name === 'scroll:closed')?.data).toMatchObject({
    sampleCount: 1,
  })

  runner.destroy()
  scrollport.dispatchEvent(new Event('scroll'))
  await flushProgressFrame(frameCallbacks)
  expect(runner.player.trackJournal.getAllEvents()).toHaveLength(4)
  root.remove()
})
