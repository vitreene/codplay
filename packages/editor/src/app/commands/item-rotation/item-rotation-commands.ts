import type { EditorScene, Item } from '../types'

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

  const foreignDecorIds = new Set([
    scene.rootDecorId,
    ...scene.items.filter((candidate) => candidate !== item)
      .flatMap((candidate) => [candidate.initialDecorId, ...candidate.keyframes.map((keyframe) => keyframe.decorId)]),
  ])
  const decorIds = new Set([item.initialDecorId, ...item.keyframes.map((keyframe) => keyframe.decorId)])
  const replacements = new Map<string, string>()
  const decors = { ...scene.decors }
  decorIds.forEach((decorId) => {
    const decor = decors[decorId]
    if (decor?.offset?.rotate === undefined) return
    const nextId = foreignDecorIds.has(decorId) ? `decor-${crypto.randomUUID()}` : decorId
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
