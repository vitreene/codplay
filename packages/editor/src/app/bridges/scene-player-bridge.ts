import type { Actor } from 'xstate'
import { CodPlay } from 'codplay/creator'
import { createAuthorApi, createLibreAdapter, createSelectionFrame, createTrackedSession } from '@codplay/selection-frame'
import type { AuthorApi, SelectionFrameHandle, TrackedSession } from '@codplay/selection-frame'
import type { SceneDoc } from 'codplay/player/types'
import { buildSceneDoc } from '../../builder/build-scene'
import { createOffsetEditorBridge } from './offset-editor-bridge'
import type { EditorScene } from '../commands/types'
import type { controllerMachine } from '../controller/controller-machine'
import type { BridgeHandle } from './types'

/**
 * Vocabulaire de gestes partagé par LibreAdapter+SelectionFrame sur une session — `resize` couvre
 * aussi le scale (même sous-état côté `csMachine`, `machine.ts`, pas de ROTATE/SCALE distinct pour
 * un pincement). Miroir exact de `selection-frame.ts`'s propre mirroring vers la session partagée
 * (`2026-07-16-rebuild-ordering-execution-plan.md` §2, Option B).
 */
const CS_GESTURE_KINDS = [
  { kind: 'move', state: 'dragging', startEvent: 'DRAG_START', endEvent: 'DRAG_END' },
  { kind: 'resize', state: 'resizing', startEvent: 'RESIZE_START', endEvent: 'RESIZE_END' },
  { kind: 'rotate', state: 'rotating', startEvent: 'ROTATE_START', endEvent: 'ROTATE_END' }
] as const

/**
 * Pont `scenePlayer` — `2026-07-13-controller-islands-bridge-plan.md` §3.3. Rebuild complet à
 * chaque `sceneCommitted`/`sceneLoaded` (même mécanisme que dedit, §2.1 du plan — coût mesuré et
 * accepté). `CodPlay.load()` (§1.6) enchaîne déjà compile→init ; pas d'orchestration manuelle
 * `BuilderFacade`+`Player`.
 */
export function createScenePlayerBridge(mountTarget: HTMLElement, machine: Actor<typeof controllerMachine>): BridgeHandle {
  const studio = new CodPlay({})
  /**
   * `TelcoApi` — façade transport (`2026-07-17-telco-real-transport-plan.md` §0) : existe dès la
   * construction de `studio` (contrairement à `authorApi`, qui a besoin d'un premier rebuild réussi),
   * jamais recréée. Référence locale utilisée directement par ce pont (le handler `seek` ci-dessous,
   * le statut de lecture pour le CS) ; publiée aussi via `context.telco` (`PLAYER_READY`) pour les
   * autres bridges.
   */
  const telco = studio.telco
  // Le CS doit se désactiver ET disparaître pendant la lecture — `telco.onChange` est la source la
  // plus riche (snapshot complet, pas seulement `isPlaying`) et déjà testée (`2026-07-17-telco-real-
  // transport-plan.md` §5) : posé une seule fois ici, indépendamment de tout rebuild, puisque `telco`
  // existe déjà à cet instant. `setPartActive('cs', false)` ne retire QUE l'interactivité
  // (`pointerEvents`) — les poignées restaient visibles à l'écran pendant une vraie lecture (bug
  // constaté en direct, remontant à la remarque d'origine de ce chantier) ; `setPartVisibility('cs',
  // false)` (déjà exposé par la façade, jamais câblé dans ed2 avant ce fix) cache le cadre lui-même.
  // La même paire est réappliquée depuis `attachSelection` pour qu'un frame flambant neuf (nouvelle
  // sélection en cours de lecture) reflète immédiatement l'état courant, pas seulement au prochain
  // changement.
  telco.onChange((state) => {
    frame?.setPartActive('cs', state.status !== 'playing')
    frame?.setPartVisibility('cs', state.status !== 'playing')
  })
  let authorApi: AuthorApi | null = null
  let frame: SelectionFrameHandle | null = null
  /**
   * Session partagée (LibreAdapter+SelectionFrame) de l'item actuellement sélectionné —
   * `session.isGestureActive()` est la décision unique qui gouverne à la fois le déclenchement du
   * rebuild (§Chantier 2.1) et le remplacement du frame (§Chantier 2.2), remplaçant les anciennes
   * garanties implicites (debounce réarmé, `.then()` aveugle).
   */
  let session: TrackedSession | null = null
  /** itemId actuellement attaché — permet à `selectItem` de ne rien faire quand un rebuild ne fait que recommitter le MÊME item (l'ancre existante suit déjà le node remonté, Chantier 1). */
  let currentItemId: string | null = null
  /**
   * Pont offset (spec `2026-07-07-dedit-spec.md` §6) — construit une fois, publié via
   * `PLAYER_READY`/`context.offsetBridge`, jamais recréé (`2026-07-16-position-bridge-
   * reconciliation-plan.md` §Étape A). dedit est le seul consommateur ; ce pont ne commet plus
   * rien lui-même — `persistOffset` a été retiré (§Étape C), la position transite désormais par
   * dedit comme tout le reste du décor.
   */
  const offsetBridge = createOffsetEditorBridge()
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
        machine.send({ type: 'PLAYER_READY', authorApi, referenceWidthPx: mountTarget.getBoundingClientRect().width, offsetBridge, telco })
      }
      // Un rebuild remonte toujours le player à t=0 — rejouer la position courante immédiatement,
      // sinon toute modification (décor, transition…) reste invisible jusqu'au prochain geste de
      // seek explicite de l'auteur.
      await studio.player.seek({ timelineMs: lastSeekMs + preRollMs })
    } catch (error) {
      console.error('[scenePlayer bridge] rebuild failed', error)
    }
  }

  /**
   * Détruit le frame/session courants — attend la fin d'un geste en cours plutôt que de couper le
   * frame sous la main de l'utilisateur (`2026-07-16-rebuild-ordering-execution-plan.md` §3.2).
   * `then` ne s'exécute qu'une fois la destruction réellement effective.
   */
  function destroySelection(then: () => void): void {
    const oldFrame = frame
    const oldSession = session
    frame = null
    session = null
    if (oldFrame === null || oldSession === null) {
      then()
      return
    }
    if (!oldSession.isGestureActive()) {
      oldFrame.destroy()
      then()
      return
    }
    const unsubscribe = oldSession.subscribe(() => {
      if (!oldSession.isGestureActive()) {
        unsubscribe()
        oldFrame.destroy()
        then()
      }
    })
  }

  /** Construit la session+frame pour `itemId` — no-op si supplanté par une sélection plus récente pendant l'attente de `destroySelection`. */
  function attachSelection(itemId: string | null): void {
    if (itemId !== currentItemId) return
    if (itemId === null || authorApi === null) return

    // Session partagée (LibreAdapter+SelectionFrame) au lieu de deux abonnements séparés sur le même
    // id — `2026-07-16-authoring-shared-tracking-layer-plan.md` §3, Étape 2. Porte aussi, depuis ce
    // chantier, `isGestureActive()`/`canAct()`/`onSuspend`, seule source consultée pour gater le
    // rebuild (Chantier 2.1), le remplacement du frame (Chantier 2.2) et le commit (Chantier 3).
    const newSession = createTrackedSession({ authorApi, persoIds: [itemId], gestureKinds: CS_GESTURE_KINDS })
    session = newSession

    // Le pont offset relaie chaque delta LibreAdapter vers dedit (spec §6, `onApplied` — émission
    // continue, jamais de debounce ici) ; dedit décide seul quand committer (Chantier 3 généralisé,
    // `2026-07-16-position-bridge-reconciliation-plan.md` §Étape D). Ce pont ne commet plus rien
    // lui-même — l'ancien `persistOffset`/`RUN_TRANSACTION` direct est retiré (§Étape C du plan de
    // réconciliation). `change.kind` propagé au pont offset : seuls les composants réellement
    // manipulés entrent dans l'écart (`2026-07-17-phase-commit-selection-recovery-plan.md` §Étape C).
    const adapter = createLibreAdapter({
      authorApi,
      itemId,
      anchor: newSession,
      onApplied: (change) => offsetBridge.notifyNow(change.kind),
    })
    offsetBridge.rebind({
      session: newSession,
      adapter,
      authorApi,
      itemId,
      referenceWidthPx: () => machine.getSnapshot().context.referenceWidthPx,
    })

    const newFrame = createSelectionFrame({ itemId, authorApi, anchor: newSession, sceneRoot: mountTarget, adapter })
    // Reflète l'état de lecture courant immédiatement — la souscription globale (ci-dessus) ne
    // notifie qu'au PROCHAIN changement, un frame flambant neuf doit déjà être correct sans attendre.
    const notPlaying = telco.getState().status !== 'playing'
    newFrame.setPartActive('cs', notPlaying)
    newFrame.setPartVisibility('cs', notPlaying)

    frame = newFrame
    const frameDestroy = newFrame.destroy.bind(newFrame)
    newFrame.destroy = () => {
      offsetBridge.rebind(null)
      newSession.destroy()
      frameDestroy()
    }
  }

  /**
   * Ne remplace le frame/session que si la sélection a réellement changé — un simple écho de
   * sélection (`SELECT_ITEM` sans mutation du document, `scene === lastScene`) sur le MÊME item est
   * un no-op ici. Après un rebuild réel (nouveau document), voir `reattachSelection` ci-dessous —
   * codplay n'émet aucune notification `subscribeToNode` au moment où un enfant de liste est
   * réellement attaché par replay de move (seule la racine l'est avant ce point), donc la session
   * existante ne peut PAS être supposée suivre le node remonté dans ce cas (`2026-07-17-phase-
   * commit-selection-recovery-plan.md` — restaure le comportement de `db18e52`, régressé par
   * `7e4534f`).
   */
  function selectItem(itemIds: string[]): void {
    const itemId = itemIds[0] ?? null
    if (itemId === currentItemId) return
    currentItemId = itemId
    destroySelection(() => attachSelection(itemId))
  }

  /**
   * Reconstruction inconditionnelle après un rebuild réel — même item ou non. `attachSelection`
   * ouvre une souscription `subscribeToNode` fraîche, qui reçoit son node immédiatement (contrat
   * « appel immédiat ») : c'est le seul chemin fiable pour voir le node effectivement attaché
   * aujourd'hui, cf. commentaire de `selectItem`.
   */
  function reattachSelection(itemIds: string[]): void {
    const itemId = itemIds[0] ?? null
    currentItemId = itemId
    destroySelection(() => attachSelection(itemId))
  }

  const unsubscribeCommitted = machine.on('sceneCommitted', ({ scene, selection }) => {
    const proceed = (): void => {
      if (scene !== lastScene) {
        void rebuild(scene).then(() => reattachSelection(selection.itemIds))
      } else {
        selectItem(selection.itemIds)
      }
    }
    // Chantier 2.1 — un rebuild ne démarre jamais tant qu'un geste est actif sur la session
    // courante, explicitement consulté plutôt qu'implicite via le seul timing du debounce.
    if (session !== null && session.isGestureActive()) {
      const unsubscribe = session.subscribe(() => {
        if (session === null || !session.isGestureActive()) {
          unsubscribe()
          proceed()
        }
      })
      return
    }
    proceed()
  })
  const unsubscribeLoaded = machine.on('sceneLoaded', ({ scene }) => {
    void rebuild(scene)
  })
  const unsubscribeSeek = machine.on('seek', ({ timelineMs }) => {
    lastSeekMs = timelineMs
    // Avant le premier rebuild réussi (`authorApi` non posé), le player n'a rien à rejouer.
    if (!authorApi) return
    // `telco.seek()` (façade, `2026-07-17-telco-real-transport-plan.md` §Étape E — jamais
    // `studio.player.seek()` en direct) fait bouger la pose anime.js du node SANS le remplacer ni
    // changer sa taille — ni `handleElementNode` (changement de node) ni le `ResizeObserver`
    // (changement de taille) du CS ne se déclenchent dans ce cas. Sans `sync()` explicite ici, le
    // cadre reste figé sur la position d'avant le seek jusqu'au prochain événement qui le
    // repositionne par accident. Ce point d'écoute reste le SEUL chemin d'exécution réelle du seek
    // (scrub du sequence-editor comme Stop, §3 bis du plan) — décor-editor-bridge's flush (signal 3)
    // et `lastSeekMs` en dépendent tous les deux, jamais court-circuités.
    void telco.seek(timelineMs + lastPreRollMs).then(() => frame?.sync())
  })
  /**
   * Abandon de phase (Échap côté pont `decorEditor`) — `scene` est le document INCHANGÉ (rien n'a
   * été committé pour la phase annulée), mais la preview live du geste/de la palette a déjà mué le
   * DOM en dehors de tout commit. Un rebuild inconditionnel depuis ce même document efface cette
   * preview périmée ; `reattachSelection` (étape A) redonne un cadre fonctionnel sur le résultat.
   */
  const unsubscribeReverted = machine.on('sceneReverted', ({ scene }) => {
    void rebuild(scene).then(() => reattachSelection(machine.getSnapshot().context.selection.itemIds))
  })

  // Clic hors CS → `CLEAR_SELECTION` : déjà câblé, pas ici — `AppLayout.tsx::useClearSelectionShortcuts`
  // (`mousedown` sur `.app-region--scene` hors `[data-selection-frame]`) le fait depuis
  // `2026-07-16-rebuild-ordering-execution-plan.md` §4.2. Signal 1 (flush sur changement de
  // sélection, `decor-editor-bridge.ts`) s'en sert déjà tel quel — rien à ajouter ici.

  /**
   * Resize fenêtre / scroll — `SelectionFrameHandle.sync()` existe précisément pour ça
   * (`positionCs()` recalculé depuis `getBoundingClientRect()` courant) mais n'était câblé nulle
   * part dans ed2 — seulement dans les démos autonomes du module (`selection-frame-demo.ts`,
   * `selection-frame-grid-demo.ts`), jamais dans `scene-player-bridge.ts`. Le `ResizeObserver`
   * interne de `SelectionFrame` observe uniquement le NODE de l'item (ses changements de taille
   * propre) — ni un resize de fenêtre ni un scroll d'ancêtre ne le déclenchent, aucun des deux ne
   * change la taille du node, seulement sa position à l'écran. `scroll` en phase de capture (ne
   * bulle pas nativement) pour attraper le scroll de n'importe quel ancêtre scrollable, pas
   * seulement `window` — même portée que les démos.
   */
  const onWindowResize = (): void => frame?.sync()
  const onAncestorScroll = (): void => frame?.sync()
  window.addEventListener('resize', onWindowResize)
  document.addEventListener('scroll', onAncestorScroll, { capture: true, passive: true })

  const initialScene = machine.getSnapshot().context.scene
  if (initialScene) void rebuild(initialScene)

  return {
    destroy(): void {
      unsubscribeCommitted.unsubscribe()
      unsubscribeLoaded.unsubscribe()
      unsubscribeSeek.unsubscribe()
      unsubscribeReverted.unsubscribe()
      window.removeEventListener('resize', onWindowResize)
      document.removeEventListener('scroll', onAncestorScroll, { capture: true })
      frame?.destroy()
      void studio.player.destroy()
    },
  }
}
