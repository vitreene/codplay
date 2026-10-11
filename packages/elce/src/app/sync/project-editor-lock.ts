interface ProjectEditorLockMessage {
  readonly type: 'request'
  readonly projectId: string
  readonly senderId: string
}

export interface ProjectEditorLockLifecycle {
  onAccessWaiting(): void
  onAccessGranted(): Promise<boolean | void>
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
  private releaseFailed = false

  public constructor(projectId: string, lifecycle: ProjectEditorLockLifecycle) {
    this.projectId = projectId
    this.lifecycle = lifecycle
    this.instanceId = crypto.randomUUID()
    this.lockName = `elce-project:${projectId}`
    this.channel = new BroadcastChannel(this.lockName)
  }

  /** Starts lock requests only while this visible window has focus. */
  public start(): void {
    if (this.started) return
    this.started = true
    this.channel.addEventListener('message', this.onMessage)
    document.addEventListener('visibilitychange', this.onVisibilityChange)
    window.addEventListener('blur', this.onBlur)
    window.addEventListener('focus', this.onFocus)
    window.addEventListener('online', this.onOnline)
    window.addEventListener('pagehide', this.onPageHide)
    if (this.pageCanEdit()) this.requestAccess()
    else this.lifecycle.onAccessWaiting()
  }

  /** Suspends this window before releasing its project lock. */
  public async stop(): Promise<void> {
    if (!this.started) return
    this.wantsAccess = false
    await this.releaseAccess()
    this.started = false
    this.channel.removeEventListener('message', this.onMessage)
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    window.removeEventListener('blur', this.onBlur)
    window.removeEventListener('focus', this.onFocus)
    window.removeEventListener('online', this.onOnline)
    window.removeEventListener('pagehide', this.onPageHide)
    this.channel.close()
  }

  /** Requests access when this editor window becomes visible again. */
  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this.wantsAccess = false
      void this.releaseAccess().catch(() => undefined)
      return
    }
    if (document.visibilityState === 'visible') this.retry()
  }

  /** Suspends editing and syncs the local document before this window loses focus. */
  private readonly onBlur = (): void => {
    this.wantsAccess = false
    void this.releaseAccess().catch(() => undefined)
  }

  /** Requests an active project lock when focus returns to this window. */
  private readonly onFocus = (): void => {
    this.retry()
  }

  /** Retries an unfinished handoff when the network becomes available. */
  private readonly onOnline = (): void => {
    this.retry()
  }

  /** Retries a retained lock handoff or requests an available local lock. */
  public retry(): void {
    if (this.pageCanEdit()) this.wantsAccess = true
    if (this.ownsLock && this.grantReady) {
      if (this.releaseFailed) void this.releaseAccess().catch(() => undefined)
      return
    }
    this.requestAccess()
  }

  /** Releases ownership on page navigation or closure. */
  private readonly onPageHide = (): void => {
    this.wantsAccess = false
    void this.releaseAccess().catch(() => undefined)
  }

  /** Yields to a visible same-origin window that explicitly requests ownership. */
  private readonly onMessage = (event: MessageEvent<unknown>): void => {
    const message = readLockMessage(event.data)
    if (message === null || message.projectId !== this.projectId || message.senderId === this.instanceId) return
    if (this.ownsLock) {
      this.wantsAccess = false
      void this.releaseAccess().catch(() => undefined)
    }
  }

  /** Queues an exclusive native lock and announces the request to its current owner. */
  private requestAccess(): void {
    if (!this.pageCanEdit()) return
    this.wantsAccess = true
    if (this.accessRequest !== null) return
    this.lifecycle.onAccessWaiting()
    this.channel.postMessage({ type: 'request', projectId: this.projectId, senderId: this.instanceId } satisfies ProjectEditorLockMessage)

    this.accessRequest = navigator.locks.request(this.lockName, { mode: 'exclusive' }, async (lock) => {
      if (lock === null || !this.wantsAccess || !this.pageCanEdit()) return
      await this.holdAccess()
    }).catch((error: unknown) => {
      this.wantsAccess = false
      this.lifecycle.onAccessError(error)
    }).finally(() => {
      this.accessRequest = null
      if (this.wantsAccess && this.pageCanEdit()) this.requestAccess()
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
      const granted = await this.lifecycle.onAccessGranted()
      if (granted === false) {
        this.wantsAccess = false
        release()
        return
      }
      this.grantReady = true
      if (!this.wantsAccess || !this.pageCanEdit()) await this.releaseAccess().catch(() => undefined)
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

  /** Checks whether this running editor window is currently eligible to edit. */
  private pageCanEdit(): boolean {
    return this.started && document.visibilityState === 'visible' && document.hasFocus()
  }

  /** Waits for XState and IndexedDB to settle before handing the lock over. */
  private async releaseAccess(): Promise<void> {
    if (!this.ownsLock || !this.grantReady || this.releaseLock === null) return
    if (this.releaseTask !== null) return this.releaseTask

    this.releaseTask = (async () => {
      try {
        await this.lifecycle.onAccessSuspending()
        this.releaseFailed = false
        this.grantReady = false
        this.releaseLock?.()
      } catch (error) {
        this.releaseFailed = true
        this.lifecycle.onAccessError(error)
        throw error
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
