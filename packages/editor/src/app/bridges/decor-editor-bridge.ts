import type { Actor } from 'xstate'
import { DecorEditorController } from '../../decor-editor/controller'
import { mountDecorEditor } from '../../decor-editor/mount'
import { DEFAULT_PALETTE, DEFAULT_PRESETS } from '../../decor-editor/default-palette'
import type { DecorEditorCatalogs } from '../../decor-editor/controller'
import type { DecorEditorMountHandle } from '../../decor-editor/mount'
import type { DecorPatch, OffsetPatch } from '../../decor-editor/types'
import type { Content, Decor, EditorScene, OffsetData } from '../commands/types'
import type { Command, Selection } from '../controller/types'
import type { controllerMachine } from '../controller/controller-machine'
import type { BridgeHandle } from './types'

/**
 * Pont `decorEditor` — `2026-07-13-controller-islands-bridge-plan.md` §3.2. `defaults`/`chain`
 * restent vides : aucune chaîne d'héritage (capsule/zone) n'est modélisée côté document
 * aujourd'hui — `patch` porte donc, à lui seul, le décor résolu.
 */

type Target = { itemId: string; keyframeId: string | null; contentId: string | null; decorId: string; itemType: 'text' | 'image' | 'media' | 'video' | 'capsule' }

/** `bloc` n'a pas encore de type visuel (§6 du plan) — rien à décorer tant qu'il n'est pas différencié. */
function resolveTarget(scene: EditorScene, selection: Selection): Target | null {
  const itemId = selection.itemIds[0]
  if (!itemId) return null
  const item = scene.items.find((i) => i.id === itemId)
  if (!item || item.type === 'bloc') return null
  const decorId = selection.keyframeId
    ? item.keyframes.find((k) => k.id === selection.keyframeId)?.decorId
    : item.initialDecorId
  if (!decorId) return null
  return { itemId: item.id, keyframeId: selection.keyframeId ?? null, contentId: item.contentId, decorId, itemType: item.type }
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
  if (decor.zoneId) {
    const zone = scene.zones[decor.zoneId]
    if (zone) patch.zone = zone.name
  }
  if (content?.text !== undefined) patch.text = content.text
  if (content?.textAutoSize !== undefined) patch.textAutoSize = content.textAutoSize
  return patch
}

/** Écarts routés vers `setDecor` (`style`/`classes`/`offset`/`zone`) — présents seulement si modifiés. */
function patchToDecorArgs(patch: DecorPatch, scene: EditorScene): Partial<Omit<Decor, 'id'>> | null {
  const args: Partial<Omit<Decor, 'id'>> = {}
  let touched = false
  if (patch.style !== undefined) { args.style = patch.style; touched = true }
  if (patch.classes !== undefined) { args.classes = patch.classes as unknown as Decor['classes']; touched = true }
  if (patch.offset !== undefined) { args.offset = patch.offset as unknown as OffsetData; touched = true }
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
    // Fin d'un geste CS — désormais un simple signal d'activité de phase (harmonisé avec le `change`
    // palette, arbitrage 2026-07-17), jamais un commit immédiat : arme le minuteur d'inactivité.
    offsetBridge.onGestureActiveChange(active => {
      if (active) cancelIdleFlush()
      else if (pendingCommands !== null) armIdleFlush()
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
    const target = resolveTarget(scene, selection)
    if (!target) {
      controller.detach()
      return
    }
    const decor: Decor = scene.decors[target.decorId] ?? { id: target.decorId }
    const content = target.contentId ? scene.contents[target.contentId] : undefined
    controller.attachItems([
      {
        itemId: target.itemId,
        itemType: target.itemType,
        defaults: {},
        chain: [],
        patch: resolveCurrentPatch(decor, content, scene),
        zones: [],
        context: 'horizontal',
      },
    ])
  }

  const unsubscribeDecorChange = controller.onDecorChange((entries) => {
    const { scene, selection } = machine.getSnapshot().context
    if (!scene) return
    const target = resolveTarget(scene, selection)
    if (!target) return
    const entry = entries.find((e) => e.itemId === target.itemId)
    if (!entry) return

    const commands: Command[] = []
    let writeDecorId = target.decorId
    if (target.keyframeId && isDecorSharedByAnotherKeyframe(scene, target.decorId, target.keyframeId)) {
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
    // se présente pas réellement. `.custom` : aucun champ document ne correspond à du CSS libre
    // arbitraire aujourd'hui (`Decor` n'a que `style`/`classes`/`offset`/`zoneId`) — un vrai
    // gap de modèle, pas un oubli de câblage ; à trancher si ce panneau doit rester.
    if (entry.patch.capsule !== undefined) console.warn('[decorEditor bridge] patch.capsule non routé — aucune capsule créée par cet incrément')
    if (entry.patch.custom !== undefined) console.warn('[decorEditor bridge] patch.custom non routé — aucun champ document ne correspond à du CSS libre')

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
  const unsubscribeSeek = machine.on('seek', () => flushNow())

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
      pendingCommands = null
      unsubscribeCommitted.unsubscribe()
      unsubscribeLoaded.unsubscribe()
      unsubscribeAuthorApiReady.unsubscribe()
      unsubscribeDecorChange()
      unsubscribeInteractionEnd()
      mountHandle?.destroy()
      controller.destroy()
    },
  }
}
