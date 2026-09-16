/** Names the internal phases that govern composition-changing admissions. */
export type RuntimeNavigationPhase = 'ready' | 'changing'

/** Identifies one reserved composition-changing admission. */
export type RuntimeTransitionLease = Readonly<{
  id: number
}>

/** Serializes composition-changing intentions before they enter the operation queue. */
export class RuntimeNavigationStateMachine {
  private phase: RuntimeNavigationPhase = 'ready'
  private nextLeaseId = 1
  private activeLease: RuntimeTransitionLease | undefined

  /** Reserves the changing phase for one transition intent, if it is available. */
  acquireTransition(): RuntimeTransitionLease | undefined {
    if (this.phase !== 'ready') return undefined
    const lease = { id: this.nextLeaseId }
    this.nextLeaseId += 1
    this.phase = 'changing'
    this.activeLease = lease
    return lease
  }

  /** Releases a transition reservation only when it belongs to the current intent. */
  releaseTransition(lease: RuntimeTransitionLease): void {
    if (this.activeLease?.id !== lease.id) return
    this.activeLease = undefined
    this.phase = 'ready'
  }

  /** Reports whether a composition-changing intent is currently reserved. */
  isChanging(): boolean {
    return this.phase === 'changing'
  }
}
