import { PROJECT_EDIT_HEARTBEAT_MS } from '../../config/api-config'

type ProjectEditorLockMessage =
  | Readonly<{ type: 'request'; projectId: string; senderId: string }>
  | Readonly<{ type: 'force'; projectId: string; senderId: string }>

const ACCESS_RECOVERY_FAILURE_LIMIT = 3

export interface ProjectEditorLockLifecycle {
  onAccessWaiting(): void
  onAccessGranted(force?: boolean): Promise<boolean | void>
  onAccessSuspending(): Promise<void>
  onAccessPriorityRequest?(): Promise<boolean>
  onAccessHeartbeat?(): Promise<boolean>
  onAccessLost?(error: unknown): Promise<void>
  onAccessRecoveryRequired?(error: unknown): void
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
  private ownsAccess = false
  private grantReady = false
  private wantsAccess = false
  private started = false
  private releaseTask: Promise<void> | null = null
  private releaseFailed = false
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private heartbeatTask: Promise<void> | null = null
  private forceInProgress = false
  private priorityRequest: Promise<void> | null = null
  private priorityFailureCount = 0

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
    window.addEventListener('pointerdown', this.onUserInteraction, true)
    window.addEventListener('keydown', this.onUserInteraction, true)
    window.addEventListener('online', this.onOnline)
    window.addEventListener('pagehide', this.onPageHide)
    if (this.pageCanEdit()) this.requestAccess()
    else this.lifecycle.onAccessWaiting()
  }

  /** Bypasses a held browser lock and asks the server to replace its current grant. */
  public forceAccess(): void {
    if (!this.pageCanEdit() || this.ownsAccess || this.forceInProgress) return
    this.forceInProgress = true
    this.wantsAccess = true
    this.lifecycle.onAccessWaiting()
    this.channel.postMessage({ type: 'force', projectId: this.projectId, senderId: this.instanceId } satisfies ProjectEditorLockMessage)
    void this.holdAccess(false, true).finally(() => {
      this.forceInProgress = false
      if (this.wantsAccess && this.pageCanEdit() && !this.ownsAccess) this.requestAccess()
    })
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
    window.removeEventListener('pointerdown', this.onUserInteraction, true)
    window.removeEventListener('keydown', this.onUserInteraction, true)
    window.removeEventListener('online', this.onOnline)
    window.removeEventListener('pagehide', this.onPageHide)
    this.channel.close()
  }

  /** Requests or releases access as this window changes visibility. */
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

  /** Requests edit priority after interaction in a confirmed, focused reader. */
  private readonly onUserInteraction = (): void => {
    if (!this.pageCanEdit() || this.ownsAccess || this.forceInProgress || this.priorityRequest !== null) return
    this.priorityRequest = (async () => {
      try {
        if (await this.lifecycle.onAccessPriorityRequest?.() !== true) return
        if (!this.pageCanEdit() || this.ownsAccess || this.forceInProgress) return
        this.forceAccess()
      } catch (error) {
        this.recordPriorityFailure(error)
      }
    })().finally(() => {
      this.priorityRequest = null
    })
  }

  /** Retries a held grant or an unfinished handoff when the network returns. */
  private readonly onOnline = (): void => {
    this.retry()
  }

  /** Retries a retained lock handoff or requests an available local lock. */
  public retry(): void {
    if (this.pageCanEdit()) this.wantsAccess = true
    if (this.ownsAccess && this.grantReady) {
      if (this.releaseFailed) {
        void this.releaseAccess().catch(() => undefined)
        return
      }
      void this.renewAccess()
      return
    }
    this.requestAccess()
  }

  /** Releases ownership on page navigation or closure. */
  private readonly onPageHide = (): void => {
    this.wantsAccess = false
    void this.releaseAccess().catch(() => undefined)
  }

  /** Yields to a same-origin request or locally suspends after a forced takeover. */
  private readonly onMessage = (event: MessageEvent<unknown>): void => {
    const message = readLockMessage(event.data)
    if (message === null || message.projectId !== this.projectId || message.senderId === this.instanceId) return
    if (message.type === 'force') {
      this.wantsAccess = false
      void this.loseAccess(new Error('edit_access_lost'))
      return
    }
    if (this.ownsAccess) {
      this.wantsAccess = false
      void this.releaseAccess().catch(() => undefined)
    }
  }

  /** Queues an exclusive native lock and announces the request to its current owner. */
  private requestAccess(): void {
    if (!this.pageCanEdit() || this.forceInProgress) return
    this.wantsAccess = true
    if (this.accessRequest !== null) return
    this.lifecycle.onAccessWaiting()
    this.channel.postMessage({ type: 'request', projectId: this.projectId, senderId: this.instanceId } satisfies ProjectEditorLockMessage)

    this.accessRequest = navigator.locks.request(this.lockName, { mode: 'exclusive' }, async (lock) => {
      if (lock === null || this.ownsAccess || this.forceInProgress || !this.wantsAccess || !this.pageCanEdit()) return
      await this.holdAccess(true, false)
    }).catch((error: unknown) => {
      this.wantsAccess = false
      this.lifecycle.onAccessError(error)
    }).finally(() => {
      this.accessRequest = null
      if (this.wantsAccess && !this.forceInProgress && this.pageCanEdit()) this.requestAccess()
    })
  }

  /** Keeps the editor session until it is safely suspended, with or without a native lock. */
  private async holdAccess(nativeLockOwned: boolean, force: boolean): Promise<void> {
    if (this.ownsAccess) return
    let release!: () => void
    const released = new Promise<void>((resolve) => { release = resolve })
    this.releaseLock = release
    this.ownsAccess = true
    this.grantReady = false

    try {
      const granted = await this.lifecycle.onAccessGranted(force)
      if (granted === false) {
        this.wantsAccess = false
        if (force) this.recordPriorityFailure(new Error('edit_access_occupied'))
        release()
        return
      }
      this.priorityFailureCount = 0
      this.grantReady = true
      this.startHeartbeat()
      if (!this.wantsAccess || !this.pageCanEdit()) await this.releaseAccess().catch(() => undefined)
      await released
    } catch (error) {
      this.wantsAccess = false
      if (force) this.recordPriorityFailure(error)
      else this.lifecycle.onAccessError(error)
      release()
    } finally {
      this.stopHeartbeat()
      this.ownsAccess = false
      this.grantReady = false
      this.releaseLock = null
      if (!nativeLockOwned && this.wantsAccess && this.pageCanEdit()) this.requestAccess()
    }
  }

  /** Renews the server lease and suspends local editing when renewal fails. */
  private renewAccess(): Promise<void> {
    if (!this.ownsAccess || !this.grantReady || this.lifecycle.onAccessHeartbeat === undefined) return Promise.resolve()
    if (this.heartbeatTask !== null) return this.heartbeatTask
    this.heartbeatTask = (async () => {
      try {
        if (await this.lifecycle.onAccessHeartbeat?.() === false) await this.loseAccess(new Error('edit_access_lost'))
      } catch (error) {
        await this.loseAccess(error)
      } finally {
        this.heartbeatTask = null
      }
    })()
    return this.heartbeatTask
  }

  /** Starts lease renewal while this page holds its server grant. */
  private startHeartbeat(): void {
    this.stopHeartbeat()
    if (this.lifecycle.onAccessHeartbeat === undefined) return
    this.heartbeatTimer = setInterval(() => { void this.renewAccess() }, PROJECT_EDIT_HEARTBEAT_MS)
  }

  /** Stops lease renewal after the grant is released or lost. */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = null
  }

  /** Suspends local editing without publishing through an unavailable or revoked grant. */
  private async loseAccess(error: unknown): Promise<void> {
    if (!this.ownsAccess || !this.grantReady) return
    this.wantsAccess = false
    this.grantReady = false
    this.stopHeartbeat()
    try {
      await this.lifecycle.onAccessLost?.(error)
    } catch (lossError) {
      this.lifecycle.onAccessError(lossError)
    } finally {
      this.lifecycle.onAccessError(error)
      this.releaseLock?.()
    }
  }

  /** Delays recovery messaging until repeated interaction requests have failed. */
  private recordPriorityFailure(error: unknown): void {
    this.priorityFailureCount += 1
    if (this.priorityFailureCount < ACCESS_RECOVERY_FAILURE_LIMIT) return
    this.lifecycle.onAccessRecoveryRequired?.(error)
  }

  /** Checks whether this running editor window is currently eligible to edit. */
  private pageCanEdit(): boolean {
    return this.started && document.visibilityState === 'visible' && document.hasFocus()
  }

  /** Waits for XState and IndexedDB to settle before handing the lock over. */
  private async releaseAccess(): Promise<void> {
    if (!this.ownsAccess || !this.grantReady || this.releaseLock === null) return
    if (this.releaseTask !== null) return this.releaseTask

    this.releaseTask = (async () => {
      try {
        await this.lifecycle.onAccessSuspending()
        this.releaseFailed = false
        this.grantReady = false
        this.stopHeartbeat()
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

/** Accepts only recognized handoff messages for this project. */
function readLockMessage(value: unknown): ProjectEditorLockMessage | null {
  if (typeof value !== 'object' || value === null) return null
  const message = value as Partial<ProjectEditorLockMessage>
  if (message.type !== 'request' && message.type !== 'force') return null
  if (typeof message.projectId !== 'string' || typeof message.senderId !== 'string') return null
  return { type: message.type, projectId: message.projectId, senderId: message.senderId }
}
