import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProjectEditorLock } from './project-editor-lock'

interface PendingLockRequest {
  readonly callback: (lock: unknown) => Promise<void>
  readonly resolve: () => void
  readonly reject: (error: unknown) => void
}

afterEach(() => {
  vi.useRealTimers()
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

  it('keeps edit access while the native file picker is open and imports before a queued handoff', async () => {
    const fileInput = { type: 'file' } as HTMLInputElement
    const { requests, setFocused, setVisible, grantAccess, broadcastMessage, dispatchFileInputEvent } = installBrowserLock(true)
    const sequence: string[] = []
    const onAccessGranted = vi.fn(async () => {})
    const onAccessSuspending = vi.fn(async () => { sequence.push('suspend') })
    const editorLock = new ProjectEditorLock('project-file-picker-handoff', {
      onAccessWaiting: vi.fn(),
      onAccessGranted,
      onAccessSuspending,
      onAccessError: vi.fn(),
    })

    editorLock.start()
    grantAccess(0)
    await vi.waitFor(() => expect(onAccessGranted).toHaveBeenCalledOnce())

    document.addEventListener('change', () => { sequence.push('change') })
    dispatchFileInputEvent('click', fileInput)
    setFocused(false)
    setVisible(false)
    window.dispatchEvent(new Event('blur'))
    document.dispatchEvent(new Event('visibilitychange'))
    broadcastMessage({ type: 'request', projectId: 'project-file-picker-handoff', senderId: 'waiting-editor' })
    expect(onAccessSuspending).not.toHaveBeenCalled()

    dispatchFileInputEvent('change', fileInput)
    await Promise.resolve()
    expect(onAccessSuspending).not.toHaveBeenCalled()
    expect(requests[0]?.resolve).not.toHaveBeenCalled()

    setFocused(true)
    window.dispatchEvent(new Event('focus'))
    expect(onAccessSuspending).not.toHaveBeenCalled()
    setVisible(true)
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() => expect(onAccessSuspending).toHaveBeenCalledOnce())

    expect(sequence).toEqual(['change', 'suspend'])
    await vi.waitFor(() => expect(requests[0]?.resolve).toHaveBeenCalledOnce())
    await editorLock.stop()
  })

  it('retains edit access when the picker returns focus before its change event', async () => {
    const fileInput = { type: 'file' } as HTMLInputElement
    const { setFocused, grantAccess, dispatchFileInputEvent } = installBrowserLock(true)
    const onAccessGranted = vi.fn(async () => {})
    const onAccessSuspending = vi.fn(async () => {})
    const editorLock = new ProjectEditorLock('project-file-picker-focus-order', {
      onAccessWaiting: vi.fn(),
      onAccessGranted,
      onAccessSuspending,
      onAccessError: vi.fn(),
    })

    editorLock.start()
    grantAccess(0)
    await vi.waitFor(() => expect(onAccessGranted).toHaveBeenCalledOnce())

    dispatchFileInputEvent('click', fileInput)
    setFocused(false)
    window.dispatchEvent(new Event('blur'))
    setFocused(true)
    window.dispatchEvent(new Event('focus'))
    dispatchFileInputEvent('change', fileInput)
    await Promise.resolve()

    expect(onAccessSuspending).not.toHaveBeenCalled()
    await editorLock.stop()
  })

  it('ends a canceled picker focus exception so a later ordinary blur releases access', async () => {
    const fileInput = { type: 'file' } as HTMLInputElement
    const { setFocused, grantAccess, dispatchFileInputEvent } = installBrowserLock(true)
    const onAccessGranted = vi.fn(async () => {})
    const onAccessSuspending = vi.fn(async () => {})
    const editorLock = new ProjectEditorLock('project-file-picker-cancel', {
      onAccessWaiting: vi.fn(),
      onAccessGranted,
      onAccessSuspending,
      onAccessError: vi.fn(),
    })

    editorLock.start()
    grantAccess(0)
    await vi.waitFor(() => expect(onAccessGranted).toHaveBeenCalledOnce())

    dispatchFileInputEvent('click', fileInput)
    setFocused(false)
    window.dispatchEvent(new Event('blur'))
    dispatchFileInputEvent('cancel', fileInput)
    await Promise.resolve()
    expect(onAccessSuspending).not.toHaveBeenCalled()

    setFocused(true)
    window.dispatchEvent(new Event('focus'))
    expect(onAccessSuspending).not.toHaveBeenCalled()

    setFocused(false)
    window.dispatchEvent(new Event('blur'))
    await vi.waitFor(() => expect(onAccessSuspending).toHaveBeenCalledOnce())
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

  it('takes the explicit force path without waiting for the browser lock', async () => {
    const { lock, setFocused } = installBrowserLock(false)
    const onAccessGranted = vi.fn(async () => {})
    const editorLock = new ProjectEditorLock('project-forced-lock', {
      onAccessWaiting: vi.fn(),
      onAccessGranted,
      onAccessSuspending: vi.fn(async () => {}),
      onAccessError: vi.fn(),
    })

    editorLock.start()
    setFocused(true)
    editorLock.forceAccess()

    await vi.waitFor(() => expect(onAccessGranted).toHaveBeenCalledWith(true))
    expect(lock.request).not.toHaveBeenCalled()
    await editorLock.stop()
  })

  it('requests edit priority after interaction when the reader confirms it is synchronized', async () => {
    const { lock, setFocused } = installBrowserLock(false)
    const onAccessPriorityRequest = vi.fn(async () => true)
    const onAccessGranted = vi.fn(async () => false)
    const editorLock = new ProjectEditorLock('project-interaction-priority', {
      onAccessWaiting: vi.fn(),
      onAccessGranted,
      onAccessSuspending: vi.fn(async () => {}),
      onAccessPriorityRequest,
      onAccessError: vi.fn(),
    })

    editorLock.start()
    setFocused(true)
    window.dispatchEvent(new Event('pointerdown'))

    await vi.waitFor(() => expect(onAccessGranted).toHaveBeenCalledWith(true))
    expect(onAccessPriorityRequest).toHaveBeenCalledTimes(1)
    expect(lock.request).not.toHaveBeenCalled()
    await editorLock.stop()
  })

  it('shows access recovery only after three failed priority requests from interaction', async () => {
    const { setFocused } = installBrowserLock(false)
    const onAccessPriorityRequest = vi.fn(async () => true)
    const onAccessGranted = vi.fn(async () => false)
    const onAccessRecoveryRequired = vi.fn()
    const editorLock = new ProjectEditorLock('project-recovery-after-interaction', {
      onAccessWaiting: vi.fn(),
      onAccessGranted,
      onAccessSuspending: vi.fn(async () => {}),
      onAccessPriorityRequest,
      onAccessRecoveryRequired,
      onAccessError: vi.fn(),
    })

    editorLock.start()
    setFocused(true)
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      window.dispatchEvent(new Event('pointerdown'))
      await vi.waitFor(() => expect(onAccessGranted).toHaveBeenCalledTimes(attempt))
      if (attempt < 3) expect(onAccessRecoveryRequired).not.toHaveBeenCalled()
    }

    expect(onAccessPriorityRequest).toHaveBeenCalledTimes(3)
    await vi.waitFor(() => expect(onAccessRecoveryRequired).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'edit_access_occupied' }),
    ))
    await editorLock.stop()
  })

  it('offers access recovery when a native lock request remains queued', async () => {
    const { lock } = installBrowserLock(true)
    vi.useFakeTimers()
    const onAccessRecoveryRequired = vi.fn()
    const editorLock = new ProjectEditorLock('project-native-lock-timeout', {
      onAccessWaiting: vi.fn(),
      onAccessGranted: vi.fn(async () => {}),
      onAccessSuspending: vi.fn(async () => {}),
      onAccessRecoveryRequired,
      onAccessError: vi.fn(),
    })

    editorLock.start()
    expect(lock.request).toHaveBeenCalledOnce()
    expect(onAccessRecoveryRequired).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(5000)

    expect(onAccessRecoveryRequired).toHaveBeenCalledOnce()
    expect(onAccessRecoveryRequired).toHaveBeenCalledWith(expect.objectContaining({
      message: 'edit_access_wait_timeout',
    }))
    await editorLock.stop()
  })

  it('does not preempt another editor when the reader is not synchronized', async () => {
    const { lock, setFocused } = installBrowserLock(false)
    const onAccessPriorityRequest = vi.fn(async () => false)
    const onAccessGranted = vi.fn(async () => {})
    const editorLock = new ProjectEditorLock('project-unsynchronized-reader', {
      onAccessWaiting: vi.fn(),
      onAccessGranted,
      onAccessSuspending: vi.fn(async () => {}),
      onAccessPriorityRequest,
      onAccessError: vi.fn(),
    })

    editorLock.start()
    setFocused(true)
    window.dispatchEvent(new Event('keydown'))

    await vi.waitFor(() => expect(onAccessPriorityRequest).toHaveBeenCalledTimes(1))
    expect(onAccessGranted).not.toHaveBeenCalled()
    expect(lock.request).not.toHaveBeenCalled()
    await editorLock.stop()
  })

  it('suspends a same-origin owner when another page broadcasts a force takeover', async () => {
    const { grantAccess, broadcastMessage } = installBrowserLock(true)
    const onAccessGranted = vi.fn(async () => {})
    const onAccessLost = vi.fn(async () => {})
    const editorLock = new ProjectEditorLock('project-force-message', {
      onAccessWaiting: vi.fn(),
      onAccessGranted,
      onAccessSuspending: vi.fn(async () => {}),
      onAccessLost,
      onAccessError: vi.fn(),
    })

    editorLock.start()
    grantAccess(0)
    await vi.waitFor(() => expect(onAccessGranted).toHaveBeenCalledTimes(1))
    broadcastMessage({ type: 'force', projectId: 'project-force-message', senderId: 'other-page' })

    await vi.waitFor(() => expect(onAccessLost).toHaveBeenCalledWith(expect.any(Error)))
    await editorLock.stop()
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
  setVisible(visible: boolean): void
  grantAccess(index: number): void
  broadcastMessage(message: unknown): void
  dispatchFileInputEvent(type: 'click' | 'change' | 'cancel', input: HTMLInputElement): void
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

  const channels: FakeBroadcastChannel[] = []
  class FakeBroadcastChannel extends EventTarget {
    public constructor(_name: string) { super(); channels.push(this) }
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
    setVisible: (visible) => { documentTarget.visibilityState = visible ? 'visible' : 'hidden' },
    broadcastMessage: (message) => {
      for (const channel of channels) {
        channel.dispatchEvent(Object.assign(new Event('message'), { data: message }))
      }
    },
    dispatchFileInputEvent: (type, input) => {
      const event = new Event(type, { bubbles: true })
      Object.defineProperty(event, 'composedPath', { value: () => [input] })
      documentTarget.dispatchEvent(event)
    },
    grantAccess: (index) => {
      const pending = requests[index]
      if (pending === undefined) throw new Error(`No lock request exists at index ${index}.`)
      void pending.callback({ name: 'test-project-lock' }).then(pending.resolve, pending.reject)
    },
  }
}
