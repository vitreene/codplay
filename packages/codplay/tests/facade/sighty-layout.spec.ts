/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createSightyLayout } from '../../../demos/src/sighty/layout/layout'
import type {
  SightyDemoDefinition,
  SightyDemoSession,
} from '../../../demos/src/sighty/layout/types'

/** Waits for the asynchronous initialization started by the shared layout. */
function flushLayout(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve))
}

/** Creates the minimal page structure required by the shared Sighty frame. */
function createPage(): HTMLElement {
  const app = document.createElement('div')
  app.innerHTML = `
    <main data-sighty-layout>
      <h1 data-sighty-title></h1>
      <select data-sighty-selector></select>
      <span data-sighty-status></span>
      <button data-sighty-log-toggle></button>
      <div data-sighty-body>
        <section class="stage-frame">
          <div data-sighty-stage></div>
          <aside>
            <section data-sighty-log-panel hidden>
              <pre data-sighty-log-output></pre>
              <button data-sighty-log-copy></button>
              <button data-sighty-log-close></button>
            </section>
          </aside>
        </section>
        <footer data-sighty-footer>
          <section data-sighty-optional-zone hidden><div data-sighty-demo-controls></div></section>
          <section class="sighty-layout__remote"><div data-sighty-remote></div></section>
        </footer>
      </div>
    </main>
  `
  document.body.append(app)
  return app
}

/** Builds a session spy that exposes one optional demo-specific control. */
function createSession(withControls: boolean): {
  session: SightyDemoSession
  play: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
  relaunch: ReturnType<typeof vi.fn>
  initialize: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
} {
  const play = vi.fn(async () => undefined)
  const pause = vi.fn(async () => undefined)
  const relaunch = vi.fn(async () => undefined)
  const initialize = vi.fn(async () => undefined)
  const destroy = vi.fn()
  const session: SightyDemoSession = {
    transport: { play, pause, relaunch },
    initialize,
    ...(withControls
      ? {
          createOptionalControls: (container: HTMLElement) => {
            const marker = document.createElement('span')
            marker.dataset.demoControl = 'demo1'
            container.append(marker)
            return { destroy: () => container.replaceChildren() }
          },
        }
      : {}),
    destroy,
  }
  return { session, play, pause, relaunch, initialize, destroy }
}

describe('shared Sighty demo layout', () => {
  afterEach(() => {
    globalThis.localStorage.clear()
    document.body.replaceChildren()
  })

  it('shares the remote, selector, logs and optional demo controls', async () => {
    const app = createPage()
    const first = createSession(true)
    const firstAfterReset = createSession(true)
    const second = createSession(false)
    let firstMountCount = 0
    const demos: SightyDemoDefinition[] = [
      {
        id: 'demo1',
        title: 'Démo 1',
        create: () => {
          firstMountCount += 1
          return firstMountCount === 1 ? first.session : firstAfterReset.session
        },
      },
      { id: 'demo2', title: 'Démo 2', create: () => second.session },
    ]

    const layout = createSightyLayout({ app, demos, active: demos[0]! })
    await flushLayout()

    expect(app.querySelector('[data-sighty-title]')?.textContent).toBe('Démo 1')
    const stage = app.querySelector<HTMLElement>('.stage-frame')!
    const footer = app.querySelector<HTMLElement>('[data-sighty-footer]')!
    const optionalZone = app.querySelector<HTMLElement>('[data-sighty-optional-zone]')!
    const remotePanel = app.querySelector<HTMLElement>('.sighty-layout__remote')!
    expect(stage.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(app.querySelector('[data-sighty-demo-controls] [data-demo-control]')).not.toBeNull()
    expect(optionalZone.compareDocumentPosition(remotePanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(app.querySelectorAll('[data-sighty-remote] button')).toHaveLength(2)

    const remoteButton = app.querySelector<HTMLButtonElement>('[data-sighty-remote] button')!
    const resetButton = app.querySelector<HTMLButtonElement>('[data-sighty-remote] button[aria-label="Remise à zéro"]')!
    expect(remoteButton.getAttribute('aria-label')).toBe('Pause')
    expect(remoteButton.querySelector('.sighty-remote__label')).toBeNull()
    remoteButton.click()
    await flushLayout()
    expect(first.pause).toHaveBeenCalledOnce()
    expect(remoteButton.getAttribute('aria-label')).toBe('Lire')
    remoteButton.click()
    await flushLayout()
    expect(first.play).toHaveBeenCalledOnce()
    expect(remoteButton.getAttribute('aria-label')).toBe('Pause')
    resetButton.click()
    await flushLayout()
    await flushLayout()
    expect(first.relaunch).not.toHaveBeenCalled()
    expect(first.destroy).toHaveBeenCalledOnce()
    expect(firstAfterReset.initialize).toHaveBeenCalledOnce()
    const resetRemoteButton = app.querySelector<HTMLButtonElement>('[data-sighty-remote] button')!
    expect(resetRemoteButton.getAttribute('aria-label')).toBe('Pause')

    const logToggle = app.querySelector<HTMLButtonElement>('[data-sighty-log-toggle]')!
    const logPanel = app.querySelector<HTMLElement>('[data-sighty-log-panel]')!
    logToggle.click()
    expect(logPanel.hidden).toBe(false)

    const selector = app.querySelector<HTMLSelectElement>('[data-sighty-selector]')!
    selector.value = 'demo2'
    selector.dispatchEvent(new Event('change'))
    await flushLayout()
    await flushLayout()

    expect(first.destroy).toHaveBeenCalledOnce()
    expect(firstAfterReset.destroy).toHaveBeenCalledOnce()
    expect(app.querySelector('[data-sighty-title]')?.textContent).toBe('Démo 2')
    expect(app.querySelector('[data-sighty-demo-controls] [data-demo-control]')).toBeNull()
    expect(app.querySelector('[data-sighty-optional-zone]')?.hasAttribute('hidden')).toBe(true)

    layout.destroy()
    expect(second.destroy).toHaveBeenCalledOnce()
  })

  it('can omit the shared transport for a scenario that has its own controls', async () => {
    const app = createPage()
    const session = createSession(true)
    const demo: SightyDemoDefinition = {
      id: 'demo1',
      title: 'Démo 1',
      create: () => ({ ...session.session, showRemote: false }),
    }

    const layout = createSightyLayout({ app, demos: [demo], active: demo })
    await flushLayout()

    expect(app.querySelector<HTMLElement>('.sighty-layout__remote')?.hasAttribute('hidden')).toBe(true)
    expect(app.querySelectorAll('[data-sighty-remote] button')).toHaveLength(0)
    layout.destroy()
  })
})
