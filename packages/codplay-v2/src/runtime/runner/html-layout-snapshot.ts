import { captureHtmlPose } from '../motion/html-pose'
import {
  composeMotionPose,
  createMotionRootPose,
  deriveRelativeMotionPose,
  type LayoutItemSnapshot,
  type LayoutSnapshot,
} from '../motion'
import type { SolvedScene } from '../player'

/** Captures one complete root-relative layout state from an isolated HTML tree. */
export function captureHtmlLayoutSnapshot(
  root: Element,
  nodes: ReadonlyMap<string, unknown>,
  scene: SolvedScene,
): LayoutSnapshot {
  if (!isMeasurableElement(root)) return emptySnapshot(scene)
  const hostRootPose = captureHtmlPose(root)
  const rootCoordinatePose = createMotionRootPose()
  const measured = new Map<string, ReturnType<typeof captureHtmlPose>>()
  for (const perso of Object.values(scene.persos)) {
    if (!perso.placement.mounted) continue
    const node = nodes.get(perso.key)
    if (isMeasurableElement(node)) measured.set(perso.key, captureHtmlPose(node))
  }

  const items = new Map<string, LayoutItemSnapshot>()
  for (const persoKey of scene.graph.rootPersoKeys) visit(persoKey)
  for (const perso of Object.values(scene.persos)) if (perso.placement.mounted) visit(perso.key)
  const revision = `${scene.graph.revision}:${scene.timeMs}:${JSON.stringify([...items.values()].map((item) => [
    item.itemId,
    item.parentItemId,
    item.targetId,
    item.localPose.origin,
    item.localPose.matrix,
    item.localPose.width,
    item.localPose.height,
  ]))}`
  return Object.freeze({ timeMs: scene.timeMs, revision, items })

  /** Captures parents before children so every local relation uses one snapshot. */
  function visit(itemId: string): void {
    if (items.has(itemId)) return
    const pose = measured.get(itemId)
    const targetId = scene.graph.targetByPerso[itemId]
    if (pose === undefined || targetId === undefined) return
    const parentItemId = scene.graph.parentByPerso[itemId]
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
      localPose,
      rootPose: composeMotionPose(rootCoordinatePose, rootLocalPose),
    }))
  }
}

/** Returns an empty snapshot for hosts without browser geometry, such as structural tests. */
function emptySnapshot(scene: SolvedScene): LayoutSnapshot {
  return Object.freeze({ timeMs: scene.timeMs, revision: `${scene.graph.revision}:${scene.timeMs}:unmeasured`, items: new Map() })
}

/** Narrows values to browser elements with a usable document coordinate context. */
function isMeasurableElement(value: unknown): value is Element {
  return typeof Element !== 'undefined'
    && value instanceof Element
    && value.ownerDocument !== undefined
    && typeof (value as Element & { getBoundingClientRect?: unknown }).getBoundingClientRect === 'function'
}
