import { LayoutComponent } from '../../../../codplay-v2/src/runtime/components'
import { createCoreRuntimeCatalog } from '../../../../codplay-v2/src/runtime/catalog'
import type { RuntimeCapabilityCatalog } from '../../../../codplay-v2/src/runtime/catalog'
import { HtmlPlayerRunner } from '../../../../codplay-v2/src/runtime/runner'
import { SceneBuilder } from '../../../../codplay-v2/src/scene/compiled'
import type { PersoDoc, SceneDoc } from '../../../../codplay-v2/src/scene/types'

import './style.css'

type ContainerId = 'stress-a' | 'stress-b' | 'stress-c' | 'stress-d'
type ContentId =
  | 'qa'
  | 'qb'
  | 'qc'
  | 'qd'
  | 'qe'
  | 'qf'
  | 'ka'
  | 'kb'
  | 'kc'
  | 'kd'
  | 'ke'
  | 'kf'
type OwnerId = 'q' | 'k'

type ContentExchange = Readonly<{
  name: string
  timeMs: number
  itemId: ContentId
  from: OwnerId
  to: OwnerId
}>

const HOST_ID = 'flip-stress-test-v2'
const BOUNDARY_TIME_MS = 1_000
const TRANSFER_END_TIME_MS = 9_000
const CONTAINER_DURATION_MS = 10_000
const SECONDARY_CONTAINER_DURATION_MS = 9_000
const TRANSFER_DURATION_MS = 8_000
const CONTENT_DURATION_MS = 1_000
const CONTENT_FIRST_EXCHANGE_MS = 1_200
const CONTENT_EXCHANGE_SPACING_MS = 500
const TIMELINE_END_MS = 10_000
const CONTENT_EASE = 'inOutQuad'
const CENTER_CURVE_PATH = 'M 0 0 A 0.8 0.8 0 0 0 1 0'

const CONTAINER_IDS: readonly ContainerId[] = ['stress-a', 'stress-b', 'stress-c', 'stress-d']
const CONTENT_IDS: readonly ContentId[] = [
  'qa',
  'qb',
  'qc',
  'qd',
  'qe',
  'qf',
  'ka',
  'kb',
  'kc',
  'kd',
  'ke',
  'kf',
]

const CONTENT_EXCHANGES: readonly ContentExchange[] = [
  { name: 'exchange-qa', timeMs: CONTENT_FIRST_EXCHANGE_MS, itemId: 'qa', from: 'q', to: 'k' },
  { name: 'exchange-ka', timeMs: CONTENT_FIRST_EXCHANGE_MS + CONTENT_EXCHANGE_SPACING_MS, itemId: 'ka', from: 'k', to: 'q' },
  { name: 'exchange-qb', timeMs: CONTENT_FIRST_EXCHANGE_MS + CONTENT_EXCHANGE_SPACING_MS * 2, itemId: 'qb', from: 'q', to: 'k' },
  { name: 'exchange-kb', timeMs: CONTENT_FIRST_EXCHANGE_MS + CONTENT_EXCHANGE_SPACING_MS * 3, itemId: 'kb', from: 'k', to: 'q' },
  { name: 'exchange-qc', timeMs: CONTENT_FIRST_EXCHANGE_MS + CONTENT_EXCHANGE_SPACING_MS * 4, itemId: 'qc', from: 'q', to: 'k' },
  { name: 'exchange-kc', timeMs: CONTENT_FIRST_EXCHANGE_MS + CONTENT_EXCHANGE_SPACING_MS * 5, itemId: 'kc', from: 'k', to: 'q' },
  { name: 'exchange-qd', timeMs: CONTENT_FIRST_EXCHANGE_MS + CONTENT_EXCHANGE_SPACING_MS * 6, itemId: 'qd', from: 'q', to: 'k' },
  { name: 'exchange-kd', timeMs: CONTENT_FIRST_EXCHANGE_MS + CONTENT_EXCHANGE_SPACING_MS * 7, itemId: 'kd', from: 'k', to: 'q' },
  { name: 'exchange-qe', timeMs: CONTENT_FIRST_EXCHANGE_MS + CONTENT_EXCHANGE_SPACING_MS * 8, itemId: 'qe', from: 'q', to: 'k' },
  { name: 'exchange-ke', timeMs: CONTENT_FIRST_EXCHANGE_MS + CONTENT_EXCHANGE_SPACING_MS * 9, itemId: 'ke', from: 'k', to: 'q' },
  { name: 'exchange-qf', timeMs: CONTENT_FIRST_EXCHANGE_MS + CONTENT_EXCHANGE_SPACING_MS * 10, itemId: 'qf', from: 'q', to: 'k' },
  { name: 'exchange-kf', timeMs: CONTENT_FIRST_EXCHANGE_MS + CONTENT_EXCHANGE_SPACING_MS * 11, itemId: 'kf', from: 'k', to: 'q' },
]

const ITEM_LABELS: Readonly<Record<ContentId, string>> = {
  qa: 'Qa',
  qb: 'Qb',
  qc: 'Qc',
  qd: 'Qd',
  qe: 'Qe',
  qf: 'Qf',
  ka: 'Ka',
  kb: 'Kb',
  kc: 'Kc',
  kd: 'Kd',
  ke: 'Ke',
  kf: 'Kf',
}

/** Creates one container layout with a public outlet for a transfer parent. */
function containerMarkup(label: string, description: string, outletId: string, className: string): string {
  return `<section class="stress-container ${className}"><h2>${label}</h2><p>${description}</p><div class="stress-container__outlet" data-part="${outletId}"></div></section>`
}

/** Creates one transfer layout with a public content outlet. */
function transferMarkup(label: string, className: string, outletId: string): string {
  return `<section class="transfer-container ${className}"><h3>${label}</h3><div class="transfer-items" data-part="${outletId}" role="list"></div></section>`
}

/** Creates one responsive vertical position tween in the root's coordinate system. */
function responsiveVerticalStyle(
  property: 'top' | 'bottom',
  from: string,
  to: string,
  duration: number,
): Readonly<Record<string, unknown>> {
  return {
    [property]: { from, to, duration, ease: 'linear' },
  }
}

/** Creates a repeatable pseudo-random source for one content identifier. */
function createDeterministicRandom(seed: string): () => number {
  let state = 2166136261
  for (const character of seed) state = Math.imul(state ^ character.charCodeAt(0), 16777619)
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 4294967296
  }
}

/** Formats one generated SVG path coordinate with stable authoring precision. */
function formatPathNumber(value: number): string {
  return value.toFixed(2)
}

/** Builds a deterministic two-arc stress path for one moving content item. */
function createRandomContentPath(itemId: ContentId): string {
  const random = createDeterministicRandom(`flip-stress:${itemId}`)
  const firstPoint = {
    x: 0.24 + random() * 0.2,
    y: -0.7 + random() * 1.4,
  }
  const secondPoint = {
    x: 0.62 + random() * 0.22,
    y: -0.7 + random() * 1.4,
  }
  const firstRadius = {
    x: 0.65 + random() * 0.7,
    y: 0.65 + random() * 0.7,
  }
  const secondRadius = {
    x: 0.65 + random() * 0.7,
    y: 0.65 + random() * 0.7,
  }
  const firstRotation = -45 + random() * 90
  const secondRotation = -45 + random() * 90
  const firstSweep = random() < 0.5 ? 0 : 1
  const secondSweep = random() < 0.5 ? 0 : 1
  return [
    'M 0 0',
    `A ${formatPathNumber(firstRadius.x)} ${formatPathNumber(firstRadius.y)} ${formatPathNumber(firstRotation)} 0 ${firstSweep} ${formatPathNumber(firstPoint.x)} ${formatPathNumber(firstPoint.y)}`,
    `A ${formatPathNumber(secondRadius.x)} ${formatPathNumber(secondRadius.y)} ${formatPathNumber(secondRotation)} 0 ${secondSweep} ${formatPathNumber(secondPoint.x)} ${formatPathNumber(secondPoint.y)}`,
    'A 0.9 0.9 0 0 0 1 0',
  ].join(' ')
}

/** Creates one declarative content move between the Q and K outlets. */
function contentPerso(exchange: ContentExchange): PersoDoc {
  const target = exchange.to === 'q' ? 'q-content-outlet' : 'k-content-outlet'
  return {
    id: exchange.itemId,
    type: 'tag',
    initial: {
      tag: 'span',
      move: { target: exchange.from === 'q' ? 'q-content-outlet' : 'k-content-outlet' },
      className: `stress-item stress-${exchange.itemId}`,
      content: ITEM_LABELS[exchange.itemId],
    },
      actions: {
        [exchange.name]: {
          move: {
            target,
            transition: {
              duration: CONTENT_DURATION_MS,
              ease: CONTENT_EASE,
              path: createRandomContentPath(exchange.itemId),
              traversal: 'arc-length',
            },
          },
        },
    },
  }
}

/** Creates the complete declarative replacement for the historical stress fixture. */
function createStressScene(): SceneDoc {
  const contentPersos = CONTENT_EXCHANGES.map((exchange) => contentPerso(exchange))
  return {
    id: HOST_ID,
    stories: {
      main: {
        id: 'main',
        persos: [
          {
            id: 'stress-a',
            type: 'layout',
            initial: {
              move: '@root',
              markup: containerMarkup('A', 'source haut gauche', 'stress-a-outlet', 'stress-container--a'),
            },
            actions: {
              moveA: {
                style: responsiveVerticalStyle('top', '5%', '28%', CONTAINER_DURATION_MS),
              },
            },
          },
          {
            id: 'stress-b',
            type: 'layout',
            initial: {
              move: '@root',
              markup: containerMarkup('B', 'cible haut droite', 'stress-b-outlet', 'stress-container--b'),
            },
            actions: {
              moveB: {
                style: responsiveVerticalStyle('top', '36%', '13%', CONTAINER_DURATION_MS),
              },
            },
          },
          {
            id: 'stress-c',
            type: 'layout',
            initial: {
              move: '@root',
              markup: containerMarkup('C', 'source bas gauche', 'stress-c-outlet', 'stress-container--c'),
              style: { visibility: 'hidden' },
            },
            actions: {
              revealC: {
                style: {
                  ...responsiveVerticalStyle('bottom', '5%', '28%', SECONDARY_CONTAINER_DURATION_MS),
                  visibility: 'visible',
                },
              },
            },
          },
          {
            id: 'stress-d',
            type: 'layout',
            initial: {
              move: '@root',
              markup: containerMarkup('D', 'cible bas droite', 'stress-d-outlet', 'stress-container--d'),
              style: { visibility: 'hidden' },
            },
            actions: {
              revealD: {
                style: {
                  ...responsiveVerticalStyle(
                    'top',
                    'min(52%, calc(100% - var(--stress-container-size)))',
                    'min(75%, calc(100% - var(--stress-container-size)))',
                    SECONDARY_CONTAINER_DURATION_MS,
                  ),
                  visibility: 'visible',
                },
              },
            },
          },
          {
            id: 'transfer-q',
            type: 'list',
            initial: {
              move: { target: 'stress-a-outlet' },
              markup: transferMarkup('Q', 'transfer-q', 'q-content-outlet'),
            },
            actions: {
              transferQ: {
                move: {
                  target: 'stress-b-outlet',
                  transition: {
                    duration: TRANSFER_DURATION_MS,
                    ease: CONTENT_EASE,
                    path: CENTER_CURVE_PATH,
                    traversal: 'arc-length',
                  },
                },
              },
            },
          },
          {
            id: 'transfer-k',
            type: 'list',
            initial: {
              move: { target: 'stress-d-outlet' },
              markup: transferMarkup('K', 'transfer-k', 'k-content-outlet'),
            },
            actions: {
              transferK: {
                move: {
                  target: 'stress-c-outlet',
                  transition: {
                    duration: TRANSFER_DURATION_MS,
                    ease: CONTENT_EASE,
                    path: CENTER_CURVE_PATH,
                    traversal: 'arc-length',
                  },
                },
              },
            },
          },
          ...contentPersos,
        ],
        listen: [],
        eventimes: [
          { name: 'moveA', startAt: 0 },
          { name: 'moveB', startAt: 0 },
          { name: 'revealC', startAt: BOUNDARY_TIME_MS },
          { name: 'revealD', startAt: BOUNDARY_TIME_MS },
          { name: 'transferQ', startAt: BOUNDARY_TIME_MS },
          { name: 'transferK', startAt: BOUNDARY_TIME_MS },
          ...CONTENT_EXCHANGES.map((exchange) => ({ name: exchange.name, startAt: exchange.timeMs })),
        ],
      },
    },
  }
}

/** Compiles the declarative stress scene through the normative SceneDoc boundary. */
function buildScene(catalog: RuntimeCapabilityCatalog): ReturnType<SceneBuilder['build']> {
  return new SceneBuilder(catalog.validationSnapshot(), {
    createdAt: '2026-08-18T00:00:00.000Z',
  }).build(createStressScene())
}

/** Creates the CodPlay runtime catalog and configures the stress scene's outlets. */
function createRuntimeCatalog(): RuntimeCapabilityCatalog {
  const catalog = createCoreRuntimeCatalog()
  const layout = catalog.getComponent('layout')
  if (layout === undefined) throw new Error('Core layout component is not registered.')
  catalog.overrideComponent({
    ...layout,
    mountableParts: [
      'stress-a-outlet',
      'stress-b-outlet',
      'stress-c-outlet',
      'stress-d-outlet',
      'q-content-outlet',
      'k-content-outlet',
    ],
  })
  const list = catalog.getComponent('list')
  if (list === undefined) throw new Error('Core list component is not registered.')
  catalog.overrideComponent({
    ...list,
    modules: ['markup', 'list'],
    create: (input) => new LayoutComponent(input as never),
    mountableParts: ['q-content-outlet', 'k-content-outlet'],
  })
  return catalog
}

/** Reads one materialized HTML element from the runner diagnostics map. */
function readElement(runner: HtmlPlayerRunner, persoId: string): HTMLElement | undefined {
  const node = runner.getPersoNode(`main:${persoId}`)
  return node instanceof HTMLElement ? node : undefined
}

/** Returns the logical persona owning one materialized node's direct parent. */
function readParentId(node: HTMLElement | undefined): string {
  let parent = node?.parentElement
  while (parent !== null && parent !== undefined) {
    const itemId = parent.dataset.itemId
    if (itemId !== undefined) return itemId.replace('main:', '')
    parent = parent.parentElement
  }
  return node?.parentElement?.className ?? 'none'
}

/** Returns the order of persona nodes mounted in one published outlet. */
function readOutletOrder(runner: HtmlPlayerRunner, outletId: string): string {
  const outlet = runner.getTargetNode(outletId)
  if (!(outlet instanceof HTMLElement)) return 'none'
  return [...outlet.children]
    .map((child) => child instanceof HTMLElement ? child.dataset.itemId?.replace('main:', '') ?? '?' : '?')
    .join(' → ')
}

/** Returns the transfer owner of one content item from its outlet parentage. */
function readContentOwner(runner: HtmlPlayerRunner, contentId: ContentId): string {
  const item = readElement(runner, contentId)
  const transfer = item?.parentElement?.parentElement
  return transfer?.dataset.itemId?.replace('main:', '') ?? 'none'
}

/** Reads runner-owned overlay diagnostics without touching the projection runtime. */
function readOverlayDiagnostics(root: HTMLElement): { ghosts: number; hidden: number } {
  const layer = root.querySelector<HTMLElement>('[data-codplay-motion-overlay]')
  if (layer === null) return { ghosts: 0, hidden: 0 }
  return {
    ghosts: layer.children.length,
    hidden: layer.querySelectorAll('[data-codplay-motion-hidden]').length,
  }
}

/** Describes declared transition windows active at one diagnostic time. */
function readDeclaredTransitions(timeMs: number): string {
  const active: string[] = []
  if (timeMs >= BOUNDARY_TIME_MS && timeMs <= TRANSFER_END_TIME_MS) active.push('Q/K')
  for (const exchange of CONTENT_EXCHANGES) {
    if (timeMs >= exchange.timeMs && timeMs <= exchange.timeMs + CONTENT_DURATION_MS) active.push(exchange.itemId)
  }
  return active.length === 0 ? 'none' : active.join(', ')
}

/** Displays a runner diagnostic error in the stress-test panel. */
function showError(error: HTMLElement, diagnostics: readonly { code: string; message: string }[]): void {
  error.hidden = diagnostics.length === 0
  error.textContent = diagnostics.map((entry) => `${entry.code}: ${entry.message}`).join('\n')
}

/** Mounts the declarative stress scene and delegates transport to HtmlPlayerRunner. */
function mountFlipStressDemo(container: HTMLElement): void {
  container.innerHTML = `
    <main class="demo-shell">
      <aside>
        <p class="eyebrow">CodPlay V2 / HtmlPlayerRunner</p>
        <h1>FLIP Stress Test</h1>
        <p class="subtitle">SceneDoc déclarative : quatre containers mobiles, deux transferts imbriqués et douze échanges alternés.</p>
        <div class="demo-controls">
          <button id="stress-play" class="demo-button" type="button">Play</button>
          <button id="stress-reset" class="demo-button demo-button-secondary" type="button">Reset</button>
        </div>
        <label class="demo-progress-control" for="stress-seek">
          Seek
          <input id="stress-seek" class="demo-progress-range" type="range" min="0" max="${TIMELINE_END_MS}" value="0" step="1" />
          <output id="stress-seek-label" class="demo-progress-label">0ms</output>
        </label>
        <div class="demo-checkpoints" aria-label="timeline checkpoints">
          <button class="demo-button demo-button-secondary" type="button" data-time="0">FIRST</button>
          <button class="demo-button demo-button-secondary" type="button" data-time="${BOUNDARY_TIME_MS}">BOUNDARY</button>
          <button class="demo-button demo-button-secondary" type="button" data-time="5000">MIDDLE</button>
          <button class="demo-button demo-button-secondary" type="button" data-time="${TIMELINE_END_MS}">LAST</button>
        </div>
        <div id="stress-status" class="player-state">Prêt. Lancez le stress-test déclaratif.</div>
        <div id="stress-debug" class="player-state stress-status"></div>
        <p class="stress-legend">A/B : mouvement continu dès FIRST. C/D : apparition à 1s. Q/K : transfert world de 1s à 9s, courbé vers le centre. Les contenus s'échangent toutes les 0,5s de 1,2s à 6,7s sur des chemins pseudo-aléatoires reproductibles.</p>
        <pre id="stress-error" class="stress-error" hidden></pre>
      </aside>
      <div class="container">
        <div class="stress-stage" id="stress-stage" aria-label="declarative FLIP stress scene"></div>
      </div>
    </main>
  `

  const stage = container.querySelector<HTMLElement>('#stress-stage')!
  const status = container.querySelector<HTMLDivElement>('#stress-status')!
  const debug = container.querySelector<HTMLDivElement>('#stress-debug')!
  const error = container.querySelector<HTMLElement>('#stress-error')!
  const seek = container.querySelector<HTMLInputElement>('#stress-seek')!
  const seekLabel = container.querySelector<HTMLOutputElement>('#stress-seek-label')!
  const play = container.querySelector<HTMLButtonElement>('#stress-play')!
  const reset = container.querySelector<HTMLButtonElement>('#stress-reset')!
  const checkpoints = [...container.querySelectorAll<HTMLButtonElement>('[data-time]')]

    const catalog = createRuntimeCatalog()
  const build = buildScene(catalog)
  if (!build.ok) {
    status.textContent = 'SceneDoc build failed'
    showError(error, build.diagnostics.errors)
    return
  }

  const runner = new HtmlPlayerRunner({
    id: HOST_ID,
    compiledScene: build.compiledScene,
    root: stage,
    rootTargets: [{ id: 'root-host', storyId: 'main' }],
    catalog,
  })
  const init = runner.init()
  if (!init.ok) {
    status.textContent = 'Runner init failed'
    showError(error, init.diagnostics.errors)
    runner.destroy()
    return
  }

  let playing = false

  /** Presents current parentage, active declarations and runner-owned overlays. */
  function present(): void {
    const timeMs = runner.getCurrentTimeMs()
    const overlay = readOverlayDiagnostics(stage)
    const containerParents = CONTAINER_IDS
      .map((id) => `${id.replace('stress-', '')}:${readParentId(readElement(runner, id))}`)
      .join(' ')
    const contentOwners = CONTENT_IDS
      .map((id) => `${id}:${readContentOwner(runner, id)}`)
      .join(' ')
    status.textContent = `${runner.getLifecycleState()} / t=${Math.round(timeMs)}ms / containers ${containerParents} / Q=${readParentId(readElement(runner, 'transfer-q'))} K=${readParentId(readElement(runner, 'transfer-k'))} / Q-list ${readOutletOrder(runner, 'q-content-outlet')} / K-list ${readOutletOrder(runner, 'k-content-outlet')} / owners ${contentOwners} / declared active ${readDeclaredTransitions(timeMs)} / ghosts ${overlay.ghosts}, hidden ${overlay.hidden} / epoch ${runner.getMaterializationEpoch()}`
    seek.value = String(Math.min(TIMELINE_END_MS, timeMs))
    seekLabel.value = `${Math.round(timeMs)}ms`
    if (playing && timeMs >= TIMELINE_END_MS) {
      runner.pause()
      playing = false
      play.textContent = 'Play'
    }
    requestAnimationFrame(present)
  }

  /** Starts or pauses playback owned by the HTML runner. */
  function togglePlay(): void {
    if (playing) {
      runner.pause()
      playing = false
      play.textContent = 'Play'
      return
    }
    if (runner.getCurrentTimeMs() >= TIMELINE_END_MS) runner.seek(0)
    runner.play()
    playing = true
    play.textContent = 'Pause'
  }

  debug.textContent = `SceneDoc: ${HOST_ID}\nRunner-owned motion graph and overlay lifecycle\nContainers: A/B 0→10000ms, C/D 1000→10000ms\nQ/K: 1000→9000ms\nContent: ${CONTENT_EXCHANGES.map((exchange) => `${exchange.timeMs}ms ${exchange.itemId}`).join(', ')}`
  showError(error, [])
  play.addEventListener('click', togglePlay)
  reset.addEventListener('click', () => {
    if (playing) runner.pause()
    playing = false
    const result = runner.seek(0)
    if (!result.ok) showError(error, result.diagnostics.errors)
    else showError(error, [])
    play.textContent = 'Play'
  })
  seek.addEventListener('input', () => {
    if (playing) runner.pause()
    playing = false
    const result = runner.seek(Number(seek.value))
    if (!result.ok) showError(error, result.diagnostics.errors)
    else showError(error, [])
    play.textContent = 'Play'
  })
  for (const checkpoint of checkpoints) {
    checkpoint.addEventListener('click', () => {
      if (playing) runner.pause()
      playing = false
      const result = runner.seek(Number(checkpoint.dataset.time))
      if (!result.ok) showError(error, result.diagnostics.errors)
      else showError(error, [])
      play.textContent = 'Play'
    })
  }

  /** Rebuilds measured endpoints after the responsive root changes size. */
  function refreshAfterResize(): void {
    try {
      runner.resize()
      showError(error, [])
    } catch (resizeError) {
      error.hidden = false
      error.textContent = resizeError instanceof Error ? resizeError.message : String(resizeError)
    }
  }

  const resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(refreshAfterResize)
  if (resizeObserver !== undefined) resizeObserver.observe(stage)
  else window.addEventListener('resize', refreshAfterResize)
  window.addEventListener('beforeunload', () => {
    resizeObserver?.disconnect()
    runner.destroy()
  }, { once: true })
  requestAnimationFrame(present)
}

const app = document.querySelector<HTMLElement>('#app')
if (app !== null) mountFlipStressDemo(app)
