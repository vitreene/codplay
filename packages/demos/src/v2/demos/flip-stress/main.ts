import { createCoreRuntimeCatalog } from '../../../../../codplay-v2/src/runtime/catalog'
import type { RuntimeCapabilityCatalog } from '../../../../../codplay-v2/src/runtime/catalog'
import { HtmlPlayerRunner } from '../../../../../codplay-v2/src/runtime/runner'
import { createRuntimeTelco } from '../../../../../codplay-v2/src/runtime/telco'
import { SceneBuilder } from '../../../../../codplay-v2/src/scene/compiled'
import type { PersoDoc, SceneDoc } from '../../../../../codplay-v2/src/scene/types'
import type { V2DemoMountContext } from '../../layout/types'

import './style.css'

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
const REVEAL_OPACITY_DURATION_MS = 400
const CONTENT_FIRST_EXCHANGE_MS = 1_200
const CONTENT_EXCHANGE_SPACING_MS = 500
const TIMELINE_END_MS = 10_000
const CONTENT_EASE = 'inOutQuad'
const CENTER_CURVE_PATH = 'M 0 0 A 0.8 0.8 0 0 0 1 0'

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

/** Creates one moving transfer layout with a stable label and list outlet. */
function transferLayoutMarkup(label: string, outletId: string, className: string): string {
  return `<section class="transfer-frame ${className}"><h3 class="transfer-frame__label">${label}</h3><div class="transfer-frame__outlet" data-part="${outletId}"></div></section>`
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

/** Builds a deterministic smooth two-lobed path for one moving content item. */
function createSmoothContentPath(itemId: ContentId): string {
  const random = createDeterministicRandom(`flip-stress:${itemId}`)
  const radiusX = 0.5 + random() * 0.24
  const radiusY = 0.32 + random() * 0.4
  const rotation = -18 + random() * 36
  const firstSweep = random() < 0.5 ? 0 : 1
  const secondSweep = firstSweep === 1 ? 0 : 1
  return [
    'M 0 0',
    `A ${formatPathNumber(radiusX)} ${formatPathNumber(radiusY)} ${formatPathNumber(rotation)} 0 ${firstSweep} 0.5 0`,
    `A ${formatPathNumber(radiusX)} ${formatPathNumber(radiusY)} ${formatPathNumber(rotation)} 0 ${secondSweep} 1 0`,
  ].join(' ')
}

/** Creates one declarative content move between the Q and K outlets. */
function contentPerso(exchange: ContentExchange): PersoDoc {
  const target = exchange.to === 'q' ? 'transfer-q' : 'transfer-k'
  return {
    id: exchange.itemId,
    type: 'tag',
    initial: {
      tag: 'span',
      move: { target: exchange.from === 'q' ? 'transfer-q' : 'transfer-k' },
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
              path: createSmoothContentPath(exchange.itemId),
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
              move: '@off',
              markup: containerMarkup('C', 'source bas gauche', 'stress-c-outlet', 'stress-container--c'),
            },
            actions: {
              revealC: {
                move: '@root',
                style: {
                  ...responsiveVerticalStyle('bottom', '5%', '28%', SECONDARY_CONTAINER_DURATION_MS),
                  opacity: { from: 0, to: 1, duration: REVEAL_OPACITY_DURATION_MS, ease: 'linear' },
                },
              },
            },
          },
          {
            id: 'stress-d',
            type: 'layout',
            initial: {
              move: '@off',
              markup: containerMarkup('D', 'cible bas droite', 'stress-d-outlet', 'stress-container--d'),
            },
            actions: {
              revealD: {
                move: '@root',
                style: {
                  ...responsiveVerticalStyle(
                    'top',
                    'min(52%, calc(100% - var(--stress-container-size)))',
                    'min(75%, calc(100% - var(--stress-container-size)))',
                    SECONDARY_CONTAINER_DURATION_MS,
                  ),
                  opacity: { from: 0, to: 1, duration: REVEAL_OPACITY_DURATION_MS, ease: 'linear' },
                },
              },
            },
          },
          {
            id: 'transfer-q-frame',
            type: 'layout',
            initial: {
              move: { target: 'stress-a-outlet' },
              markup: transferLayoutMarkup('Q', 'transfer-q-outlet', 'transfer-frame--q'),
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
            id: 'transfer-k-frame',
            type: 'layout',
            initial: {
              move: { target: 'stress-d-outlet' },
              markup: transferLayoutMarkup('K', 'transfer-k-outlet', 'transfer-frame--k'),
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
          {
            id: 'transfer-q',
            type: 'list',
            initial: {
              tag: 'section',
              move: { target: 'transfer-q-outlet' },
              className: 'transfer-container',
              attr: { role: 'list', 'aria-label': 'Q' },
            },
          },
          {
            id: 'transfer-k',
            type: 'list',
            initial: {
              tag: 'section',
              move: { target: 'transfer-k-outlet' },
              className: 'transfer-container',
              attr: { role: 'list', 'aria-label': 'K' },
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
      'transfer-q-outlet',
      'transfer-k-outlet',
    ],
  })
  return catalog
}

/** Mounts the declarative stress scene through the shared V2 layout and telco. */
export function mount(context: V2DemoMountContext): () => void {
  context.stage.innerHTML = `
    <div class="stress-stage" id="stress-stage" aria-label="declarative FLIP stress scene"></div>
  `

  const stage = context.stage.querySelector<HTMLElement>('#stress-stage')!

  const catalog = createRuntimeCatalog()
  const build = buildScene(catalog)
  if (!build.ok) {
    context.log(`SceneDoc build failed: ${build.diagnostics.errors.map((entry) => entry.message).join(' · ')}`, 'error')
    return () => undefined
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
    context.log(`Runner init failed: ${init.diagnostics.errors.map((entry) => entry.message).join(' · ')}`, 'error')
    runner.destroy()
    return () => undefined
  }


  const telco = createRuntimeTelco({
    durationMs: TIMELINE_END_MS,
    target: {
      getLifecycleState: () => runner.getLifecycleState(),
      getCurrentTimeMs: () => runner.getCurrentTimeMs(),
      getRate: () => runner.getRate(),
      play: () => runner.play(),
      pause: () => runner.pause(),
      setRate: (rate) => runner.setRate(rate),
      seek: (timeMs) => {
        const result = runner.seek(timeMs)
        return { ok: result.ok }
      },
    },
  })
  context.setTelco(telco)
  context.log(`FLIP stress initialisée · durée=${TIMELINE_END_MS}ms`)

  /** Rebuilds measured endpoints after the responsive root changes size. */
  function refreshAfterResize(): void {
    try {
      runner.resize()
    } catch (resizeError) {
      const message = resizeError instanceof Error ? resizeError.message : String(resizeError)
      context.log(message, 'error')
    }
  }

  const resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(refreshAfterResize)
  if (resizeObserver !== undefined) resizeObserver.observe(stage)
  else window.addEventListener('resize', refreshAfterResize)

  return () => {
    resizeObserver?.disconnect()
    if (resizeObserver === undefined) globalThis.removeEventListener('resize', refreshAfterResize)
    telco.destroy()
    runner.destroy()
  }
}
