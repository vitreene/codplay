import type { EditorScene } from '../types'

/** One document place that points at a decor. */
export type DecorReference =
  | Readonly<{ kind: 'root' }>
  | Readonly<{ kind: 'initial'; itemId: string }>
  | Readonly<{ kind: 'keyframe'; itemId: string; keyframeId: string }>

/** Lists every reference to one decor: the implicit root, item initial decors and keyframes. */
export function decorReferences(scene: EditorScene, decorId: string): DecorReference[] {
  return [
    ...(scene.rootDecorId === decorId ? [{ kind: 'root' as const }] : []),
    ...scene.items.flatMap((item) => [
      ...(item.initialDecorId === decorId ? [{ kind: 'initial' as const, itemId: item.id }] : []),
      ...item.keyframes
        .filter((keyframe) => keyframe.decorId === decorId)
        .map((keyframe) => ({ kind: 'keyframe' as const, itemId: item.id, keyframeId: keyframe.id })),
    ]),
  ]
}

/** Points the given references at another decor, leaving every other reference untouched. */
export function reassignDecorReferences(
  scene: EditorScene,
  references: readonly DecorReference[],
  decorId: string,
): EditorScene {
  const initialItemIds = new Set(references.flatMap((reference) => reference.kind === 'initial' ? [reference.itemId] : []))
  const keyframeIds = new Set(references.flatMap((reference) => reference.kind === 'keyframe'
    ? [`${reference.itemId}\u0000${reference.keyframeId}`]
    : []))
  return {
    ...scene,
    ...(references.some((reference) => reference.kind === 'root') ? { rootDecorId: decorId } : {}),
    items: scene.items.map((item) => ({
      ...item,
      initialDecorId: initialItemIds.has(item.id) ? decorId : item.initialDecorId,
      keyframes: item.keyframes.map((keyframe) => keyframeIds.has(`${item.id}\u0000${keyframe.id}`)
        ? { ...keyframe, decorId }
        : keyframe),
    })),
  }
}
