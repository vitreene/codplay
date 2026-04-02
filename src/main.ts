import './style.css'

import { animate } from 'animejs'

import { createAnimationAdapter, type AnimeImplementation } from './animation/adapter'
import { convertEddySnapshotToScene } from './integration/eddy-legacy-adapter'
import { eddySnapshotManual } from './integration/fixtures/eddy-snapshot-manual'
import { renderInitialScene } from './integration/render-initial-scene'
import { createPlayer } from './player/create-player'
import { createLocalTelco } from './telco-local/create-local-telco'
import { createLocalTelcoPanel } from './telco-local/create-local-telco-panel'

/**
 * Injects the requested scoped legacy CSS snippet for manual Eddy tests.
 */
function mountRequestedLegacyStyleScope(): void {
  const styleId = 'legacy-style-scope'
  if (globalThis.document.getElementById(styleId)) {
    return
  }

  const style = globalThis.document.createElement('style')
  style.id = styleId
  style.textContent = `.bg-image {
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-origin: content-box;
}
.bg-sprite {
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
  background-origin: content-box;
}

.bg-picture {
  width: 100%;
  height: 100%;
}

.ed-video {
  width: 100%;
  height: 100%;
  display: block;
}
.root-scene{
  display: grid;
  grid-row: 1 / -1;
  grid-column: 1 / -1;
  overflow: hidden;
}

.ed-grid-w1-h1{display:grid;grid-template-columns:1fr;grid-template-rows:1fr}
.ed-grid-w2-h2{display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));grid-template-rows:repeat(2, minmax(0, 1fr))}
.cell-r1-c1{grid-row:1 / span 1;grid-column:1 / span 1;}
.cell_layout_auto-r1-c1{grid-row:1 / span 1;grid-column:1 / span 1;}
.cell_layout_auto_grille-r1-c2{grid-row:1 / span 1;grid-column:2 / span 1;}
.cell_layout_auto_grille-r2-c2{grid-row:2 / span 1;grid-column:2 / span 1;}
.cell-r2-c1{grid-row:2 / span 1;grid-column:1 / span 1;}
.cell-r1-c2{grid-row:1 / span 1;grid-column:2 / span 1;}

.ed-item,.ed-caps {
  overflow: hidden;
  position: relative;
}`

  globalThis.document.head.append(style)
}

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

const appNode = globalThis.document.querySelector<HTMLDivElement>('#app')
if (appNode === null) {
  throw new Error('Expected #app root element')
}

appNode.innerHTML = `
  <main class="app-shell">
    <section class="hero-card">
      <p class="eyebrow">Runtime V1</p>
      <h1>Player + Telco locale</h1>
      <p class="subtitle">Pilotage local sur la meme page. WebSocket deports en V2.</p>
      <div id="player-state" class="player-state"></div>
      <p id="conversion-state" class="player-state"></p>
    </section>
    <section id="telco-mount" class="telco-mount"></section>
    <section id="scene-mount" class="scene-mount"></section>
  </main>
`

mountRequestedLegacyStyleScope()

const conversionStateNode = globalThis.document.querySelector<HTMLParagraphElement>('#conversion-state')
if (conversionStateNode === null) {
  throw new Error('Expected #conversion-state element')
}

const sceneMountNode = globalThis.document.querySelector<HTMLElement>('#scene-mount')
if (sceneMountNode === null) {
  throw new Error('Expected #scene-mount element')
}

const converted = convertEddySnapshotToScene(eddySnapshotManual, {
  allowEmptyEventtimesPreview: false
})

if (!converted.ok) {
  conversionStateNode.textContent = `conversion failed code=${converted.error.code} message=${converted.error.message}`
  throw new Error(`conversion failed ${converted.error.code}`)
}

const renderResult = renderInitialScene(converted.data.scene, sceneMountNode)
const nodeByItemId = renderResult.nodeByItemId
const animationAdapter = createAnimationAdapter(createAnimeImplementation())
const player = createPlayer({
  animationAdapter,
  createElementOptions: {
    nodeFactory: (item) => nodeByItemId.get(item.id)
  }
})
const telco = createLocalTelco({ player })

const playerStateNode = globalThis.document.querySelector<HTMLDivElement>('#player-state')
if (playerStateNode === null) {
  throw new Error('Expected #player-state mount element')
}

player.onStateChange((state) => {
  playerStateNode.textContent = `status=${state.status} timelineMs=${Math.round(state.timelineMs)} revision=${state.runtimeRevision}`
})

const telcoMountNode = globalThis.document.querySelector<HTMLElement>('#telco-mount')
if (telcoMountNode === null) {
  throw new Error('Expected #telco-mount element')
}

createLocalTelcoPanel({
  telco,
  mountTarget: telcoMountNode,
  title: 'Telco locale'
})

const runtimeEvents = (converted.data.scene.tracks?.['track-story-main'] as { events?: unknown[] } | undefined)?.events?.length ?? 0
conversionStateNode.textContent = `scene source=eddy-snapshot-manual.ts warnings=${converted.data.warnings.length + converted.data.conversionWarnings.length} events=${runtimeEvents} rendered=${renderResult.renderedCount} unresolvedParents=${renderResult.unresolvedParentCount}`

void player.init(converted.data.scene)
