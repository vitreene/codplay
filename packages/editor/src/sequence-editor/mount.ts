import './sequence-editor.css'

import type { MachineContext, VirtualKeyframe } from './machine'
import type { SequenceEditorController } from './controller'
import type { TelcoApi } from 'codplay/telco/types'
import type { PlayerStateSnapshot } from 'codplay/player/types'
import { formatTimeMs } from './constants'
import { createTimeRuler, renderTimeRuler } from './render/time-ruler'
import { createTrackLabelList, renderTrackLabelList } from './render/track-label-list'
import { createTrackRowArea, renderTrackRows } from './render/track-row'
import { createPlayheadOverlay, renderPlayhead } from './render/playhead-line'
import { createCueRow, renderCueRow } from './render/cue-row'
import { createMarkerTrackRows, renderMarkerTrackRows } from './render/marker-row'
import { createWaveformRow, renderWaveformRow } from './render/waveform-row'

/**
 * Un `<button>` dont le `textContent` est un glyphe Unicode seul (▶/■/≫/⊡/×) expose ce nœud texte
 * au hit-test du pointeur — WebKit peut router un clic dessus vers sa machinerie de sélection de
 * texte au lieu de le laisser remonter en `click` sur le bouton (`-webkit-user-select:none` sur le
 * conteneur, déjà posé, ne suffit pas dans tous les cas : signalé toujours reproductible). Le
 * contenu généré par CSS (`::before`/`content: attr(...)`) n'est jamais sélectionnable par
 * construction (aucun moteur ne permet de sélectionner du texte généré) — aucun nœud texte réel
 * dans le bouton, donc rien à intercepter. Pas de balisage ajouté, seulement l'attribut de données
 * que la règle `::before` de `sequence-editor.css` consomme.
 */
function setButtonGlyph(btn: HTMLButtonElement, glyph: string): void {
  btn.dataset.glyph = glyph
}

export interface MountSequenceEditorOptions {
  /** Notifié à chaque changement de playhead — le pont vers `player.seek({ timelineMs })` vit chez l'appelant, pas ici. */
  onPlayheadChange?: (timeMs: number) => void
  /**
   * Notifié juste AVANT tout appel `telco.*` engageant une lecture/relecture du document (play
   * aujourd'hui — même patron pour un futur stop/rewind direct, remarque utilisateur 2026-07-17 :
   * « pas besoin de dupliquer le flush, factoriser plutôt »). Le pont vers `TELCO_ACTION_REQUEST`
   * vit chez l'appelant, pas ici — même séparation que `onPlayheadChange`/`SEEK`.
   */
  onTelcoActionRequest?: () => void
  /**
   * Notifié juste AVANT tout appel `telco.pause()` — geste explicite (clic Play/Pause) OU pause
   * automatique en fin de scène (`syncFromTelco`). Sort l'état `playing` du contrôleur
   * (`2026-07-17-play-mode-decor-editor-deactivation-plan.md`) : point d'entrée/sortie tous deux au
   * niveau du GESTE éditeur, jamais du statut brut du transport (`isPlaying`) — un rebuild forcé
   * déclenché à l'entrée dans `playing` produit lui-même du bruit transitoire sur ce statut,
   * confirmé en direct (2026-07-18) : `isPlaying` comme signal de sortie sortait de l'état AVANT
   * que le rebuild forcé n'ait fini, quel que soit l'ordre d'exécution.
   */
  onTelcoPauseRequest?: () => void
}

export interface SequenceEditorMountHandle {
  /**
   * `context.telco` (contrôleur central) n'existe qu'après le premier rebuild réussi de
   * `scenePlayer` — jamais disponible à la construction de ce module (même contrainte que
   * `decorEditor`/`AuthorApi`, `2026-07-16-position-bridge-reconciliation-plan.md`). L'appelant
   * (`sequence-editor-bridge.ts`) l'invoque une fois ce moment venu ; tant que ce n'est pas fait,
   * Play/Pause/Stop restent inertes (`telco` reste `null`).
   */
  attachTelco(telco: TelcoApi): void
  destroy(): void
}

/**
 * Monte le sequence-editor dans `container`, piloté par `controller` — un seul contrôleur pour
 * toute la durée du montage (changer de scène = `destroy()` puis remonter avec un nouveau
 * contrôleur, pas de remplacement à chaud). Assemble les modules `create*`/`render*` déjà
 * existants ; ne contient aucune logique de démo (pas de sélecteur de fixture — c'est
 * l'appelant qui choisit quelle scène charger dans le contrôleur avant de monter).
 */
export function mountSequenceEditor(
  container: HTMLElement,
  controller: SequenceEditorController,
  options: MountSequenceEditorOptions = {},
): SequenceEditorMountHandle {
  const ctrl = controller

  // ── Proximity guard ──────────────────────────────────────────────────────────

  function isTooCloseToExisting(trackId: string, rawMs: number, ctx: MachineContext): boolean {
    const { pixelsPerMs } = ctx.viewport
    const thresholdMs = ctx.layoutProfile.keyframeHandleSizePx / pixelsPerMs
    const track = ctx.scene.items.find((i) => i.id === trackId)
    if (track) {
      for (const kf of track.keyframes) {
        if (Math.abs(kf.timeMs - rawMs) < thresholdMs) return true
      }
    }
    for (const vkf of ctx.virtualKeyframes) {
      if (vkf.trackId === trackId && Math.abs(vkf.timeMs - rawMs) < thresholdMs) return true
    }
    return false
  }

  // ── Collapse state (UI-only) ──────────────────────────────────────────────────

  let collapsedCapsuleIds = new Set<string>()

  function onToggleCollapse(capsuleId: string): void {
    if (collapsedCapsuleIds.has(capsuleId)) {
      collapsedCapsuleIds.delete(capsuleId)
    } else {
      collapsedCapsuleIds.add(capsuleId)
    }
    render(ctrl.getSnapshot())
  }

  // ── Telco (transport réel) ──────────────────────────────────────────────────────
  // La lecture réelle est pilotée par `TelcoApi` (`codplay`), jamais par une boucle RAF locale —
  // `2026-07-17-telco-real-transport-plan.md` §1/§Étape C. `telco` n'est branché qu'après coup via
  // `attachTelco` (voir `SequenceEditorMountHandle`) ; tant que c'est `null`, Play/Pause/Stop sont
  // inertes plutôt que de lever une erreur (même tolérance que `decorEditor` avant son propre
  // branchement tardif).

  let telco: TelcoApi | null = null
  let unsubscribeTelcoGlyph: (() => void) | null = null
  let unsubscribeTelcoProgress: (() => void) | null = null

  // ── Build shell ───────────────────────────────────────────────────────────────

  container.style.cssText = 'display:flex;flex-direction:column;height:100%;background:#111827'

  const toolbar = document.createElement('div')
  toolbar.classList.add('seq-toolbar')

  const btnPlay = document.createElement('button')
  btnPlay.classList.add('seq-toolbar__btn')
  setButtonGlyph(btnPlay, '▶')
  btnPlay.title = 'Play / Pause'

  const btnStop = document.createElement('button')
  btnStop.classList.add('seq-toolbar__btn')
  setButtonGlyph(btnStop, '■')
  btnStop.title = 'Stop'

  const timeDisplay = document.createElement('span')
  timeDisplay.classList.add('seq-toolbar__time')

  const zoomWrap = document.createElement('div')
  zoomWrap.classList.add('seq-toolbar__zoom')
  zoomWrap.innerHTML = '<span>zoom</span>'
  const zoomSlider = document.createElement('input')
  zoomSlider.type = 'range'
  zoomSlider.min = '10'
  zoomSlider.max = '800'
  zoomSlider.value = '80'
  zoomWrap.appendChild(zoomSlider)

  const unitLabel = document.createElement('span')
  unitLabel.classList.add('seq-toolbar__label')
  unitLabel.textContent = 'unité'

  const unitBtn = document.createElement('button')
  unitBtn.classList.add('seq-toolbar__btn')
  setButtonGlyph(unitBtn, 's')
  unitBtn.title = 'Basculer unité de temps (s / ms)'

  const followLabel = document.createElement('span')
  followLabel.classList.add('seq-toolbar__label')
  followLabel.textContent = 'suivre'

  const btnFollow = document.createElement('button')
  btnFollow.classList.add('seq-toolbar__btn')
  setButtonGlyph(btnFollow, '≫')
  btnFollow.title = 'Suivre la tête de lecture (mode paginé)'

  const btnZoomRange = document.createElement('button')
  btnZoomRange.classList.add('seq-toolbar__btn')
  setButtonGlyph(btnZoomRange, '⊡')
  btnZoomRange.title = 'Zoom sur le clip'
  btnZoomRange.style.display = 'none'

  const btnClearRange = document.createElement('button')
  btnClearRange.classList.add('seq-toolbar__btn')
  setButtonGlyph(btnClearRange, '×')
  btnClearRange.title = 'Effacer le clip'
  btnClearRange.style.display = 'none'

  toolbar.append(btnPlay, btnStop, timeDisplay, zoomWrap, unitLabel, unitBtn, followLabel, btnFollow, btnZoomRange, btnClearRange)

  const editor = document.createElement('div')
  editor.classList.add('seq-editor')
  editor.style.flex = '1'
  editor.style.minHeight = '0'

  const corner = document.createElement('div')
  corner.classList.add('seq-corner')

  const rulerWrapper = document.createElement('div')
  rulerWrapper.classList.add('seq-ruler-wrapper')
  const ruler = createTimeRuler()
  rulerWrapper.appendChild(ruler)

  const labels = createTrackLabelList()

  const timeline = document.createElement('div')
  timeline.classList.add('seq-timeline')
  const timelineInner = document.createElement('div')
  timelineInner.classList.add('seq-timeline-inner')
  timeline.appendChild(timelineInner)

  const cueRow = createCueRow()
  const markerRow = createMarkerTrackRows()
  const markerAddSpacer = document.createElement('div')
  markerAddSpacer.classList.add('seq-marker-track-add-spacer')
  const waveformRow = createWaveformRow()
  const trackRows = createTrackRowArea()
  const playheadOverlay = createPlayheadOverlay()
  playheadOverlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none'

  timelineInner.append(cueRow, markerRow, markerAddSpacer, waveformRow, trackRows, playheadOverlay)
  editor.append(corner, rulerWrapper, labels, timeline)

  const infobar = document.createElement('div')
  infobar.classList.add('seq-infobar')

  const mainArea = document.createElement('div')
  mainArea.classList.add('seq-main')
  mainArea.append(editor, infobar)

  const dragOverlay = document.createElement('div')
  dragOverlay.classList.add('seq-drag-overlay')
  container.appendChild(dragOverlay)

  container.append(toolbar, mainArea)

  // ── Timeline pan (pointer drag on background) ─────────────────────────────────

  function startPan(e: PointerEvent): void {
    if (ctrl.getSnapshot().value !== 'idle') return
    dragOverlay.classList.add('active')
    ctrl.panStart(e.clientX)

    function onMove(ev: PointerEvent): void {
      ctrl.panMove(ev.clientX)
    }

    function onUp(): void {
      ctrl.panEnd()
      dragOverlay.classList.remove('active')
      dragOverlay.removeEventListener('pointermove', onMove)
      dragOverlay.removeEventListener('pointerup', onUp)
    }

    dragOverlay.addEventListener('pointermove', onMove)
    dragOverlay.addEventListener('pointerup', onUp)
  }

  // ── Clip draw (drag on capsule row, threshold-gated) ─────────────────────────

  function startClipDrag(trackId: string, e: PointerEvent): void {
    if (ctrl.getSnapshot().value !== 'idle') return
    const rect = timeline.getBoundingClientRect()
    const startClientX = e.clientX

    function onMoveWindow(ev: PointerEvent): void {
      if (Math.abs(ev.clientX - startClientX) <= 4) return
      window.removeEventListener('pointermove', onMoveWindow)
      window.removeEventListener('pointerup', onUpWindow)
      dragOverlay.classList.add('active')
      dragOverlay.addEventListener('pointermove', onMoveOverlay)
      dragOverlay.addEventListener('pointerup', onUpOverlay)
      ctrl.clipStartDraw(trackId, ctrl.pixelToMs(startClientX - rect.left))
      ctrl.clipDrawMove(ctrl.pixelToMs(ev.clientX - rect.left))
    }

    function onUpWindow(): void {
      window.removeEventListener('pointermove', onMoveWindow)
      window.removeEventListener('pointerup', onUpWindow)
    }

    function onMoveOverlay(ev: PointerEvent): void {
      ctrl.clipDrawMove(ctrl.pixelToMs(ev.clientX - rect.left))
    }

    function onUpOverlay(): void {
      ctrl.clipDrawEnd()
      dragOverlay.classList.remove('active')
      dragOverlay.removeEventListener('pointermove', onMoveOverlay)
      dragOverlay.removeEventListener('pointerup', onUpOverlay)
    }

    window.addEventListener('pointermove', onMoveWindow)
    window.addEventListener('pointerup', onUpWindow)
  }

  function onTimelinePointerDown(e: PointerEvent): void {
    if (e.button !== 0) return
    // La sélection de texte native pendant un drag est bloquée par CSS (`user-select:none` +
    // `-webkit-user-select:none` sur `.seq-editor`, toujours actif, pas quelque chose que le JS
    // doit "rattraper" via `preventDefault()`) — vérifié en conditions réelles (Safari) : la
    // sélection reste vide au drag, avec ou sans `preventDefault` ici. Un `preventDefault()`
    // systématique sur ce pointerdown avait été ajouté par erreur pour ce même besoin ; retiré —
    // il s'appliquait aussi au cas d'un simple double-clic (aucun drag prévu), risque inutile.
    if (e.altKey) {
      startPan(e)
      return
    }
    const rowEl = (e.target as HTMLElement).closest('[data-track-id]') as HTMLElement | null
    if (rowEl?.dataset.kind === 'capsule') {
      startClipDrag(rowEl.dataset.trackId!, e)
    }
  }
  timeline.addEventListener('pointerdown', onTimelinePointerDown)

  function onTimelineDblClick(e: MouseEvent): void {
    if (!e.altKey) return
    const rowEl = (e.target as HTMLElement).closest('[data-track-id]') as HTMLElement | null
    if (rowEl?.dataset.kind !== 'capsule') return
    const rect = timeline.getBoundingClientRect()
    ctrl.clipPlace(rowEl.dataset.trackId!, ctrl.pixelToMs(e.clientX - rect.left))
  }
  timeline.addEventListener('dblclick', onTimelineDblClick)

  // ── Timeline zoom (ctrl/meta + wheel, or trackpad pinch) ──────────────────────

  function onTimelineWheel(e: WheelEvent): void {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    const rect = timeline.getBoundingClientRect()
    const focusPx = e.clientX - rect.left
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
    ctrl.zoom(factor, focusPx)
  }
  timeline.addEventListener('wheel', onTimelineWheel, { passive: false })

  // ── Keyframe drag ─────────────────────────────────────────────────────────────

  function startKeyframeDrag(trackId: string, kfId: string): void {
    dragOverlay.classList.add('active')

    function onMove(ev: PointerEvent): void {
      const rect = timeline.getBoundingClientRect()
      const pointerMs = ctrl.pixelToMs(ev.clientX - rect.left)
      ctrl.dragMove(pointerMs)
    }

    function onUp(): void {
      ctrl.dragEnd()
      dragOverlay.classList.remove('active')
      dragOverlay.removeEventListener('pointermove', onMove)
      dragOverlay.removeEventListener('pointerup', onUp)
    }

    dragOverlay.addEventListener('pointermove', onMove)
    dragOverlay.addEventListener('pointerup', onUp)

    ctrl.dragStartKeyframe(trackId, kfId)
  }

  // ── Marker drag ────────────────────────────────────────────────────────────────

  function startMarkerDrag(markerId: string): void {
    dragOverlay.classList.add('active')
    ctrl.selectMarker(markerId)

    function onMove(ev: PointerEvent): void {
      const rect = timeline.getBoundingClientRect()
      const rawMs = ctrl.pixelToMs(ev.clientX - rect.left)
      const snapped = ctrl.snapToGrid(rawMs)
      ctrl.moveMarker(markerId, Math.max(0, snapped))
    }

    function onUp(): void {
      dragOverlay.classList.remove('active')
      dragOverlay.removeEventListener('pointermove', onMove)
      dragOverlay.removeEventListener('pointerup', onUp)
    }

    dragOverlay.addEventListener('pointermove', onMove)
    dragOverlay.addEventListener('pointerup', onUp)
  }

  // ── Seek (click) ou création de segment (Maj+glisser) — depuis la règle ET depuis le corps de
  // la timeline (n'importe où dans la bande où la tête de lecture se trouve réellement : cue row,
  // marqueurs, waveform, pistes — pas seulement la fine bande de graduations au-dessus, contre-
  // intuitive comme seul point d'accroche). Les éléments plus spécifiques (poignée de kf, drapeau
  // de marqueur, …) appellent déjà `stopPropagation()` sur leur propre pointerdown — ce geste
  // générique ne les court-circuite donc jamais, il ne réagit que sur l'espace resté libre. ──────

  function startPlayheadScrub(e: PointerEvent): void {
    if (e.button !== 0) return
    // La règle reste la référence horizontale commune, même quand le geste démarre ailleurs dans
    // le corps de la timeline — les deux zones sont alignées sur le même axe temporel.
    const rect = rulerWrapper.getBoundingClientRect()
    const startMs = ctrl.pixelToMs(e.clientX - rect.left + timeline.scrollLeft)
    // Décidé au tout début du geste, jamais pendant : un glisser simple doit rester un scrub continu
    // de la tête de lecture du début à la fin — le seuil de 5px qui basculait automatiquement en
    // création de segment rendait le scrub impossible (retour utilisateur direct). Le segment est un
    // geste secondaire, explicite (Maj+glisser), jamais une conséquence accidentelle d'un glisser.
    const rangeMode = e.shiftKey
    const pointerId = e.pointerId

    // PAS de `setPointerCapture` ici (contrairement à un drag de poignée/marqueur, qui n'a aucun
    // enfant concurrent) : la règle capture proprement, mais le corps de la timeline porte les
    // pistes, dont le double-clic (ajout de kf, `track-row.ts`) a besoin que `click`/`dblclick`
    // continuent de cibler la ligne réellement cliquée — une capture ici les redirigerait tous vers
    // ce conteneur, et le double-clic ne pourrait plus jamais atteindre son propre gestionnaire.
    // `window` reçoit `pointermove`/`pointerup` même hors des bornes de l'élément, sans ce risque.
    ctrl.seek(startMs)

    function onMove(ev: PointerEvent): void {
      if (ev.pointerId !== pointerId) return
      const curMs = ctrl.pixelToMs(ev.clientX - rect.left + timeline.scrollLeft)
      if (rangeMode) {
        const inMs = Math.min(startMs, curMs)
        const outMs = Math.max(startMs, curMs)
        ctrl.setPlayRange(inMs, outMs)
      } else {
        ctrl.seek(curMs)
      }
    }

    function onUp(ev: PointerEvent): void {
      if (ev.pointerId !== pointerId) return
      if (rangeMode) {
        const curMs = ctrl.pixelToMs(ev.clientX - rect.left + timeline.scrollLeft)
        const inMs = Math.min(startMs, curMs)
        const outMs = Math.max(startMs, curMs)
        ctrl.setPlayRange(inMs, outMs)
      }
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
  rulerWrapper.addEventListener('pointerdown', startPlayheadScrub)
  timelineInner.addEventListener('pointerdown', startPlayheadScrub)

  // ── Controls ──────────────────────────────────────────────────────────────────

  function onPlayClick(): void {
    if (!telco) return
    if (telco.getState().status === 'playing') {
      options.onTelcoPauseRequest?.()
      void telco.pause()
      return
    }
    options.onTelcoActionRequest?.()
    void telco.play()
  }
  btnPlay.addEventListener('click', onPlayClick)

  function onStopClick(): void {
    // Stop = `ctrl.seek(0)`, jamais `options.onPlayheadChange?.(0)` en direct — ce dernier est un
    // canal SORTANT UNIQUEMENT (voir `render()` plus bas : il émet quand `ctx.playheadMs` a changé,
    // jamais l'inverse). L'appeler directement pilote bien le player réel (le `SEEK` part, le seek
    // réussit) mais ne met jamais à jour `ctx.playheadMs` local, donc le chrono/curseur affichés
    // restent figés sur leur dernière valeur (bug constaté en direct : Stop après une lecture menée à
    // son terme laissait le chrono affiché sur l'heure de fin, alors que la tête réelle était bien
    // revenue à 0). `ctrl.seek(0)` met à jour l'état local puis laisse le diff de `render()` émettre
    // `onPlayheadChange`/`SEEK` tout seul — même relais que le scrub, `scene-player-bridge.ts` inchangé.
    ctrl.seek(0)
  }
  btnStop.addEventListener('click', onStopClick)

  function onZoomInput(): void {
    ctrl.setZoom(Number(zoomSlider.value))
  }
  zoomSlider.addEventListener('input', onZoomInput)

  function onFollowClick(): void {
    ctrl.toggleFollowPlayhead()
  }
  btnFollow.addEventListener('click', onFollowClick)

  function onZoomRangeClick(): void {
    ctrl.zoomToRange()
  }
  btnZoomRange.addEventListener('click', onZoomRangeClick)

  function onClearRangeClick(): void {
    ctrl.clearPlayRange()
  }
  btnClearRange.addEventListener('click', onClearRangeClick)

  function onUnitClick(): void {
    const next = ctrl.getSnapshot().context.displayConfig.timeUnit === 's' ? 'ms' : 's'
    ctrl.setDisplayConfig({ timeUnit: next })
    setButtonGlyph(unitBtn, next)
  }
  unitBtn.addEventListener('click', onUnitClick)

  // ── Render ────────────────────────────────────────────────────────────────────

  let scrollSyncing = false
  let lastPlayheadMs: number | null = null
  /**
   * `renderTrackRows` fait `container.innerHTML = ''` puis reconstruit toutes les lignes — aucune
   * de leurs propriétés ne dépend de `playheadMs` (positions = `kf.timeMs`, jamais la tête de
   * lecture). Sans ce filtre, chaque scrub/tick détruit et recrée les nœuds DOM des lignes
   * en continu — un double-clic en cours (ajout de kf) perd sa cible entre les deux clics, puisque
   * le navigateur exige le même nœud pour reconnaître un `dblclick` (signalé en test réel : "la
   * tête de lecture capte le click", un simple clic pour scruter suffit à casser le geste suivant).
   */
  let lastRowsViewport: MachineContext['viewport'] | null = null
  let lastRowsScene: MachineContext['scene'] | null = null
  let lastRowsSelection: MachineContext['selection'] | null = null
  let lastRowsInteraction: MachineContext['interaction'] | null = null
  let lastRowsVirtualKeyframes: MachineContext['virtualKeyframes'] | null = null
  let lastRowsLayoutProfile: MachineContext['layoutProfile'] | null = null

  function render(snap: { context: MachineContext }): void {
    const ctx = snap.context
    timeDisplay.textContent = formatTimeMs(ctx.playheadMs, ctx.displayConfig.timeUnit)
    // Le glyphe play/pause est piloté par `telco.onChange` (`attachTelco`), pas par le contexte de
    // cette machine — le statut de lecture réel n'y est plus dupliqué (§Étape C).
    btnFollow.classList.toggle('seq-toolbar__btn--active', ctx.followPlayhead)
    const hasRange = ctx.playRange !== null
    btnZoomRange.style.display = hasRange ? '' : 'none'
    btnClearRange.style.display = hasRange ? '' : 'none'

    if (options.onPlayheadChange && ctx.playheadMs !== lastPlayheadMs) {
      lastPlayheadMs = ctx.playheadMs
      options.onPlayheadChange(ctx.playheadMs)
    }

    const currentPxPerSec = Math.round(ctx.viewport.pixelsPerMs * 1000)
    if (Number(zoomSlider.value) !== currentPxPerSec) zoomSlider.value = String(currentPxPerSec)

    const timelineW = timeline.clientWidth
    if (Math.abs(timelineW - ctx.viewport.viewWidthPx) > 1) {
      ctrl.notifyResize(timelineW, timeline.clientHeight)
    }

    const totalPx = ctx.scene.meta.durationMs * ctx.viewport.pixelsPerMs
    timelineInner.style.minWidth = `${totalPx}px`

    const expectedScrollLeft = ctx.viewport.startMs * ctx.viewport.pixelsPerMs
    if (Math.abs(timeline.scrollLeft - expectedScrollLeft) > 1) {
      scrollSyncing = true
      timeline.scrollLeft = expectedScrollLeft
      scrollSyncing = false
    }

    renderTimeRuler(ruler, ctx)
    renderTrackLabelList(
      labels,
      ctx,
      (id) => ctrl.selectTrack(id),
      (id) => ctrl.toggleVisibility(id),
      onToggleCollapse,
      collapsedCapsuleIds,
      () => {},
      (id) => ctrl.toggleMarkerTrackVisibility(id),
      () => {
        const label = window.prompt('Nom de la piste de marqueurs :')
        if (!label) return
        ctrl.addMarkerTrack(label)
      },
      (id) => ctrl.removeMarkerTrack(id),
    )
    markerAddSpacer.style.height = `${ctx.layoutProfile.rowHeightMarkers + 1}px`
    if (
      ctx.viewport !== lastRowsViewport ||
      ctx.scene !== lastRowsScene ||
      ctx.selection !== lastRowsSelection ||
      ctx.interaction !== lastRowsInteraction ||
      ctx.virtualKeyframes !== lastRowsVirtualKeyframes ||
      ctx.layoutProfile !== lastRowsLayoutProfile
    ) {
      lastRowsViewport = ctx.viewport
      lastRowsScene = ctx.scene
      lastRowsSelection = ctx.selection
      lastRowsInteraction = ctx.interaction
      lastRowsVirtualKeyframes = ctx.virtualKeyframes
      lastRowsLayoutProfile = ctx.layoutProfile
      renderTrackRows(
        trackRows,
        ctx,
        (trackId, rawMs) => {
          if (isTooCloseToExisting(trackId, rawMs, ctx)) return
          ctrl.addKeyframe(trackId, rawMs)
        },
        (trackId, kfId) => ctrl.selectKeyframe(trackId, kfId),
        collapsedCapsuleIds,
        startKeyframeDrag,
        (vkf: VirtualKeyframe) => {
          const id = ctrl.addKeyframe(vkf.trackId, vkf.timeMs)
          ctrl.renameKeyframe(vkf.trackId, id, vkf.name)
        },
      )
    }
    renderCueRow(cueRow, ctx)
    renderMarkerTrackRows(
      markerRow,
      ctx,
      (markerTrackId, rawMs) => ctrl.addMarker(markerTrackId, Math.max(0, rawMs)),
      (markerId) => ctrl.selectMarker(markerId),
      startMarkerDrag,
    )
    renderWaveformRow(waveformRow, ctx)
    renderPlayhead(playheadOverlay, ctx)
    renderInfobar(infobar, ctx)
  }

  function renderInfobar(bar: HTMLElement, ctx: MachineContext): void {
    bar.innerHTML = ''
    const { selection, scene, displayConfig } = ctx

    function btn(label: string, action: () => void): HTMLButtonElement {
      const b = document.createElement('button')
      b.className = 'seq-infobar__btn'
      b.textContent = label
      b.addEventListener('click', action)
      return b
    }
    function span(text: string): HTMLSpanElement {
      const s = document.createElement('span')
      s.textContent = text
      return s
    }

    if (selection.keyframeId) {
      const track = scene.items.find((i) => i.id === selection.trackId)
      const kf = track?.keyframes.find((k) => k.id === selection.keyframeId)
      if (!kf || !track) return
      bar.append(
        span(`kf: ${formatTimeMs(kf.timeMs, displayConfig.timeUnit)}${kf.name ? ' — ' + kf.name : ''}  décor: ${kf.decorId}`),
        btn('Supprimer', () => ctrl.removeKeyframe(track.id, kf.id)),
        btn('Vider la ligne', () => ctrl.clearTrack(track.id)),
      )
    } else if (selection.trackId) {
      const track = scene.items.find((i) => i.id === selection.trackId)
      if (!track) return
      bar.append(
        span(`${track.label ?? track.id}  (${track.type})  ${track.keyframes.length} kf`),
        btn('Vider la ligne', () => ctrl.clearTrack(track.id)),
      )
      if (track.type === 'capsule') {
        bar.append(btn('Vider la capsule', () => ctrl.clearCapsule(track.id)))
      }
    }
  }

  // Delete / Backspace → remove selected kf or marker
  function onKeyDown(e: KeyboardEvent): void {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return
    if ((e.target as HTMLElement).closest('input, textarea, select')) return
    const { selection } = ctrl.getSnapshot().context
    if (selection.keyframeId && selection.trackId) {
      ctrl.removeKeyframe(selection.trackId, selection.keyframeId)
    } else if (selection.markerId) {
      ctrl.removeMarker(selection.markerId)
    }
  }
  document.addEventListener('keydown', onKeyDown)

  // ── Scroll sync ───────────────────────────────────────────────────────────────

  function onLabelsScroll(): void {
    if (scrollSyncing) return
    scrollSyncing = true
    timeline.scrollTop = labels.scrollTop
    scrollSyncing = false
  }
  labels.addEventListener('scroll', onLabelsScroll)

  function onTimelineScroll(): void {
    if (scrollSyncing) return
    scrollSyncing = true
    labels.scrollTop = timeline.scrollTop
    scrollSyncing = false

    const { pixelsPerMs } = ctrl.getViewport()
    ctrl.scrollToMs(timeline.scrollLeft / pixelsPerMs)
  }
  timeline.addEventListener('scroll', onTimelineScroll)

  // ── Resize observer ───────────────────────────────────────────────────────────

  const ro = new ResizeObserver(() => ctrl.notifyResize(timeline.clientWidth, timeline.clientHeight))
  ro.observe(timeline)

  // ── Telco attach (tardif — voir SequenceEditorMountHandle) ─────────────────────

  function attachTelco(t: TelcoApi): void {
    unsubscribeTelcoGlyph?.()
    unsubscribeTelcoProgress?.()

    telco = t
    setButtonGlyph(btnPlay, t.getState().status === 'playing' ? '⏸' : '▶')
    unsubscribeTelcoGlyph = t.onChange((state) => {
      setButtonGlyph(btnPlay, state.status === 'playing' ? '⏸' : '▶')
    })

    // Marque `lastPlayheadMs` AVANT la transition — sans ça, le diff de `render()` (ligne ~488)
    // reforwarderait cette valeur via `onPlayheadChange`, ré-émettant un SEEK vers ce même telco :
    // boucle. Abonné à `onProgress` SEUL, jamais `onChange` : `PlayerFacade.seek()` appelle
    // `setStatus('seeking')` — donc émet `onChange` — AVANT de mettre à jour `this.timelineMs`
    // (`create-player.ts::seek()`) ; un `onChange` y était abonné en plus jusqu'ici, et recevait
    // cette notification transitoire avec l'ANCIENNE position, qu'il remirait aussitôt dans le
    // contexte — la tête sautait brièvement sur le kf cliqué puis revenait en arrière avant que le
    // seek ne s'achève (bug constaté 2026-07-17). `onProgress` ne fire jamais pendant un `seek` (family
    // gate `status === 'playing'` seulement), donc insensible à cette transition intermédiaire.
    function syncFromTelco(state: PlayerStateSnapshot): void {
      lastPlayheadMs = state.timelineMs
      ctrl.syncPlayheadFromTelco(state.timelineMs)

      const ctx = ctrl.getSnapshot().context
      // Suivi de tête — l'ancien `rafLoop` en était l'unique lecteur (retiré avec la simulation
      // locale) ; rebranché ici, sur le flux réel de `telco`, plutôt que sur le diff de `render()`
      // (indépendant de la garde anti-boucle ci-dessus, qui ne concerne que `onPlayheadChange`).
      if (ctx.followPlayhead && ctx.playheadMs >= ctx.viewport.endMs) {
        ctrl.scrollToMs(ctx.playheadMs)
      }

      // Fin de scène — l'ancienne garde locale (`PLAYHEAD.TICK`) stoppait à `scene.meta.durationMs`
      // ; ce plafond n'existe pas côté `telco` pour une scène ed2 (`sequenceEnded`/`authorEndMs`
      // dépendent d'un event `sequenceEnd` que le Builder n'émet pas forcément ici), donc sans ce
      // garde-fou la lecture réelle continue indéfiniment au-delà de la durée affichée.
      if (state.status === 'playing' && state.timelineMs >= ctx.scene.meta.durationMs) {
        options.onTelcoPauseRequest?.()
        void telco?.pause()
      }
    }
    unsubscribeTelcoProgress = t.onProgress(syncFromTelco)
  }

  // ── Boot ──────────────────────────────────────────────────────────────────────

  ctrl.notifyResize(timeline.clientWidth, timeline.clientHeight)
  const unsubscribe = ctrl.subscribe(render)

  return {
    attachTelco,
    destroy(): void {
      unsubscribe()
      ro.disconnect()
      document.removeEventListener('keydown', onKeyDown)
      unsubscribeTelcoGlyph?.()
      unsubscribeTelcoProgress?.()
      container.innerHTML = ''
    },
  }
}
