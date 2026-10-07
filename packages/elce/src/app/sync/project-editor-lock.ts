interface ProjectEditorLockMessage {
  readonly type: 'request'
  readonly projectId: string
  readonly senderId: string
}

export interface ProjectEditorLockLifecycle {
  onAccessWaiting(): void
  onAccessGranted(): Promise<void>
  onAccessSuspending(): Promise<void>
  onAccessError(error: unknown): void
}

/** Gives one same-origin Elcé window edit access to a project at a time. */
export class ProjectEditorLock {
  private readonly projectId: string
  private readonly instanceId: string
  private readonly lifecycle: ProjectEditorLockLifecycle
  private readonly channel: BroadcastChannel
  private readonly lockName: string
  private accessRequest: Promise<void> | null = null
  private releaseLock: (() => void) | null = null
  private ownsLock = false
  private grantReady = false
  private wantsAccess = false
  private started = false
  private releaseTask: Promise<void> | null = null

  public constructor(projectId: string, lifecycle: ProjectEditorLockLifecycle) {
    this.projectId = projectId
    this.lifecycle = lifecycle
    this.instanceId = crypto.randomUUID()
    this.lockName = `elce-project:${projectId}`
    this.channel = new BroadcastChannel(this.lockName)
  }

  /** Starts lock requests when this window is visible and listens for handoffs. */
  public start(): void {
    if (this.started) return
    this.started = true
    this.channel.addEventListener('message', this.onMessage)
    document.addEventListener('visibilitychange', this.onVisibilityChange)
    window.addEventListener('focus', this.onFocus)
    window.addEventListener('pagehide', this.onPageHide)
    if (document.visibilityState === 'visible') this.requestAccess()
    else this.lifecycle.onAccessWaiting()
  }

  /** Suspends this window before releasing its project lock. */
  public async stop(): Promise<void> {
    if (!this.started) return
    this.started = false
    this.wantsAccess = false
    this.channel.removeEventListener('message', this.onMessage)
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    window.removeEventListener('focus', this.onFocus)
    window.removeEventListener('pagehide', this.onPageHide)
    await this.releaseAccess()
    this.channel.close()
  }

  /** Requests access when this editor window becomes visible again. */
  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this.wantsAccess = false
      void this.releaseAccess()
      return
    }
    if (document.visibilityState === 'visible') this.requestAccess()
  }

  /** Requests an active project lock when focus returns to this window. */
  private readonly onFocus = (): void => {
    if (document.visibilityState === 'visible') this.requestAccess()
  }

  /** Releases ownership on page navigation or closure. */
  private readonly onPageHide = (): void => {
    this.wantsAccess = false
    void this.releaseAccess()
  }

  /** Yields to a visible same-origin window that explicitly requests ownership. */
  private readonly onMessage = (event: MessageEvent<unknown>): void => {
    const message = readLockMessage(event.data)
    if (message === null || message.projectId !== this.projectId || message.senderId === this.instanceId) return
    if (this.ownsLock) {
      this.wantsAccess = false
      void this.releaseAccess()
    }
  }

  /** Queues an exclusive native lock and announces the request to its current owner. */
  private requestAccess(): void {
    if (!this.started || this.accessRequest !== null || document.visibilityState !== 'visible') return
    this.wantsAccess = true
    this.lifecycle.onAccessWaiting()
    this.channel.postMessage({ type: 'request', projectId: this.projectId, senderId: this.instanceId } satisfies ProjectEditorLockMessage)

    this.accessRequest = navigator.locks.request(this.lockName, { mode: 'exclusive' }, async (lock) => {
      if (lock === null || !this.wantsAccess || document.visibilityState !== 'visible') return
      await this.holdAccess()
    }).catch((error: unknown) => {
      this.wantsAccess = false
      this.lifecycle.onAccessError(error)
    }).finally(() => {
      this.accessRequest = null
      if (this.started && this.wantsAccess && document.visibilityState === 'visible') this.requestAccess()
    })
  }

  /** Keeps the native lock until this window has safely suspended its editor. */
  private async holdAccess(): Promise<void> {
    let release!: () => void
    const released = new Promise<void>((resolve) => { release = resolve })
    this.releaseLock = release
    this.ownsLock = true
    this.grantReady = false

    try {
      await this.lifecycle.onAccessGranted()
      this.grantReady = true
      if (!this.wantsAccess || document.visibilityState !== 'visible') await this.releaseAccess()
      await released
    } catch (error) {
      this.wantsAccess = false
      this.lifecycle.onAccessError(error)
      release()
    } finally {
      this.ownsLock = false
      this.grantReady = false
      this.releaseLock = null
    }
  }

  /** Waits for XState and IndexedDB to settle before handing the lock over. */
  private async releaseAccess(): Promise<void> {
    if (!this.ownsLock || !this.grantReady || this.releaseLock === null) return
    if (this.releaseTask !== null) return this.releaseTask

    this.releaseTask = (async () => {
      try {
        await this.lifecycle.onAccessSuspending()
        this.grantReady = false
        this.releaseLock?.()
      } catch (error) {
        this.lifecycle.onAccessError(error)
      } finally {
        this.releaseTask = null
      }
    })()
    return this.releaseTask
  }
}

/** Accepts only lock handoff messages for this browser API. */
function readLockMessage(value: unknown): ProjectEditorLockMessage | null {
  if (typeof value !== 'object' || value === null) return null
  const message = value as Partial<ProjectEditorLockMessage>
  if (message.type !== 'request' || typeof message.projectId !== 'string' || typeof message.senderId !== 'string') return null
  return { type: 'request', projectId: message.projectId, senderId: message.senderId }
}
