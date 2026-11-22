import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

/** Creates an isolated parent/reader boundary around the actual compatibility bridge. */
function createBridgeEnvironment() {
  const parentOrigin = 'http://host.test'
  const sessionId = 'bridge-test-session'
  const messages = []
  const listeners = new Map()
  let timelineSeconds = 3.456

  const parent = {
    postMessage: (value) => {
      if (typeof value !== 'object' || value === null || !('kind' in value)) return
      messages.push(value)
    },
  }
  const lesson = {
    paused: false,
    navBar: { isPaused: false },
    currentPage: undefined,
    goPause() {
      this.paused = true
    },
    goResume() {
      this.paused = false
    },
  }
  const page = {
    id: 'page112',
    totalDuration: 24.3934375,
    timeLineSlider: { value: '0' },
    pageTimeLine: { time: () => timelineSeconds },
    onSlideDown: () => {
      if (!lesson.navBar.isPaused) lesson.goPause()
      timelineSeconds = Number(page.timeLineSlider.value) / 100 * page.totalDuration
    },
    onSlideUp: () => {
      if (!lesson.navBar.isPaused) lesson.goResume()
    },
  }
  lesson.currentPage = page

  const config = encodeURIComponent(JSON.stringify({
    chapterParameter: '01_introduction',
    pageParameter: 'page112',
  }))
  const window = {
    location: {
      search: `?config=${config}&parentOrigin=${encodeURIComponent(parentOrigin)}&sessionId=${sessionId}`,
      hash: '#/lesson/01_introduction/page112',
    },
    parent,
    shell: { lesson },
    addEventListener: (type, listener) => {
      const typeListeners = listeners.get(type) ?? new Set()
      typeListeners.add(listener)
      listeners.set(type, typeListeners)
    },
    removeEventListener: (type, listener) => {
      listeners.get(type)?.delete(listener)
    },
    setTimeout,
    clearTimeout,
  }
  const document = { body: { dataset: { pageId: 'page112' } } }

  /** Delivers one host message to the bridge's registered window listener. */
  function dispatchMessage(event) {
    for (const listener of listeners.get('message') ?? []) listener(event)
  }

  /** Disposes bridge timers and message listeners after each assertion path. */
  function dispose() {
    for (const listener of listeners.get('pagehide') ?? []) {
      listener({ source: parent, origin: parentOrigin, data: undefined })
    }
  }

  return { document, dispatchMessage, dispose, lesson, messages, parent, parentOrigin, sessionId, window }
}

/** Waits for the bridge's native 100 ms readiness check and initial progress sample. */
function waitForBridgeTimers() {
  return new Promise((resolve) => setTimeout(resolve, 130))
}

describe('external course page bridge', () => {
  it('publishes native page progress and leaves a native seek paused', async () => {
    const environment = createBridgeEnvironment()
    const bridgePath = new URL('../tools/external-course-page/embedded-reader-bridge.js', import.meta.url)
    const bridgeSource = readFileSync(bridgePath, 'utf8')
    const context = createContext({
      URL,
      URLSearchParams,
      MutationObserver: class {
        /** Accepts the bridge's page marker observation without simulating DOM mutations. */
        observe() {}

        /** Releases the inert observer used by this isolated reader fixture. */
        disconnect() {}
      },
      document: environment.document,
      sessionId: environment.sessionId,
      window: environment.window,
    })
    runInContext(bridgeSource, context)

    await waitForBridgeTimers()
    expect(environment.messages.find((message) => message.kind === 'ready')).toMatchObject({
      chapterId: '01_introduction',
      pageId: 'page112',
      sessionId: environment.sessionId,
    })
    expect(environment.messages.find((message) => message.kind === 'progress')).toMatchObject({
      status: 'playing',
      timelineMs: 3_456,
      durationMs: 24_393,
    })

    const seekCommand = runInContext(`({
      version: 1,
      sessionId,
      kind: 'command',
      requestId: 'seek-test',
      command: 'seek',
      targetMs: 12000,
    })`, context)
    environment.dispatchMessage({
      source: environment.parent,
      origin: environment.parentOrigin,
      data: seekCommand,
    })

    expect(environment.messages.find((message) => message.kind === 'seek-result')).toMatchObject({
      requestId: 'seek-test',
      ok: true,
      status: 'paused',
      timelineMs: 12_000,
      durationMs: 24_393,
    })
    expect(environment.lesson.paused).toBe(true)
    environment.dispose()
  })
})
