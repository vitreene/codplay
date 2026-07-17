/**
 * Commandes de base de la façade — `plan/app/2026-07-12-app-controller-definition.md` §4.1. Chaque
 * commande est une mutation PURE `(EditorScene, args) → EditorScene`, testable par entrée→sortie
 * sans DOM (même patron que `zone-model.ts` et le Builder). Le contrôleur les invoque et remplace
 * le document dans son contexte — il n'y a pas d'autre voie d'écriture du document.
 */

import type { CapsuleDef, Content, Decor, EditorScene, Item, ItemType, OffsetData } from './types'
import { nextOrderKey } from './order-key'

let idCounter = 0

/** Id fraîchement généré, unique dans le process — suffisant pour un document en mémoire (pas de collision réseau à couvrir ici). */
function freshId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${idCounter}`
}

/** Les items directement enfants de `parentId` (racine si `null`) — pour calculer la prochaine clé d'ordre. */
function childrenOf(scene: EditorScene, parentId: string | null): Item[] {
  return scene.items.filter((item) => item.parentId === parentId)
}

/**
 * Crée un item `bloc` (sans contenu — `assignType`/`assignContent` le différencient ensuite),
 * positionné par `geometry` (devient le décor initial), attaché sous `parentId` (racine si absent).
 * `geometry` peut venir d'un tracé libre ou du rect d'une zone désignée (§3 du document
 * contrôleur) — cette commande ne distingue pas la source, seulement la valeur.
 */
export function createItem(
  scene: EditorScene,
  args: { geometry: OffsetData; parentId?: string | null },
): { scene: EditorScene; itemId: string } {
  const parentId = args.parentId ?? null
  const itemId = freshId('item')
  const decorId = freshId('decor')

  const decor: Decor = { id: decorId, offset: args.geometry }
  const order = nextOrderKey(childrenOf(scene, parentId).map((i) => i.order))

  const item: Item = {
    id: itemId,
    type: 'bloc',
    parentId,
    order,
    visible: true,
    contentId: null,
    initialDecorId: decorId,
    keyframes: [],
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
 * Différencie un `bloc` vers un type concret — seul cas de changement de type autorisé en v1
 * (document-model, discussion §« Tout item naît en type bloc »). Lève si l'item n'est pas un
 * `bloc` : ce n'est pas une commande de changement de type général.
 */
export function assignType(scene: EditorScene, args: { itemId: string; type: ItemType }): EditorScene {
  const item = requireItem(scene, args.itemId)
  if (item.type !== 'bloc') {
    throw new Error(`assignType: item '${args.itemId}' is already type '${item.type}' — type change is only allowed from 'bloc'`)
  }
  return updateItem(scene, args.itemId, (i) => ({ ...i, type: args.type }))
}

/** Renseigne le contenu d'un item déjà typé — crée l'entrée `Content` et la relie via `contentId`. */
export function assignContent(scene: EditorScene, args: { itemId: string; content: Omit<Content, 'id'> }): EditorScene {
  const item = requireItem(scene, args.itemId)
  const contentId = item.contentId ?? freshId('content')
  const content: Content = { ...args.content, id: contentId }

  return {
    ...updateItem(scene, args.itemId, (i) => ({ ...i, contentId })),
    contents: { ...scene.contents, [contentId]: content },
  }
}

/** Change le parent et/ou la clé d'ordre d'un item. `order` explicite si fourni, sinon calculée en fin de fratrie du nouveau parent. */
export function attachItem(scene: EditorScene, args: { itemId: string; parentId: string | null; order?: string }): EditorScene {
  requireItem(scene, args.itemId)
  const order = args.order ?? nextOrderKey(childrenOf(scene, args.parentId).map((i) => i.order))
  return updateItem(scene, args.itemId, (i) => ({ ...i, parentId: args.parentId, order }))
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
 * (`2026-06-11-sequence-editor-grid-spec.md` §2.3 : « à la modification d'un décor partagé,
 * l'éditeur de décors doit créer une nouvelle entrée via `registerDecor` et appeler `assignDecor`
 * pour lier le keyframe à ce nouvel id, avant d'écrire les propriétés »). Toujours suivie d'un
 * `assignKeyframeDecor` puis d'un `setDecor` dans la même transaction (`decor-editor-bridge.ts`) —
 * jamais appelée seule, même convention que `createKeyframe`/`createNamedKeyframe` (entrée `{id}`
 * vide, remplie par le `setDecor` qui suit).
 */
export function registerDecor(scene: EditorScene, args: { decorId: string }): EditorScene {
  return { ...scene, decors: { ...scene.decors, [args.decorId]: { id: args.decorId } } }
}

/**
 * Pose un keyframe explicite sur l'item à l'instant donné — l'acte VOLONTAIRE qui seul fait naître
 * un kf (jamais un effet de bord de `setDecor`). Si `decorId` n'est pas fourni, un nouveau décor
 * vide est créé pour ce kf ; s'il est fourni, il doit référencer un décor déjà existant.
 */
export function createKeyframe(scene: EditorScene, args: { itemId: string; timeMs: number; decorId?: string }): { scene: EditorScene; keyframeId: string; decorId: string } {
  requireItem(scene, args.itemId)
  const keyframeId = freshId('kf')

  let nextScene = scene
  let decorId = args.decorId
  if (decorId === undefined) {
    decorId = freshId('decor')
    nextScene = { ...scene, decors: { ...scene.decors, [decorId]: { id: decorId } } }
  } else if (!scene.decors[decorId]) {
    throw new Error(`createKeyframe: no decor '${decorId}' in scene`)
  }

  const keyframe = { id: keyframeId, timeMs: args.timeMs, decorId }
  const updated = updateItem(nextScene, args.itemId, (i) => ({ ...i, keyframes: [...i.keyframes, keyframe] }))

  return { scene: updated, keyframeId, decorId }
}

/** Crée un item capsule avec son `CapsuleDef` (statique, défini une fois — pas reconfigurable en cours de vie). */
export function createCapsule(
  scene: EditorScene,
  args: { geometry: OffsetData; capsuleDef: CapsuleDef; parentId?: string | null },
): { scene: EditorScene; itemId: string } {
  const created = createItem(scene, { geometry: args.geometry, parentId: args.parentId })
  const withType = assignType(created.scene, { itemId: created.itemId, type: 'capsule' })
  const withCapsule = updateItem(withType, created.itemId, (i) => ({ ...i, capsule: args.capsuleDef }))
  return { scene: withCapsule, itemId: created.itemId }
}

/** Modifie les réglages d'une capsule. Cf. modèle : la capsule est figée une fois en usage — cette commande vaut pour la phase de réglage, pas une reconfiguration dynamique arbitraire. */
export function setCapsuleDef(scene: EditorScene, args: { itemId: string; patch: Partial<CapsuleDef> }): EditorScene {
  const item = requireItem(scene, args.itemId)
  if (!item.capsule) throw new Error(`setCapsuleDef: item '${args.itemId}' has no CapsuleDef (not a capsule?)`)
  return updateItem(scene, args.itemId, (i) => ({ ...i, capsule: { ...i.capsule!, ...args.patch } }))
}

/**
 * Assigne/retire une zone à un item. Filtré côté appelant aux zones de la capsule parente
 * (document-model — le reparent cross-capsule est neutralisé en v1) ; cette commande applique la
 * référence, elle ne valide pas l'appartenance de la zone à la capsule (responsabilité du module
 * qui propose les zones disponibles, pas de la façade).
 */
export function placeInZone(scene: EditorScene, args: { itemId: string; zoneId: string | null }): EditorScene {
  const item = requireItem(scene, args.itemId)
  return setDecor(scene, { decorId: item.initialDecorId, patch: { zoneId: args.zoneId } })
}

/** Retire un item et ses descendants (retire aussi leurs décors/contenus propres — pas de fuite de références orphelines). */
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

  const decors = { ...scene.decors }
  for (const id of decorIdsToRemove) delete decors[id]
  const contents = { ...scene.contents }
  for (const id of contentIdsToRemove) delete contents[id]

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
