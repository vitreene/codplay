import { resolveKeyframeChannel } from '../types'
import type { Decor, EditorScene, Item, Keyframe } from '../types'
import { decorReferences, reassignDecorReferences, type DecorReference } from './decor-sharing'

/** Decor fields written by one edit; nested records merge with the authored values they extend. */
export type DecorFields = Partial<Omit<Decor, 'id'>>

/** Merges one sparse edit into authored decor fields: records merge, every other value replaces. */
function mergeDecorFields(base: DecorFields, patch: DecorFields): DecorFields {
  return Object.fromEntries([
    ...Object.entries(base),
    ...Object.entries(patch).map(([key, value]) => {
      const previous = base[key]
      return isRecord(value) && isRecord(previous)
        ? [key, mergeDecorFields(previous as DecorFields, value as DecorFields)]
        : [key, value]
    }),
  ])
}

/** Identifies plain nested records, the only values merged field by field. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Returns the item's intro: the first pose keyframe, which shares its state with the initial decor. */
function introKeyframe(item: Item): Keyframe | undefined {
  return item.keyframes
    .filter((keyframe) => resolveKeyframeChannel(keyframe) === 'pose')
    .sort((left, right) => left.timeMs - right.timeMs)[0]
}

/**
 * Writes one edit into the decor of an item's keyframe, or of its initial state when `keyframeId`
 * is null — the single copy-on-write rule of the editor:
 * - an edit never changes another reference: a keyframe whose decor is also used elsewhere gets
 *   `forkDecorId`, holding only the sparse edit (the cascade supplies the rest);
 * - the intro (first pose keyframe sharing the initial decor) and the initial state are one state:
 *   their edit is written into the initial decor, and every other reference to it first receives
 *   `forkDecorId`, a copy of the previous content.
 */
export function setItemDecor(
  scene: EditorScene,
  args: { itemId: string; keyframeId: string | null; patch: DecorFields; forkDecorId: string },
): EditorScene {
  const item = scene.items.find((candidate) => candidate.id === args.itemId)
  if (item === undefined) throw new Error(`setItemDecor: no item '${args.itemId}' in scene`)
  const keyframe = args.keyframeId === null ? undefined : item.keyframes.find((candidate) => candidate.id === args.keyframeId)
  if (args.keyframeId !== null && keyframe === undefined) {
    throw new Error(`setItemDecor: no keyframe '${args.keyframeId}' on item '${args.itemId}'`)
  }
  const decorId = keyframe?.decorId ?? item.initialDecorId
  const decor = scene.decors[decorId]
  if (decor === undefined) throw new Error(`setItemDecor: no decor '${decorId}' in scene`)

  const intro = introKeyframe(item)
  const writesInitial = decorId === item.initialDecorId && (keyframe === undefined || keyframe.id === intro?.id)
  /** Reports whether a reference is the edited state itself (intro and initial being one state). */
  const isEdited = (reference: DecorReference): boolean => reference.kind !== 'root' && reference.itemId === item.id
    && (reference.kind === 'initial'
      ? writesInitial
      : reference.keyframeId === keyframe?.id || (writesInitial && reference.keyframeId === intro?.id))
  const others = decorReferences(scene, decorId).filter((reference) => !isEdited(reference))
  const { id: _id, ...fields } = decor
  const edited = { ...decor, ...mergeDecorFields(fields, args.patch), id: decorId }

  if (others.length === 0) return { ...scene, decors: { ...scene.decors, [decorId]: edited } }
  if (writesInitial) {
    return reassignDecorReferences({
      ...scene,
      decors: { ...scene.decors, [decorId]: edited, [args.forkDecorId]: { ...decor, id: args.forkDecorId } },
    }, others, args.forkDecorId)
  }
  return reassignDecorReferences({
    ...scene,
    decors: { ...scene.decors, [args.forkDecorId]: { ...mergeDecorFields({}, args.patch), id: args.forkDecorId } },
  }, [{ kind: 'keyframe', itemId: item.id, keyframeId: keyframe!.id }], args.forkDecorId)
}
