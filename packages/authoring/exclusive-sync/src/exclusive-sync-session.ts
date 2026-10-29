export interface EditGrant {
  readonly grantId: string
}

export interface ConfirmedValue<T> {
  readonly revision: number
  readonly value: T
}

export interface ExclusiveSyncPorts<T> {
  acquire(): Promise<EditGrant | null>
  release(grant: EditGrant): Promise<void>
  stillHeld(grant: EditGrant): Promise<boolean>
  readConfirmed(): Promise<ConfirmedValue<T>>
  publishPending(): Promise<void>
  installConfirmed(confirmed: ConfirmedValue<T>): Promise<void>
  setEditable(editable: boolean): void
}

/** Coordinates one exclusive editor without owning its document or transport. */
export class ExclusiveSyncSession<T> {
  private readonly ports: ExclusiveSyncPorts<T>
  private pending: Promise<void> = Promise.resolve()
  private grant: EditGrant | null = null
  private displayedRevision: number | null = null
  private editable = false

  public constructor(ports: ExclusiveSyncPorts<T>) {
    this.ports = ports
  }

  /** Reads a confirmed value for a page that does not own editing. */
  public refreshReader(): Promise<void> {
    return this.serialize(async () => {
      if (this.grant !== null) {
        if (await this.ports.stillHeld(this.grant)) return
        this.grant = null
      }
      const confirmed = await this.ports.readConfirmed()
      if (confirmed.revision === this.displayedRevision) return
      await this.ports.installConfirmed(confirmed)
      this.displayedRevision = confirmed.revision
    })
  }

  /** Acquires editing and completes pending publication before activation. */
  public requestEdit(): Promise<boolean> {
    return this.serialize(async () => {
      this.setEditable(false)
      if (this.grant !== null && !await this.ports.stillHeld(this.grant)) this.grant = null
      if (this.grant === null) this.grant = await this.ports.acquire()
      if (this.grant === null) return false
      await this.ports.publishPending()
      const confirmed = await this.ports.readConfirmed()
      await this.ports.installConfirmed(confirmed)
      this.displayedRevision = confirmed.revision
      this.setEditable(true)
      return true
    })
  }

  /** Suspends commands, publishes the current state, then releases ownership. */
  public yieldEdit(): Promise<void> {
    this.setEditable(false)
    return this.serialize(async () => {
      const grant = this.grant
      if (grant === null) return
      await this.ports.publishPending()
      try {
        await this.ports.release(grant)
      } catch (error) {
        if (await this.ports.stillHeld(grant)) throw error
      }
      this.grant = null
    })
  }

  /** Returns whether this session still carries an unconfirmed editing grant. */
  public hasGrant(): boolean {
    return this.grant !== null
  }

  /** Releases without publication after the application preserves edits in an independent copy. */
  public releaseAfterIndependentCopy(): Promise<void> {
    this.setEditable(false)
    return this.serialize(async () => {
      const grant = this.grant
      if (grant === null) return
      try {
        await this.ports.release(grant)
      } catch (error) {
        if (await this.ports.stillHeld(grant)) throw error
      }
      this.grant = null
    })
  }

  /** Serializes access transitions and confirmed-value installation. */
  private serialize<R>(operation: () => Promise<R>): Promise<R> {
    const result = this.pending.then(operation)
    this.pending = result.then(() => undefined, () => undefined)
    return result
  }

  /** Projects command access only when its value changes. */
  private setEditable(editable: boolean): void {
    if (this.editable === editable) return
    this.editable = editable
    this.ports.setEditable(editable)
  }
}
