/**
 * Bibliothèque de commandes LOCALE au sequence-editor — même contrat que
 * `app/commands/base-commands.ts` : chaque commande est une mutation PURE
 * `(EditorScene, args) → EditorScene`, testable par entrée→sortie sans DOM,
 * sans état interne. Le contrôleur central (`app/commands/facade.ts`) est
 * la SEULE voie d'écriture qui les invoque et remplace le document dans son
 * contexte — cette bibliothèque n'est jamais elle-même possesseur d'une
 * scène (`2026-07-13-controller-islands-bridge-plan.md` §3bis : une
 * DEUXIÈME BIBLIOTHÈQUE de fonctions pures, pas une deuxième voie
 * d'écriture).
 *
 * Périmètre : tout ce qui est spécifique à la mécanique timeline
 * (keyframes, marqueurs, visibilité de piste, durée de scène). Les
 * opérations de structure du document (déplacer/supprimer un item) restent
 * dans `base-commands.ts`, réutilisées telles quelles par le sequence-editor
 * via la façade centrale (`attachItem` pour TRACK.MOVE, `deleteItem` pour
 * TRACK.REMOVE) — pas dupliquées ici.
 *
 * La création de keyframe (`createNamedKeyframe`) N'appelle PAS le
 * `createKeyframe` central : le sequence-editor a besoin de choisir l'id du
 * keyframe À L'AVANCE (stable pendant tout un geste de drag, cf.
 * `CLIP.START_DRAW`) et, pour l'outillage de clip, de poser les labels optionnels
 * `name: 'intro'|'outro'` à la création — deux besoins que `createKeyframe` central
 * (id généré en interne, pas de champ `name`) ne couvre pas. Les labels ne définissent
 * pas les frontières V2 ; ce sont les premier/dernier keyframes selon `timeMs`.
 * Un seul point de création ici, jamais deux voies.
 */

import type { EditorScene, Item, Keyframe, MarkerTrack, Marker, Transition, Waveform } from './types'

function requireItem(scene: EditorScene, itemId: string): Item {
  const item = scene.items.find((i) => i.id === itemId)
  if (!item) throw new Error(`no item '${itemId}' in scene`)
  return item
}

function updateItemInScene(scene: EditorScene, itemId: string, updater: (item: Item) => Item): EditorScene {
  return { ...scene, items: scene.items.map((item) => (item.id === itemId ? updater(item) : item)) }
}

/** Tous les descendants de `itemId` par remontées successives de `parentId` — pas de champ `children` à parcourir. */
function descendantIds(items: Item[], itemId: string): string[] {
  const ids: string[] = []
  let frontier = [itemId]
  while (frontier.length > 0) {
    const next: string[] = []
    for (const item of items) {
      if (item.parentId !== null && frontier.includes(item.parentId)) {
        ids.push(item.id)
        next.push(item.id)
      }
    }
    frontier = next
  }
  return ids
}

function pruneOrphanDecors(scene: EditorScene): EditorScene {
  const used = referencedDecorIds(scene)
  const decors = Object.fromEntries(Object.entries(scene.decors).filter(([id]) => used.has(id)))
  return { ...scene, decors }
}

/** Returns every decor id still owned by the scene, including initial and root references. */
function referencedDecorIds(scene: EditorScene): Set<string> {
  const used = new Set<string>()
  if (scene.rootDecorId !== undefined) used.add(scene.rootDecorId)
  for (const item of scene.items) {
    used.add(item.initialDecorId)
    for (const keyframe of item.keyframes) used.add(keyframe.decorId)
  }
  return used
}

function detachKeyframesByMarkerIds(items: Item[], markerIds: ReadonlySet<string>): Item[] {
  return items.map((item) => ({
    ...item,
    keyframes: item.keyframes.map((k) =>
      k.markerId !== undefined && markerIds.has(k.markerId) ? { ...k, markerId: undefined } : k,
    ),
  }))
}

// ─── Keyframes ──────────────────────────────────────────────────────────────

/**
 * Seul point de création de keyframe pour le sequence-editor — `keyframeId` fourni par
 * l'appelant (stable pendant un geste de drag), `decorId` réutilisé s'il existe déjà
 * (partage un décor adjacent), sinon un décor vide est créé — même règle que le
 * `createKeyframe` central (`Keyframe.decorId` toujours non-null).
 */
export function createNamedKeyframe(
  scene: EditorScene,
  args: { itemId: string; keyframeId: string; timeMs: number; decorId?: string; name?: string },
): EditorScene {
  let nextScene = scene
  let decorId = args.decorId
  if (decorId === undefined || !scene.decors[decorId]) {
    decorId = decorId ?? `decor-${args.keyframeId}`
    nextScene = { ...nextScene, decors: { ...nextScene.decors, [decorId]: { id: decorId } } }
  }
  const kf: Keyframe = { id: args.keyframeId, timeMs: args.timeMs, decorId, name: args.name }
  return updateItemInScene(nextScene, args.itemId, (item) => ({
    ...item,
    keyframes: [...item.keyframes, kf].sort((a, b) => a.timeMs - b.timeMs),
  }))
}

export function deleteKeyframe(scene: EditorScene, args: { itemId: string; keyframeId: string }): EditorScene {
  const item = requireItem(scene, args.itemId)
  const removedKf = item.keyframes.find((k) => k.id === args.keyframeId)
  const sceneAfterRemove = updateItemInScene(scene, args.itemId, (i) => ({
    ...i,
    keyframes: i.keyframes.filter((k) => k.id !== args.keyframeId),
  }))
  if (!removedKf) return sceneAfterRemove
  const stillUsed = referencedDecorIds(sceneAfterRemove).has(removedKf.decorId)
  if (stillUsed) return sceneAfterRemove
  const decors = Object.fromEntries(Object.entries(sceneAfterRemove.decors).filter(([id]) => id !== removedKf.decorId))
  return { ...sceneAfterRemove, decors }
}

export function moveKeyframe(scene: EditorScene, args: { itemId: string; keyframeId: string; timeMs: number }): EditorScene {
  return updateItemInScene(scene, args.itemId, (item) => ({
    ...item,
    keyframes: item.keyframes
      .map((k) => (k.id === args.keyframeId ? { ...k, timeMs: args.timeMs } : k))
      .sort((a, b) => a.timeMs - b.timeMs),
  }))
}

export function renameKeyframe(scene: EditorScene, args: { itemId: string; keyframeId: string; name: string | null }): EditorScene {
  return updateItemInScene(scene, args.itemId, (item) => ({
    ...item,
    keyframes: item.keyframes.map((k) => (k.id === args.keyframeId ? { ...k, name: args.name ?? undefined } : k)),
  }))
}

export function assignKeyframeDecor(scene: EditorScene, args: { itemId: string; keyframeId: string; decorId: string }): EditorScene {
  return updateItemInScene(scene, args.itemId, (item) => ({
    ...item,
    keyframes: item.keyframes.map((k) => (k.id === args.keyframeId ? { ...k, decorId: args.decorId } : k)),
  }))
}

export function setKeyframeTransitionIn(
  scene: EditorScene,
  args: { itemId: string; keyframeId: string; transition: Transition | null },
): EditorScene {
  return updateItemInScene(scene, args.itemId, (item) => ({
    ...item,
    keyframes: item.keyframes.map((k) => (k.id === args.keyframeId ? { ...k, transitionIn: args.transition ?? undefined } : k)),
  }))
}

export function setKeyframeTransitionOut(
  scene: EditorScene,
  args: { itemId: string; keyframeId: string; transition: Transition | null },
): EditorScene {
  return updateItemInScene(scene, args.itemId, (item) => ({
    ...item,
    keyframes: item.keyframes.map((k) => (k.id === args.keyframeId ? { ...k, transitionOut: args.transition ?? undefined } : k)),
  }))
}

export function attachMarkerToKeyframe(scene: EditorScene, args: { itemId: string; keyframeId: string; markerId: string }): EditorScene {
  return updateItemInScene(scene, args.itemId, (item) => ({
    ...item,
    keyframes: item.keyframes.map((k) => (k.id === args.keyframeId ? { ...k, markerId: args.markerId } : k)),
  }))
}

export function detachMarkerFromKeyframe(scene: EditorScene, args: { itemId: string; keyframeId: string }): EditorScene {
  return updateItemInScene(scene, args.itemId, (item) => ({
    ...item,
    keyframes: item.keyframes.map((k) => (k.id === args.keyframeId ? { ...k, markerId: undefined } : k)),
  }))
}

/** Vide les keyframes d'un seul item — couvre `KEYFRAME.CLEAR_TRACK` ET `TRACK.RESET_KEYFRAMES` (même opération, deux anciens noms d'event). */
export function clearItemKeyframes(scene: EditorScene, args: { itemId: string }): EditorScene {
  const cleared = updateItemInScene(scene, args.itemId, (item) => ({ ...item, keyframes: [] }))
  return pruneOrphanDecors(cleared)
}

/** Vide les keyframes d'une capsule ET de tous ses descendants (parentId-dérivé, pas de parcours `.children`). */
export function clearCapsuleKeyframes(scene: EditorScene, args: { itemId: string }): EditorScene {
  const clearedIds = new Set([args.itemId, ...descendantIds(scene.items, args.itemId)])
  const items = scene.items.map((i) => (clearedIds.has(i.id) ? { ...i, keyframes: [] } : i))
  return pruneOrphanDecors({ ...scene, items })
}

// ─── Track (item) ───────────────────────────────────────────────────────────

export function toggleItemVisibility(scene: EditorScene, args: { itemId: string }): EditorScene {
  return updateItemInScene(scene, args.itemId, (item) => ({ ...item, visible: !item.visible }))
}

// ─── Marker tracks / markers ────────────────────────────────────────────────

export function addMarkerTrack(scene: EditorScene, args: { markerTrackId: string; label: string; color?: string }): EditorScene {
  const track: MarkerTrack = { id: args.markerTrackId, label: args.label, color: args.color, visible: true, markers: [] }
  return { ...scene, markerTracks: { ...scene.markerTracks, [track.id]: track } }
}

export function removeMarkerTrack(scene: EditorScene, args: { markerTrackId: string }): EditorScene {
  const track = scene.markerTracks[args.markerTrackId]
  const markerIds = new Set(track?.markers.map((m) => m.id) ?? [])
  const markerTracks = { ...scene.markerTracks }
  delete markerTracks[args.markerTrackId]
  const items = detachKeyframesByMarkerIds(scene.items, markerIds)
  return { ...scene, markerTracks, items }
}

export function renameMarkerTrack(scene: EditorScene, args: { markerTrackId: string; label: string }): EditorScene {
  const track = scene.markerTracks[args.markerTrackId]
  if (!track) return scene
  return { ...scene, markerTracks: { ...scene.markerTracks, [args.markerTrackId]: { ...track, label: args.label } } }
}

export function toggleMarkerTrackVisibility(scene: EditorScene, args: { markerTrackId: string }): EditorScene {
  const track = scene.markerTracks[args.markerTrackId]
  if (!track) return scene
  return { ...scene, markerTracks: { ...scene.markerTracks, [args.markerTrackId]: { ...track, visible: !track.visible } } }
}

export function addMarker(scene: EditorScene, args: { markerTrackId: string; marker: Marker }): EditorScene {
  const track = scene.markerTracks[args.markerTrackId]
  if (!track) return scene
  return {
    ...scene,
    markerTracks: { ...scene.markerTracks, [args.markerTrackId]: { ...track, markers: [...track.markers, args.marker] } },
  }
}

/** Déplace le marqueur ET propage aux keyframes qui lui sont attachés (même règle que l'ancien handler de machine.ts). */
export function moveMarker(scene: EditorScene, args: { markerId: string; timeMs: number }): EditorScene {
  const items = scene.items.map((item) => ({
    ...item,
    keyframes: item.keyframes.map((k) => (k.markerId === args.markerId ? { ...k, timeMs: args.timeMs } : k)),
  }))
  const markerTracks = Object.fromEntries(
    Object.entries(scene.markerTracks).map(([id, mt]) => [
      id,
      { ...mt, markers: mt.markers.map((m) => (m.id === args.markerId ? { ...m, timeMs: args.timeMs } : m)) },
    ]),
  )
  return { ...scene, markerTracks, items }
}

export function removeMarker(scene: EditorScene, args: { markerId: string }): EditorScene {
  const markerTracks = Object.fromEntries(
    Object.entries(scene.markerTracks).map(([id, mt]) => [id, { ...mt, markers: mt.markers.filter((m) => m.id !== args.markerId) }]),
  )
  const items = detachKeyframesByMarkerIds(scene.items, new Set([args.markerId]))
  return { ...scene, markerTracks, items }
}

// ─── Audio (item média désigné par masterItemId — document-model §"Le son master") ─

export function setMasterWaveform(scene: EditorScene, args: { waveform: Waveform }): EditorScene {
  const masterItem = scene.masterItemId ? scene.items.find((i) => i.id === scene.masterItemId) : undefined
  if (!masterItem?.contentId) return scene
  const content = scene.contents[masterItem.contentId]
  if (!content) return scene
  return { ...scene, contents: { ...scene.contents, [content.id]: { ...content, waveform: args.waveform } } }
}

// ─── Scene meta ───────────────────────────────────────────────────────────────

export function setSceneDuration(scene: EditorScene, args: { durationMs: number; source?: EditorScene['meta']['durationSource'] }): EditorScene {
  return {
    ...scene,
    meta: { ...scene.meta, durationMs: args.durationMs, durationSource: args.source ?? scene.meta.durationSource },
  }
}

// ─── Command union — composée dans app/controller/types.ts::Command ─────────

export type SequenceEditorCommand =
  | { name: 'createNamedKeyframe'; args: Parameters<typeof createNamedKeyframe>[1] }
  | { name: 'deleteKeyframe'; args: Parameters<typeof deleteKeyframe>[1] }
  | { name: 'moveKeyframe'; args: Parameters<typeof moveKeyframe>[1] }
  | { name: 'renameKeyframe'; args: Parameters<typeof renameKeyframe>[1] }
  | { name: 'assignKeyframeDecor'; args: Parameters<typeof assignKeyframeDecor>[1] }
  | { name: 'setKeyframeTransitionIn'; args: Parameters<typeof setKeyframeTransitionIn>[1] }
  | { name: 'setKeyframeTransitionOut'; args: Parameters<typeof setKeyframeTransitionOut>[1] }
  | { name: 'attachMarkerToKeyframe'; args: Parameters<typeof attachMarkerToKeyframe>[1] }
  | { name: 'detachMarkerFromKeyframe'; args: Parameters<typeof detachMarkerFromKeyframe>[1] }
  | { name: 'clearItemKeyframes'; args: Parameters<typeof clearItemKeyframes>[1] }
  | { name: 'clearCapsuleKeyframes'; args: Parameters<typeof clearCapsuleKeyframes>[1] }
  | { name: 'toggleItemVisibility'; args: Parameters<typeof toggleItemVisibility>[1] }
  | { name: 'addMarkerTrack'; args: Parameters<typeof addMarkerTrack>[1] }
  | { name: 'removeMarkerTrack'; args: Parameters<typeof removeMarkerTrack>[1] }
  | { name: 'renameMarkerTrack'; args: Parameters<typeof renameMarkerTrack>[1] }
  | { name: 'toggleMarkerTrackVisibility'; args: Parameters<typeof toggleMarkerTrackVisibility>[1] }
  | { name: 'addMarker'; args: Parameters<typeof addMarker>[1] }
  | { name: 'moveMarker'; args: Parameters<typeof moveMarker>[1] }
  | { name: 'removeMarker'; args: Parameters<typeof removeMarker>[1] }
  | { name: 'setMasterWaveform'; args: Parameters<typeof setMasterWaveform>[1] }
  | { name: 'setSceneDuration'; args: Parameters<typeof setSceneDuration>[1] }
