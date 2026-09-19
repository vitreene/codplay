import type {
  RuntimeTargetIdentity,
  RuntimeTargetRegistration,
} from './runtime-target-types'

type TargetEntry = {
  readonly token: symbol
  readonly value: unknown
  available: boolean
}

/** Stores live opaque host targets for one player without sharing component surfaces. */
export class RuntimeTargetRegistry {
  private readonly entries = new Map<string, TargetEntry>()

  /** Publishes one target and returns an idempotent availability registration. */
  publish(identity: RuntimeTargetIdentity, value: unknown): RuntimeTargetRegistration {
    assertTargetIdentity(identity)
    const key = serializeTargetIdentity(identity)
    const entry: TargetEntry = {
      token: Symbol(key),
      value,
      available: false,
    }
    this.entries.set(key, entry)

    return {
      setAvailable: (available) => {
        if (this.entries.get(key)?.token !== entry.token) return
        entry.available = available
      },
      release: () => {
        if (this.entries.get(key)?.token !== entry.token) return
        this.entries.delete(key)
      },
    }
  }

  /** Resolves one available target or leaves the consumer without a target. */
  resolve(identity: RuntimeTargetIdentity): unknown | undefined {
    assertTargetIdentity(identity)
    const entry = this.entries.get(serializeTargetIdentity(identity))
    return entry?.available === true ? entry.value : undefined
  }

  /** Clears every target owned by this player-local registry. */
  clear(): void {
    this.entries.clear()
  }
}

/** Rejects malformed internal identities before they can alias one another. */
function assertTargetIdentity(identity: RuntimeTargetIdentity): void {
  if (identity.host.trim().length === 0) throw new Error('Runtime target host identity must not be empty.')
  if (identity.target !== undefined && identity.target.trim().length === 0) {
    throw new Error('Runtime target identity must not be empty.')
  }
}

/** Serializes the host and optional target without using a second lookup registry. */
function serializeTargetIdentity(identity: RuntimeTargetIdentity): string {
  return JSON.stringify([identity.host, identity.target ?? null])
}
