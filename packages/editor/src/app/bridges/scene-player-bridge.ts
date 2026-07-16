import type { Actor } from 'xstate'
import { CodPlay } from 'codplay/creator'
import { createAuthorApi, createLibreAdapter, createMinimalAnchor, createSelectionFrame } from '@codplay/selection-frame'
import type { AuthorApi, SelectionFrameHandle } from '@codplay/selection-frame'
import type { SceneDoc } from 'codplay/player/types'
import { buildSceneDoc } from '../../builder/build-scene'
import { pxToCqw } from '../../decor-editor/units'
import type { EditorScene, OffsetData } from '../commands/types'
import type { controllerMachine } from '../controller/controller-machine'
import type { BridgeHandle } from './types'

/** Même lecture que `libre-adapter.ts` (readTranslate/readPx) — ne relit jamais un delta, seul l'état CSS final du node fait foi. */
function readCurrentOffsetPx(node: HTMLElement): { x: number; y: number; width: number; height: number; rotate: number; scale: { x: number; y: number } } {
  const translateRaw = node.style.translate
  const translateParts = translateRaw && translateRaw !== 'none' ? translateRaw.split(/\s+/).map((p) => Number.parseFloat(p)) : []
  const computed = node.ownerDocument.defaultView?.getComputedStyle(node)
  const width = Number.parseFloat(node.style.width) || (computed ? Number.parseFloat(computed.width) : 0) || node.offsetWidth
  const height = Number.parseFloat(node.style.height) || (computed ? Number.parseFloat(computed.height) : 0) || node.offsetHeight
  const rotate = Number.parseFloat(node.style.rotate) || 0
  const scaleRaw = node.style.scale
  const scaleParts = scaleRaw && scaleRaw !== 'none' ? scaleRaw.split(/\s+/).map((p) => Number.parseFloat(p)) : []
  const scaleX = Number.isFinite(scaleParts[0]) ? scaleParts[0]! : 1
  const scaleY = Number.isFinite(scaleParts[1]) ? scaleParts[1]! : scaleX
  return {
    x: translateParts[0] || 0,
    y: translateParts[1] || 0,
    width,
    height,
    rotate,
    scale: { x: scaleX, y: scaleY },
  }
}

/**
 * Pont `scenePlayer` — `2026-07-13-controller-islands-bridge-plan.md` §3.3. Rebuild complet à
 * chaque `sceneCommitted`/`sceneLoaded` (même mécanisme que dedit, §2.1 du plan — coût mesuré et
 * accepté). `CodPlay.load()` (§1.6) enchaîne déjà compile→init ; pas d'orchestration manuelle
 * `BuilderFacade`+`Player`.
 */
export function createScenePlayerBridge(mountTarget: HTMLElement, machine: Actor<typeof controllerMachine>): BridgeHandle {
  const studio = new CodPlay({})
  let authorApi: AuthorApi | null = null
  let frame: SelectionFrameHandle | null = null
  /** `SELECT_ITEM` seul ne change pas `context.scene` (même référence) — sert à ne rebuild QUE sur une vraie mutation du document, jamais sur un simple changement de sélection. */
  let lastScene: EditorScene | null = null
  /** `BuildSceneResult.preRollMs` du dernier rebuild réussi — le `0` que voit l'auteur au seek correspond à ce décalage côté player (`2026-06-11-sequence-editor-grid-spec.md` §2.2). */
  let lastPreRollMs = 0
  /**
   * Dernier `timelineMs` (référentiel auteur, sans `preRollMs`) reçu via l'event `seek` —
   * `studio.load()` remonte toujours à `t=0`, un rebuild déclenché par une simple modification de
   * décor (aucun changement de playhead) doit donc rejouer explicitement cette position, sinon
   * l'effet reste invisible tant que l'auteur ne bouge pas la tête de lecture lui-même : la mise à
   * jour ne serait plus « immédiate » (régression sinon, la tête reste où l'auteur l'a laissée).
   */
  let lastSeekMs = 0

  async function rebuild(scene: EditorScene): Promise<void> {
    lastScene = scene
    try {
      // `buildSceneDoc` lève plutôt que de renvoyer un Result (§6 du plan : `type: 'text'` seul
      // supporté aujourd'hui — un item resté `bloc` lève ici, pas un bug de ce pont).
      const { sceneDoc, styleSheet, rootGrid, preRollMs } = buildSceneDoc(scene)
      lastPreRollMs = preRollMs
      console.log('[DEBUG sceneDoc.stories.story-main]', JSON.stringify(sceneDoc.stories['story-main'], null, 2))
      // Rien n'est placé hors du capsule racine ; ses dimensions réelles sont adaptatives, seul le
      // ratio (`cols/rows` de sa grille) est une contrainte — letterboxing dans `.app-region--scene`
      // plutôt qu'un étirement. Posé sur `mountTarget` lui-même (pas le node racine que Codplay monte
      // dedans) : c'est cette boîte que le flex parent centre.
      mountTarget.style.aspectRatio = `${rootGrid.cols} / ${rootGrid.rows}`
      const styleSheetUrl = URL.createObjectURL(new Blob([styleSheet], { type: 'text/css' }))
      const loadResult = await studio.load({
        // `SceneDef` (sortie du Builder) vs `SceneDoc` (entrée `CodPlay.load`) — même cast déjà établi
        // côté `packages/demos/src/scenes/ed2-builder-scene.ts`, pas une divergence introduite ici.
        scene: sceneDoc as unknown as SceneDoc,
        mountTarget,
        extraResources: [{ url: styleSheetUrl, type: 'css', policy: { cache: 'no-store' } }],
        // 'broadcast' (par défaut) attend l'événement d'intro avant de révéler un item — packages/editor
        // est un contexte d'édition, pas de lecture ; même mode que les « démos d'édition » de packages/demos.
        mode: 'author',
      })
      if (!loadResult.ok) {
        // Deux commits rapprochés (ex. deux `RUN_TRANSACTION` synchrones, ou un picker couleur qui
        // émet en continu pendant un drag) déclenchent chacun un rebuild — le second annule le
        // `studio.load()` encore en vol du premier (`PRELOAD_CANCELLED`). Vérifié en conditions
        // réelles : le rebuild le plus récent aboutit toujours, celui-ci est déjà périmé — pas une
        // vraie erreur, juste bruyant en `console.error`. Toute autre cause reste une vraie erreur.
        if (loadResult.error.code !== 'PRELOAD_CANCELLED') {
          console.error('[scenePlayer bridge] rebuild failed', loadResult.error)
        }
        return
      }
      const isFirstReady = authorApi === null
      authorApi = createAuthorApi(studio.player)
      // `studio.player` est la même instance à travers tous les rebuilds (§2.1) — un seul envoi suffit.
      if (isFirstReady) {
        machine.send({ type: 'PLAYER_READY', authorApi, referenceWidthPx: mountTarget.getBoundingClientRect().width })
      }
      // Un rebuild remonte toujours le player à t=0 — rejouer la position courante immédiatement,
      // sinon toute modification (décor, transition…) reste invisible jusqu'au prochain geste de
      // seek explicite de l'auteur.
      await studio.player.seek({ timelineMs: lastSeekMs + preRollMs })
    } catch (error) {
      console.error('[scenePlayer bridge] rebuild failed', error)
    }
  }

  /** `resolveTarget` de `decor-editor-bridge.ts` — même résolution decorId (kf sélectionné sinon décor initial), dupliquée ici faute d'un point de partage entre ponts (§3bis, chacun reste autonome). */
  function resolveTargetDecorId(scene: EditorScene, selection: { itemIds: string[]; keyframeId?: string }): string | null {
    const itemId = selection.itemIds[0]
    if (!itemId) return null
    const item = scene.items.find((i) => i.id === itemId)
    if (!item) return null
    return selection.keyframeId
      ? (item.keyframes.find((k) => k.id === selection.keyframeId)?.decorId ?? null)
      : item.initialDecorId
  }

  function selectItem(itemIds: string[]): void {
    frame?.destroy()
    frame = null
    let persistTimer: ReturnType<typeof setTimeout> | null = null
    const itemId = itemIds[0]
    if (itemId && authorApi) {
      // One shared anchor for this itemId, handed to both LibreAdapter and
      // SelectionFrame (and used directly here for persistOffset's own node
      // read) instead of three independent subscribeToNode calls on the same
      // id — `2026-07-16-authoring-shared-tracking-layer-plan.md` §3, Étape
      // 2. scene-player-bridge.ts is the sole owner: destroyed in
      // frame.destroy below, never by the adapter/frame that borrow it.
      const anchor = createMinimalAnchor({ authorApi, persoIds: [itemId] })
      const persistOffset = (): void => {
        const { scene, selection, referenceWidthPx } = machine.getSnapshot().context
        if (!scene || !anchor.canAct() || referenceWidthPx <= 0) return
        const node = anchor.getNode(itemId)
        if (!(node instanceof HTMLElement)) return
        const decorId = resolveTargetDecorId(scene, selection)
        if (!decorId) return
        const current = readCurrentOffsetPx(node)
        const offset: OffsetData = {
          translate: { x: pxToCqw(current.x, referenceWidthPx), y: pxToCqw(current.y, referenceWidthPx) },
          rotate: current.rotate,
          scale: current.scale,
        }
        if (current.width) offset.width = pxToCqw(current.width, referenceWidthPx)
        if (current.height) offset.height = pxToCqw(current.height, referenceWidthPx)
        machine.send({
          type: 'RUN_TRANSACTION',
          commands: [{ name: 'setDecor', args: { decorId, patch: { offset } } }],
        })
      }
      const adapter = createLibreAdapter({
        authorApi,
        itemId,
        anchor,
        // Application DOM déjà immédiate (adapter lui-même) — ici seulement la persistance
        // document, debattue pour ne pas écrire à chaque micro-pas de pointermove.
        onApplied: () => {
          if (persistTimer !== null) clearTimeout(persistTimer)
          persistTimer = setTimeout(persistOffset, 250)
        },
      })
      frame = createSelectionFrame({ itemId, authorApi, anchor, sceneRoot: mountTarget, adapter })
      const frameDestroy = frame.destroy.bind(frame)
      frame.destroy = () => {
        if (persistTimer !== null) clearTimeout(persistTimer)
        anchor.destroy()
        frameDestroy()
      }
    }
  }

  const unsubscribeCommitted = machine.on('sceneCommitted', ({ scene, selection }) => {
    if (scene !== lastScene) {
      void rebuild(scene).then(() => selectItem(selection.itemIds))
    } else {
      selectItem(selection.itemIds)
    }
  })
  const unsubscribeLoaded = machine.on('sceneLoaded', ({ scene }) => {
    void rebuild(scene)
  })
  const unsubscribeSeek = machine.on('seek', ({ timelineMs }) => {
    lastSeekMs = timelineMs
    // Avant le premier rebuild réussi (`authorApi` non posé), le player n'a rien à rejouer.
    if (authorApi) void studio.player.seek({ timelineMs: timelineMs + lastPreRollMs })
  })

  const initialScene = machine.getSnapshot().context.scene
  if (initialScene) void rebuild(initialScene)

  return {
    destroy(): void {
      unsubscribeCommitted.unsubscribe()
      unsubscribeLoaded.unsubscribe()
      unsubscribeSeek.unsubscribe()
      frame?.destroy()
      void studio.player.destroy()
    },
  }
}
