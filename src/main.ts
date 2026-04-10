import './style.css'

import { animate } from 'animejs'

import { createAnimationAdapter, type AnimeImplementation } from './animation/adapter'
import { PlayerFacade } from './player/create-player'
import type { SceneDoc } from './player/types'

/**
 * Builds an animejs wrapper compatible with runtime animation adapter.
 */
function createAnimeImplementation(): AnimeImplementation {
  return (parameters) => {
    const targets = parameters.targets
    const animationParameters = { ...parameters }
    delete animationParameters.targets

    const animationTargets = targets as Parameters<typeof animate>[0]
    const typedAnimationParameters = animationParameters as Parameters<typeof animate>[1]
    return animate(animationTargets, typedAnimationParameters)
  }
}

/**
 * Creates one minimal scene used for first real Player processing tests.
 */
function createDemoScene(): SceneDoc {
  return {
    id: 'scene-demo',
    initialStoryId: 'story-demo',
    stories: {
      'story-demo': {
        id: 'story-demo',
        items: {
          'demo-box': {
            id: 'demo-box',
            type: 'text',
            initial: {
              id: 'demo-box',
              tag: 'div',
              className: 'demo-box',
              content: 'DEMO',
              style: {
                backgroundColor: '#c80f17',
                color: '#ffffff',
                width: '180px',
                height: '180px',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
                letterSpacing: '0.08em'
              }
            },
            actions: {
              'demo:rotate': {
                style: {
                  rotate: {
                    to: 180,
                    duration: 2000
                  }
                }
              }
            }
          }
        }
      }
    },
    tracks: {
      'track-demo': {
        id: 'track-demo',
        source: 'story',
        order: 0,
        events: [
          {
            id: 'evt-demo-rotate',
            ms: 0,
            name: 'demo:rotate',
            index: 0,
            source: 'story'
          }
        ]
      }
    }
  }
}

const appNode = globalThis.document.querySelector<HTMLDivElement>('#app')
if (appNode === null) {
  throw new Error('Expected #app root element')
}

appNode.innerHTML = `
  <main class="demo-shell">
    <p class="eyebrow">Runtime V1</p>
    <h1>Player POC</h1>
    <p class="subtitle">Div rouge "DEMO" animee a 180 degres en 2 secondes.</p>
    <div id="player-state" class="player-state"></div>
    <div id="player-trace" class="player-state"></div>
    <div class="container" id="demo-container"></div>
  </main>
`

const containerNode = globalThis.document.querySelector<HTMLDivElement>('#demo-container')
if (containerNode === null) {
  throw new Error('Expected #demo-container element')
}

const demoNode = globalThis.document.createElement('div')
containerNode.append(demoNode)

const animationAdapter = createAnimationAdapter(createAnimeImplementation())
const player = new PlayerFacade({
  animationAdapter,
  createElementOptions: {
    nodeFactory: () => demoNode
  }
})

const playerStateNode = globalThis.document.querySelector<HTMLDivElement>('#player-state')
if (playerStateNode === null) {
  throw new Error('Expected #player-state element')
}

const playerTraceNode = globalThis.document.querySelector<HTMLDivElement>('#player-trace')
if (playerTraceNode === null) {
  throw new Error('Expected #player-trace element')
}

player.onStateChange((state) => {
  playerStateNode.textContent = `status=${state.status} timelineMs=${Math.round(state.timelineMs)} revision=${state.runtimeRevision}`
})

player.onTrace((row) => {
  playerTraceNode.textContent = `trace=${row.status}:${row.eventName}`
})

/**
 * Boots the demo scene and starts playback.
 */
async function runDemo(): Promise<void> {
  await player.init(createDemoScene())
  await player.play()
}

void runDemo()
