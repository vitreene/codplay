import type {
  FlipCaptureRequest,
  HtmlFlipProjection,
  HtmlMeasurementTree,
  HtmlPose,
} from '../flip'
import type { SolvedScene } from '../player'

/** The synchronous presentation contract shared by frame and historical work. */
export type PresentationTransaction = Readonly<{
  present: (scene: SolvedScene) => void
  read: (items: readonly string[]) => ReadonlyMap<string, HtmlPose>
  restore: () => void
}>

/** The host callbacks needed to present and restore one HTML scene. */
export type HtmlPresentationTransactionOptions = Readonly<{
  projection: HtmlFlipProjection
  present: (scene: SolvedScene) => void
  restore: () => void
}>

/** Input for one synchronous FIRST/LAST measurement transaction. */
export type HtmlPresentationMeasurementInput = Readonly<{
  description: Readonly<Pick<FlipCaptureRequest, 'hostContextId' | 'projectionEpoch' | 'entries' | 'ancestors'>>
  logicalTimeMs: number
  prepareFirst?: () => void
  presentLast: () => void
  restoreAfter?: boolean
}>

/** Owns the HTML read/write boundary and returns only DOM-free measurement data. */
export class HtmlPresentationTransaction implements PresentationTransaction {
  private readonly projection: HtmlFlipProjection
  private readonly presentScene: (scene: SolvedScene) => void
  private readonly restoreScene: () => void

  /** Creates one transaction around a host projection and scene presenter. */
  constructor(options: HtmlPresentationTransactionOptions) {
    this.projection = options.projection
    this.presentScene = options.present
    this.restoreScene = options.restore
  }

  /** Presents one scene through the host-owned authored and structural path. */
  present(scene: SolvedScene): void {
    this.presentScene(scene)
  }

  /** Reads all requested item poses in one synchronous read phase. */
  read(items: readonly string[]): ReadonlyMap<string, HtmlPose> {
    const result = new Map<string, HtmlPose>()
    for (const itemId of items) result.set(itemId, this.readPose(itemId))
    return result
  }

  /** Restores the caller's current presentation after historical work. */
  restore(): void {
    this.restoreScene()
  }

  /** Executes READ FIRST, WRITE LAST, READ LAST, and optional restoration atomically. */
  measure(input: HtmlPresentationMeasurementInput): HtmlMeasurementTree {
    assertMeasurementScope(input, this.projection)
    const ids = collectMeasurementIds(input.description)
    let first: ReadonlyMap<string, HtmlPose> | undefined
    try {
      input.prepareFirst?.()
      first = this.readMeasurementPoses(input.description, ids)
      input.presentLast()
      const last = this.readMeasurementPoses(input.description, ids)
      return createMeasurementTree(input, first, last)
    } finally {
      if (input.restoreAfter === true) this.restore()
    }
  }

  /** Reads one item with the host's canonical local pose implementation. */
  private readPose(itemId: string): HtmlPose {
    const handle = requireHandle(this.projection, itemId)
    return this.projection.capturePose(handle)
  }

  /** Reads entries and ancestors without interleaving any host write. */
  private readMeasurementPoses(
    description: HtmlPresentationMeasurementInput['description'],
    ids: readonly string[],
  ): ReadonlyMap<string, HtmlPose> {
    const modes = new Map(description.entries.map((entry) => [entry.itemId, entry.mode]))
    const result = new Map<string, HtmlPose>()
    for (const itemId of ids) {
      const handle = requireHandle(this.projection, itemId)
      const mode = modes.get(itemId)
      const pose = mode === 'overlay-world' && this.projection.captureOverlayPose !== undefined
        ? this.projection.captureOverlayPose(handle)
        : this.projection.capturePose(handle)
      result.set(itemId, pose)
    }
    return result
  }
}

/** Ensures a transaction never measures a foreign or stale host presentation. */
function assertMeasurementScope(input: HtmlPresentationMeasurementInput, projection: HtmlFlipProjection): void {
  if (input.description.hostContextId !== projection.getHostContextId()) {
    throw new Error('HTML presentation transaction crosses host contexts.')
  }
  if (input.description.projectionEpoch !== projection.getProjectionEpoch()) {
    throw new Error('HTML presentation transaction uses a stale host projection epoch.')
  }
}

/** Collects every entry and ancestor exactly once for the shared read phases. */
function collectMeasurementIds(
  description: HtmlPresentationMeasurementInput['description'],
): readonly string[] {
  return [...new Set([
    ...(description.ancestors ?? []).map((ancestor) => ancestor.ancestorId),
    ...description.entries.map((entry) => entry.itemId),
  ])]
}

/** Builds the immutable DOM-free tree after both read phases have completed. */
function createMeasurementTree(
  input: HtmlPresentationMeasurementInput,
  first: ReadonlyMap<string, HtmlPose>,
  last: ReadonlyMap<string, HtmlPose>,
): HtmlMeasurementTree {
  const items = input.description.entries.map((entry) => Object.freeze({
    itemId: entry.itemId,
    ancestorIds: Object.freeze([...entry.ancestorIds]),
    mode: entry.mode ?? 'local' as const,
    first: requirePose(first, entry.itemId),
    last: requirePose(last, entry.itemId),
    ...(entry.path === undefined ? {} : { path: entry.path }),
  }))
  const ancestors = (input.description.ancestors ?? []).map((ancestor) => Object.freeze({
    ancestorId: ancestor.ancestorId,
    ...(ancestor.parentId === undefined ? {} : { parentId: ancestor.parentId }),
    regime: ancestor.regime,
    first: requirePose(first, ancestor.ancestorId),
    last: requirePose(last, ancestor.ancestorId),
  }))
  return Object.freeze({
    hostContextId: input.description.hostContextId,
    projectionEpoch: input.description.projectionEpoch,
    logicalTimeMs: input.logicalTimeMs,
    items: Object.freeze(items),
    ancestors: Object.freeze(ancestors),
  })
}

/** Resolves one pose from a completed synchronous read phase. */
function requirePose(poses: ReadonlyMap<string, HtmlPose>, itemId: string): HtmlPose {
  const pose = poses.get(itemId)
  if (pose === undefined) throw new Error(`HTML presentation pose is missing: ${itemId}`)
  return pose
}

/** Resolves one live HTML handle without exposing it outside the transaction. */
function requireHandle(projection: HtmlFlipProjection, itemId: string): unknown {
  const handle = projection.resolveHandle(itemId)
  if (handle === undefined || handle === null) throw new Error(`FLIP HTML handle is missing: ${itemId}`)
  return handle
}
