import type { EditorScene, Item } from '../types'
import { createId } from '../ids'
import { decorReferences } from '../item-decor/decor-sharing'

/** Changes the whole item's rotation policy and clears manual angles on entry to tangent mode. */
export function setItemRotationMode(
  scene: EditorScene,
  args: { itemId: string; mode: NonNullable<Item['rotationMode']> },
): EditorScene {
  const item = scene.items.find((candidate) => candidate.id === args.itemId)
  if (item === undefined || (item.rotationMode ?? 'manual') === args.mode) return scene
  if (args.mode === 'manual') {
    return { ...scene, items: scene.items.map((candidate) => candidate === item ? { ...item, rotationMode: args.mode } : candidate) }
  }

  /** A decor also referenced by the root or another item is copied before its angles are reset. */
  const isForeign = (decorId: string): boolean => decorReferences(scene, decorId)
    .some((reference) => reference.kind === 'root' || reference.itemId !== item.id)
  const decorIds = new Set([item.initialDecorId, ...item.keyframes.map((keyframe) => keyframe.decorId)])
  const replacements = new Map<string, string>()
  const decors = { ...scene.decors }
  decorIds.forEach((decorId) => {
    const decor = decors[decorId]
    if (decor?.offset?.rotate === undefined) return
    const nextId = isForeign(decorId) ? createId('decor') : decorId
    const { rotate: _rotate, ...offset } = decor.offset
    decors[nextId] = { ...decor, id: nextId, offset }
    replacements.set(decorId, nextId)
  })
  return {
    ...scene,
    decors,
    items: scene.items.map((candidate) => candidate !== item ? candidate : {
      ...item,
      rotationMode: args.mode,
      initialDecorId: replacements.get(item.initialDecorId) ?? item.initialDecorId,
      keyframes: item.keyframes.map((keyframe) => ({
        ...keyframe,
        decorId: replacements.get(keyframe.decorId) ?? keyframe.decorId,
      })),
    }),
  }
}
