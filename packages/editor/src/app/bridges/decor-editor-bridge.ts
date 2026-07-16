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

type Target = { itemId: string; contentId: string | null; decorId: string; itemType: 'text' | 'image' | 'media' | 'video' | 'capsule' }

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
  return { itemId: item.id, contentId: item.contentId, decorId, itemType: item.type }
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

export function createDecorEditorBridge(container: HTMLElement, machine: Actor<typeof controllerMachine>): BridgeHandle {
  const catalogs: DecorEditorCatalogs = { presets: DEFAULT_PRESETS, cards: [], palette: DEFAULT_PALETTE }
  const controller = new DecorEditorController(catalogs)
  let mountHandle: DecorEditorMountHandle | null = null
  let offsetBridgeWired = false

  // ── Flush de fin de phase (chantier 3 généralisé — `2026-07-16-position-bridge-reconciliation-
  // plan.md` §Étape D) — dedit lui-même n'a aucun debounce (spec §4.3, émission continue) ; c'est
  // ce pont, l'hôte, qui décide seul quand committer réellement vers la scène. ────────────────────

  let pendingCommands: Command[] | null = null
  let flushTimer: ReturnType<typeof setTimeout> | null = null

  function armFlush(): void {
    if (flushTimer !== null) clearTimeout(flushTimer)
    flushTimer = setTimeout(flushNow, 250)
  }

  function cancelFlush(): void {
    if (flushTimer !== null) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
  }

  /**
   * Double garde avec `armFlush`/`onGestureActiveChange` : un geste CS repris entre-temps (ex.
   * resize→rotate enchaînés sans pause) laisse `pendingCommands` en place sans committer — sa
   * propre fin réarmera. Sans ce second contrôle au moment du tir, un minuteur déjà en vol au
   * moment où un nouveau geste démarre pourrait committer une position intermédiaire.
   */
  function flushNow(): void {
    flushTimer = null
    if (machine.getSnapshot().context.offsetBridge?.isGestureActive()) return
    const commands = pendingCommands
    pendingCommands = null
    if (commands && commands.length > 0) machine.send({ type: 'RUN_TRANSACTION', commands })
  }

  /** Câblé une fois le pont offset disponible (`context.offsetBridge`, publié avec `authorApi`). */
  function wireOffsetBridge(): void {
    if (offsetBridgeWired) return
    const { offsetBridge } = machine.getSnapshot().context
    if (!offsetBridge) return
    offsetBridgeWired = true
    controller.setOffsetBridge(offsetBridge)
    // Fin d'un geste CS — arme le délai court (réarmé si un nouveau geste, ou une autre édition
    // continue, s'enchaîne avant qu'il n'expire) plutôt que de committer immédiatement : c'est
    // exactement le comportement qui empêchait resize→rotate→move de produire 3 commits distincts.
    offsetBridge.onGestureActiveChange(active => {
      if (active) cancelFlush()
      else if (pendingCommands !== null) armFlush()
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
    const decorArgs = patchToDecorArgs(entry.patch, scene)
    if (decorArgs) commands.push({ name: 'setDecor', args: { decorId: target.decorId, patch: decorArgs } })

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

    // Ne commet plus immédiatement — armé pour la fin de phase (chantier 3 généralisé, ci-dessus).
    // `entry.patch` porte déjà l'écart COMPLET de l'item (spec §4.3), offset inclus s'il est à jour
    // (pont §Étape A) : c'est ce qui ferme le bug de patch périmé constaté en direct cette session.
    if (commands.length > 0) {
      pendingCommands = commands
      armFlush()
    }
  })

  const unsubscribeInteractionEnd = controller.onInteractionEnd(() => {
    if (pendingCommands === null) return
    if (machine.getSnapshot().context.offsetBridge?.isGestureActive()) {
      cancelFlush()
      return
    }
    armFlush()
  })

  const unsubscribeCommitted = machine.on('sceneCommitted', ({ scene, selection }) => {
    ensureMounted()
    syncSelection(scene, selection)
  })
  const unsubscribeLoaded = machine.on('sceneLoaded', ({ scene }) => {
    ensureMounted()
    syncSelection(scene, machine.getSnapshot().context.selection)
  })
  const unsubscribeAuthorApiReady = machine.on('authorApiReady', () => ensureMounted())

  ensureMounted()
  const initial = machine.getSnapshot().context
  if (initial.scene) syncSelection(initial.scene, initial.selection)

  return {
    destroy(): void {
      cancelFlush()
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
