import type { Actor } from 'xstate'
import type { AuthorApi } from '@codplay/selection-frame'
import { DecorEditorController } from '../../decor-editor/controller'
import { mountDecorEditor } from '../../decor-editor/mount'
import { DEFAULT_PALETTE, DEFAULT_PRESETS } from '../../decor-editor/default-palette'
import type { DecorEditorCatalogs } from '../../decor-editor/controller'
import type { DecorEditorMountHandle } from '../../decor-editor/mount'
import { findPanel, panelsForType } from '../../decor-editor/palette-panel'
import type { PanelField } from '../../decor-editor/palette-panel'
import { formatLiveValueForCssProperty } from '../../decor-editor/css-value-format'
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

type ItemVisualType = 'text' | 'image' | 'media' | 'video' | 'capsule'

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

type KeyframeAlignment =
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
function resolveKeyframeAlignment(item: Item, timelineMs: number): KeyframeAlignment {
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
function styleFieldsForItemType(controller: DecorEditorController, itemType: ItemVisualType): PanelField[] {
  const config = controller.getPaletteConfig()
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
 * Décor temporaire — lecture live via `AuthorApi.getNodeSnapshot`, jamais `scene.decors`. Ne
 * demande que les propriétés que la palette édite réellement (`styleFieldsForItemType`), convertit
 * chaque valeur résolue dans l'unité propre au `Decor` (`formatLiveValueForCssProperty` — cqw pour
 * les champs numériques, chaîne brute sinon, ex. couleur).
 */
function resolveTemporaryPatch(authorApi: AuthorApi, itemId: string, fields: PanelField[], referenceWidthPx: number): DecorPatch {
  const propNames = fields.map((f) => f.path.slice('style.'.length))
  const snapshot = authorApi.getNodeSnapshot(itemId, propNames)
  if (!snapshot) return {}
  const style: Record<string, string> = {}
  for (const field of fields) {
    const prop = field.path.slice('style.'.length)
    const raw = snapshot[prop]
    if (raw === undefined) continue
    style[prop] = field.kind === 'number' || field.kind === 'slider' ? formatLiveValueForCssProperty(prop, raw, referenceWidthPx) : String(raw)
  }
  return Object.keys(style).length > 0 ? { style } : {}
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
function resolveCurrentPatch(decor: Decor, content: Content | undefined, scene: EditorScene): DecorPatch {
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
function resolveEffectiveKeyframePatch(
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

/** Écarts routés vers `setDecor` (`style`/`classes`/`offset`/`custom`/`zone`) — présents seulement si modifiés. */
function patchToDecorArgs(patch: DecorPatch, scene: EditorScene): Partial<Omit<Decor, 'id'>> | null {
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
      const { authorApi, referenceWidthPx } = machine.getSnapshot().context
      // Fiable même pendant un geste CS actif : `LibreAdapter` écrit désormais la pose via
      // `AuthorApi.setNodePose` (anime.js `utils.set`), plus jamais directement sur `node.style.*`
      // — le cache d'anime.js reste cohérent en permanence (même correctif que `offset-editor-
      // bridge.ts::readActivePose`, `2026-07-18-pose-edit-architecture-study.md` §2/§6). L'ancienne
      // exception `!gestureActive` retombait sur le kf précédent seul pendant tout geste — le décor
      // temporaire restait figé au lieu de suivre le geste en cours.
      const live = authorApi ? resolveTemporaryPatch(authorApi, target.itemId, styleFieldsForItemType(controller, target.itemType), referenceWidthPx) : {}
      patch = mergePatch(base, live)
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

    const commands: Command[] = []
    let writeDecorId = target.writeDecorId
    if (target.keyframeId && isDecorSharedByAnotherKeyframe(scene, target.writeDecorId, target.keyframeId)) {
      // Fork avant d'écrire, jamais après (spec §2.3) — sinon la mutation en place a déjà atteint
      // le keyframe voisin le temps que le fork soit décidé.
      writeDecorId = freshDecorId()
      commands.push({ name: 'registerDecor', args: { decorId: writeDecorId } })
      commands.push({ name: 'assignKeyframeDecor', args: { itemId: target.itemId, keyframeId: target.keyframeId, decorId: writeDecorId } })
    }
    const decorArgs = patchToDecorArgs(entry.patch, scene)
    if (decorArgs) commands.push({ name: 'setDecor', args: { decorId: writeDecorId, patch: decorArgs } })

    const existingContent = target.contentId ? scene.contents[target.contentId] : undefined
    const contentArgs = patchToContentArgs(entry.patch, existingContent, target.itemType)
    if (contentArgs) commands.push({ name: 'assignContent', args: { itemId: target.itemId, content: contentArgs } })

    // `.capsule` (→ `Item.capsule`) : aucun geste de création de capsule n'existe encore dans
    // l'app (`DemoMenuRegion` ne crée que des items texte) — rien à vérifier tant que ce cas ne
    // se présente pas réellement. `.custom` (CSS libre) est routé depuis ce jour via
    // `Decor.custom`/`patchToDecorArgs` — plus un gap, cf `2026-07-17-decor-keyframe-layering-plan.md`.
    if (entry.patch.capsule !== undefined) console.warn('[decorEditor bridge] patch.capsule non routé — aucune capsule créée par cet incrément')

    // Ne commet plus immédiatement — accumulé pour la fin de phase (§Étape B). `entry.patch` porte
    // déjà l'écart COMPLET de l'item (spec §4.3), offset inclus s'il est à jour (pont §Étape A) :
    // c'est ce qui ferme le bug de patch périmé constaté en direct cette session.
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
