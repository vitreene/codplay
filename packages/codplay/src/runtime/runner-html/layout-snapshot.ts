import { captureHtmlPose, createHtmlPoseCaptureContext } from '../motion/html-pose'
import { isMeasurableHtmlElement } from './element-guards'
import {
  composeMotionPose,
  createMotionRootPose,
  deriveRelativeMotionPose,
  type LayoutItemSnapshot,
  type LayoutSnapshot,
} from '../motion'
import type { SolvedScene } from '../player'

/**
 * Captures one root-relative layout state from the supplied author nodes.
 *
 * The optional selection keeps the snapshot proportional to the motion being
 * planned. Ancestors are added because their poses are required to compose a
 * selected item's local attachment; no DOM node is retained in the snapshot.
 */
export function captureHtmlLayoutSnapshot(
  root: Element,
  nodes: ReadonlyMap<string, unknown>,
  scene: SolvedScene,
  selection?: ReadonlySet<string>,
  rootKey?: string,
): LayoutSnapshot {
  if (!isMeasurableHtmlElement(root)) return emptySnapshot(scene)
  const captureContext = createHtmlPoseCaptureContext()
  const hostRootPose = captureHtmlPose(root, captureContext)
  const rootCoordinatePose = createMotionRootPose()
  const selectedItemIds = resolveSelection(scene, selection)
  const measured = new Map<string, ReturnType<typeof captureHtmlPose>>()
  for (const perso of Object.values(scene.persos)) {
    if (!perso.placement.mounted || !selectedItemIds.has(perso.key)) continue
    const node = nodes.get(perso.key)
    if (isMeasurableHtmlElement(node)) measured.set(perso.key, captureHtmlPose(node, captureContext))
  }

  const items = new Map<string, LayoutItemSnapshot>()
  for (const itemId of selectedItemIds) visit(itemId)
  const revision = `${scene.graph.revision}:${scene.timeMs}:${JSON.stringify([...items.values()].map((item) => [
    item.itemId,
    item.parentItemId,
    item.targetId,
    item.targetOrder,
    item.localPose.origin,
    item.localPose.layoutOrigin,
    item.localPose.matrix,
    item.localPose.width,
    item.localPose.height,
  ]))}`
  return Object.freeze({
    timeMs: scene.timeMs,
    revision,
    rootPose: hostRootPose,
    ...(rootKey === undefined ? {} : { rootKey }),
    items,
  })

  /** Captures parents before children so every local relation uses one snapshot. */
  function visit(itemId: string): void {
    if (items.has(itemId)) return
    const pose = measured.get(itemId)
    const targetId = scene.graph.targetByPerso[itemId]
    if (pose === undefined || targetId === undefined) return
    const parentItemId = scene.graph.parentByPerso[itemId]
    const targetOrder = resolveTargetOrder(scene, targetId, itemId)
    if (parentItemId !== undefined) visit(parentItemId)
    const parentPose = parentItemId === undefined ? hostRootPose : measured.get(parentItemId)
    const localPose = parentPose === undefined
      ? deriveRelativeMotionPose(hostRootPose, pose)
      : deriveRelativeMotionPose(parentPose, pose)
    const rootLocalPose = deriveRelativeMotionPose(hostRootPose, pose)
    items.set(itemId, Object.freeze({
      itemId,
      ...(parentItemId === undefined ? {} : { parentItemId }),
      targetId,
      targetOrder,
      localPose,
      rootPose: composeMotionPose(rootCoordinatePose, rootLocalPose),
      ...(rootKey === undefined ? {} : { motionRootKey: rootKey }),
      motionRootPose: hostRootPose,
    }))
  }
}

/** Reads one item's structural index from the solved target order. */
function resolveTargetOrder(scene: SolvedScene, targetId: string, itemId: string): number {
  const index = scene.graph.childrenByTarget[targetId]?.indexOf(itemId) ?? -1
  // A source target can be absent during FIRST capture. Its destination
  // attachment supplies the authoritative order when the item is mounted.
  return index < 0 ? Number.MAX_SAFE_INTEGER : index
}

/** Selects mounted items and closes an explicit selection over its ancestors. */
function resolveSelection(scene: SolvedScene, selection: ReadonlySet<string> | undefined): ReadonlySet<string> {
  if (selection === undefined) {
    return new Set(Object.values(scene.persos)
      .filter((perso) => perso.placement.mounted)
      .map((perso) => perso.key))
  }
  const selected = new Set<string>()
  for (const itemId of selection) {
    const perso = scene.persos[itemId]
    if (perso?.placement.mounted) selected.add(itemId)
    let parentItemId = scene.graph.parentByPerso[itemId]
    while (parentItemId !== undefined && !selected.has(parentItemId)) {
      const parent = scene.persos[parentItemId]
      if (parent?.placement.mounted) selected.add(parentItemId)
      parentItemId = scene.graph.parentByPerso[parentItemId]
    }
  }
  return selected
}

/** Returns an empty snapshot for hosts without browser geometry, such as structural tests. */
function emptySnapshot(scene: SolvedScene): LayoutSnapshot {
  return Object.freeze({
    timeMs: scene.timeMs,
    revision: `${scene.graph.revision}:${scene.timeMs}:unmeasured`,
    rootPose: createMotionRootPose(),
    items: new Map(),
  })
}
