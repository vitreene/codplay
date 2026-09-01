import type { Actor } from 'xstate'
import type { CodPlaySnapshot } from 'codplay'
import { DecorEditorController } from '../../decor-editor/controller'
import { mountDecorEditor } from '../../decor-editor/mount'
import { DEFAULT_PALETTE, DEFAULT_PRESETS } from '../../decor-editor/default-palette'
import type { DecorEditorCatalogs } from '../../decor-editor/controller'
import type { DecorEditorMountHandle } from '../../decor-editor/mount'
import { findPanel, panelsForType } from '../../decor-editor/palette-panel'
import type { PanelField, PaletteConfig } from '../../decor-editor/palette-panel'
import type { DecorPatch, OffsetPatch } from '../../decor-editor/types'
import type { Content, Decor, EditorScene, Item, OffsetData } from '../commands/types'
import type { Command, Selection } from '../controller/types'
import type { controllerMachine } from '../controller/controller-machine'
import type { BridgeHandle } from './types'
import { mergePatch } from '../../decor-editor/merge'

/**
 * Pont `decorEditor` — `2026-07-13-controller-islands-bridge-plan.md` §3.2. `defaults`/`chain`
 * restent vides : aucune chaîne d'héritage (capsule/zone) n'est modélisée côté document
 * aujourd'hui — `patch` porte donc, à lui seul, le décor résolu.
 */

export type ItemVisualType = 'text' | 'image' | 'media' | 'video' | 'capsule'

/**
 * `keyframeId: null` + `isTemporary: false` = décor initial de l'item (`initialDecorId`), comme
 * avant ce chantier. `keyframeId` non nul = décor RÉEL d'un keyframe (sélectionné explicitement OU
 * déduit de l'alignement playhead — les deux s'écrivent pareil, `2026-07-17-resolved-state-at-
 * time-notes.md`, « initialDecorId ≈ kf1 »). `isTemporary: true` = aucun décor réel ne correspond
 * à l'instant courant (entre deux kf) — jamais de cible d'écriture dans ce cas (`writeDecorId` reste
 * `null`), le décor affiché est lu en direct sur le node, pas dans le document.
 */
type Target = {
  itemId: string
  keyframeId: string | null
  contentId: string | null
  /** `null` seulement quand `isTemporary` — rien à écrire tant qu'aucun keyframe n'existe à cet instant. */
  writeDecorId: string | null
  itemType: ItemVisualType
  isTemporary: boolean
}

/** `bloc` n'a pas encore de type visuel (§6 du plan) — rien à décorer tant qu'il n'est pas différencié. */
function resolveTarget(scene: EditorScene, selection: Selection, timelineMs: number): Target | null {
  const itemId = selection.itemIds[0]
  if (!itemId) return null
  const item = scene.items.find((i) => i.id === itemId)
  if (!item || item.type === 'bloc') return null

  if (selection.keyframeId) {
    const decorId = item.keyframes.find((k) => k.id === selection.keyframeId)?.decorId
    if (!decorId) return null
    return { itemId: item.id, keyframeId: selection.keyframeId, contentId: item.contentId, writeDecorId: decorId, itemType: item.type, isTemporary: false }
  }

  // Pas de keyframe explicitement sélectionné — déduit de l'alignement de la tête de lecture
  // (`resolveKeyframeAlignment`) plutôt que de retomber systématiquement sur `initialDecorId`,
  // qui ne correspond à l'instant courant que si la tête est AVANT le premier keyframe.
  const alignment = resolveKeyframeAlignment(item, timelineMs)
  if (alignment.kind === 'before-first' || alignment.kind === 'no-keyframes') {
    return { itemId: item.id, keyframeId: null, contentId: item.contentId, writeDecorId: item.initialDecorId, itemType: item.type, isTemporary: false }
  }
  if (alignment.kind === 'between') {
    return { itemId: item.id, keyframeId: null, contentId: item.contentId, writeDecorId: null, itemType: item.type, isTemporary: true }
  }
  const decorId = item.keyframes.find((k) => k.id === alignment.keyframeId)?.decorId
  if (!decorId) return null
  return { itemId: item.id, keyframeId: alignment.keyframeId, contentId: item.contentId, writeDecorId: decorId, itemType: item.type, isTemporary: false }
}

export type KeyframeAlignment =
  | { kind: 'no-keyframes' }
  | { kind: 'before-first' }
  | { kind: 'exact'; keyframeId: string }
  | { kind: 'after-last'; keyframeId: string }
  | { kind: 'between'; prevKeyframeId: string; nextKeyframeId: string }

/**
 * Où se trouve `timelineMs` par rapport aux keyframes de l'item — `2026-07-17-resolved-state-at-
 * time-notes.md`. `exact`/`after-last` se résolvent depuis le document (cascade, comme un kf
 * explicitement sélectionné — même résultat, `initialDecorId ≈ kf1`) ; seul `between` a besoin
 * d'une lecture live (aucun décor réel ne correspond à un instant interpolé).
 */
export function resolveKeyframeAlignment(item: Item, timelineMs: number): KeyframeAlignment {
  const sorted = [...item.keyframes].sort((a, b) => a.timeMs - b.timeMs)
  const first = sorted[0]
  if (!first) return { kind: 'no-keyframes' }
  if (timelineMs < first.timeMs) return { kind: 'before-first' }
  const exact = sorted.find((k) => k.timeMs === timelineMs)
  if (exact) return { kind: 'exact', keyframeId: exact.id }
  const last = sorted[sorted.length - 1]!
  if (timelineMs >= last.timeMs) return { kind: 'after-last', keyframeId: last.id }
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!
    const b = sorted[i + 1]!
    if (timelineMs > a.timeMs && timelineMs < b.timeMs) return { kind: 'between', prevKeyframeId: a.id, nextKeyframeId: b.id }
  }
  /* c8 ignore next */
  return { kind: 'no-keyframes' }
}

/** `style.<prop>` de tous les panneaux pertinents pour ce type d'item — jamais devinés (`default-palette.ts` en est la seule source, `2026-07-17-resolved-state-at-time-notes.md`). */
export function styleFieldsForItemType(config: PaletteConfig, itemType: ItemVisualType): PanelField[] {
  const fields: PanelField[] = []
  for (const panelId of panelsForType(itemType, config)) {
    const panel = findPanel(config, panelId)
    if (!panel || panel.kind === 'custom-code' || panel.kind === 'preset-list') continue
    for (const field of panel.fields) {
      if (field.path.startsWith('style.')) fields.push(field)
    }
  }
  return fields
}

/**
 * Décor temporaire — lecture live via `AuthorApi.getPersoStates()`, jamais `scene.decors`, jamais
 * le node/DOM (`2026-07-25-perso-state-at-t-plan.md`). Remplace l'ancienne lecture par
 * `authorApi.getNodeSnapshot` (`utils.get` d'anime sur le node réel) : cette dernière dépendait du
 * timing d'anime.js — deux défauts distincts constatés en direct la même session (`width`/`height`
 * parfois lus en cqw brut mal réinterprété comme px ; `background-color` figé sur le keyframe
 * précédent, jamais rafraîchi avant un rendez-vous explicite). `getPersoStates()` renvoie l'état du
 * PERSO, capturé une fois par seek, dans son unité d'origine — jamais dérivé du DOM/du cache anime
 * lié à un node.
 *
 * `getPersoStates()` renvoie une valeur BRUTE par propriété, TOUJOURS déjà dans l'unité native du
 * perso (jamais du px, contrairement à `getNodeSnapshot`) — `formatPersoValueForCssProperty`
 * (`css-value-format.ts`) formate sans jamais convertir physiquement (pas de `referenceWidthPx`
 * ici, devenu inutile pour ce chemin de lecture).
 */
export function resolveTemporaryPatch(snapshot: CodPlaySnapshot | null, itemId: string, fields: PanelField[]): DecorPatch {
  const state = snapshotState(snapshot, itemId)
  const persoState = state?.style
  if (!persoState || typeof persoState !== 'object') return {}
  const style: Record<string, string> = {}
  for (const field of fields) {
    const prop = field.path.slice('style.'.length)
    const raw = (persoState as Record<string, unknown>)[prop]
    if (raw === undefined) continue
    style[prop] = formatSnapshotValue(raw)
  }
  return Object.keys(style).length > 0 ? { style } : {}
}

/**
 * Pose live d'un perso — `x`/`y`/`width`/`height`/`rotate`/`scaleX`/`scaleY`, jamais couverte par
 * la palette (aucun champ position/rotate/scale dans `default-palette.ts`), mais bien fournie par
 * `getPersoStates()` (`2026-07-25-perso-state-at-t-plan.md`) comme n'importe quelle autre
 * propriété du perso — la palette n'est jamais la limite de ce que « photographier » un item peut
 * capturer. `x`/`y`/`width`/`height` sont des chaînes cqw brutes (jamais px) : un simple
 * `Number.parseFloat` suffit, sans le facteur d'échelle de `parseNumberFromCssValue` (celui-ci
 * n'a de sens que pour une SAISIE utilisateur, cf `css-value-format.ts` — pas une valeur perso déjà
 * dans l'unité finale).
 *
 * `getPersoStates()` ne porte QUE les propriétés activement animées à cet instant (issues des
 * transitions actives, `2026-07-25-perso-state-at-t-plan.md` §4) — un champ constant (ex. `x`,
 * jamais transitionné si l'item ne bouge qu'en `y`) en est absent, PAS égal à 0. `base` (la
 * cascade déjà résolue jusqu'au keyframe précédent) fournit la valeur de repli pour ces champs —
 * jamais un défaut arbitraire (`0`/`1`) qui écraserait silencieusement l'héritage : `translate`/
 * `scale` sont fusionnés par `mergePatch` comme des groupes ENTIERS (`STRUCTURED_GROUPS`), donc un
 * `x: 0` inventé ici écraserait le vrai `x` hérité de `base`, pas seulement le compléter.
 */
function resolveTemporaryOffset(snapshot: CodPlaySnapshot | null, itemId: string, base: DecorPatch): DecorPatch {
  const state = snapshotState(snapshot, itemId)
  const persoState = state?.style
  if (!persoState || typeof persoState !== 'object') return {}
  const parseCqw = (raw: unknown): number | undefined => {
    if (raw === undefined) return undefined
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const value = (raw as Record<string, unknown>).value
      return typeof value === 'number' && Number.isFinite(value) ? value : undefined
    }
    const parsed = typeof raw === 'number' ? raw : Number.parseFloat(String(raw))
    return Number.isFinite(parsed) ? parsed : undefined
  }
  const style = persoState as Record<string, unknown>
  const x = parseCqw(style.x) ?? base.offset?.translate?.x
  const y = parseCqw(style.y) ?? base.offset?.translate?.y
  const width = parseCqw(style.width) ?? base.offset?.width
  const height = parseCqw(style.height) ?? base.offset?.height
  const rotate = parseCqw(style.rotate) ?? base.offset?.rotate
  const scaleX = parseCqw(style.scaleX) ?? base.offset?.scale?.x
  const scaleY = parseCqw(style.scaleY) ?? base.offset?.scale?.y
  const offset: OffsetPatch = {}
  if (x !== undefined || y !== undefined) offset.translate = { x: x ?? 0, y: y ?? 0 }
  if (width !== undefined) offset.width = width
  if (height !== undefined) offset.height = height
  if (rotate !== undefined) offset.rotate = rotate
  if (scaleX !== undefined || scaleY !== undefined) offset.scale = { x: scaleX ?? 1, y: scaleY ?? 1 }
  return Object.keys(offset).length > 0 ? { offset } : {}
}

/** Returns the selected item state from a CodPlay V2 snapshot. */
function snapshotState(snapshot: CodPlaySnapshot | null, itemId: string): Record<string, unknown> | null {
  return snapshot?.states.find((entry) => entry.target.persoId === itemId)?.state ?? null
}

/** Formats one logical V2 value for the decor model without converting its unit. */
function formatSnapshotValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return String(value)
  const record = value as Record<string, unknown>
  if (record.kind === 'length' && typeof record.value === 'number' && typeof record.unit === 'string') {
    return `${record.value}${record.unit}`
  }
  if (record.kind === 'color' && Array.isArray(record.coords) && typeof record.alpha === 'number') {
    const coords = record.coords.filter((coordinate): coordinate is number => typeof coordinate === 'number')
    if (record.space === 'srgb' && coords.length >= 3) {
      return `rgba(${Math.round(coords[0]! * 255)}, ${Math.round(coords[1]! * 255)}, ${Math.round(coords[2]! * 255)}, ${record.alpha})`
    }
    if (record.space === 'oklch' && coords.length >= 3) {
      return `oklch(${coords[0]} ${coords[1]} ${coords[2]} / ${record.alpha})`
    }
  }
  return String(value)
}

/**
 * Copy-on-write (`2026-06-11-sequence-editor-grid-spec.md` §2.3) : un `decorId` peut être partagé
 * entre plusieurs keyframes adjacents (`KEYFRAME.ADD` en hérite délibérément, §2.3 « à la création
 * d'un keyframe » — pour ne pas dupliquer inutilement des décors identiques). Le muter en place
 * (`setDecor`) modifierait TOUS les keyframes qui le référencent, pas seulement celui en cours
 * d'édition — bug constaté 2026-07-17 (kf2 hérite du décor de kf1, éditer kf2 change aussi kf1, et
 * `buildKeyframeDecorActions` ne voit alors aucun diff entre les deux, donc aucune interpolation).
 * Portée volontairement limitée aux keyframes (`target.keyframeId`) : `item.initialDecorId` est créé
 * frais par `createItem`, jamais partagé par construction — rien à forker dans ce cas.
 */
function isDecorSharedByAnotherKeyframe(scene: EditorScene, decorId: string, keyframeId: string): boolean {
  return scene.items.some((item) => item.keyframes.some((k) => k.id !== keyframeId && k.decorId === decorId))
}

function freshDecorId(): string {
  return `decor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * `decor.zoneId` (référence par id) → `patch.zone` (référence par nom, modèle dedit).
 * `content.text`/`.textAutoSize` sont inclus ici (pas seulement le décor) : le panneau
 * « Contenu »/« Auto » de la palette doit refléter la valeur RÉELLEMENT posée à l'attache,
 * pas repartir vide alors que l'item porte déjà du texte.
 */
export function resolveCurrentPatch(decor: Decor, content: Content | undefined, scene: EditorScene): DecorPatch {
  const patch: DecorPatch = {}
  if (decor.style) patch.style = decor.style
  // `ClassNameValue` — deux types homonymes distincts : `string|string[]` côté document
  // (`app/commands/types.ts`) contre le modèle add/remove du runtime codplay côté dedit
  // (`codplay/runtime/perso-shared-types`). Un remplacement total (jamais un diff add/remove)
  // reste une valeur valide des deux côtés — seul point de passage, comme `offset` ci-dessous.
  if (decor.classes) patch.classes = decor.classes as unknown as DecorPatch['classes']
  // `OffsetPatch`/`OffsetData` — même représentation valeur, `anchor` typé en littéraux stricts
  // côté dedit contre `string` générique côté document (même raisonnement que le cast `CapsuleKind`/
  // `AutoCapsuleType` de `build-scene.ts`, un seul point de passage).
  if (decor.offset) patch.offset = decor.offset as unknown as OffsetPatch
  // Même traitement qu'`offset` ci-dessus (un champ structuré côté document, ici juste une
  // chaîne — même type des deux côtés, pas de cast nécessaire) — bien plus simple, de même nature.
  if (decor.custom !== undefined) patch.custom = decor.custom
  if (decor.zoneId) {
    const zone = scene.zones[decor.zoneId]
    if (zone) patch.zone = zone.name
  }
  if (content?.text !== undefined) patch.text = content.text
  if (content?.textAutoSize !== undefined) patch.textAutoSize = content.textAutoSize
  return patch
}

/**
 * Décor effectif d'un keyframe sélectionné — cascade en DIRECT (jamais stockée, jamais figée à un
 * instant donné) : `item.initialDecorId`, puis chaque keyframe antérieur dans l'ordre du temps,
 * puis le keyframe lui-même. Une propriété absente d'un maillon reste celle du maillon précédent
 * (persistance visuelle standard d'un keyframe non retouché) — recalculée à CHAQUE sélection,
 * jamais mémorisée : un réordonnancement ultérieur ou une édition faite après coup sur un
 * keyframe antérieur se reflètent immédiatement, sans jamais devenir « faux »
 * (`2026-07-17-decor-keyframe-layering-plan.md` §3 — répond précisément au cas : border ajouté sur
 * kf1 après que kf2 existe déjà, kf2 doit le voir dès sa prochaine sélection). Réutilise
 * `resolveCurrentPatch` (conversion décor→patch déjà existante) et `mergePatch`
 * (`decor-editor/merge.ts`, déjà existant) — aucune nouvelle logique de fusion ici.
 */
export function resolveEffectiveKeyframePatch(
  scene: EditorScene,
  item: Item,
  keyframeId: string,
  content: Content | undefined,
): DecorPatch {
  const kf = item.keyframes.find((k) => k.id === keyframeId)
  const initial = scene.decors[item.initialDecorId] ?? { id: item.initialDecorId }
  if (!kf) return resolveCurrentPatch(initial, content, scene)

  const precedingDecors = item.keyframes
    .filter((k) => k.timeMs < kf.timeMs)
    .sort((a, b) => a.timeMs - b.timeMs)
    .map((k) => scene.decors[k.decorId])
    .filter((d): d is Decor => d !== undefined)

  const ownDecor = scene.decors[kf.decorId] ?? { id: kf.decorId }
  const layers = [initial, ...precedingDecors, ownDecor]
  return layers
    .map((d) => resolveCurrentPatch(d, content, scene))
    .reduce((acc, patch) => mergePatch(acc, patch), {} as DecorPatch)
}

/**
 * Diff propriété par propriété entre deux `DecorPatch` résolus — vrai si `patch` diverge de `base`
 * sur au moins une propriété présente dans `patch`. Granularité identique à `mergePatch`
 * (`decor-editor/merge.ts`) : clés de `style` une à une, sous-champs d'`offset` un à un,
 * `classes`/`custom`/`zone` comme valeurs entières.
 */
export function patchDiffersFromBase(base: DecorPatch, patch: DecorPatch): boolean {
  if (patch.style) {
    for (const [k, v] of Object.entries(patch.style)) if (base.style?.[k] !== v) return true
  }
  if (patch.offset) {
    for (const k of Object.keys(patch.offset) as (keyof OffsetPatch)[]) {
      if (JSON.stringify(base.offset?.[k]) !== JSON.stringify(patch.offset[k])) return true
    }
  }
  if (patch.classes !== undefined && JSON.stringify(patch.classes) !== JSON.stringify(base.classes)) return true
  if (patch.custom !== undefined && patch.custom !== base.custom) return true
  if (patch.zone !== undefined && patch.zone !== base.zone) return true
  return false
}

/**
 * Décor à consigner pour un NOUVEAU keyframe inséré à `timelineMs` sur `item` — `null` si rien à
 * consigner (pas entre deux keyframes réels, ou état live identique à la cascade : le keyframe
 * s'ouvre vide, comportement actuel de `adjacentDecorId` inchangé). Non-null seulement si l'état
 * réellement affiché DIVERGE de la cascade — jamais un instantané complet systématique.
 *
 * « Photographier » l'item : capture TOUTE propriété du perso, pas seulement celles éditables via
 * la palette — `liveStyle` (couleur, dimensions CSS) ET `liveOffset` (position/rotation/scale,
 * pilotées par le CS, jamais un champ de palette) sont toutes deux des propriétés du même perso,
 * `getPersoStates()` les fournit ensemble (`2026-07-25-perso-state-at-t-plan.md`).
 */
export function resolveKeyframeInsertionPatch(
  scene: EditorScene,
  item: Item,
  timelineMs: number,
  content: Content | undefined,
  snapshot: CodPlaySnapshot | null,
  paletteConfig: PaletteConfig,
  itemType: ItemVisualType,
): DecorPatch | null {
  const alignment = resolveKeyframeAlignment(item, timelineMs)
  if (alignment.kind !== 'between') return null
  const base = resolveEffectiveKeyframePatch(scene, item, alignment.prevKeyframeId, content)
  const liveStyle = resolveTemporaryPatch(snapshot, item.id, styleFieldsForItemType(paletteConfig, itemType))
  const liveOffset = resolveTemporaryOffset(snapshot, item.id, base)
  const patch = mergePatch(mergePatch(base, liveStyle), liveOffset)
  return patchDiffersFromBase(base, patch) ? patch : null
}

/** Écarts routés vers `setDecor` (`style`/`classes`/`offset`/`custom`/`zone`) — présents seulement si modifiés. */
export function patchToDecorArgs(patch: DecorPatch, scene: EditorScene): Partial<Omit<Decor, 'id'>> | null {
  const args: Partial<Omit<Decor, 'id'>> = {}
  let touched = false
  if (patch.style !== undefined) { args.style = patch.style; touched = true }
  if (patch.classes !== undefined) { args.classes = patch.classes as unknown as Decor['classes']; touched = true }
  if (patch.offset !== undefined) { args.offset = patch.offset as unknown as OffsetData; touched = true }
  if (patch.custom !== undefined) { args.custom = patch.custom; touched = true }
  if (patch.zone !== undefined) {
    touched = true
    if (patch.zone === null) {
      args.zoneId = null
    } else {
      const zone = Object.values(scene.zones).find((z) => z.name === patch.zone)
      if (zone) args.zoneId = zone.id
      else console.warn(`[decorEditor bridge] zone '${patch.zone}' introuvable dans la scène`)
    }
  }
  return touched ? args : null
}

/** Écart routé vers `assignContent` (`text`/`textAutoSize`) — fusionné sur le `Content` existant, jamais un remplacement partiel (`assignContent` remplace tout l'objet). */
function patchToContentArgs(patch: DecorPatch, existing: Content | undefined, itemType: Target['itemType']): Omit<Content, 'id'> | null {
  if (patch.text === undefined && patch.textAutoSize === undefined) return null
  return {
    type: itemType === 'capsule' ? 'text' : itemType,
    source: existing?.source,
    text: patch.text ?? existing?.text,
    textAutoSize: patch.textAutoSize ?? existing?.textAutoSize,
    lang: existing?.lang,
    waveform: existing?.waveform,
    cues: existing?.cues,
  }
}

/**
 * Commandes d'écriture pour `patch` sur `target` — fork-si-partagé (spec §2.3) inclus. Commun à
 * `onDecorChange` (édition continue via dedit — palette, CSS libre, presets) et au commit d'une
 * `DecorLiveSession` (fin de geste CS-family — `2026-07-25-decor-unified-channel-plan.md` §4 étape
 * 5) : un seul endroit qui sait construire ces commandes, plus deux copies qui auraient pu diverger.
 */
function buildDecorCommands(scene: EditorScene, target: Target, patch: DecorPatch): Command[] {
  const commands: Command[] = []
  let writeDecorId = target.writeDecorId!
  if (target.keyframeId && isDecorSharedByAnotherKeyframe(scene, writeDecorId, target.keyframeId)) {
    // Fork avant d'écrire, jamais après (spec §2.3) — sinon la mutation en place a déjà atteint
    // le keyframe voisin le temps que le fork soit décidé.
    writeDecorId = freshDecorId()
    commands.push({ name: 'registerDecor', args: { decorId: writeDecorId } })
    commands.push({ name: 'assignKeyframeDecor', args: { itemId: target.itemId, keyframeId: target.keyframeId, decorId: writeDecorId } })
  }
  const decorArgs = patchToDecorArgs(patch, scene)
  if (decorArgs) commands.push({ name: 'setDecor', args: { decorId: writeDecorId, patch: decorArgs } })

  const existingContent = target.contentId ? scene.contents[target.contentId] : undefined
  const contentArgs = patchToContentArgs(patch, existingContent, target.itemType)
  if (contentArgs) commands.push({ name: 'assignContent', args: { itemId: target.itemId, content: contentArgs } })

  // `.capsule` (→ `Item.capsule`) : aucun geste de création de capsule n'existe encore dans
  // l'app (`DemoMenuRegion` ne crée que des items texte) — rien à vérifier tant que ce cas ne
  // se présente pas réellement. `.custom` (CSS libre) est routé depuis ce jour via
  // `Decor.custom`/`patchToDecorArgs` — plus un gap, cf `2026-07-17-decor-keyframe-layering-plan.md`.
  if (patch.capsule !== undefined) console.warn('[decorEditor bridge] patch.capsule non routé — aucune capsule créée par cet incrément')

  return commands
}

/** Signal d'inactivité seulement — jamais une cadence de commit pour un geste actif (spec §4.3, `2026-07-17-phase-commit-selection-recovery-plan.md` §Étape B.4). Exporté pour que les tests avancent les minuteurs factices sur la valeur réelle, sans dupliquer la constante. */
export const PHASE_IDLE_FLUSH_MS = 4000

export function createDecorEditorBridge(container: HTMLElement, machine: Actor<typeof controllerMachine>): BridgeHandle {
  const catalogs: DecorEditorCatalogs = { presets: DEFAULT_PRESETS, cards: [], palette: DEFAULT_PALETTE }
  const controller = new DecorEditorController(catalogs)
  let mountHandle: DecorEditorMountHandle | null = null
  let offsetBridgeWired = false

  // ── Commit de fin de phase (`2026-07-17-phase-commit-selection-recovery-plan.md` §Étape B) —
  // dedit lui-même n'a aucun debounce (spec §4.3, émission continue) ; c'est ce pont, l'hôte, qui
  // décide seul QUAND committer. Six signaux de fin de phase, jamais un minuteur court réarmé à
  // chaque micro-geste : changement de sélection, seek, mutation externe du document et Échap sont
  // immédiats (`flushNow`/`abortPhase` appelés directement) ; seule l'inactivité prolongée passe par
  // un minuteur (`armIdleFlush`, réarmé à chaque signal d'activité). ─────────────────────────────

  let pendingCommands: Command[] | null = null
  let idleFlushTimer: ReturnType<typeof setTimeout> | null = null
  /** Dernière scène/sélection observées — distingue une vraie mutation externe (signal 5) et un simple écho de notre propre flush (qui vide `pendingCommands` avant d'émettre). */
  let lastObservedScene: EditorScene | null = null
  let lastSelectionKey: string | null = null
  /**
   * Référentiel AUTEUR (sans `preRollMs`, même convention que `Keyframe.timeMs`) — mis à jour
   * uniquement par un vrai `SEEK` explicite (scrub/Stop), jamais par la progression naturelle de
   * la lecture (`telco.onProgress`, local à `sequence-editor`, ne redescend jamais vers ce
   * contrôleur — sans conséquence : dedit est de toute façon suspendu pendant `playing`, §Signal
   * `playbackActiveChanged`). Sert à `resolveKeyframeAlignment` pour situer la sélection courante
   * par rapport aux keyframes de l'item (`2026-07-17-resolved-state-at-time-notes.md`).
   */
  let lastKnownTimelineMs = 0

  function selectionKey(selection: Selection): string {
    return JSON.stringify([selection.itemIds, selection.keyframeId ?? null])
  }

  function armIdleFlush(): void {
    if (idleFlushTimer !== null) clearTimeout(idleFlushTimer)
    idleFlushTimer = setTimeout(flushNow, PHASE_IDLE_FLUSH_MS)
  }

  function cancelIdleFlush(): void {
    if (idleFlushTimer !== null) {
      clearTimeout(idleFlushTimer)
      idleFlushTimer = null
    }
  }

  /**
   * Double garde avec `onGestureActiveChange` : un geste CS repris entre-temps (ex. resize→rotate
   * enchaînés) laisse `pendingCommands` en place sans committer — sa propre fin réarmera. Sans ce
   * second contrôle au moment du tir, un signal de fin de phase déjà en vol au moment où un nouveau
   * geste démarre pourrait committer une position intermédiaire.
   */
  function flushNow(): void {
    cancelIdleFlush()
    if (machine.getSnapshot().context.offsetBridge?.isGestureActive()) return
    const commands = pendingCommands
    pendingCommands = null
    if (commands && commands.length > 0) machine.send({ type: 'RUN_TRANSACTION', commands })
  }

  /** Échap — abandon de phase (§Étape B.6) : jette l'écart en attente sans committer, puis force le pont `scenePlayer` à rejouer le document inchangé pour effacer la preview live devenue périmée. */
  function abortPhase(): void {
    if (pendingCommands === null) return
    cancelIdleFlush()
    pendingCommands = null
    machine.send({ type: 'PHASE_ABORT' })
  }

  /**
   * `AppLayout.tsx::useClearSelectionShortcuts` écoute déjà `Escape` sur `document` (phase de
   * bulles, déjà câblé) et envoie `CLEAR_SELECTION` — ce qui, via le signal 1 ci-dessus, COMMIT le
   * patch en attente. Sans précaution, Échap ferait donc l'inverse du contrat validé (« abandon,
   * jamais de commit »). Capturée en phase de capture sur `document` (jamais `window` en phase de
   * bulles, qui s'exécuterait APRÈS le `CLEAR_SELECTION` de la bulle) : la capture descend
   * `window → document → …` STRICTEMENT avant toute bulle, donc `abortPhase()` vide
   * `pendingCommands` avant que `CLEAR_SELECTION` n'atteigne le signal 1 — son flush devient un
   * no-op. Ne duplique pas la désélection elle-même, seulement l'abandon du patch en attente.
   */
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    abortPhase()
  }
  document.addEventListener('keydown', onKeyDown, { capture: true })

  /** Câblé une fois le pont offset disponible (`context.offsetBridge`, publié avec `authorApi`). */
  function wireOffsetBridge(): void {
    if (offsetBridgeWired) return
    const { offsetBridge } = machine.getSnapshot().context
    if (!offsetBridge) return
    offsetBridgeWired = true
    controller.setOffsetBridge(offsetBridge)
    // Début de geste — annule un flush déjà armé, jamais un commit en soi (arbitrage 2026-07-17,
    // regroupement de phase préservé). Fin de geste — armée par `onCommit` (message explicite du
    // geste qui vient de finir, `2026-07-18-pose-edit-architecture-study.md` §7), pas par
    // `onGestureActiveChange(false)` (état redéduit) : même comportement observable (un seul flush
    // pour une salve de gestes enchaînés, idle en déclenche un), signal de déclenchement fiabilisé.
    offsetBridge.onGestureActiveChange(active => {
      if (active) cancelIdleFlush()
    })
    offsetBridge.onCommit(() => {
      if (pendingCommands !== null) armIdleFlush()
    })
    // La `DecorLiveSession` (§2/§3 du plan) reste alimentée (`offset-editor-bridge.ts`) mais n'est PAS
    // consultée ici pour l'écriture : `onDecorChange`/`pendingCommands` ci-dessus est DÉJÀ l'unique
    // écrivain de l'offset, sensible à tous les signaux de fin de phase (sélection, seek, mutation
    // externe — pas seulement la fin du geste CS) — `onCommit` n'arme qu'un flush déjà préparé,
    // jamais une écriture indépendante. Faire écrire la session ICI créerait un second chemin
    // d'écriture concurrent (double fork possible sur un décor partagé) — constaté en écrivant les
    // tests de cette étape, corrigé en ne branchant PAS ce point d'écriture. La session sert pour
    // l'instant de lecture seule (insertion de kf, §4 du plan) ; `committing`/`notifyWritten` restent
    // définis pour un futur producteur (zone/multi-sélection) qui n'a pas déjà de chemin d'écriture.
  }

  /** Différé jusqu'au premier `PLAYER_READY` (`authorApi` requis pour `subscribeToNode`, §3.2). */
  function ensureMounted(): void {
    wireOffsetBridge()
    if (mountHandle) return
    const { authorApi, referenceWidthPx } = machine.getSnapshot().context
    if (!authorApi) return
    mountHandle = mountDecorEditor(container, controller, authorApi.subscribeToNode, { referenceWidthPx })
  }

  function syncSelection(scene: EditorScene, selection: Selection): void {
    const target = resolveTarget(scene, selection, lastKnownTimelineMs)
    if (!target) {
      controller.detach()
      return
    }
    const content = target.contentId ? scene.contents[target.contentId] : undefined
    const item = scene.items.find((i) => i.id === target.itemId)!

    // Un keyframe (explicite OU déduit de l'alignement playhead) se lit en cascade
    // (item.initialDecorId ⊕ keyframes antérieurs ⊕ lui-même) — jamais son seul décor brut, qui
    // peut rester vide tant que rien n'a divergé dessus (`2026-07-17-decor-keyframe-layering-
    // plan.md` §3). Décor temporaire (`isTemporary`) : lu en direct sur le node, jamais dans
    // `scene.decors` — `resolveKeyframeAlignment` garantit qu'on est alors ENTRE deux kf réels,
    // le cascade au kf précédent sert de base (propriétés non couvertes par la palette).
    let patch: DecorPatch
    if (target.isTemporary) {
      const alignment = resolveKeyframeAlignment(item, lastKnownTimelineMs)
      const base = alignment.kind === 'between' ? resolveEffectiveKeyframePatch(scene, item, alignment.prevKeyframeId, content) : {}
      const { authorApi } = machine.getSnapshot().context
      // Fiable même pendant un geste CS actif : `getPersoStates()` est capturé au dernier seek,
      // indépendamment de tout geste CS en cours (`2026-07-25-perso-state-at-t-plan.md`).
      const liveStyle = authorApi ? resolveTemporaryPatch(authorApi, target.itemId, styleFieldsForItemType(controller.getPaletteConfig(), target.itemType)) : {}
      patch = mergePatch(base, liveStyle)
    } else if (target.keyframeId) {
      patch = resolveEffectiveKeyframePatch(scene, item, target.keyframeId, content)
    } else {
      patch = resolveCurrentPatch(scene.decors[target.writeDecorId!] ?? { id: target.writeDecorId! }, content, scene)
    }
    controller.attachItems([
      {
        itemId: target.itemId,
        itemType: target.itemType,
        defaults: {},
        chain: [],
        patch,
        zones: [],
        context: 'horizontal',
        isTemporary: target.isTemporary,
      },
    ])
  }

  const unsubscribeDecorChange = controller.onDecorChange((entries) => {
    const { scene, selection } = machine.getSnapshot().context
    if (!scene) return
    const target = resolveTarget(scene, selection, lastKnownTimelineMs)
    if (!target) return
    // Décor temporaire : rien à écrire (`2026-07-17-resolved-state-at-time-notes.md` — persisté
    // seulement si l'auteur pose un keyframe à cette position, un chantier séparé, pas cette
    // écriture-ci). Écrire dans `initialDecorId` par défaut serait FAUX — ce n'est pas ce que
    // l'auteur regarde.
    if (target.isTemporary || target.writeDecorId === null) {
      console.warn('[decorEditor bridge] édition ignorée — décor temporaire (aucun keyframe à cet instant), pose un keyframe pour committer.')
      return
    }
    const entry = entries.find((e) => e.itemId === target.itemId)
    if (!entry) return

    // Ne commet plus immédiatement — accumulé pour la fin de phase (§Étape B). `entry.patch` porte
    // déjà l'écart COMPLET de l'item (spec §4.3), offset inclus s'il est à jour (pont §Étape A) —
    // seul et unique chemin d'écriture pour offset, sensible à tous les signaux de fin de phase.
    const commands = buildDecorCommands(scene, target, entry.patch)
    if (commands.length > 0) {
      pendingCommands = commands
      armIdleFlush()
    }
  })

  const unsubscribeInteractionEnd = controller.onInteractionEnd(() => {
    if (pendingCommands === null) return
    if (machine.getSnapshot().context.offsetBridge?.isGestureActive()) {
      cancelIdleFlush()
      return
    }
    // `change` d'un champ palette — harmonisé (arbitrage 2026-07-17) : un signal d'activité de
    // phase comme la fin d'un geste CS, jamais un commit en soi.
    armIdleFlush()
  })

  /**
   * Raccourci « aller à kf1 » (`2026-07-17-resolved-state-at-time-notes.md`) — dedit n'a aucune
   * notion de temps/keyframe dans son propre domaine, il ne fait que demander ; c'est ce pont qui
   * résout le premier keyframe de l'item sélectionné et déclenche le `SEEK` (même chemin qu'un
   * scrub réel — flush, resynchro CS, resynchro palette en découlent déjà tous).
   */
  const unsubscribeSnapToFirstKeyframe = controller.onSnapToFirstKeyframeRequest(() => {
    const { scene, selection } = machine.getSnapshot().context
    const itemId = selection.itemIds[0]
    const item = scene && itemId ? scene.items.find((i) => i.id === itemId) : undefined
    const firstKeyframe = item ? [...item.keyframes].sort((a, b) => a.timeMs - b.timeMs)[0] : undefined
    if (firstKeyframe) machine.send({ type: 'SEEK', timelineMs: firstKeyframe.timeMs })
  })

  const unsubscribeCommitted = machine.on('sceneCommitted', ({ scene, selection }) => {
    ensureMounted()
    const key = selectionKey(selection)
    // Signal 1 — changement de sélection : flush avant de resynchroniser la palette sur la
    // nouvelle cible, quelle que soit l'origine (timeline, clic hors CS, etc.).
    if (key !== lastSelectionKey) {
      flushNow()
    } else if (scene !== lastObservedScene && pendingCommands !== null) {
      // Signal 5 — mutation externe du document (ex. édition timeline) survenue pendant une phase
      // décor en cours : notre propre flush vide `pendingCommands` AVANT d'émettre son propre
      // commit, donc son écho ne peut jamais retomber dans cette branche (pas de boucle).
      flushNow()
    }
    lastSelectionKey = key
    lastObservedScene = scene
    syncSelection(scene, selection)
  })
  const unsubscribeLoaded = machine.on('sceneLoaded', ({ scene }) => {
    // Un chargement de document supplante toute phase en cours — rien à committer, rien à préserver.
    cancelIdleFlush()
    pendingCommands = null
    ensureMounted()
    const selection = machine.getSnapshot().context.selection
    syncSelection(scene, selection)
    lastObservedScene = scene
    lastSelectionKey = selectionKey(selection)
  })
  const unsubscribeAuthorApiReady = machine.on('authorApiReady', () => ensureMounted())
  // Signal 3 — seek de l'auteur : flush immédiat (le rebuild qui suit rejoue la position demandée).
  // Resynchronise aussi la palette après coup — l'alignement kf/décor temporaire dépend de
  // `lastKnownTimelineMs` (`2026-07-17-resolved-state-at-time-notes.md`) ; sans ce resync explicite,
  // un seek qui ne flush rien (rien en attente) laisserait la palette affichant l'instant précédent.
  const unsubscribeSeek = machine.on('seek', ({ timelineMs }) => {
    lastKnownTimelineMs = timelineMs
    flushNow()
    const { scene, selection } = machine.getSnapshot().context
    if (scene) syncSelection(scene, selection)
  })
  /**
   * `'seek'` ci-dessus est émis à la DEMANDE (synchrone), avant que `telco.seek()` (asynchrone,
   * `scene-player-bridge.ts`) n'ait réellement appliqué la position au DOM — le `syncSelection`
   * immédiat ci-dessus capture donc systématiquement l'état D'AVANT le seek pour tout champ lu en
   * direct sur le node (`resolveTemporaryPatch`, décor temporaire). Bug constaté en direct : la
   * couleur d'un décor temporaire restait figée sur le keyframe précédent pendant qu'un scrub
   * répété faisait progresser la position (celle-ci vient du CS, resynchronisé séparément via
   * `frame?.sync()` dans ce même `.then()`). `'seekApplied'` est le rendez-vous de fin réel —
   * un second `syncSelection` ici referme l'écart, sans nouvel appel `telco.seek()`.
   */
  const unsubscribeSeekApplied = machine.on('seekApplied', () => {
    const { scene, selection } = machine.getSnapshot().context
    if (scene) syncSelection(scene, selection)
  })
  // Signal 6 — play demandé : flush immédiat AVANT `telco.play()` (`PLAY_REQUEST`, `types.ts`) —
  // sans ça une édition tout juste faite peut rester en attente pendant tout le play qui suit.
  const unsubscribeFlushPending = machine.on('flushPending', () => flushNow())

  /**
   * État `playing` (`2026-07-17-play-mode-decor-editor-deactivation-plan.md`) — aucune écriture de
   * preview live pendant que `isPlaying === true`, y compris quand le rebuild forcé du pont
   * `scenePlayer` remonte un nouveau node (sans ce gel, `subscribeToNode`, câblé dans
   * `decor-editor/mount.ts`, réappliquerait aussitôt la preview périmée sur le node flambant neuf).
   * `mountHandle.setPreviewSuspended` — pas `controller.detach()` — préserve le panneau actif et les
   * toggles (`visualPosition`/`zoneMode`) à travers un cycle play→pause : `ITEMS.DETACH` les
   * réinitialise (vérifié dans `decor-editor/machine.ts`), ce que ce chantier ne veut pas faire pour
   * un simple play/pause. `syncSelection` avant la reprise (pas après) : la resynchronisation se
   * fait sur le node déjà remonté par le rebuild forcé pendant que l'écriture reste encore gelée,
   * `setPreviewSuspended(false)` déclenche alors une seule écriture, déjà à jour.
   */
  const unsubscribePlaybackActive = machine.on('playbackActiveChanged', ({ active }) => {
    if (active) {
      mountHandle?.setPreviewSuspended(true)
      return
    }
    ensureMounted()
    const { scene, selection } = machine.getSnapshot().context
    if (scene) syncSelection(scene, selection)
    mountHandle?.setPreviewSuspended(false)
  })

  ensureMounted()
  const initial = machine.getSnapshot().context
  if (initial.scene) syncSelection(initial.scene, initial.selection)
  lastObservedScene = initial.scene
  lastSelectionKey = selectionKey(initial.selection)

  return {
    destroy(): void {
      cancelIdleFlush()
      document.removeEventListener('keydown', onKeyDown, { capture: true })
      unsubscribeSeek.unsubscribe()
      unsubscribeSeekApplied.unsubscribe()
      unsubscribeFlushPending.unsubscribe()
      unsubscribePlaybackActive.unsubscribe()
      pendingCommands = null
      unsubscribeCommitted.unsubscribe()
      unsubscribeLoaded.unsubscribe()
      unsubscribeAuthorApiReady.unsubscribe()
      unsubscribeDecorChange()
      unsubscribeInteractionEnd()
      unsubscribeSnapToFirstKeyframe()
      mountHandle?.destroy()
      controller.destroy()
    },
  }
}
