// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { animate } from 'animejs'

import { createAnimationAdapter, type AnimeImplementation } from '../../src/animation/adapter'
import { setContainerQueryRootNode } from '../../src/runtime/components/lib/container-query-units'
import type { TransitionRequest } from '../../src/animation/types'

/**
 * `2026-07-25-perso-state-at-t-plan.md` §4.2 — vérifie qu'une transition-miroir (même `from`/`to`
 * BRUTS, `target` un objet simple au lieu du node) reste FIDÈLE à la transition réelle : les deux
 * doivent converger vers le même ratio de progression au même instant, mais dans des unités
 * différentes — le node en px résolu (`resolveContainerQueryValue`), le miroir dans l'unité perso
 * native (`cqw`, jamais convertie, `target instanceof Element` étant faux pour un objet simple).
 */

function temp__createRealAnimeImplementation(): AnimeImplementation {
  return (parameters) => {
    const { targets, ...rest } = parameters
    return animate(targets as Parameters<typeof animate>[0], rest as Parameters<typeof animate>[1])
  }
}

function temp__createSceneRootWithChild(rect: { width: number; height: number }): HTMLElement {
  const container = document.createElement('div')
  Object.defineProperty(container, 'getBoundingClientRect', { value: () => rect })

  const child = document.createElement('div')
  container.appendChild(child)
  document.body.appendChild(container)

  setContainerQueryRootNode(container)

  return child
}

async function sleep(durationMs: number): Promise<void> {
  const startedAtMs = Date.now()
  while (Date.now() - startedAtMs < durationMs) {
    await new Promise<void>((resolve) => setTimeout(resolve, 16))
  }
}

describe('V1 - perso state mirror transition stays faithful to the real node transition', () => {
  it('mirror target receives the raw perso unit (cqw) while the node receives the resolved px, at the same progress ratio', async () => {
    const child = temp__createSceneRootWithChild({ width: 1000, height: 500 })
    const adapter = createAnimationAdapter(temp__createRealAnimeImplementation())

    const realTransition: TransitionRequest = {
      transitionId: 'tr-real',
      eventId: 'evt-1',
      eventName: 'intro',
      listenerId: 'item-1',
      property: 'width',
      target: child,
      from: '0cqw',
      to: '100cqw',
      duration: 300,
      easing: 'linear'
    }

    const mirror: Record<string, unknown> = {}
    const mirrorTransition: TransitionRequest = {
      ...realTransition,
      transitionId: 'tr-mirror',
      target: mirror
    }

    adapter.run([realTransition, mirrorTransition])

    await sleep(150)

    const nodeWidthPx = Number.parseFloat(child.style.width)
    const mirrorWidthCqw = Number.parseFloat(String(mirror.width))

    // Le node est résolu en px, contre la largeur du conteneur (1000px) — jamais un nombre cqw brut.
    expect(child.style.width.endsWith('px')).toBe(true)
    expect(nodeWidthPx).toBeGreaterThan(0)
    expect(nodeWidthPx).toBeLessThan(1000)

    // Le miroir reste dans l'unité perso native (cqw) — jamais convertie (target non-Element, no-op).
    expect(String(mirror.width).endsWith('cqw')).toBe(true)
    expect(mirrorWidthCqw).toBeGreaterThan(0)
    expect(mirrorWidthCqw).toBeLessThan(100)

    // Les deux progressent au même ratio (± tolérance de timing) : node/1000 ≈ mirror/100.
    const nodeProgress = nodeWidthPx / 1000
    const mirrorProgress = mirrorWidthCqw / 100
    expect(Math.abs(nodeProgress - mirrorProgress)).toBeLessThan(0.1)

    await sleep(300)
    expect(Number.parseFloat(child.style.width)).toBeGreaterThanOrEqual(990)
    expect(Number.parseFloat(String(mirror.width))).toBeGreaterThanOrEqual(99)

    setContainerQueryRootNode(null)
  })
})
