// @vitest-environment jsdom

import { afterEach, expect, it, vi } from 'vitest'
import { Sighty, type SightyScenarioDefinition } from '@codplay/sighty'
import type { SceneDoc } from 'codplay/scene/types'
import { ELCE_SCENARIO } from '../learning-reading-events'
import type { ElceSceneKey, ElceSlotName } from '../learning-scenario-types'
import { bindLearningNavigationRemote } from './learning-navigation-remote'

let project: Sighty<ElceSceneKey, ElceSlotName> | undefined
let disconnect: (() => void) | undefined

afterEach(() => {
  disconnect?.()
  disconnect = undefined
  project?.runtime.destroy()
  project = undefined
  document.body.replaceChildren()
})

/** Creates a finite scene with its own values for the real navigation transport tests. */
function createPage(id: string): SceneDoc<string> {
  return {
    id,
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: `${id}-text`,
          type: 'tag',
          initial: { tag: 'p', attr: { id: `${id}-text` }, content: 'Before', move: '@root' },
          actions: { 'test:change': { content: 'After' } },
        }],
        eventimes: [{ name: 'test:change', startAt: 600 }, { name: 'sequence:end', startAt: 2000 }],
      },
    },
  }
}

/** Mounts a real Sighty content slot and binds navigation to its selected instance. */
async function mountRemote() {
  const stage = document.body.appendChild(document.createElement('div'))
  const scenario: SightyScenarioDefinition<ElceSceneKey, ElceSlotName> = {
    format: 'sighty',
    version: 1,
    id: 'navigation-remote-test',
    views: {
      start: 'layout',
      views: {
        layout: {
          view: {
            scene: ELCE_SCENARIO.LAYOUT_SCENE,
            slots: {
              [ELCE_SCENARIO.CONTENT_SLOT]: {
                start: 'first',
                showMode: 'reset',
                views: {
                  first: {
                    view: { scene: 'scene-first' },
                    actions: { 'test:next': { go: { path: 'layout/slot-content/second' } } },
                  },
                  second: {
                    view: { scene: 'scene-second' },
                    actions: { 'test:previous': { go: { path: 'layout/slot-content/first' } } },
                  },
                },
              },
            },
          },
        },
      },
    },
    scenes: {
      [ELCE_SCENARIO.LAYOUT_SCENE]: {
        id: 'navigation-test-layout',
        stories: {
          main: {
            id: 'main',
            persos: [{
              id: 'navigation-test-layout',
              type: 'layout',
              initial: {
                move: '@root',
                markup: '<main id="navigation-test-root"><!-- data-part="test:content" --><nav id="navigation-test-bar"><div id="elce-navigation-remote" hidden></div></nav></main>',
              },
            }, {
              id: 'navigation-test-slot',
              name: ELCE_SCENARIO.CONTENT_SLOT,
              type: 'slot',
              initial: { move: { target: 'test:content' } },
            }],
          },
        },
      },
      'scene-first': createPage('first'),
      'scene-second': createPage('second'),
    },
  }
  project = new Sighty({
    scenario,
    runtime: {
      root: stage,
      instanceIds: {
        [ELCE_SCENARIO.LAYOUT_SCENE]: 'navigation-test-layout-instance',
        'scene-first': 'navigation-test-first-instance',
        'scene-second': 'navigation-test-second-instance',
      },
      codplay: { engine: { idle: false } },
    },
  })
  const runtime = project.runtime
  await runtime.initialize()
  const errors: string[] = []
  disconnect = bindLearningNavigationRemote(stage, runtime, { 'scene-first': { autoStart: false } }, (message) => errors.push(message))
  await runtime.playAll([ELCE_SCENARIO.LAYOUT_SCENE])
  const first = runtime.getInstance('scene-first')
  if (first === undefined) throw new Error('La première scène du test est absente.')
  return { stage, runtime, first, errors }
}

it('waits for Play, then uses the real telco for Pause, Seek, end and replay', async () => {
  const { stage, first, errors } = await mountRemote()
  const play = stage.querySelector<HTMLButtonElement>('[aria-label="Lire"]')!
  const seek = stage.querySelector<HTMLInputElement>('[aria-label="Progression de la narration"]')!
  expect(first.telco.getState().status).not.toBe('playing')
  expect(first.telco.getProgress().timelineMs).toBe(0)
  expect(stage.querySelector('#navigation-test-bar')?.contains(play)).toBe(true)

  play.click()
  await vi.waitFor(() => expect(first.telco.getState().status).toBe('playing'))
  await vi.waitFor(() => expect(first.telco.getProgress().timelineMs).toBeGreaterThan(0))
  play.click()
  await vi.waitFor(() => expect(first.telco.getState().status).toBe('paused'))

  seek.value = '900'
  seek.dispatchEvent(new Event('input', { bubbles: true }))
  seek.dispatchEvent(new Event('change', { bubbles: true }))
  await vi.waitFor(() => expect(first.telco.getProgress().timelineMs).toBe(900))
  expect(stage.querySelector('#first-text')?.textContent).toBe('After')
  expect(first.telco.getState().status).toBe('paused')
  await first.telco.seek(1950)
  play.click()
  await vi.waitFor(() => expect(first.telco.getState().sequenceEnded).toBe(true))
  expect(seek.disabled).toBe(true)
  play.click()
  await vi.waitFor(() => expect(first.telco.getState().status).toBe('playing'))
  expect(first.telco.getProgress().timelineMs).toBeLessThan(1000)
  expect(errors).toEqual([])
})

it('releases the old controls on an ordinary page and waits for Play on return', async () => {
  const { stage, runtime, first, errors } = await mountRemote()
  const oldRemote = stage.querySelector<HTMLElement>('#elce-navigation-remote-control')!
  await first.telco.play()
  await runtime.dispatch({ name: 'test:next', sourceSceneKey: 'scene-first' })
  expect(stage.querySelector('#elce-navigation-remote-control')).toBeNull()
  expect(oldRemote.isConnected).toBe(false)
  expect(first.telco.getState().status).toBe('paused')
  expect(stage.querySelector<HTMLElement>('#elce-navigation-remote')?.hidden).toBe(true)

  await runtime.dispatch({ name: 'test:previous', sourceSceneKey: 'scene-second' })
  await vi.waitFor(() => expect(first.telco.getState().status).toBe('paused'))
  expect(first.telco.getProgress().timelineMs).toBe(0)
  expect(stage.querySelectorAll('#elce-navigation-remote-control')).toHaveLength(1)
  disconnect?.()
  disconnect = undefined
  expect(stage.querySelector('#elce-navigation-remote-control')).toBeNull()
  expect(errors).toEqual([])
})
