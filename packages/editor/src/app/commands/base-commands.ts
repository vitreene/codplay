/**
 * Commandes de base de la façade — elles appliquent les mutations documentaires de l'éditeur V2.
 * Chaque commande est une mutation PURE `(EditorScene, args) → EditorScene`, testable par entrée→sortie
 * sans DOM (même patron que `zone-model.ts` et le Builder). Le contrôleur les invoque et remplace
 * le document dans son contexte — il n'y a pas d'autre voie d'écriture du document.
 */

import type { CapsuleDef, Content, Decor, EditorScene, Item, ItemType, OffsetData } from './types'
import { createId } from './ids'
import { decorReferences } from './item-decor/decor-sharing'
import { nextOrderKey, OrderKeyHardBoundaryError, orderKeyBetween, rebalanceOrderKeys } from './order-key'
import { DEFAULT_DECOR_PRESET } from './default-decor-presets'
import { hasExplicitPlacementGeometry, missingZoneFillStyle } from './offset-placement'
import { capsuleGridForScene, clampZoneRectToGrid, isManualCapsuleType } from '../../capsule-editor/capsule-grid'


/** Les items directement enfants de `parentId` (racine si `null`) — pour calculer la prochaine clé d'ordre. */
function childrenOf(scene: EditorScene, parentId: string | null): Item[] {
  return scene.items.filter((item) => item.parentId === parentId)
}

/**
 * Crée un item `bloc` (sans contenu — `assignType`/`assignContent` le différencient ensuite),
 * positionné par `geometry` (devient le décor initial), attaché sous `parentId` (racine si absent).
 * `geometry` peut venir d'un tracé libre ou du rect d'une zone désignée (voir le mémo de décisions Editor) — cette commande ne distingue pas la source, seulement la valeur.
 */
export function createItem(
  scene: EditorScene,
  args: { geometry: OffsetData; parentId?: string | null; zoneId?: string; itemId?: string; introTimeMs?: number },
): { scene: EditorScene; itemId: string } {
  const parentId = args.parentId ?? null
  const zone = args.zoneId === undefined ? undefined : scene.zones[args.zoneId]
  if (args.zoneId !== undefined && zone === undefined) {
    throw new Error(`createItem: no zone '${args.zoneId}' in scene`)
  }
  if (zone !== undefined && zone.capsuleId !== parentId) {
    throw new Error(`createItem: zone '${args.zoneId}' does not belong to the item's parent capsule`)
  }
  // The caller may choose the id (`createId`) so it can select the item it is creating.
  const itemId = args.itemId ?? createId('item')
  const decorId = createId('decor')

  const decor: Decor = {
    id: decorId,
    ...(Object.keys(args.geometry).length === 0 ? {} : { offset: args.geometry }),
    ...(args.zoneId === undefined ? {} : { zoneId: args.zoneId }),
    ...(zone !== undefined && !hasExplicitPlacementGeometry(args.geometry)
      ? { style: missingZoneFillStyle(undefined, undefined) }
      : {}),
  }
  const order = nextOrderKey(childrenOf(scene, parentId).map((i) => i.order))

  const item: Item = {
    id: itemId,
    type: 'bloc',
    parentId,
    order,
    visible: true,
    contentId: null,
    initialDecorId: decorId,
    // The item is born at `introTimeMs`: its intro is a pose keyframe sharing the initial decor, and its
    // outro keeps its automatic placement (computed by the parent capsule).
    keyframes: args.introTimeMs === undefined ? [] : [{
      id: createId('kf'),
      timeMs: Math.max(0, Math.min(args.introTimeMs, scene.meta.durationMs)),
      decorId,
      channel: 'pose',
    }],
  }

  return {
    scene: {
      ...scene,
      items: [...scene.items, item],
      decors: { ...scene.decors, [decorId]: decor },
    },
    itemId,
  }
}

/**
 * Différencie un `bloc` vers un type concret — seul cas de changement de type autorisé par le
 * modèle actuel (discussion §« Tout item naît en type bloc »). Lève si l'item n'est pas un
 * `bloc` : ce n'est pas une commande de changement de type général.
 */
/**
 * Applique aussi le preset par défaut du type (s'il en existe un) à `item.initialDecorId`, dans le
 * même geste — jamais une commande séparée que l'appelant devrait penser à enchaîner
 * (`specs/item-presentation-spec.md`). Un objet JSON simple appliqué une fois, pas
 * une couche vivante — changer le preset plus tard ne rétroagit pas sur les items déjà créés.
 */
export function assignType(scene: EditorScene, args: { itemId: string; type: ItemType }): EditorScene {
  const item = requireItem(scene, args.itemId)
  if (item.type !== 'bloc') {
    throw new Error(`assignType: item '${args.itemId}' is already type '${item.type}' — type change is only allowed from 'bloc'`)
  }
  const withType = updateItem(scene, args.itemId, (i) => ({ ...i, type: args.type }))
  const preset = DEFAULT_DECOR_PRESET[args.type]
  if (!preset) return withType

  // The geometry is collected before the type is assigned (the creation gesture produces a
  // `bloc` first). A type preset may provide a fallback size, but it must not erase the user's
  // traced position/size while adding the visual defaults. Offset fields therefore merge with
  // the creation decor, with authored geometry taking precedence over preset fallbacks.
  const existingDecor = withType.decors[item.initialDecorId]
  const { offset: presetOffset, ...visualPreset } = preset
  const keepZonePlacement = existingDecor?.zoneId != null
    && !hasExplicitPlacementGeometry(existingDecor.offset)
  const patch = {
    ...visualPreset,
    ...(preset.style === undefined ? {} : { style: { ...preset.style, ...existingDecor?.style } }),
    ...(presetOffset === undefined || keepZonePlacement
      ? {}
      : { offset: { ...presetOffset, ...existingDecor?.offset } }),
  }
  return setDecor(withType, { decorId: item.initialDecorId, patch })
}

/** Renseigne le contenu d'un item déjà typé — crée l'entrée `Content` et la relie via `contentId`. */
export function assignContent(scene: EditorScene, args: { itemId: string; content: Omit<Content, 'id'> }): EditorScene {
  const item = requireItem(scene, args.itemId)
  const contentId = item.contentId ?? createId('content')
  const content: Content = { ...args.content, id: contentId }

  return {
    ...updateItem(scene, args.itemId, (i) => ({ ...i, contentId })),
    contents: { ...scene.contents, [contentId]: content },
  }
}

/** Changes an item's parent and sibling order, rejecting cycles in the hierarchy. */
export function attachItem(
  scene: EditorScene,
  args: { itemId: string; parentId: string | null; order?: string; beforeItemId?: string; afterItemId?: string },
): EditorScene {
  const item = requireItem(scene, args.itemId)
  if (args.parentId !== null && collectDescendantIds(scene, item.id).has(args.parentId)) {
    throw new Error(`cannot attach item '${item.id}' to itself or one of its descendants`)
  }

  const siblings = childrenOf(scene, args.parentId)
    .filter((sibling) => sibling.id !== item.id)
    .sort((left, right) => left.order < right.order ? -1 : left.order > right.order ? 1 : left.id.localeCompare(right.id))
  const explicitOrder = args.order
  if (explicitOrder !== undefined) {
    return updateItem(scene, args.itemId, (current) => ({ ...current, parentId: args.parentId, order: explicitOrder }))
  }
  if (args.beforeItemId === undefined && args.afterItemId === undefined) {
    return updateItem(scene, args.itemId, (current) => ({
      ...current,
      parentId: args.parentId,
      order: nextOrderKey(siblings.map((sibling) => sibling.order)),
    }))
  }

  const beforeIndex = args.beforeItemId === undefined
    ? -1
    : siblings.findIndex((sibling) => sibling.id === args.beforeItemId)
  const afterIndex = args.afterItemId === undefined
    ? -1
    : siblings.findIndex((sibling) => sibling.id === args.afterItemId)
  if ((args.beforeItemId !== undefined && beforeIndex < 0)
    || (args.afterItemId !== undefined && afterIndex < 0)
    || (args.beforeItemId !== undefined && args.afterItemId !== undefined && beforeIndex !== afterIndex + 1)) {
    throw new Error('attachItem insertion anchors must be adjacent siblings of the destination parent')
  }

  const insertionIndex = args.beforeItemId === undefined ? afterIndex + 1 : beforeIndex
  const before = siblings[insertionIndex - 1]
  const after = siblings[insertionIndex]
  let order: string
  try {
    order = orderKeyBetween(before?.order ?? null, after?.order ?? null)
  } catch (error) {
    if (!(error instanceof OrderKeyHardBoundaryError)) throw error
    const reordered = [...siblings]
    reordered.splice(insertionIndex, 0, { ...item, parentId: args.parentId })
    const keys = rebalanceOrderKeys(reordered.length)
    const orderById = new Map(reordered.map((sibling, index) => [sibling.id, keys[index]!]))
    return {
      ...scene,
      items: scene.items.map((current) => orderById.has(current.id)
        ? { ...current, parentId: args.parentId, order: orderById.get(current.id)! }
        : current),
    }
  }
  return updateItem(scene, args.itemId, (current) => ({ ...current, parentId: args.parentId, order }))
}

/** Applique un patch sur un décor existant (style/classes/offset/zone) — fusion superficielle, pas de remplacement total. */
export function setDecor(scene: EditorScene, args: { decorId: string; patch: Partial<Omit<Decor, 'id'>> }): EditorScene {
  const decor = scene.decors[args.decorId]
  if (!decor) throw new Error(`setDecor: no decor '${args.decorId}' in scene`)
  return {
    ...scene,
    decors: { ...scene.decors, [args.decorId]: { ...decor, ...args.patch, id: decor.id } },
  }
}

/**
 * Crée (ou remplace) une entrée vide dans `scene.decors` — le `registerDecor` du copy-on-write
 * : à la modification d'un décor partagé, l'éditeur crée une nouvelle entrée via `registerDecor`
 * et appelle `assignDecor` pour lier le keyframe à ce nouvel id, avant d'écrire les propriétés.
 * Toujours suivie d'un
 * `assignKeyframeDecor` puis d'un `setDecor` dans la même transaction (`decor-editor-bridge.ts`) —
 * jamais appelée seule, même convention que `createNamedKeyframe` (entrée `{id}`
 * vide, remplie par le `setDecor` qui suit).
 */
export function registerDecor(scene: EditorScene, args: { decorId: string }): EditorScene {
  return { ...scene, decors: { ...scene.decors, [args.decorId]: { id: args.decorId } } }
}

/** Crée un item capsule avec son `CapsuleDef` (statique, défini une fois — pas reconfigurable en cours de vie). */
export function createCapsule(
  scene: EditorScene,
  args: { geometry: OffsetData; capsuleDef: CapsuleDef; parentId?: string | null; zoneId?: string; itemId?: string; introTimeMs?: number },
): { scene: EditorScene; itemId: string } {
  const created = createItem(scene, {
    geometry: args.geometry, parentId: args.parentId, zoneId: args.zoneId, itemId: args.itemId, introTimeMs: args.introTimeMs,
  })
  const withType = assignType(created.scene, { itemId: created.itemId, type: 'capsule' })
  const withCapsule = updateItem(withType, created.itemId, (i) => ({ ...i, capsule: args.capsuleDef }))
  return { scene: withCapsule, itemId: created.itemId }
}

/** Updates a capsule definition and applies the editor's temporary grid-change fallback in one document command. */
export function setCapsuleDef(scene: EditorScene, args: { itemId: string; patch: Partial<CapsuleDef> }): EditorScene {
  const item = requireItem(scene, args.itemId)
  if (!item.capsule) throw new Error(`setCapsuleDef: item '${args.itemId}' has no CapsuleDef (not a capsule?)`)
  const nextCapsule = { ...item.capsule, ...args.patch }
  if (args.patch.grid !== undefined) {
    const { rows, cols, gap } = args.patch.grid
    if (!Number.isInteger(rows) || rows < 1 || !Number.isInteger(cols) || cols < 1) {
      throw new RangeError('setCapsuleDef: grid rows and cols must be positive integers')
    }
    if (gap !== undefined && (!Number.isFinite(gap.row) || gap.row < 0 || !Number.isFinite(gap.col) || gap.col < 0)) {
      throw new RangeError('setCapsuleDef: grid gaps must be non-negative finite cqw values')
    }
  }

  const gridWithPotentialGap = nextCapsule.grid
  const normalizedCapsule = gridWithPotentialGap !== undefined
    && isManualCapsuleType(nextCapsule.kind)
    && gridWithPotentialGap.gap !== undefined
    && (gridWithPotentialGap.rows > 32 || gridWithPotentialGap.cols > 32)
    ? { ...nextCapsule, grid: { rows: gridWithPotentialGap.rows, cols: gridWithPotentialGap.cols } }
    : nextCapsule
  const nextScene = updateItem(scene, args.itemId, (current) => ({ ...current, capsule: normalizedCapsule }))
  const previousGrid = capsuleGridForScene(scene, args.itemId)
  const nextGrid = capsuleGridForScene(nextScene, args.itemId)
  const tracksChanged = previousGrid !== null && nextGrid !== null
    && (previousGrid.rows !== nextGrid.rows || previousGrid.cols !== nextGrid.cols)
  if (!tracksChanged || !isManualCapsuleType(normalizedCapsule.kind)) return nextScene

  const zones = { ...nextScene.zones }
  const capsuleZones = Object.values(nextScene.zones).filter((zone) => zone.capsuleId === args.itemId)
  for (const zone of capsuleZones) {
    zones[zone.id] = {
      ...zone,
      surfaces: {
        portrait: clampZoneRectToGrid(zone.surfaces.portrait, nextGrid),
        landscape: clampZoneRectToGrid(zone.surfaces.landscape, nextGrid),
      },
    }
  }

  const orderedChildren = nextScene.items
    .filter((child) => child.parentId === args.itemId)
    .sort((left, right) => left.order < right.order ? -1 : left.order > right.order ? 1 : left.id.localeCompare(right.id))
  const reflowed = orderedChildren.reduce<{ items: Item[]; decors: EditorScene['decors'] }>((current, child, index) => {
    if (capsuleZones.length === 0) return { ...current, items: [...current.items, child] }
    const zone = capsuleZones[Math.min(index, capsuleZones.length - 1)]!
    const decor = current.decors[child.initialDecorId]
    if (decor === undefined) return { ...current, items: [...current.items, child] }
    const zoneFillStyle = hasExplicitPlacementGeometry(decor.offset)
      ? {}
      : missingZoneFillStyle(decor.style, decor.custom)
    const decorWithZone = {
      ...decor,
      zoneId: zone.id,
      ...(Object.keys(zoneFillStyle).length === 0 ? {} : { style: { ...decor.style, ...zoneFillStyle } }),
    }
    if (initialDecorIsShared(nextScene, child)) {
      const decorId = createId('decor')
      return {
        items: [...current.items, { ...child, initialDecorId: decorId }],
        decors: { ...current.decors, [decorId]: { ...decorWithZone, id: decorId } },
      }
    }
    return {
      items: [...current.items, child],
      decors: { ...current.decors, [decor.id]: decorWithZone },
    }
  }, { items: [], decors: { ...nextScene.decors } })
  const reflowedItems = new Map(reflowed.items.map((item) => [item.id, item]))

  return {
    ...nextScene,
    items: nextScene.items.map((item) => reflowedItems.get(item.id) ?? item),
    zones,
    decors: reflowed.decors,
  }
}

/** Reports whether a base decor is also used outside one item's initial state. */
function initialDecorIsShared(scene: EditorScene, item: Item): boolean {
  return decorReferences(scene, item.initialDecorId)
    .some((reference) => reference.kind !== 'initial' || reference.itemId !== item.id)
}

/** Removes an item and its descendants while preserving decor/content references still owned by the remaining scene. */
export function deleteItem(scene: EditorScene, args: { itemId: string }): EditorScene {
  const idsToRemove = collectDescendantIds(scene, args.itemId)
  const removedItems = scene.items.filter((i) => idsToRemove.has(i.id))

  const decorIdsToRemove = new Set<string>()
  const contentIdsToRemove = new Set<string>()
  for (const item of removedItems) {
    decorIdsToRemove.add(item.initialDecorId)
    for (const kf of item.keyframes) decorIdsToRemove.add(kf.decorId)
    if (item.contentId) contentIdsToRemove.add(item.contentId)
  }

  const remainingItems = scene.items.filter((i) => !idsToRemove.has(i.id))
  const remainingDecorIds = new Set<string>()
  const remainingContentIds = new Set<string>()
  if (scene.rootDecorId !== undefined) remainingDecorIds.add(scene.rootDecorId)
  for (const item of remainingItems) {
    remainingDecorIds.add(item.initialDecorId)
    for (const keyframe of item.keyframes) remainingDecorIds.add(keyframe.decorId)
    if (item.contentId !== null) remainingContentIds.add(item.contentId)
  }
  const decors = { ...scene.decors }
  for (const id of decorIdsToRemove) {
    if (!remainingDecorIds.has(id)) delete decors[id]
  }
  const contents = { ...scene.contents }
  for (const id of contentIdsToRemove) {
    if (!remainingContentIds.has(id)) delete contents[id]
  }

  return {
    ...scene,
    items: scene.items.filter((i) => !idsToRemove.has(i.id)),
    decors,
    contents,
  }
}

/** Groupe N commandes sous un seul commit — une macro (lot→carousel, coller…) en est la première instance, pas un cas isolé. */
export function transaction(scene: EditorScene, commands: Array<(s: EditorScene) => EditorScene>): EditorScene {
  return commands.reduce((current, command) => command(current), scene)
}

// ─── Aides internes ─────────────────────────────────────────────────────────

function requireItem(scene: EditorScene, itemId: string): Item {
  const item = scene.items.find((i) => i.id === itemId)
  if (!item) throw new Error(`no item '${itemId}' in scene`)
  return item
}

function updateItem(scene: EditorScene, itemId: string, update: (item: Item) => Item): EditorScene {
  return {
    ...scene,
    items: scene.items.map((i) => (i.id === itemId ? update(i) : i)),
  }
}

function collectDescendantIds(scene: EditorScene, rootId: string): Set<string> {
  const ids = new Set<string>([rootId])
  let grew = true
  while (grew) {
    grew = false
    for (const item of scene.items) {
      if (item.parentId !== null && ids.has(item.parentId) && !ids.has(item.id)) {
        ids.add(item.id)
        grew = true
      }
    }
  }
  return ids
}
