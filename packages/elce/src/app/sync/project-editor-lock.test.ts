import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProjectEditorLock } from './project-editor-lock'

interface PendingLockRequest {
  readonly callback: (lock: unknown) => Promise<void>
  readonly resolve: () => void
  readonly reject: (error: unknown) => void
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Elcé project editor focus lock', () => {
  it('reacquires access when focus returns during a pending handoff', async () => {
    const { lock, setFocused, grantAccess } = installBrowserLock(true)
    let finishSuspending = () => {}
    const suspended = new Promise<void>((resolve) => { finishSuspending = resolve })
    const onAccessGranted = vi.fn(async () => {})
    const onAccessSuspending = vi.fn(() => suspended)
    const editorLock = new ProjectEditorLock('project-focus-race', {
      onAccessWaiting: vi.fn(),
      onAccessGranted,
      onAccessSuspending,
      onAccessError: vi.fn(),
    })

    editorLock.start()
    expect(lock.request).toHaveBeenCalledTimes(1)
    grantAccess(0)
    await vi.waitFor(() => expect(onAccessGranted).toHaveBeenCalledTimes(1))

    setFocused(false)
    window.dispatchEvent(new Event('blur'))
    await vi.waitFor(() => expect(onAccessSuspending).toHaveBeenCalledTimes(1))

    setFocused(true)
    window.dispatchEvent(new Event('focus'))
    expect(lock.request).toHaveBeenCalledTimes(1)
    finishSuspending()

    await vi.waitFor(() => expect(lock.request).toHaveBeenCalledTimes(2))
    grantAccess(1)
    await vi.waitFor(() => expect(onAccessGranted).toHaveBeenCalledTimes(2))

    onAccessSuspending.mockResolvedValue(undefined)
    await editorLock.stop()
  })

  it('does not request a lock for a visible but unfocused window', () => {
    const { lock, setFocused } = installBrowserLock(false)
    const editorLock = new ProjectEditorLock('project-background-window', {
      onAccessWaiting: vi.fn(),
      onAccessGranted: vi.fn(async () => {}),
      onAccessSuspending: vi.fn(async () => {}),
      onAccessError: vi.fn(),
    })

    editorLock.start()
    expect(lock.request).not.toHaveBeenCalled()

    setFocused(true)
    window.dispatchEvent(new Event('focus'))
    expect(lock.request).toHaveBeenCalledTimes(1)
  })

  it('retains the native lock after a failed handoff and retries without acquiring another one', async () => {
    const { lock, requests, setFocused, grantAccess } = installBrowserLock(true)
    const onAccessSuspending = vi.fn()
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValue(undefined)
    const onAccessError = vi.fn()
    const editorLock = new ProjectEditorLock('project-failed-handoff', {
      onAccessWaiting: vi.fn(),
      onAccessGranted: vi.fn(async () => {}),
      onAccessSuspending,
      onAccessError,
    })

    editorLock.start()
    grantAccess(0)
    setFocused(false)
    window.dispatchEvent(new Event('blur'))
    await vi.waitFor(() => expect(onAccessError).toHaveBeenCalledWith(expect.any(Error)))
    expect(lock.request).toHaveBeenCalledTimes(1)
    expect(requests[0]?.resolve).not.toHaveBeenCalled()

    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(onAccessSuspending).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(requests[0]?.resolve).toHaveBeenCalledTimes(1))
    expect(lock.request).toHaveBeenCalledTimes(1)
    await editorLock.stop()
  })
})

/** Installs browser focus and lock primitives for editor-lock tests. */
function installBrowserLock(initialFocus: boolean): Readonly<{
  lock: { request: ReturnType<typeof vi.fn> }
  requests: PendingLockRequest[]
  setFocused(focused: boolean): void
  grantAccess(index: number): void
}> {
  const windowTarget = new EventTarget()
  const documentTarget = Object.assign(new EventTarget(), {
    visibilityState: 'visible',
    hasFocus: () => initialFocus,
  })
  const requests: PendingLockRequest[] = []
  const request = vi.fn((_name: string, _options: unknown, callback: PendingLockRequest['callback']) => new Promise<void>((resolve, reject) => {
    requests.push({ callback, resolve: vi.fn(resolve), reject })
  }))

  class FakeBroadcastChannel extends EventTarget {
    public constructor(_name: string) { super() }
    public postMessage(_message: unknown): void {}
    public close(): void {}
  }

  vi.stubGlobal('window', windowTarget)
  vi.stubGlobal('document', documentTarget)
  vi.stubGlobal('navigator', { locks: { request } })
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
  vi.stubGlobal('crypto', { randomUUID: () => 'test-editor-lock' })

  return {
    lock: { request },
    requests,
    setFocused: (focused) => { initialFocus = focused },
    grantAccess: (index) => {
      const pending = requests[index]
      if (pending === undefined) throw new Error(`No lock request exists at index ${index}.`)
      void pending.callback({ name: 'test-project-lock' }).then(pending.resolve, pending.reject)
    },
  }
}
