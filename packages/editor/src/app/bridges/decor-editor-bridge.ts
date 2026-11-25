import { createActor, type Actor } from 'xstate'
import type { CodPlayPresentationPose, CodPlaySnapshot, CodPlaySnapshotPatch } from 'codplay'
import { createRotationModifier, createSelectionFrameV2 } from '@codplay/selection-frame/v2'
import type { SelectionFrameDelta, SelectionFrameV2CreationResult, SelectionFrameV2Handle } from '@codplay/selection-frame/v2'
import { DecorEditorController } from '../../decor-editor/controller'
import { mountDecorEditor } from '../../decor-editor/mount'
import { DEFAULT_PALETTE, DEFAULT_PRESETS } from '../../decor-editor/default-palette'
import type { DecorEditorCatalogs } from '../../decor-editor/controller'
import type { DecorEditorMountHandle } from '../../decor-editor/mount'
import { mountCapsuleDefinitionEditor } from '../../capsule-editor/mount'
import type { CapsuleDefinitionEditorHandle, CapsuleEditorSelection } from '../../capsule-editor/mount'
import type { DecorPatch, SelectionFrameValue } from '../../decor-editor/types'
import {
  applyDecorModifications,
  collectDecorModifications,
  modificationsFromDecorPatch,
  modificationsToDecorPatch,
} from '../../decor-editor/modified-properties'
import type { DecorModificationMap } from '../../decor-editor/modified-properties'
import { resolveKeyframeChannel } from '../commands/types'
import { createId } from '../commands/ids'
import { isItemVisible } from '../commands/item-visibility/item-visibility'
import type { CapsuleDef, EditorScene, Item, ItemType, OffsetData, RootPlacementMode } from '../commands/types'
import { ROOT_PLACEMENT_GRID, rootPlacementModeForScene } from '../commands/root-placement-commands'
import type { Command, Selection } from '../controller/types'
import type { controllerMachine } from '../controller/controller-machine'
import type { BridgeHandle } from './types'
import type { EditorActionsFacade } from '../facades/editor-actions-facade'
import { mergePatch } from '../../decor-editor/merge'
import { offsetValuesPxToPatch, pxToCqw, } from '../../decor-editor/units'
import { clearOffsetPlacementGeometry, hasExplicitPlacementGeometry, missingZoneFillStyle } from '../commands/offset-placement'
// Read the stable identifier without importing the builder barrel, which loads the whole compiler.
import { EDITOR_V2_STORY_ID } from '../../builder-v2/types'
import { composeItemPresentationPose, readItemTransformProjection } from '../../item-presentation/item-style-projection'
import { resolveDecorationStyleAtTime } from '../../builder-v2/decor-resolution'
import { createMotionOverlay } from '../../motion-editor/overlay'
import type { MotionOverlayGhost, MotionOverlayHandle, MotionOverlayRole, MotionOverlaySegment } from '../../motion-editor/overlay'
import { createMotionGeometryStore } from '../../motion-editor/geometry-store'
import { createBlockMoveControl } from './block-move-control'
import {
  decorEditSessionMachine,
  editRegistryKey,
  type DecorEditState,
  type FrameGesture,
  type PendingTemporaryEdit,
} from './decor-edit/decor-edit-session-machine'
import { hasZoneSurface, ZoneSurfaceBinding } from './decor-edit/zone-surface-binding'
import {
  presentedItemAt,
  readRotationOrigin,
  runtimeItemId,
  snapshotItemStyle,
} from './presentation-reading'
import { isSameAuthorTime } from '../config/author-time'
import type { BlockMoveControlHandle } from './block-move-control'
import {
  frameVisualCenter,
  resolveMotionGeometryPose,
  normalizeAngleDegrees,
  presentationItemPoseToContentFrame,
  presentationPoseToSelectionFrame,
  type MotionGeometryPose,
} from '../../motion-editor/geometry'
import {
  ZERO_CONTENT_BOX_INSETS_PX,
} from '../../motion-editor/content-box'
import { resolveContentInsetsPx, type FrameBorderInsetsPx } from '../../motion-editor/border-insets'
import { OVERLAY_LAYERS } from '../config/overlay-layers'

import type { Target } from './decor-edit/decor-target'
import { inheritedBoundAt } from '../../scene-bounds/scene-bounds'
import { resolveDecorationKeyframeAlignment, resolveTarget, sortPoseKeyframes, temporaryInsertionTimeMs } from './decor-edit/decor-target'
import {
  itemUsesZonePlacement,
  resolveDocumentDecorBase,
  resolveEffectivePosePatch,
  resolveTemporaryOffset,
  resolveTemporaryPatch,
  resolveZoneIdAtPoseKeyframe,
  resolveZoneIdAtTime,
} from './decor-edit/decor-patches'
import { buildDecorCommands, keyframeCreationAt, materializeZoneFillStyle, patchToDecorArgs } from './decor-edit/decor-commands'
import {
  authorFrameForGesture,
  frameGesturePatch,
  frameToOffsetPatch,
  logicalFrameToPx,
  previewStyle,
  readLogicalFrame,
  resolveGestureCandidate,
} from './decor-edit/frame-projection'
import {
  activeMotionFromSegment,
  buildMotionPathCommands,
  resolveMotionOverlayGhosts,
  resolveMotionOverlaySegments,
  resolveWaypointSplit,
  authoredRotationAtGestureStart,
  displayFrameForAuthorFrame,
  targetUsesTangent,
  type ActiveMotion,
  type GestureMotionContext,
  type MotionProjectionView,
} from './decor-edit/motion-projection'
import { zoneOffsetGesturePatch } from './decor-edit/frame-delta'

/**
 * Pont `decorEditor` — `specs/editor-v2-integration-spec.md`. `defaults`/`chain`
 * restent vides : aucune chaîne d'héritage (capsule/zone) n'est modélisée côté document
 * aujourd'hui — `patch` porte donc, à lui seul, le décor résolu.
 */

/** Bridge handle owned by the Decor inspector region. */
export type DecorEditorBridgeHandle = BridgeHandle & Readonly<{
  /** Panel shown by the inspector region; the capsule settings reveal their zone grid. */
  setInspectorPanel(panel: 'decor' | 'capsule'): void
}>

/**
 * Wires the Decor palette (mounted in `container`), the capsule definition editor (mounted in
 * `options.capsuleDefinitionHost` when given) and the Selection Frame overlays to the controller.
 */
export function createDecorEditorBridge(
  container: HTMLElement,
  machine: Actor<typeof controllerMachine>,
  coordination: import('./editor-coordination-bridge').EditorCoordinationBridge,
  actions: EditorActionsFacade,
  options: Readonly<{ capsuleDefinitionHost?: HTMLElement }> = {},
): DecorEditorBridgeHandle {
  const catalogs: DecorEditorCatalogs = { presets: DEFAULT_PRESETS, palette: DEFAULT_PALETTE }
  const controller = new DecorEditorController(catalogs)
  const motionGeometry = createMotionGeometryStore()
  let mountHandle: DecorEditorMountHandle | null = null
  let capsuleDefinitionEditor: CapsuleDefinitionEditorHandle | null = null
  /** Panel shown by the inspector region (`setInspectorPanel`). */
  let inspectorPanel: 'decor' | 'capsule' = 'decor'
  let selectionFrame: SelectionFrameV2Handle | null = null
  let blockMoveControl: BlockMoveControlHandle | null = null
  let unsubscribeSceneToolState: (() => void) | null = null
  let unsubscribeSelectionGeometry: (() => void) | null = null
  let motionOverlay: MotionOverlayHandle | null = null
  let sceneHost: HTMLElement | null = null
  let resizeObserver: ResizeObserver | null = null
  let sceneRootContentWidthPx: number | null = null
  let frameTarget: Target | null = null
  /** Logical author frame kept for snapshot/document writes. */
  let authorFramePx: SelectionFrameValue | null = null
  let displayFramePx: SelectionFrameValue | null = null
  let frameLogicalValue: SelectionFrameValue | null = null
  /** Phases of the current Decor edit (étape 3d) ; read synchronously after each `send`. */
  const session = createActor(decorEditSessionMachine).start()
  /** Current frame gesture, kept while a cancelled gesture waits for its release. */
  const gesture = (): FrameGesture | null => session.getSnapshot().context.gesture
  /** Whether Escape cancelled the gesture whose pointer is still down. */
  const gestureCancelled = (): boolean => session.getSnapshot().matches({ gesture: 'cancelled' })
  /** Sparse edit registry, by item and author time. */
  const editRegistry = (): ReadonlyMap<string, DecorEditState> => session.getSnapshot().context.registry
  /** Edit between two keyframes waiting for the next boundary. */
  const pendingTemporaryEdit = (): PendingTemporaryEdit | null => session.getSnapshot().context.pendingTemporary
  /** Whether the pending temporary edit belongs to this item at the current author time. */
  const temporaryEditPendingAt = (itemId: string | undefined): boolean => {
    const pending = pendingTemporaryEdit()
    return pending !== null && pending.itemId === itemId && isSameAuthorTime(pending.timeMs, lastKnownTimelineMs)
  }
  /** Whether a preview patch is applied to the runtime snapshot. */
  const previewActive = (): boolean => session.getSnapshot().context.previewActive
  /** Whether a committed preview waits for the rebuilt player to present it. */
  const awaitingPresentation = (): boolean => session.getSnapshot().matches({ presentation: 'awaitingPresentation' })
  /** Displayed frame kept authoritative after a commit, until the player presents it. */
  const commitCandidate = (): SelectionFrameValue | null => session.getSnapshot().context.commitCandidate
  /** Keeps (or drops, with `null`) the frame shown after a commit. */
  const setCommitCandidate = (candidate: SelectionFrameValue | null): void => {
    session.send({ type: 'COMMIT_CANDIDATE', candidate })
  }
  /** Current border geometry used only to move between the outer pose origin and content-box origin. */
  let frameBorderInsetsPx: FrameBorderInsetsPx = ZERO_CONTENT_BOX_INSETS_PX
  let activeMotion: ActiveMotion | null = null
  /** Coalesced root-resize projection; runs after the runtime's own resize observer. */
  let resizeFrameRequest: number | null = null
  let resizeProjectionQueued = false

  // ── Commit de fin d'interaction —
  // dedit émet la preview pendant `input` ; ce pont committe au signal explicite de fin d'interaction.
  // Sélection, seek et mutation externe gardent leurs frontières immédiates ; Échap abandonne.
  // Aucun délai d'inactivité ne décide du commit. ───────────────────────────────────────────────

  /** Dernière scène/sélection observées — distingue une vraie mutation externe (signal 5) et un simple écho de notre propre flush (qui vide `pendingCommands` avant d'émettre). */
  let lastObservedScene: EditorScene | null = null
  let lastSelectionKey: string | null = null
  /**
   * Référentiel AUTEUR (sans `preRollMs`, même convention que `Keyframe.timeMs`) — mis à jour
   * uniquement par un vrai `SEEK` explicite (scrub/Stop), jamais par la progression naturelle de
   * la lecture (`telco.onProgress`, local à `sequence-editor`, ne redescend jamais vers ce
   * contrôleur — sans conséquence : dedit est de toute façon suspendu pendant `playing`, §Signal
   * `playbackActiveChanged`). Sert à `resolveKeyframeAlignment` pour situer la sélection courante
   * par rapport aux keyframes de l'item (`specs/editor-v2-integration-spec.md`).
   */
  let lastKnownTimelineMs = 0

  /** Whether the controller plays the scene (read on its state, never copied). */
  const playbackActive = (): boolean => machine.getSnapshot().matches('playing')
  /** Item creation in progress on the controller, if any. */
  const activeCreationMode = (): { itemType: ItemType; placementMode: RootPlacementMode } | null => {
    const { creatingType, creatingPlacementMode } = machine.getSnapshot().context
    return creatingType === null || creatingPlacementMode === null ? null : { itemType: creatingType, placementMode: creatingPlacementMode }
  }

  /** Zone Editor overlay of the selected capsule or of the scene root. */
  const zones = new ZoneSurfaceBinding({
    machine,
    actions,
    presentation: () => coordination.presentation.get(),
    isPlaybackActive: playbackActive,
    isCreating: () => activeCreationMode() !== null,
    inspectorPanel: () => inspectorPanel,
  })

  /** Returns the snapshot only when it belongs to the author time currently being projected. */
  function presentedSnapshotAt(timeMs: number): CodPlaySnapshot | null {
    const snapshot = coordination.snapshot.get()
    if (snapshot === null) return null
    const progress = coordination.transport.getProgress()
    if (progress !== null && !isSameAuthorTime(progress.timelineMs, timeMs)) return null
    if (progress !== null && !isSameAuthorTime(snapshot.timeMs, progress.playerTimeMs)) return null
    return snapshot
  }

  /**
   * Immutable base of one current Decor edit: the persisted cascade, overlaid with the state the
   * player presents at `timeMs`; a temporary target also takes its interpolated pose from it.
   */
  function resolveDecorEditBase(scene: EditorScene, target: Target, timeMs: number): DecorPatch {
    const documentBase = resolveDocumentDecorBase(scene, target, timeMs)
    const snapshot = presentedSnapshotAt(timeMs)
    const presented = mergePatch(documentBase, resolveTemporaryPatch(snapshot, target.itemId))
    return target.isTemporary
      ? mergePatch(presented, resolveTemporaryOffset(snapshot, target.itemId, documentBase))
      : presented
  }

  /** Updates the rendering projection and the sparse registry for the active Decor target. */
  function setDecorEditState(itemId: string, timeMs: number, base: DecorPatch, current: DecorPatch): DecorModificationMap {
    const modifications = collectDecorModifications(base, current)
    session.send({ type: 'REGISTRY_SET', key: editRegistryKey(itemId, timeMs), state: modifications.size === 0 ? null : { base, modifications } })
    controller.setModifiedProperties(itemId, [...modifications.keys()])
    return modifications
  }

  /** Removes one temporary edit state and its preview candidate after a commit or cancellation. */
  function clearDecorEditState(itemId: string, timeMs: number): void {
    session.send({ type: 'TEMPORARY_CLEARED', itemId, timeMs })
    coordination.decorPreview.clear(itemId, timeMs)
  }

  /** Builds the sparse document transaction for a Decor edit made between two real keyframes. */
  function buildTemporaryDecorCommit(
    scene: EditorScene,
    itemId: string,
    timeMs: number,
    state: DecorEditState | undefined,
  ): { commands: Command[]; keyframeId: string } | null {
    const item = scene.items.find(candidate => candidate.id === itemId)
    if (item === undefined) return null
    const alignment = resolveDecorationKeyframeAlignment(item, timeMs)
    const bound = inheritedBoundAt(scene, itemId, timeMs)
    if (item.keyframes.some(keyframe => keyframe.timeMs === timeMs)) return null
    if (alignment.kind !== 'between' && bound === undefined) return null
    if (state === undefined || state.modifications.size === 0) return null
    const patch = modificationsToDecorPatch(state.modifications)
    const decorArgs = patchToDecorArgs(patch)
    if (decorArgs === null) return null
    const created = keyframeCreationAt({ itemId, timeMs, channel: 'decor', bound })
    return {
      keyframeId: created.keyframeId,
      commands: [created.command, { name: 'setDecor', args: { decorId: created.decorId, patch: decorArgs } }],
    }
  }

  /** Commits a temporary Decor edit as one sparse keyframe, if it still has a target. */
  function commitTemporaryDecor(pending: PendingTemporaryEdit, state: DecorEditState | undefined): void {
    coordination.decorPreview.clear(pending.itemId, pending.timeMs)
    const scene = machine.getSnapshot().context.scene
    if (scene === null) return
    const transaction = buildTemporaryDecorCommit(scene, pending.itemId, pending.timeMs, state)
    if (transaction === null) return
    retainSnapshotPreviewUntilPresentation()
    actions.commitDecorEdit(transaction.commands)
  }

  /** Drops temporary registry entries already consumed by an external timeline keyframe insertion. */
  function reconcileConsumedTemporaryDecor(scene: EditorScene): void {
    const pending = pendingTemporaryEdit()
    if (pending === null) return
    const item = scene.items.find(candidate => candidate.id === pending.itemId)
    if (item?.keyframes.some(keyframe => isSameAuthorTime(keyframe.timeMs, pending.timeMs))) {
      clearDecorEditState(pending.itemId, pending.timeMs)
    }
  }

  function selectionKey(selection: Selection): string {
    return JSON.stringify([selection.itemIds, selection.keyframeId ?? null])
  }

  /**
   * Commits the pending Decor transaction only after an active Selection Frame gesture has ended;
   * the gesture's own completion signal will call this again once its pointer session is released.
   */
  function flushNow(): void {
    if (selectionFrame?.isGestureActive()) return
    const { pendingCommands: commands, pendingTemporary, registry } = session.getSnapshot().context
    const temporaryState = pendingTemporary === null
      ? undefined
      : registry.get(editRegistryKey(pendingTemporary.itemId, pendingTemporary.timeMs))
    // Taken before any commit: each commit re-enters this bridge through `sceneCommitted`.
    session.send({ type: 'FLUSHED' })
    if (commands !== null && commands.length > 0) {
      retainSnapshotPreviewUntilPresentation()
      actions.commitDecorEdit([...commands])
    }
    if (pendingTemporary !== null) commitTemporaryDecor(pendingTemporary, temporaryState)
  }

  /** Clears the live snapshot and its target metadata as one phase operation. */
  function clearSnapshotPreview(clearRuntime = true): void {
    if (clearRuntime && previewActive()) coordination.snapshot.clear()
    session.send({ type: 'PREVIEW_CLEARED' })
  }

  /** Keeps the accepted display pose until the committed scene replaces the old player. */
  function retainSnapshotPreviewUntilPresentation(): void {
    session.send({ type: 'COMMIT_SENT', fallback: displayFramePx })
  }

  /** Échap — abandon de phase (§Étape B.6) : jette l'écart en attente sans committer, puis force le pont `scenePlayer` à rejouer le document inchangé pour effacer la preview live devenue périmée. */
  function abortPhase(): void {
    const { pendingCommands, pendingTemporary, registry } = session.getSnapshot().context
    const hadPendingCommands = pendingCommands !== null
    const hadPreview = previewActive()
    const hadTemporaryEdit = pendingTemporary !== null || registry.size > 0
    session.send({ type: 'ABORTED' })
    if (hadPreview) {
      clearSnapshotPreview()
    }
    coordination.decorPreview.clearAll()
    if (hadPendingCommands || hadPreview || hadTemporaryEdit) actions.abortDecorEdit()
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
    if (selectionFrame?.isGestureActive()) {
      event.preventDefault()
      event.stopImmediatePropagation()
      session.send({ type: 'GESTURE_ESCAPE' })
      const restoredFrame = gesture()?.basePx ?? displayFramePx
      selectionFrame.setValue(restoredFrame)
    }
    abortPhase()
  }
  document.addEventListener('keydown', onKeyDown, { capture: true })

  /** Returns the selected explicit capsule definition for its existing editor panel. */
  function selectedCapsuleDefinition(): CapsuleEditorSelection | null {
    const { scene, selection } = machine.getSnapshot().context
    if (scene === null || selection.itemIds.length !== 1) return null
    const item = scene.items.find((candidate) => candidate.id === selection.itemIds[0])
    return item?.type === 'capsule' && item.capsule !== undefined
      ? { itemId: item.id, capsule: item.capsule }
      : null
  }

  /** Mounts the Decor palette and, when its host is given, the capsule definition editor. */
  function ensureMounted(): void {
    if (mountHandle) return
    mountHandle = mountDecorEditor(container, controller)
    if (options.capsuleDefinitionHost === undefined) return
    capsuleDefinitionEditor = mountCapsuleDefinitionEditor(
      options.capsuleDefinitionHost,
      selectedCapsuleDefinition,
      (itemId, patch) => {
        flushNow()
        actions.setCapsuleDef({ itemId, patch })
      },
    )
  }

  /** Refreshes the capsule definition editor and the zone overlay after a selection or playback change. */
  function syncInspectorPanels(): void {
    capsuleDefinitionEditor?.render()
    capsuleDefinitionEditor?.setDisabled(playbackActive())
    zones.syncVisibility()
  }

  /** Returns the current scene-root width used by the single logical-length conversion boundary. */
  function sceneRootWidthPx(): number | null {
    if (sceneHost === null) return null
    const cssWidth = Number.parseFloat(getComputedStyle(sceneHost).width)
    const width = sceneRootContentWidthPx
      ?? (Number.isFinite(cssWidth) && cssWidth > 0 ? cssWidth : sceneHost.clientWidth)
    return Number.isFinite(width) && width > 0 ? width : null
  }

  /** Composes one runtime pose with the CSS matrix and axis captured by its transform anchor. */
  function presentedItemPose(itemId: string, pose: CodPlayPresentationPose) {
    const itemNode = [...(sceneHost?.querySelectorAll<HTMLElement>('[data-item-id]') ?? [])]
      .find((candidate) => candidate.getAttribute('data-item-id') === runtimeItemId(itemId))
    const transformAnchor = itemNode === undefined
      ? null
      : itemNode.ownerDocument.getElementById(`${itemNode.id}-transform`)
    if (transformAnchor === null || transformAnchor.parentElement !== itemNode) return { pose }
    const projection = readItemTransformProjection(transformAnchor)
    return {
      pose: composeItemPresentationPose(pose, projection),
      rotationOrigin: projection.rotationOrigin,
    }
  }

  /** Reads a zone-owned runtime box and converts its author projection back to cqw. */
  function readPresentedLogicalFrame(
    itemId: string,
    rootWidthPx: number,
    rotationOrigin: SelectionFrameValue['rotationOrigin'],
    insets: FrameBorderInsetsPx,
  ): SelectionFrameValue | null {
    const item = presentedItemAt(coordination.presentation.get(), itemId, lastKnownTimelineMs)
    if (item === null) return null
    const presented = presentedItemPose(itemId, item.pose)
    const frame = presentationPoseToSelectionFrame(
      presented.pose,
      presented.rotationOrigin ?? rotationOrigin,
      insets,
    )
    return {
      ...frame,
      x: pxToCqw(frame.x, rootWidthPx),
      y: pxToCqw(frame.y, rootWidthPx),
      width: pxToCqw(frame.width, rootWidthPx),
      height: pxToCqw(frame.height, rootWidthPx),
    }
  }

  /** Resolves border geometry from the current Decor/snapshot without reading the item DOM. */
  function resolveFrameBorderInsets(
    snapshot: CodPlaySnapshot | null,
    itemId: string,
    patch: DecorPatch,
    rootWidthPx: number,
  ): FrameBorderInsetsPx {
    const style: Record<string, unknown> = { ...(patch.style ?? {}), ...snapshotItemStyle(snapshot, itemId) }
    return resolveContentInsetsPx(style, rootWidthPx, coordination.getSceneHost()?.ownerDocument.defaultView?.devicePixelRatio ?? 1)
  }

  /** Gesture state read by the tangent and authored-rotation projections, at the time of the call. */
  function gestureContext(): GestureMotionContext {
    return {
      activeMotion,
      authorTimeMs: lastKnownTimelineMs,
      gestureActive: gesture() !== null,
      projectedSegments: motionGeometry.get().segments,
      frameInsets: frameBorderInsetsPx,
      authorFrame: authorFramePx,
    }
  }

  /** Gesture state read by the motion overlay projection, at the time of the call. */
  function motionView(): MotionProjectionView {
    return {
      authorTimeMs: lastKnownTimelineMs,
      frameTarget,
      displayFrame: displayFramePx,
      authorFrame: authorFramePx,
      frameInsets: frameBorderInsetsPx,
      commitCandidate: commitCandidate(),
      frameOwnsEndpoint: gesture() !== null || awaitingPresentation(),
      gestureActive: gesture() !== null,
      endpointInsets: motionEndpointInsets,
    }
  }

  /** Resolves the border belonging to one endpoint, including its current accepted preview. */
  function motionEndpointInsets(scene: EditorScene, item: Item, keyframeId: string, rootWidthPx: number): FrameBorderInsetsPx {
    const keyframe = item.keyframes.find((candidate) => candidate.id === keyframeId)
    const isCurrentPreview = previewActive()
      && frameTarget?.itemId === item.id
      && frameTarget.keyframeId === keyframeId
      && keyframe !== undefined
      && isSameAuthorTime(lastKnownTimelineMs, keyframe.timeMs)
    if (isCurrentPreview) return frameBorderInsetsPx
    return resolveContentInsetsPx(
      resolveDecorationStyleAtTime(
        scene,
        item,
        keyframe?.timeMs ?? 0,
        coordination.getStyleDefaults(scene, item.id),
      ), rootWidthPx,
      coordination.getSceneHost()?.ownerDocument.defaultView?.devicePixelRatio ?? 1,
    )
  }

  /** Rebuilds the active motion projection from the committed document and selected keyframe. */
  function activateCommittedMotion(item: Item, selectedKeyframeId: string, rootWidthPx: number): MotionOverlaySegment | null {
    const projectedSegments = resolveMotionOverlaySegments(
      machine.getSnapshot().context.scene!,
      item,
      selectedKeyframeId,
      rootWidthPx,
      null,
      lastKnownTimelineMs,
      motionView(),
    )
    const activeSegment = projectedSegments.segments.find((candidate) => candidate.active === true) ?? null
    activeMotion = activeSegment === null
      ? null
      : activeMotionFromSegment(machine.getSnapshot().context.scene!, item, activeSegment)
    return activeSegment
  }

  /** Projects the current runtime pose and its affine content inset into the visible CS. */
  function presentedContentBoxFrameForItem(
    itemId: string,
    rotationOrigin: SelectionFrameValue['rotationOrigin'],
  ): SelectionFrameValue | null {
    const item = presentedItemAt(coordination.presentation.get(), itemId, lastKnownTimelineMs)
    if (item === null) return null
    // Capsules retain their existing native list layout; only leaf items use content composition.
    if (frameTarget?.itemType === 'capsule') {
      return presentationPoseToSelectionFrame(item.pose, rotationOrigin, frameBorderInsetsPx)
    }
    if (authorFramePx === null) return null
    const presented = presentedItemPose(itemId, item.pose)
    return presentationItemPoseToContentFrame(
      presented.pose,
      authorFramePx.width,
      authorFramePx.height,
      presented.rotationOrigin ?? rotationOrigin,
      frameBorderInsetsPx,
    )
  }

  /** Keeps pixel and responsive projections of the same authored frame together. */
  function setAuthorFrame(value: SelectionFrameValue, rootWidthPx: number): void {
    authorFramePx = value
    frameLogicalValue = {
      ...value,
      x: pxToCqw(value.x, rootWidthPx),
      y: pxToCqw(value.y, rootWidthPx),
      width: pxToCqw(value.width, rootWidthPx),
      height: pxToCqw(value.height, rootWidthPx),
    }
  }

  /** Projects a complete displayed pose while keeping the authored Decor contribution sparse. */
  function toSnapshotPatches(
    itemId: string,
    patch: DecorPatch,
    previewFrame: SelectionFrameValue | null | undefined,
  ): CodPlaySnapshotPatch[] | null {
    const progress = coordination.transport.getProgress()
    if (progress === null) return null
    const style = previewStyle(
      patch,
      previewFrame === undefined ? displayFramePx : previewFrame,
      sceneRootWidthPx(),
      frameTarget?.itemId === itemId ? frameTarget : null,
      coordination.presentation.get()?.items.find((item) => item.itemId === runtimeItemId(itemId)),
    )
    return Object.keys(style).length === 0 ? null : [{
      target: { storyId: EDITOR_V2_STORY_ID, persoId: itemId },
      timeMs: progress.playerTimeMs,
      state: { style },
    }]
  }

  /** Presents a patch through snapshot and optionally records its temporary candidate. */
  function previewPatch(
    itemId: string,
    patch: DecorPatch,
    recordCandidate = false,
    previewFrame?: SelectionFrameValue | null,
  ): boolean {
    // Snapshot V2 currently carries the live style channel. A temporary edit may nevertheless
    // touch content, classes, custom data, zoneId or a future decor module. Record the complete
    // candidate independently so creation of a KF can capture those properties as well.
    if (recordCandidate) {
      coordination.decorPreview.set({ itemId, timeMs: lastKnownTimelineMs, patch })
    }
    const snapshotPatches = toSnapshotPatches(itemId, patch, previewFrame)
    if (snapshotPatches === null) return recordCandidate
    const result = coordination.snapshot.set(snapshotPatches)
    const accepted = result?.ok === true
    session.send({ type: 'PREVIEW_APPLIED', accepted })
    return accepted
  }

  /** Allows one tangent orientation setting at the first pose time; manual poses remain editable. */
  function canRotateSelection(): boolean {
    const { scene, selection } = machine.getSnapshot().context
    const item = scene?.items.find((candidate) => candidate.id === selection.itemIds[0])
    if (item?.rotationMode !== 'tangent') return true
    const first = sortPoseKeyframes(item)[0]
    return first !== undefined && isSameAuthorTime(lastKnownTimelineMs, first.timeMs)
  }

  /** Captures the start of a frame gesture: displayed base, edit registry entry, authored rotation and frame. */
  function startGesture(scene: EditorScene | null, target: Target, basePx: SelectionFrameValue, kind: SelectionFrameDelta['kind']): FrameGesture {
    const editState = editRegistry().get(editRegistryKey(target.itemId, lastKnownTimelineMs))
    const baseAuthorRotate = scene === null
      ? authorFramePx?.rotate ?? basePx.rotate ?? 0
      : authoredRotationAtGestureStart(scene, target, basePx, gestureContext())
    const started: FrameGesture = {
      basePx,
      kind,
      hasNetDelta: false,
      baseDecorState: editState === undefined ? null : { base: editState.base, modifications: new Map(editState.modifications) },
      baseAuthorRotate,
      baseAuthorFrame: scene === null || authorFramePx === null
        ? null
        : target.isTemporary
          ? authorFrameForGesture(basePx, baseAuthorRotate, frameBorderInsetsPx)
          : { ...authorFramePx, rotationOrigin: authorFramePx.rotationOrigin === undefined ? undefined : { ...authorFramePx.rotationOrigin } },
    }
    session.send({ type: 'GESTURE_START', gesture: started })
    return started
  }

  /** Converts a frame delta to a controller patch and returns the accepted pixel candidate. */
  function previewFrame(delta: SelectionFrameDelta): SelectionFrameValue | null {
    const context = machine.getSnapshot().context
    if (context.authoringMode === 'zone') return null
    if ((delta.kind === 'rotate' || delta.kind === 'pivot') && !canRotateSelection()) return displayFramePx
    const target = frameTarget
    const base = gesture()?.basePx ?? displayFramePx
    const rootWidth = sceneRootWidthPx()
    if (target === null || base === null || rootWidth === null) return null
    const scene = context.scene
    const item = scene?.items.find((candidate) => candidate.id === target.itemId)
    const zoneOffsetGesture = context.authoringMode === 'block'
      && context.editGesture === 'offset'
      && scene !== null
      && item !== undefined
      && itemUsesZonePlacement(scene, item, lastKnownTimelineMs, target.keyframeId)
    if (gestureCancelled()) return gesture()?.basePx ?? displayFramePx
    const currentGesture = gesture() ?? startGesture(scene, target, base, delta.kind)
    const displayedBase = currentGesture.basePx
    const hasNetDelta = delta.kind === 'rotate'
      ? delta.dr !== 0
        && normalizeAngleDegrees(Math.round((displayedBase.rotate ?? 0) + delta.dr))
          !== normalizeAngleDegrees(displayedBase.rotate ?? 0)
      : delta.kind === 'pivot'
        ? delta.fx !== (displayedBase.rotationOrigin?.fx ?? 0.5)
          || delta.fy !== (displayedBase.rotationOrigin?.fy ?? 0.5)
        : delta.dx !== 0 || delta.dy !== 0
    session.send({ type: 'GESTURE_DELTA', hasNetDelta })
    const authoredBaseRotate = gesture()?.baseAuthorRotate ?? authorFramePx?.rotate ?? displayedBase.rotate ?? 0
    const tangentMotion = !zoneOffsetGesture && scene !== null && targetUsesTangent(scene, target, gestureContext())
    const represented = coordination.presentation.get()?.items.find((entry) => entry.itemId === runtimeItemId(target.itemId))
    const {
      authorFrame: candidateAuthorFrame,
      displayFrame: displayCandidate,
      patchBaseFrame,
    } = resolveGestureCandidate({
      delta,
      displayedBase,
      authoredBase: gesture()?.baseAuthorFrame
        ?? (tangentMotion ? authorFrameForGesture(displayedBase, authoredBaseRotate, frameBorderInsetsPx) : displayedBase),
      authoredBaseRotate,
      tangentMotion,
      sourceRepresentation: represented?.representation === 'source',
      zoneOffsetGesture,
      insets: frameBorderInsetsPx,
      displayForAuthor: (frame) => scene === null ? frame : displayFrameForAuthorFrame(scene, target, frame, gestureContext()),
    })
    session.send({ type: 'DECOR_PREVIEW_REQUESTED' })
    const framePatch = zoneOffsetGesture && scene !== null
      ? zoneOffsetPatchForFrameGesture(delta, displayedBase, candidateAuthorFrame, rootWidth, scene, target)
      : frameGesturePatch(patchBaseFrame, candidateAuthorFrame, rootWidth)
    if (framePatch === null) return base
    controller.applyPatch(framePatch)
    if (!session.getSnapshot().context.lastPreviewAccepted) return base
    setAuthorFrame(candidateAuthorFrame, rootWidth)
    displayFramePx = displayCandidate
    syncMotionOverlay()
    return displayFramePx
  }

  /** Maps Selection Frame gestures to zone-relative transforms without overriding zone geometry. */
  function zoneOffsetPatchForFrameGesture(
    delta: SelectionFrameDelta,
    base: SelectionFrameValue,
    candidate: SelectionFrameValue,
    rootWidth: number,
    scene: EditorScene,
    target: Target,
  ): DecorPatch | null {
    const item = scene.items.find((entry) => entry.id === target.itemId)
    if (item === undefined || !itemUsesZonePlacement(scene, item, lastKnownTimelineMs, target.keyframeId)) return null
    const baseState = gesture()?.baseDecorState ?? null
    const basePatch = baseState === null
      ? resolveDecorEditBase(scene, target, lastKnownTimelineMs)
      : applyDecorModifications(baseState.base, baseState.modifications)
    return zoneOffsetGesturePatch(delta, base, candidate, rootWidth, basePatch)
  }

  /** Commits one path control-point edit without touching the source pose or sequence-editor. */
  function commitMotionPath(change: { control: { x: number; y: number }; path?: string }): void {
    const motion = activeMotion
    if (motion === null) return
    const { scene } = machine.getSnapshot().context
    if (scene === null) return
    const commands = buildMotionPathCommands(scene, motion.itemId, motion.targetKeyframeId, change.path)
    if (commands.length === 0) return
    activeMotion = { ...motion, path: change.path }
    actions.commitDecorEdit(commands)
    syncMotionOverlay()
  }

  /** Changes the orientation policy for the entire selected item in one document transaction. */
  function commitMotionPathOrientation(orientToPath: boolean): void {
    const { scene, selection } = machine.getSnapshot().context
    const target = scene === null ? null : resolveTarget(scene, selection, lastKnownTimelineMs)
    if (target === null) return
    actions.setItemRotationMode({ itemId: target.itemId, mode: orientToPath ? 'tangent' : 'manual' })
    activeMotion = null
    syncMotionOverlay()
  }

  /** Commits one pose gesture to the real KF at the playhead, or creates one between real KFs. */
  function commitMotionDrop(drop: { sourceFrame: SelectionFrameValue; targetFrame: SelectionFrameValue }): MotionOverlaySegment | null {
    const beforeFlush = machine.getSnapshot().context
    const gestureTarget = beforeFlush.scene === null
      ? null
      : resolveTarget(beforeFlush.scene, beforeFlush.selection, lastKnownTimelineMs)
    const gestureUsesTangent = beforeFlush.scene !== null
      && gestureTarget !== null
      && targetUsesTangent(beforeFlush.scene, gestureTarget, gestureContext())
    const dropGesture = gesture()
    const gestureUsesAuthorSource = dropGesture !== null
      && gestureTarget !== null
      && !gestureUsesTangent
      && coordination.presentation.get()?.items.some(item =>
        item.itemId === runtimeItemId(gestureTarget.itemId) && item.representation === 'source',
      ) === true
    const convertDisplayedFrames = gestureUsesTangent
    const gestureAuthorRotate = dropGesture?.baseAuthorRotate
      ?? (beforeFlush.scene !== null && gestureTarget !== null && convertDisplayedFrames
        ? authoredRotationAtGestureStart(beforeFlush.scene, gestureTarget, drop.sourceFrame, gestureContext())
        : authorFramePx?.rotate ?? drop.sourceFrame.rotate ?? 0)
    const sourceDocumentFrame = convertDisplayedFrames
      ? dropGesture?.kind === 'rotate' && dropGesture.baseAuthorFrame !== null
        ? dropGesture.baseAuthorFrame
        : authorFrameForGesture(drop.sourceFrame, gestureAuthorRotate, frameBorderInsetsPx)
      : gestureUsesAuthorSource ? dropGesture?.baseAuthorFrame ?? drop.sourceFrame : drop.sourceFrame
    const requestedTargetDocumentFrame = convertDisplayedFrames
      ? dropGesture !== null && authorFramePx !== null
        ? authorFramePx
        : authorFrameForGesture(drop.targetFrame, gestureAuthorRotate, frameBorderInsetsPx)
      : gestureUsesAuthorSource ? authorFramePx ?? drop.targetFrame : drop.targetFrame
    // A previous palette/CS phase may still be waiting for its host-level flush. Finish it before
    // resolving the drop so this gesture cannot be overwritten by an older pending command.
    // The current temporary pose gesture itself is committed below from the same sparse registry;
    // do not let the generic phase flush create an intermediate Decor KF before that transaction.
    const currentTemporaryEdit = temporaryEditPendingAt(frameTarget?.itemId)
    if (currentTemporaryEdit) session.send({ type: 'TEMPORARY_DISCARDED' })
    flushNow()
    const { scene, selection } = machine.getSnapshot().context
    if (scene === null || selection.itemIds.length !== 1) return null
    const sourceTarget = resolveTarget(scene, selection, lastKnownTimelineMs)
    if (sourceTarget === null) return null
    const item = scene.items.find((candidate) => candidate.id === sourceTarget.itemId)
    if (item === undefined) return null
    const rootWidth = sceneRootWidthPx()
    if (rootWidth === null) return null

    const selectedKeyframe = item.keyframes.find((keyframe) => keyframe.id === sourceTarget.keyframeId)
    const insertsPose = sourceTarget.isTemporary
      || (selectedKeyframe !== undefined && resolveKeyframeChannel(selectedKeyframe) === 'decor')
    const originalSegment = insertsPose
      ? resolveMotionOverlaySegments(scene, item, sourceTarget.keyframeId, rootWidth, null, lastKnownTimelineMs, motionView())
        .segments.find((segment) => segment.active === true)
      : undefined
    const { targetDocumentFrame, splitPatch, splitCommands } = resolveWaypointSplit(
      scene, item, originalSegment, requestedTargetDocumentFrame, frameBorderInsetsPx, rootWidth,
    )

    // Movement-surface frames are already content-box frames. Persist those author coordinates;
    // the builder derives the border-box layout translation at runtime.
    const targetOffset = frameToOffsetPatch(targetDocumentFrame, rootWidth)
    // A pose gesture is the explicit exception to sparse Decor capture: the new waypoint must
    // freeze the complete frame, otherwise its missing width/rotation/etc. would keep resolving
    // from a different pose and the two resulting trajectory segments would not be stable.
    // The displayed matrix can include parent and presentation transforms.
    // Freeze the logical scale, including any authored tween, at the inserted waypoint.
    const authoredScale = insertsPose
      ? resolveTemporaryOffset(presentedSnapshotAt(lastKnownTimelineMs), item.id,
        resolveDocumentDecorBase(scene, sourceTarget, lastKnownTimelineMs)).offset?.scale
      : undefined
    const capturedPosePatch: DecorPatch = { offset: {
      ...targetOffset,
      scale: authoredScale ?? { x: 1, y: 1 },
    } }
    const gestureOffsetPatch = frameGesturePatch(sourceDocumentFrame, targetDocumentFrame, rootWidth)

    if (!sourceTarget.isTemporary) {
      // An exact real KF is edited at its own time; so is the initial state (no KF selected: before the
      // intro, or an item without KF), which is the intro's own state. `setItemDecor` owns the
      // copy-on-write, so a shared decor cannot move a neighbouring KF by accident.
      const selectedKeyframe = sourceTarget.keyframeId === null
        ? undefined
        : item.keyframes.find((keyframe) => keyframe.id === sourceTarget.keyframeId)
      if (sourceTarget.keyframeId !== null && selectedKeyframe === undefined) return null
      const editState = editRegistry().get(editRegistryKey(sourceTarget.itemId, lastKnownTimelineMs))
      const decorPatch = editState === undefined || editState.modifications.size === 0
        ? {}
        : modificationsToDecorPatch(editState.modifications)
      // Promoting a decoration-only point creates a new spatial waypoint at an interpolated time.
      // It therefore needs the same complete pose capture as a newly-created middle KF. An
      // already-spatial KF keeps the historical sparse movement patch: its pose endpoint already
      // exists and untouched Decor values must continue to cascade.
      const promotesDecorKeyframe = selectedKeyframe !== undefined && resolveKeyframeChannel(selectedKeyframe) === 'decor'
      const posePatch = promotesDecorKeyframe ? capturedPosePatch : gestureOffsetPatch
      const sparsePatch = { ...mergePatch(posePatch, decorPatch), ...splitPatch }
      const commands: Command[] = []
      if (promotesDecorKeyframe) {
        commands.push({ name: 'setKeyframeChannel', args: { itemId: item.id, keyframeId: sourceTarget.keyframeId!, channel: 'pose' } })
      }
      commands.push(...buildDecorCommands(
        scene,
        sourceTarget,
        materializeZoneFillStyle(resolveDocumentDecorBase(scene, sourceTarget, lastKnownTimelineMs), sparsePatch),
      ))
      commands.push(...splitCommands)
      if (commands.length === 0) return null
      clearDecorEditState(sourceTarget.itemId, lastKnownTimelineMs)
      retainSnapshotPreviewUntilPresentation()
      actions.commitDecorEdit(commands)
      const committedScene = machine.getSnapshot().context.scene
      const committedItem = committedScene?.items.find((candidate) => candidate.id === item.id)
      if (committedScene === null || committedScene === undefined || committedItem === undefined) return null
      // The initial state has no segment of its own: the overlay is simply reprojected.
      const activeSegment = sourceTarget.keyframeId === null
        ? null
        : activateCommittedMotion(committedItem, sourceTarget.keyframeId, rootWidth)
      syncMotionOverlay()
      return activeSegment
    }

    // A temporary target is valid only in the strict interval between two real KFs. Its document time
    // is the current author playhead; the provisional 500 ms value belongs to a future
    // transition-window resolver and must never shift this keyframe's time.
    const targetTimeMs = temporaryInsertionTimeMs(scene, item, sourceTarget, lastKnownTimelineMs)
    if (targetTimeMs === null) return null

    const editState = editRegistry().get(editRegistryKey(sourceTarget.itemId, lastKnownTimelineMs))
    const sparsePatch = {
      ...(editState === undefined
        ? capturedPosePatch
        : mergePatch(capturedPosePatch, modificationsToDecorPatch(editState.modifications))),
      ...splitPatch,
    }
    const targetPatch = patchToDecorArgs(sparsePatch)
    if (targetPatch === null) return null

    const created = keyframeCreationAt({ itemId: item.id, timeMs: targetTimeMs, channel: 'pose', bound: sourceTarget.bound })
    const targetKeyframeId = created.keyframeId
    const commands: Command[] = [
      created.command,
      { name: 'setDecor', args: { decorId: created.decorId, patch: targetPatch } },
      ...splitCommands,
    ]
    clearDecorEditState(sourceTarget.itemId, lastKnownTimelineMs)
    retainSnapshotPreviewUntilPresentation()
    actions.commitDecorEdit(commands)
    const committedScene = machine.getSnapshot().context.scene
    const committedItem = committedScene?.items.find((candidate) => candidate.id === item.id)
    if (committedScene === null || committedScene === undefined || committedItem === undefined) return null
    const activeSegment = activateCommittedMotion(committedItem, targetKeyframeId, rootWidth)
    selectKeyframeAt(item.id, targetKeyframeId, targetTimeMs)
    syncMotionOverlay()
    return activeSegment
  }

  /** Resolves a same-capsule drop target from the Selection Frame centre and shared track hit-test. */
  function zoneAtFrameCenter(frame: SelectionFrameValue): string | null {
    const context = machine.getSnapshot().context
    const host = sceneHost
    if (context.scene === null || host === null || !zones.isMounted()) return null
    const target = resolveTarget(context.scene, context.selection, lastKnownTimelineMs)
    const item = context.scene.items.find((candidate) => candidate.id === target?.itemId)
    if (item === undefined || !hasZoneSurface(context.scene, item.parentId)) return null
    const width = host.clientWidth
    const height = host.clientHeight
    const bounds = host.getBoundingClientRect()
    if (width <= 0 || height <= 0 || bounds.width <= 0 || bounds.height <= 0) return null
    const center = frameVisualCenter(frame)
    const candidateIds = zones.zoneIdsAtPoint(
      bounds.left + center.x * bounds.width / width,
      bounds.top + center.y * bounds.height / height,
    )
    const sameCapsuleIds = candidateIds.filter((zoneId) => context.scene!.zones[zoneId]?.capsuleId === item.parentId)
    if (context.selectedZoneId !== null && sameCapsuleIds.includes(context.selectedZoneId)) return context.selectedZoneId
    return sameCapsuleIds.length === 1 ? sameCapsuleIds[0]! : null
  }

  /** Restores the decor edit state captured before Selection Frame preview mutations. */
  function restoreFrameGestureDecorEdit(): DecorPatch {
    const target = frameTarget
    if (target === null) return {}
    const editKey = editRegistryKey(target.itemId, lastKnownTimelineMs)
    const baseState = gesture()?.baseDecorState ?? null
    session.send({ type: 'REGISTRY_SET', key: editKey, state: baseState })
    controller.setModifiedProperties(target.itemId, baseState === null ? [] : [...baseState.modifications.keys()])
    if (target.isTemporary) {
      if (baseState === null || baseState.modifications.size === 0) {
        coordination.decorPreview.clear(target.itemId, lastKnownTimelineMs)
      } else {
        coordination.decorPreview.set({
          itemId: target.itemId,
          timeMs: lastKnownTimelineMs,
          patch: applyDecorModifications(baseState.base, baseState.modifications),
        })
      }
    }
    return baseState === null ? {} : modificationsToDecorPatch(baseState.modifications)
  }

  /** Cancels a zone-mode preview and restores staged author edits only before the phase flush consumes them. */
  function cancelZoneMovePreview(sourceFrame: SelectionFrameValue, restoreAuthorEdits = true): void {
    if (restoreAuthorEdits) restoreFrameGestureDecorEdit()
    setCommitCandidate(sourceFrame)
    displayFramePx = sourceFrame
    const rootWidth = sceneRootWidthPx()
    if (rootWidth !== null) setAuthorFrame(sourceFrame, rootWidth)
    flushNow()
    abortPhase()
  }

  /** Commits a same-capsule zone reassignment on the pose channel through the document transaction path. */
  function commitZoneAssignment(zoneId: string, sourceFrame: SelectionFrameValue): boolean {
    const before = machine.getSnapshot().context
    const beforeScene = before.scene
    const beforeTarget = beforeScene === null ? null : resolveTarget(beforeScene, before.selection, lastKnownTimelineMs)
    const beforeItem = beforeScene?.items.find((candidate) => candidate.id === beforeTarget?.itemId)
    const beforeZone = beforeScene?.zones[zoneId]
    if (beforeScene === null || beforeTarget === null || beforeItem === undefined
      || beforeZone === undefined || beforeZone.capsuleId !== beforeItem.parentId) {
      cancelZoneMovePreview(sourceFrame)
      return false
    }

    const firstPoseKeyframe = beforeTarget.isTemporary
      ? undefined
      : sortPoseKeyframes(beforeItem)[0]
    const sourceZoneId = beforeTarget.keyframeId !== null
      ? resolveZoneIdAtPoseKeyframe(beforeScene, beforeItem, beforeTarget.keyframeId)
      : firstPoseKeyframe === undefined
        ? resolveZoneIdAtTime(beforeScene, beforeItem, lastKnownTimelineMs)
        : resolveZoneIdAtPoseKeyframe(beforeScene, beforeItem, firstPoseKeyframe.id)
    if (sourceZoneId === zoneId) {
      cancelZoneMovePreview(sourceFrame)
      return false
    }

    if (beforeTarget.isTemporary
      && temporaryInsertionTimeMs(beforeScene, beforeItem, beforeTarget, lastKnownTimelineMs, { allowWithoutPoseChain: true }) === null) {
      cancelZoneMovePreview(sourceFrame)
      return false
    }

    const currentTemporaryEdit = beforeTarget.isTemporary && temporaryEditPendingAt(beforeTarget.itemId)
    const gestureDecorPatch = restoreFrameGestureDecorEdit()
    const carriedTemporaryPatch = beforeTarget.isTemporary ? gestureDecorPatch : {}
    if (currentTemporaryEdit) session.send({ type: 'TEMPORARY_DISCARDED' })
    flushNow()

    const { scene, selection } = machine.getSnapshot().context
    if (scene === null) {
      cancelZoneMovePreview(sourceFrame, false)
      return false
    }
    const target = resolveTarget(scene, selection, lastKnownTimelineMs)
    const item = scene.items.find((candidate) => candidate.id === target?.itemId)
    const zone = scene.zones[zoneId]
    if (target === null || item === undefined || zone === undefined || zone.capsuleId !== item.parentId) {
      cancelZoneMovePreview(sourceFrame, false)
      return false
    }

    const patch = materializeZoneFillStyle(
      resolveDocumentDecorBase(scene, target, lastKnownTimelineMs),
      mergePatch(carriedTemporaryPatch, { zoneId }),
    )
    const commands: Command[] = []
    let createdKeyframeId: string | null = null
    let targetTimeMs = lastKnownTimelineMs
    if (target.keyframeId !== null) {
      const keyframe = item.keyframes.find((candidate) => candidate.id === target.keyframeId)
      if (keyframe === undefined) {
        cancelZoneMovePreview(sourceFrame, false)
        return false
      }
      if (resolveKeyframeChannel(keyframe) === 'decor') {
        commands.push({ name: 'setKeyframeChannel', args: { itemId: item.id, keyframeId: keyframe.id, channel: 'pose' } })
      }
      targetTimeMs = keyframe.timeMs
      commands.push(...buildDecorCommands(scene, target, patch))
    } else if (target.isTemporary) {
      const insertionTimeMs = temporaryInsertionTimeMs(scene, item, target, lastKnownTimelineMs, { allowWithoutPoseChain: true })
      if (insertionTimeMs === null) {
        cancelZoneMovePreview(sourceFrame, false)
        return false
      }
      targetTimeMs = insertionTimeMs
      const created = keyframeCreationAt({ itemId: item.id, timeMs: targetTimeMs, channel: 'pose', bound: target.bound })
      createdKeyframeId = created.keyframeId
      commands.push(created.command)
      commands.push(...buildDecorCommands(scene, {
        ...target,
        keyframeId: created.keyframeId,
        writeDecorId: created.decorId,
        isTemporary: false,
      }, patch))
    } else {
      const firstPoseKeyframe = sortPoseKeyframes(item)[0]
      if (firstPoseKeyframe === undefined) {
        commands.push(...buildDecorCommands(scene, target, { zoneId }))
      } else {
        commands.push(...buildDecorCommands(scene, {
          ...target,
          keyframeId: firstPoseKeyframe.id,
          writeDecorId: firstPoseKeyframe.decorId,
          isTemporary: false,
        }, { zoneId }))
        targetTimeMs = firstPoseKeyframe.timeMs
      }
    }
    if (commands.length === 0) {
      cancelZoneMovePreview(sourceFrame, false)
      return false
    }

    clearDecorEditState(target.itemId, lastKnownTimelineMs)
    activeMotion = null
    retainSnapshotPreviewUntilPresentation()
    actions.commitDecorEdit(commands)
    if (createdKeyframeId !== null) {
      selectKeyframeAt(item.id, createdKeyframeId, targetTimeMs)
    }
    syncMotionOverlay()
    return true
  }

  /** Commits the sparse transform produced by the optional zone-offset Selection Frame. */
  function commitZoneOffsetGesture(): void {
    const before = machine.getSnapshot().context
    if (before.scene === null) return
    const beforeTarget = resolveTarget(before.scene, before.selection, lastKnownTimelineMs)
    if (beforeTarget === null) return
    const editKey = editRegistryKey(beforeTarget.itemId, lastKnownTimelineMs)
    const currentState = editRegistry().get(editKey)
    const gestureBaseState = gesture()?.baseDecorState ?? null
    const basePatch = gestureBaseState === null
      ? currentState?.base ?? resolveDecorEditBase(before.scene, beforeTarget, lastKnownTimelineMs)
      : applyDecorModifications(gestureBaseState.base, gestureBaseState.modifications)
    const currentPatch = currentState === undefined
      ? basePatch
      : applyDecorModifications(currentState.base, currentState.modifications)
    const gesturePatch = modificationsToDecorPatch(modificationsFromDecorPatch(basePatch, currentPatch))
    const previousTemporaryEdit = beforeTarget.isTemporary && temporaryEditPendingAt(beforeTarget.itemId)
    const temporaryPatch = previousTemporaryEdit && currentState !== undefined
      ? modificationsToDecorPatch(currentState.modifications)
      : gesturePatch
    if (previousTemporaryEdit) session.send({ type: 'TEMPORARY_DISCARDED' })
    flushNow()

    const { scene, selection } = machine.getSnapshot().context
    if (scene === null) return
    const target = resolveTarget(scene, selection, lastKnownTimelineMs)
    if (target === null) return
    const commitPatch = target.isTemporary ? temporaryPatch : gesturePatch
    if (Object.keys(commitPatch.offset ?? {}).length === 0) return
    const item = scene.items.find((candidate) => candidate.id === target.itemId)
    if (item === undefined) return

    let commands: Command[] = []
    let createdKeyframeId: string | null = null
    let targetTimeMs = lastKnownTimelineMs
    if (target.keyframeId !== null) {
      const keyframe = item.keyframes.find((candidate) => candidate.id === target.keyframeId)
      if (keyframe === undefined) return
      if (resolveKeyframeChannel(keyframe) === 'decor') {
        commands.push({ name: 'setKeyframeChannel', args: { itemId: item.id, keyframeId: keyframe.id, channel: 'pose' } })
      }
      commands.push(...buildDecorCommands(
        scene,
        target,
        materializeZoneFillStyle(resolveDocumentDecorBase(scene, target, lastKnownTimelineMs), commitPatch),
      ))
    } else if (target.isTemporary) {
      const insertionTimeMs = temporaryInsertionTimeMs(scene, item, target, lastKnownTimelineMs)
      if (insertionTimeMs === null) return
      targetTimeMs = insertionTimeMs
      const decorPatch = patchToDecorArgs(commitPatch)
      if (decorPatch === null) return
      const created = keyframeCreationAt({ itemId: item.id, timeMs: targetTimeMs, channel: 'pose', bound: target.bound })
      createdKeyframeId = created.keyframeId
      commands = [created.command, { name: 'setDecor', args: { decorId: created.decorId, patch: decorPatch } }]
    } else {
      commands = buildDecorCommands(
        scene,
        target,
        materializeZoneFillStyle(resolveDocumentDecorBase(scene, target, lastKnownTimelineMs), commitPatch),
      )
    }

    if (commands.length === 0) return
    clearDecorEditState(target.itemId, lastKnownTimelineMs)
    retainSnapshotPreviewUntilPresentation()
    actions.commitDecorEdit(commands)
    if (createdKeyframeId !== null) {
      selectKeyframeAt(item.id, createdKeyframeId, targetTimeMs)
    }
    syncMotionOverlay()
  }

  /** Commits every Selection Frame affine gesture through the pose-KF path immediately. */
  function commitSelectionFrameDrop(targetFrame: SelectionFrameValue): void {
    if (machine.getSnapshot().context.authoringMode === 'zone') {
      if (gesture() !== null) abortPhase()
      session.send({ type: 'GESTURE_END' })
      setCommitCandidate(null)
      controller.notifyInteractionEnd()
      return
    }
    if (gestureCancelled()) {
      session.send({ type: 'GESTURE_END' })
      setCommitCandidate(null)
      controller.notifyInteractionEnd()
      return
    }
    if (gesture()?.hasNetDelta !== true) {
      flushNow()
      setCommitCandidate(null)
      session.send({ type: 'GESTURE_END' })
      controller.notifyInteractionEnd()
      return
    }
    const sourceFrame = gesture()?.basePx ?? displayFramePx
    setCommitCandidate(targetFrame)
    try {
      if (sourceFrame !== null) {
        const { scene, selection } = machine.getSnapshot().context
        const item = scene?.items.find((candidate) => candidate.id === selection.itemIds[0])
        const context = machine.getSnapshot().context
        const selectedZoneItem = scene !== null
          && item !== undefined
          && itemUsesZonePlacement(scene, item, lastKnownTimelineMs, selection.keyframeId)
        const zoneOffset = context.authoringMode === 'block'
          && context.editGesture === 'offset'
          && selectedZoneItem
        const zoneMove = gesture()?.kind === 'move'
          && context.authoringMode === 'block'
          && context.editGesture !== 'offset'
          && selectedZoneItem
        if (zoneOffset) {
          commitZoneOffsetGesture()
        } else if (zoneMove) {
          const zoneId = zoneAtFrameCenter(targetFrame)
          if (zoneId === null) cancelZoneMovePreview(sourceFrame)
          else commitZoneAssignment(zoneId, sourceFrame)
        } else {
          commitMotionDrop({ sourceFrame, targetFrame })
        }
      }
    } finally {
      if (!awaitingPresentation()) setCommitCandidate(null)
      session.send({ type: 'GESTURE_END' })
    }
    controller.notifyInteractionEnd()
  }

  /** Publishes one border-aware projection to the frame, trajectory, and ghost subscribers. */
  function publishMotionGeometrySnapshot(
    selectionGeometry: MotionGeometryPose | null,
    segments: readonly MotionOverlaySegment[],
    ghosts: readonly MotionOverlayGhost[],
    selectionEnabled: boolean,
  ): void {
    motionGeometry.publish({
      selection: selectionGeometry === null ? null : {
        geometry: selectionGeometry,
        enabled: selectionEnabled,
      },
      segments,
      ghosts,
      initialGhost: null,
    })
  }

  /** Synchronizes the artefact layer with the current CS selection without entering the document. */
  function syncMotionOverlay(): void {
    if (motionOverlay === null) return
    const { scene, selection } = machine.getSnapshot().context
    const target = scene === null ? null : resolveTarget(scene, selection, lastKnownTimelineMs)
    if (target === null || displayFramePx === null) {
      publishMotionGeometrySnapshot(null, [], [], false)
      return
    }
    const item = scene?.items.find((candidate) => candidate.id === target.itemId)
    // A temporary/interpolated pose is also a valid source for the movement gesture: releasing it
    // materializes a real KF at the current author playhead. Path editing still requires a real
    // target KF because `Decor.path` has no temporary document owner.
    const canDraw = (target.keyframeId !== null || target.isTemporary)
      && !(scene !== null && item !== undefined
        && itemUsesZonePlacement(scene, item, lastKnownTimelineMs, target.keyframeId))
    let motion = activeMotion
    // A motion remains the active projection while the author seeks between its endpoints. When
    // another real KF is selected, however, the active segment must be reconstructed from that
    // KF's own adjacent pair; otherwise the old path would keep claiming the CS and its median.
    const targetIsEndpoint = motion !== null && target.keyframeId !== null
      && (target.keyframeId === motion.sourceKeyframeId || target.keyframeId === motion.targetKeyframeId)
    const targetIsInsideMotion = motion !== null && target.keyframeId === null
      && lastKnownTimelineMs > motion.sourceTimeMs && lastKnownTimelineMs < motion.targetTimeMs
    if (motion !== null && (motion.itemId !== target.itemId || (!targetIsEndpoint && !targetIsInsideMotion))) {
      motion = null
      activeMotion = null
    }
    const rootWidth = sceneRootWidthPx()
    if (scene !== null && item !== undefined && rootWidth !== null) {
      if (motion !== null) {
        const role: MotionOverlayRole = target.keyframeId === motion.sourceKeyframeId ? 'source'
          : target.keyframeId === motion.targetKeyframeId ? 'target'
            : motion.role
        motion = { ...motion, role }
        activeMotion = motion
      }
      const projected = resolveMotionOverlaySegments(
        scene,
        item,
        target.keyframeId,
        rootWidth,
        motion,
        lastKnownTimelineMs,
        motionView(),
      )
      const projectedSegments = projected.segments
      if (motion === null && target.keyframeId !== null) {
        const activeSegment = projectedSegments.find((candidate) => candidate.active === true)
        if (activeSegment !== undefined) activeMotion = activeMotionFromSegment(scene, item, activeSegment)
      }
      const projectedGhosts = resolveMotionOverlayGhosts(
        scene,
        item,
        target.keyframeId,
        rootWidth,
        lastKnownTimelineMs,
        projectedSegments,
        projected.selection,
        motionView(),
      )
      publishMotionGeometrySnapshot(projected.selection, projectedSegments, projectedGhosts, canDraw)
      return
    }
    if (motion !== null && motion.itemId !== target.itemId) activeMotion = null
    publishMotionGeometrySnapshot(
      resolveMotionGeometryPose(displayFramePx, frameBorderInsetsPx),
      [],
      [],
      canDraw,
    )
  }

  /** Applies one coalesced root-resize projection after CodPlay has refreshed its presentation. */
  function refreshProjectionAfterResize(): void {
    resizeFrameRequest = null
    resizeProjectionQueued = false
    const rootWidth = sceneRootWidthPx()
    const { scene, selection } = machine.getSnapshot().context
    if (rootWidth === null || scene === null || selectionFrame === null) return

    // A pending CS/palette phase is not in the document yet. Keep its logical candidate, but
    // project it through the same width boundary and let syncMotionOverlay reproject both path
    // endpoints around it. Calling syncSelection here would discard that candidate.
    if (session.getSnapshot().matches({ edit: 'pending' }) && frameLogicalValue !== null) {
      const target = resolveTarget(scene, selection, lastKnownTimelineMs)
      const attachedPatch = target === null
        ? null
        : controller.getPatches().find((entry) => entry.itemId === target.itemId)?.patch
      const patch = attachedPatch ?? (target === null
        ? {}
        : resolveDecorEditBase(scene, target, lastKnownTimelineMs))
      const temporaryCandidate = target?.isTemporary === true
        ? coordination.decorPreview.getAt(target.itemId, lastKnownTimelineMs)
        : null
      const snapshot = target?.isTemporary === true && temporaryCandidate === null
        ? presentedSnapshotAt(lastKnownTimelineMs)
        : null
      if (target !== null) {
        frameBorderInsetsPx = resolveFrameBorderInsets(snapshot, target.itemId, patch, rootWidth)
      }
      authorFramePx = logicalFrameToPx(frameLogicalValue, rootWidth)
      displayFramePx = target === null ? authorFramePx : displayFrameForAuthorFrame(scene, target, authorFramePx, gestureContext())
      syncMotionOverlay()
      return
    }
    // The runtime observer runs before this deferred callback in the same rendering turn; the
    // presentation port therefore exposes the new scaled item pose when syncSelection reads it.
    syncSelection(scene, selection)
  }

  /** Coalesces root-size notifications so every overlay artefact is refreshed in one pass. */
  function scheduleProjectionAfterResize(): void {
    if (resizeProjectionQueued) return
    resizeProjectionQueued = true
    const win = sceneHost?.ownerDocument.defaultView
    if (win?.requestAnimationFrame !== undefined) {
      resizeFrameRequest = win.requestAnimationFrame(() => refreshProjectionAfterResize())
      return
    }
    queueMicrotask(refreshProjectionAfterResize)
  }

  /** Cancels a queued root-resize projection during host teardown. */
  function cancelProjectionAfterResize(): void {
    if (resizeFrameRequest !== null) {
      const win = sceneHost?.ownerDocument.defaultView
      win?.cancelAnimationFrame(resizeFrameRequest)
    }
    resizeFrameRequest = null
    resizeProjectionQueued = false
  }

  /** Selects one keyframe of an item and brings the author playhead to it. */
  function selectKeyframeAt(itemId: string, keyframeId: string, timeMs: number): void {
    actions.selectItem([itemId], keyframeId)
    coordination.requestAuthorSeek(timeMs)
  }

  /** Selects one real keyframe and routes its author time through the sequence-editor owner. */
  function activateMotionKeyframe(itemId: string, keyframeId: string, role?: MotionOverlayRole): void {
    const { scene } = machine.getSnapshot().context
    const item = scene?.items.find((candidate) => candidate.id === itemId)
    const keyframe = item?.keyframes.find((candidate) => candidate.id === keyframeId)
    if (item === undefined || keyframe === undefined) return

    const currentMotion = activeMotion
    activeMotion = role !== undefined && currentMotion?.itemId === item.id
      ? { ...currentMotion, role }
      : null
    selectKeyframeAt(item.id, keyframe.id, keyframe.timeMs)
  }

  /** Shows only the control surface owned by the current Block tool and selected placement. */
  function syncControlSurfaces(frame: SelectionFrameValue | null): void {
    const context = machine.getSnapshot().context
    const target = context.scene === null ? null : resolveTarget(context.scene, context.selection, lastKnownTimelineMs)
    const item = context.scene?.items.find((candidate) => candidate.id === target?.itemId)
    const usesZonePlacement = context.scene !== null
      && item !== undefined
      && itemUsesZonePlacement(context.scene, item, lastKnownTimelineMs, target?.keyframeId)
    const selectionFrameActive = activeCreationMode() === null
      && (context.authoringMode === null
        || (context.authoringMode === 'block' && item !== undefined
          && (!usesZonePlacement || context.editGesture === 'offset')))
    const displayedFrame = selectionFrameActive ? displayFramePx ?? frame : null
    selectionFrame?.setSuspended(playbackActive())
    selectionFrame?.setValue(displayedFrame)
    if (selectionFrame !== null) selectionFrame.element.style.pointerEvents = selectionFrameActive ? 'auto' : 'none'

    const zoneMoveActive = context.authoringMode === 'block'
      && context.editGesture !== 'offset'
      && activeCreationMode() === null
      && !playbackActive()
      && context.scene !== null
      && item !== undefined
      && usesZonePlacement
    blockMoveControl?.setValue(zoneMoveActive ? displayedFrame : null, zoneMoveActive)
  }

  /** Creates the frame once a scene host exists and binds it to the decor-owned callbacks. */
  function mountSelectionFrame(host: HTMLElement): void {
    if (selectionFrame !== null && sceneHost === host) return
    // A new host replaces every scene overlay; the caller resynchronises the selection afterwards.
    unmountSelectionFrame()
    sceneHost = host
    const rotationModifier = createRotationModifier()
    selectionFrame = createSelectionFrameV2({
      sceneRoot: host,
      // V2 capabilities are composed explicitly. Rotation remains a reusable modifier rather
      // than becoming a branch in the neutral move/resize overlay; future CS modules can be added
      // here without changing the editor bridge contract.
      modifiers: [{
        ...rotationModifier,
        /** Adapts the existing rotation tool to the selected item's authoring policy. */
        mount(context) {
          const modifier = rotationModifier.mount(context)
          return {
            ...modifier,
            /** Presents rotation controls only at positions allowed by the item policy. */
            update(value) { modifier.update(canRotateSelection() ? value : null) },
          }
        },
      }],
      onPreview: previewFrame,
      onCommit: commitSelectionFrameDrop,
      onCancel: () => {
        session.send({ type: 'GESTURE_END' })
        abortPhase()
      },
      creation: { onCreate: commitItemCreation },
    })
    blockMoveControl = createBlockMoveControl({
      sceneRoot: host,
      onPreview: ({ dx, dy }) => previewFrame({ kind: 'move', dx, dy }),
      onCommit: commitSelectionFrameDrop,
      onCancel: cancelZoneMovePreview,
      onGestureStart: () => zones.setBlockMoveGestureActive(true),
      onGestureEnd: () => zones.setBlockMoveGestureActive(false),
    })
    unsubscribeSelectionGeometry = motionGeometry.subscribe(({ selection }) => {
      syncControlSurfaces(selection?.geometry.frame ?? null)
    })
    selectionFrame.element.style.cursor = 'move'
    // The general Selection Frame sits above zone hit surfaces; Block mode uses its own
    // move-only control at the same layer.
    selectionFrame.element.style.zIndex = OVERLAY_LAYERS.selectionFrame
    selectionFrame.element.style.pointerEvents = 'auto'
    const currentScene = machine.getSnapshot().context.scene
    const currentSelection = machine.getSnapshot().context.selection
    zones.mount(host)
    let toolState = machine.getSnapshot().context
    const syncToolState = (): void => {
      const context = machine.getSnapshot().context
      syncControlSurfaces(motionGeometry.get().selection?.geometry.frame ?? null)
      zones.syncVisibility()
      motionOverlay?.setSuspended(playbackActive() || activeCreationMode() !== null || context.authoringMode === 'zone')
    }
    syncToolState()
    const toolStateSubscription = machine.subscribe((snapshot) => {
      const next = snapshot.context
      if (next.authoringMode === toolState.authoringMode
        && next.editGesture === toolState.editGesture
        && next.zonesVisible === toolState.zonesVisible
        && next.hideZonesInBlockMode === toolState.hideZonesInBlockMode) return
      const authoringModeChanged = next.authoringMode !== toolState.authoringMode
      toolState = next
      syncToolState()
      if (authoringModeChanged) {
        const context = machine.getSnapshot().context
        if (context.scene !== null) zones.sync(context.scene, context.selection)
        zones.syncSelection()
      }
    })
    unsubscribeSceneToolState = () => toolStateSubscription.unsubscribe()
    if (currentScene !== null) zones.sync(currentScene, currentSelection)
    motionOverlay = createMotionOverlay(host, {
      onActivateRole: (role) => {
        const motion = activeMotion
        if (motion === null) return
        const keyframeId = role === 'source' ? motion.sourceKeyframeId : motion.targetKeyframeId
        activateMotionKeyframe(motion.itemId, keyframeId, role)
      },
      onActivateKeyframe: (keyframeId) => {
        const { scene, selection } = machine.getSnapshot().context
        const itemId = activeMotion?.itemId ?? selection.itemIds[0]
        const item = scene && itemId
          ? scene.items.find((candidate) => candidate.id === itemId)
          : undefined
        const keyframe = item?.keyframes.find((candidate) => candidate.id === keyframeId)
        if (item === undefined || keyframe === undefined) return
        // A non-active ghost changes the active segment. Let the ordinary selection/rebuild path
        // reconstruct it from this keyframe instead of retaining the previous pair.
        activateMotionKeyframe(item.id, keyframe.id)
      },
      onActivateInitial: () => {
        const { scene, selection } = machine.getSnapshot().context
        const itemId = selection.itemIds[0]
        const item = scene && itemId ? scene.items.find((candidate) => candidate.id === itemId) : undefined
        const firstKeyframe = item === undefined ? undefined : sortPoseKeyframes(item)[0]
        if (item === undefined || firstKeyframe === undefined) return
        // Selecting the route start reconstructs the first outgoing segment through the normal
        // bridge path; no separate player or timeline circuit is created for this artefact click.
        activateMotionKeyframe(item.id, firstKeyframe.id)
      },
      onPathActivate: () => {
        // The first path tranche has one control point and no secondary panel; clicking the path
        // only claims the segment so the control point is ready for the next gesture.
      },
      onPathChange: commitMotionPath,
      onPathOrientationChange: commitMotionPathOrientation,
    }, motionGeometry)
    syncToolState()
    if (activeCreationMode() !== null) {
      selectionFrame.setCreationMode(selectionModeFor())
      motionOverlay.setSuspended(playbackActive() || machine.getSnapshot().context.authoringMode === 'zone')
    }
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(([entry]) => {
        if (entry !== undefined) {
          sceneRootContentWidthPx = entry.contentBoxSize[0]?.inlineSize ?? entry.contentRect.width
        }
        scheduleProjectionAfterResize()
      })
      resizeObserver.observe(host)
    }
  }

  /** Converts one traced block or capsule into the existing command/facade document path. */
  function commitItemCreation(result: SelectionFrameV2CreationResult): void {
    const { scene, creatingType, creatingPlacementMode } = machine.getSnapshot().context
    if (
      scene === null
      || creatingType !== 'bloc' && creatingType !== 'capsule'
      || creatingPlacementMode === null
      || creatingPlacementMode !== rootPlacementModeForScene(scene)
      || sceneHost === null
    ) return

    const commands: Command[] = []
    const capsuleDef: CapsuleDef = {
      kind: scene.rootCapsule?.kind ?? 'card',
      distribution: scene.rootCapsule?.distribution ?? { mode: 'stagger', staggerInMs: 0, staggerOutMs: 0 },
    }
    const itemId = createId('item')
    const introTimeMs = coordination.getAuthorTimeMs()
    /** Builds the document command matching the active item type and trace result. */
    const createItemCommand = (geometry: OffsetData, zoneId?: string): Command => creatingType === 'capsule'
      ? { name: 'createCapsule', args: { itemId, introTimeMs, geometry, capsuleDef, ...(zoneId === undefined ? {} : { zoneId }) } }
      : { name: 'createItem', args: { itemId, introTimeMs, geometry, ...(zoneId === undefined ? {} : { zoneId }) } }
    if (creatingPlacementMode === 'transform' && result.kind === 'rect') {
      const rootWidth = sceneHost.clientWidth
      if (rootWidth <= 0) return
      const geometry: OffsetData = offsetValuesPxToPatch({
        x: result.rect.x,
        y: result.rect.y,
        width: result.rect.width,
        height: result.rect.height,
      }, rootWidth)
      commands.push(createItemCommand(geometry))
    }
    if (creatingPlacementMode === 'fine-grid' && result.kind === 'cell-area') {
      const zoneId = createId('zone')
      commands.push(
        { name: 'createRootZone', args: { zoneId, area: result.area } },
        createItemCommand({}, zoneId),
      )
    }
    if (commands.length === 0) return
    actions.commitItemCreation(itemId, commands)
  }

  /** Maps the persisted root placement mode to the selection-frame V2 drawing mode. */
  function selectionModeFor() {
    return activeCreationMode()?.placementMode === 'fine-grid'
      ? { kind: 'grid' as const, ...ROOT_PLACEMENT_GRID['fine-grid'] }
      : { kind: 'free' as const }
  }

  /** Removes the frame and root observer when the scene host is unavailable. */
  function unmountSelectionFrame(): void {
    cancelProjectionAfterResize()
    resizeObserver?.disconnect()
    resizeObserver = null
    sceneRootContentWidthPx = null
    unsubscribeSelectionGeometry?.()
    unsubscribeSelectionGeometry = null
    unsubscribeSceneToolState?.()
    unsubscribeSceneToolState = null
    zones.unmount()
    blockMoveControl?.destroy()
    blockMoveControl = null
    selectionFrame?.destroy()
    selectionFrame = null
    motionOverlay?.destroy()
    motionOverlay = null
    sceneHost = null
    frameTarget = null
    authorFramePx = null
    displayFramePx = null
    frameLogicalValue = null
    session.send({ type: 'PROJECTION_FOLLOWS_SELECTION' })
    session.send({ type: 'GESTURE_END' })
    setCommitCandidate(null)
    frameBorderInsetsPx = ZERO_CONTENT_BOX_INSETS_PX
    activeMotion = null
    motionGeometry.publish({ selection: null, segments: [], ghosts: [], initialGhost: null })
  }

  function syncSelection(scene: EditorScene, selection: Selection): void {
    ensureMounted()
    syncInspectorPanels()
    zones.sync(scene, selection)
    const target = resolveTarget(scene, selection, lastKnownTimelineMs)
    if (!target) {
      frameTarget = null
      authorFramePx = null
      displayFramePx = null
      frameLogicalValue = null
      session.send({ type: 'PROJECTION_FOLLOWS_SELECTION' })
      session.send({ type: 'GESTURE_RESET' })
      setCommitCandidate(null)
      frameBorderInsetsPx = ZERO_CONTENT_BOX_INSETS_PX
      publishMotionGeometrySnapshot(null, [], [], false)
      controller.detach()
      return
    }
    const itemsById = new Map(scene.items.map(candidate => [candidate.id, candidate]))
    const item = itemsById.get(target.itemId)
    if (item === undefined) return
    const visible = isItemVisible(item, itemsById)
    if (!visible) {
      activeMotion = null
      session.send({ type: 'PRESENTATION_SETTLED' })
    }
    // A document-backed target no longer needs the temporary snapshot contribution. This also
    // closes the preview left by a temporary edit when a freshly created keyframe is selected.
    if ((!visible || !target.isTemporary) && previewActive() && !awaitingPresentation()) {
      clearSnapshotPreview()
    }

    // Un keyframe (explicite ou déduit de l'alignement playhead) se lit en cascade. Un décor
    // temporaire part de la cascade précédente puis superpose l'état logique présenté par snapshot
    // et, le cas échéant, le patch sparse de la map utilisateur. `snapshot.get()` exclut toujours
    // la preview active.
    const temporaryCandidate = target.isTemporary
      ? coordination.decorPreview.getAt(target.itemId, lastKnownTimelineMs)
      : null
    let patch: DecorPatch
    let modifiedProperties: DecorModificationMap = new Map()
    if (target.isTemporary) {
      const base = resolveDecorEditBase(scene, target, lastKnownTimelineMs)
      const editKey = editRegistryKey(target.itemId, lastKnownTimelineMs)
      if (temporaryCandidate !== null) {
        const previousState = editRegistry().get(editKey)
        const candidateBase = previousState?.base ?? base
        modifiedProperties = modificationsFromDecorPatch(candidateBase, temporaryCandidate.patch)
        session.send({ type: 'REGISTRY_SET', key: editKey, state: { base: candidateBase, modifications: modifiedProperties } })
        patch = applyDecorModifications(candidateBase, modifiedProperties)
        controller.setModifiedProperties(target.itemId, [...modifiedProperties.keys()])
        // A scene rebuild destroys the runtime preview. Re-apply the accepted candidate only when
        // the player has reached its author time; the request-side `seek` notification is too early.
        const progress = coordination.transport.getProgress()
        if (visible && progress !== null && isSameAuthorTime(progress.timelineMs, temporaryCandidate.timeMs)) {
          previewPatch(target.itemId, temporaryCandidate.patch, true, null)
        }
      } else {
        patch = base
        session.send({ type: 'REGISTRY_SET', key: editKey, state: null })
        controller.setModifiedProperties(target.itemId, [])
      }
    } else {
      patch = resolveDecorEditBase(scene, target, lastKnownTimelineMs)
      session.send({ type: 'REGISTRY_SET', key: editRegistryKey(target.itemId, lastKnownTimelineMs), state: { base: patch, modifications: new Map() } })
    }
    const rootWidth = sceneRootWidthPx()
    const targetKeyframe = target.keyframeId === null
      ? undefined
      : item.keyframes.find((keyframe) => keyframe.id === target.keyframeId)
    const targetKeyframeTimeMs = targetKeyframe?.timeMs ?? null
    const targetIsAtTimeline = targetKeyframeTimeMs === null
      || isSameAuthorTime(targetKeyframeTimeMs, lastKnownTimelineMs)
    const targetIsDecorOnly = targetKeyframe !== undefined && resolveKeyframeChannel(targetKeyframe) === 'decor'
    // A real KF remains the document target for the trajectory, but an explicit selection can be
    // stale while the author scrubs. In that case the runtime snapshot is also the CS source; this
    // is essential for bordered items because the document endpoint alone would leave the frame on
    // the last visited KF. A decoration-only KF also has no authority over pose at its own time;
    // preserve the player-presented pose after its immediate commit. A temporary target uses the
    // same snapshot unless it already has a live candidate of its own.
    const readsPresentedSnapshot = target.isTemporary
      || (targetIsDecorOnly && targetIsAtTimeline)
      || (session.getSnapshot().matches({ projection: 'followsTime' }) && !targetIsAtTimeline)
    const currentLogicalSnapshot = readsPresentedSnapshot
      ? presentedSnapshotAt(lastKnownTimelineMs)
      : null
    const logicalSnapshot = target.isTemporary && temporaryCandidate !== null
      ? null
      : currentLogicalSnapshot
    const posePatch = target.keyframeId === null
      ? patch
      : resolveEffectivePosePatch(scene, item, target.keyframeId, target.contentId === null ? undefined : scene.contents[target.contentId])
    const resolvedBorderInsets = rootWidth === null
      ? ZERO_CONTENT_BOX_INSETS_PX
      : resolveFrameBorderInsets(logicalSnapshot, target.itemId, patch, rootWidth)
    const logicalFrameFromState = rootWidth === null
      ? null
      : readLogicalFrame(logicalSnapshot, target.itemId, posePatch)
    const rotationOrigin = posePatch.offset?.rotationOrigin
      ?? readRotationOrigin(patch.style?.['transform-origin'])
    const logicalFrame = !visible ? null : logicalFrameFromState
      ?? (rootWidth !== null && itemUsesZonePlacement(scene, item, lastKnownTimelineMs, target.keyframeId)
        ? readPresentedLogicalFrame(target.itemId, rootWidth, rotationOrigin, resolvedBorderInsets)
        : null)
    frameTarget = target
    frameLogicalValue = logicalFrame
    // An exact KF is always document-authoritative. For a temporary target, the logical projection
    // is authoritative only when the snapshot belongs to the current author time; otherwise the
    // presentation port remains the safe fallback for parent transforms and stale seek handoffs.
    authorFramePx = rootWidth === null || logicalFrame === null ? null : logicalFrameToPx(logicalFrame, rootWidth)
    frameBorderInsetsPx = resolvedBorderInsets
    const presentedFrame = authorFramePx === null
      ? null
      : presentedContentBoxFrameForItem(target.itemId, authorFramePx.rotationOrigin)
    const nextDisplayFrame = authorFramePx === null
      ? null
      : commitCandidate()
        ?? presentedFrame
        ?? authorFramePx
    displayFramePx = nextDisplayFrame === null
      ? null
      : { ...nextDisplayFrame, rotate: normalizeAngleDegrees(nextDisplayFrame.rotate ?? 0) }
    session.send({ type: 'GESTURE_RESET' })
    controller.attachItems([
      {
        itemId: target.itemId,
        itemType: target.itemType,
        defaults: {},
        chain: [],
        patch,
        isTemporary: target.isTemporary,
        modifiedProperties: [...modifiedProperties.keys()],
      },
    ])
    syncMotionOverlay()
  }

  const unsubscribeDecorChange = controller.onDecorChange((entries) => {
    const { scene, selection } = machine.getSnapshot().context
    if (!scene) return
    const target = resolveTarget(scene, selection, lastKnownTimelineMs)
    if (!target) return
    const entry = entries.find((e) => e.itemId === target.itemId)
    if (!entry) return
    // Selection Frame edits use the pose channel. Keep their sparse registry and live preview,
    // but do not arm the generic Decor-KF flush; `commitSelectionFrameDrop` captures the affine
    // pose synchronously on pointer release. A palette edit already pending before the gesture is
    // left intact so the pose commit can merge its sparse decoration patch.
    const isFramePoseGesture = gesture() !== null

    const editKey = editRegistryKey(target.itemId, lastKnownTimelineMs)
    const currentState = editRegistry().get(editKey)
    const base = currentState?.base ?? resolveDecorEditBase(scene, target, lastKnownTimelineMs)
    const modifications = setDecorEditState(entry.itemId, lastKnownTimelineMs, base, entry.patch)
    const sparsePatch = modificationsToDecorPatch(modifications)

    if (modifications.size === 0) {
      session.send({ type: 'PENDING_DISCARDED', temporary: target.isTemporary })
      coordination.decorPreview.clear(entry.itemId, lastKnownTimelineMs)
      clearSnapshotPreview()
      session.send({ type: 'DECOR_PREVIEWED', accepted: true })
      return
    }

    // A temporary target is previewed through the runtime snapshot and kept in the open registry;
    // its sparse patch is committed as one new KF at the phase boundary. No interpolated value is
    // copied into the candidate merely because it was visible in the palette.
    const rootWidth = sceneRootWidthPx()
    const nextBorderInsets = rootWidth === null
      ? null
      : resolveFrameBorderInsets(null, entry.itemId, entry.patch, rootWidth)
    const authorBase = gesture()?.baseAuthorFrame
      ?? (displayFramePx !== null && target.isTemporary && targetUsesTangent(scene, target, gestureContext())
        ? authorFrameForGesture(displayFramePx, authoredRotationAtGestureStart(scene, target, displayFramePx, gestureContext()), frameBorderInsetsPx)
        : authorFramePx)
    const authorPatch = rootWidth === null || authorBase === null
      ? null
      : mergePatch({ offset: frameToOffsetPatch(authorBase, rootWidth) }, sparsePatch)
    const logicalCandidate = authorPatch === null ? null : readLogicalFrame(null, entry.itemId, authorPatch)
    const authorCandidate = rootWidth === null || logicalCandidate === null
      ? null
      : logicalFrameToPx(logicalCandidate, rootWidth)
    const displayedCandidate = authorCandidate === null || nextBorderInsets === null || rootWidth === null
      ? displayFramePx
      : displayFrameForAuthorFrame(scene, target, authorCandidate, gestureContext(), nextBorderInsets)
    const previewAccepted = previewPatch(entry.itemId, sparsePatch, target.isTemporary, displayedCandidate)
    session.send({ type: 'DECOR_PREVIEWED', accepted: previewAccepted })
    if (previewAccepted && nextBorderInsets !== null) {
      frameBorderInsetsPx = nextBorderInsets
      if (!isFramePoseGesture && rootWidth !== null && authorCandidate !== null && displayedCandidate !== null) {
        setAuthorFrame(authorCandidate, rootWidth)
        displayFramePx = presentedContentBoxFrameForItem(entry.itemId, displayedCandidate.rotationOrigin) ?? displayedCandidate
      }
      if (!isFramePoseGesture) syncMotionOverlay()
    }
    if (target.isTemporary) {
      if (!isFramePoseGesture) {
        session.send({ type: 'TEMPORARY_EDIT_PENDING', edit: { itemId: entry.itemId, timeMs: lastKnownTimelineMs } })
        // The explicit control-end signal commits this temporary edit; movement creation is
        // handled by `commitMotionDrop`, which materializes a pose KF on pointer release.
      }
      return
    }
    if (target.writeDecorId === null) return

    // Exact targets also stay sparse until the host phase boundary. Existing target siblings are
    // materialized only by `buildDecorCommands`, so a partial nested offset never erases a value
    // authored earlier on the same Decor.
    const commands = buildDecorCommands(
      scene,
      target,
      materializeZoneFillStyle(resolveDocumentDecorBase(scene, target, lastKnownTimelineMs), sparsePatch),
    )
    if (!isFramePoseGesture && commands.length > 0) {
      session.send({ type: 'EXACT_EDIT_PENDING', commands })
    }
  })

  const unsubscribeInteractionEnd = controller.onInteractionEnd(() => {
    flushNow()
  })

  const unsubscribeZonePlacementRequest = controller.onZonePlacementRequest((useZone) => {
    const { scene, selection } = machine.getSnapshot().context
    const target = scene === null ? null : resolveTarget(scene, selection, lastKnownTimelineMs)
    const item = scene?.items.find((candidate) => candidate.id === target?.itemId)
    if (scene === null || target === null || item === undefined) return
    const documentBase = resolveDocumentDecorBase(scene, target, lastKnownTimelineMs)
    const currentPatch = controller.getPatches().find((entry) => entry.itemId === item.id)?.patch ?? documentBase
    const effective = mergePatch(documentBase, currentPatch)
    const zoneId = effective.zoneId
    const zone = typeof zoneId === 'string' ? scene.zones[zoneId] : undefined
    if (zone === undefined || zone.capsuleId !== item.parentId) return

    if (useZone) {
      if (!hasExplicitPlacementGeometry(effective.offset)) return
      const style = missingZoneFillStyle(documentBase.style, documentBase.custom)
      controller.applyPatch({
        offset: clearOffsetPlacementGeometry(effective.offset),
        ...(Object.keys(style).length === 0 ? {} : { style }),
      })
      return
    }

    if (hasExplicitPlacementGeometry(effective.offset)) return
    const rootWidth = sceneRootWidthPx()
    if (rootWidth === null) return
    const frame = displayFramePx ?? (() => {
      const logicalFrame = readPresentedLogicalFrame(
        item.id,
        rootWidth,
        authorFramePx?.rotationOrigin,
        frameBorderInsetsPx,
      )
      return logicalFrame === null ? null : logicalFrameToPx(logicalFrame, rootWidth)
    })()
    if (frame === null) return
    controller.applyPatch({ offset: frameToOffsetPatch(frame, rootWidth) })
  })

  const unsubscribeCommitted = machine.on('sceneCommitted', ({ scene, selection }) => {
    ensureMounted()
    const key = selectionKey(selection)
    // Frontière d'édition « sélection » (spec d'intégration) : flush avant de resynchroniser la palette sur la
    // nouvelle cible, quelle que soit l'origine (timeline, clic hors CS, etc.).
    if (key !== lastSelectionKey) {
      flushNow()
      // A deliberate selection (timeline item/KF or ghost) re-establishes its own target. A seek
      // without a selection change must keep following the runtime time instead of the last KF.
      session.send({ type: 'PROJECTION_FOLLOWS_SELECTION' })
    } else if (scene !== lastObservedScene && session.getSnapshot().context.pendingCommands !== null) {
      // Frontière d'édition « mutation documentaire externe » (ex. édition timeline) survenue pendant une phase
      // décor en cours : notre propre flush vide `pendingCommands` AVANT d'émettre son propre
      // commit, donc son écho ne peut jamais retomber dans cette branche (pas de boucle).
      flushNow()
    }
    lastSelectionKey = key
    lastObservedScene = scene
    reconcileConsumedTemporaryDecor(scene)
    syncSelection(scene, selection)
  })
  const unsubscribeLoaded = machine.on('sceneLoaded', ({ scene }) => {
    // Un chargement de document supplante toute phase en cours — rien à committer, rien à préserver.
    // The active segment is derived state; reload it from the new document even when IDs match.
    activeMotion = null
    session.send({ type: 'ABORTED' })
    coordination.snapshot.clear()
    session.send({ type: 'PREVIEW_CLEARED' })
    session.send({ type: 'PROJECTION_FOLLOWS_SELECTION' })
    session.send({ type: 'PRESENTATION_SETTLED' })
    coordination.decorPreview.clearAll()
    ensureMounted()
    const selection = machine.getSnapshot().context.selection
    syncSelection(scene, selection)
    lastObservedScene = scene
    lastSelectionKey = selectionKey(selection)
  })
  const unsubscribeReverted = machine.on('sceneReverted', ({ scene }) => {
    session.send({ type: 'REVERTED' })
    coordination.snapshot.clear()
    session.send({ type: 'PREVIEW_CLEARED' })
    session.send({ type: 'PROJECTION_FOLLOWS_SELECTION' })
    session.send({ type: 'PRESENTATION_SETTLED' })
    coordination.decorPreview.clearAll()
    const selection = machine.getSnapshot().context.selection
    syncSelection(scene, selection)
  })
  // Frontière d'édition « seek » : flush immédiat (le rebuild qui suit rejoue la position demandée).
  // Resynchronise aussi la palette après coup — l'alignement kf/décor temporaire dépend de
  // `lastKnownTimelineMs` (`specs/editor-v2-integration-spec.md`) ; sans ce resync explicite,
  // un seek qui ne flush rien (rien en attente) laisserait la palette affichant l'instant précédent.
  const unsubscribeSeek = machine.on('seek', ({ timelineMs }) => {
    lastKnownTimelineMs = timelineMs
    session.send({ type: 'PRESENTATION_SETTLED' })
    // The controller intentionally retains the last explicit KF until scrub release. The visual
    // CS must nevertheless follow the time being sought, including when that selection is stale.
    session.send({ type: 'PROJECTION_FOLLOWS_TIME' })
    flushNow()
    // A temporary snapshot belongs to the old presented time. Keep its coordination candidate
    // for a possible return to that time, but clear the runtime preview before the asynchronous
    // seek so it cannot paint the old edit over the new base frame.
    if (previewActive()) {
      clearSnapshotPreview()
    }
    const { scene, selection } = machine.getSnapshot().context
    if (scene) syncSelection(scene, selection)
  })
  /**
   * `'seek'` ci-dessus est émis à la DEMANDE (synchrone), avant que `telco.seek()` (asynchrone,
   * `scene-player-bridge.ts`) n'ait réellement appliqué la position au runtime — le
   * `syncSelection` immédiat ci-dessus capture donc systématiquement l'état D'AVANT le seek pour
   * tout champ lu dans le snapshot temporaire. Bug constaté en direct : la couleur d'un décor
   * temporaire restait figée sur le keyframe précédent pendant qu'un scrub répété faisait
   * progresser la position. Le CS, lui, est resynchronisé depuis `instance.presentation` au même
   * rendez-vous de fin ; `'seekApplied'` referme aussi l'écart de palette sans nouvel appel
   * `telco.seek()`.
   */
  const unsubscribeSeekApplied = machine.on('seekApplied', () => {
    if (awaitingPresentation()) {
      session.send({ type: 'PRESENTATION_SETTLED' })
      // The contribution belonged to the old instance, which the rebuild has now discarded.
      clearSnapshotPreview(false)
    }
    const { scene, selection } = machine.getSnapshot().context
    if (scene) syncSelection(scene, selection)
  })
  // Frontière d'édition « lancement de lecture » : flush immédiat AVANT `telco.play()` (`PLAY_REQUEST`, `types.ts`) —
  // sans ça une édition tout juste faite peut rester en attente pendant tout le play qui suit.
  const unsubscribeFlushPending = machine.on('flushPending', () => flushNow())

  /**
   * État `playing` — aucune écriture de
   * preview live pendant que `isPlaying === true`. Le pont `scenePlayer` conserve l'instance pour
   * un simple Play/Seek et réapplique la pose runtime avant de jouer ; le gel empêche donc la
   * palette de réinjecter une preview périmée pendant ce handoff.
   * `mountHandle.setPreviewSuspended` — pas `controller.detach()` — préserve le panneau actif à
   * travers un cycle play→pause : un détachement suivi d'un rattachement le réinitialise
   * (`decor-editor/machine.ts`), ce que ce chantier ne veut pas faire pour un simple play/pause.
   * `syncSelection` à la sortie : la resynchronisation se fait sur le node dont la pose a déjà été
   * réappliquée par le runtime, `setPreviewSuspended(false)` déclenche alors une seule écriture,
   * déjà à jour.
   */
  const unsubscribePlaybackActive = machine.on('playbackActiveChanged', ({ active }) => {
    if (active) {
      mountHandle?.setPreviewSuspended(true)
      capsuleDefinitionEditor?.setDisabled(true)
      selectionFrame?.setSuspended(true)
      blockMoveControl?.setValue(null)
      motionOverlay?.setSuspended(true)
      zones.syncVisibility()
      return
    }
    ensureMounted()
    const { scene, selection } = machine.getSnapshot().context
    if (scene) syncSelection(scene, selection)
    mountHandle?.setPreviewSuspended(false)
    const authoringMode = machine.getSnapshot().context.authoringMode
    motionOverlay?.setSuspended(authoringMode === 'zone' || activeCreationMode() !== null)
    syncControlSurfaces(motionGeometry.get().selection?.geometry.frame ?? null)
  })
  const unsubscribePlaybackReconciled = coordination.onPlaybackReconciled((timelineMs) => {
    lastKnownTimelineMs = timelineMs
    const { scene, selection } = machine.getSnapshot().context
    if (scene) syncSelection(scene, selection)
  })

  const unsubscribeCreationMode = machine.on('creationModeChanged', ({ mode }) => {
    selectionFrame?.setCreationMode(mode === null ? null : selectionModeFor())
    zones.syncVisibility()
    syncControlSurfaces(motionGeometry.get().selection?.geometry.frame ?? null)
    motionOverlay?.setSuspended(playbackActive() || mode !== null || machine.getSnapshot().context.authoringMode === 'zone')
    if (mode === null) {
      const { scene, selection } = machine.getSnapshot().context
      if (scene) syncSelection(scene, selection)
    }
  })

  const unsubscribeSceneHost = coordination.onSceneHostChange((host) => {
    if (host === null) {
      unmountSelectionFrame()
      return
    }
    mountSelectionFrame(host)
    const { scene, selection } = machine.getSnapshot().context
    if (scene) syncSelection(scene, selection)
  })

  ensureMounted()
  const initial = machine.getSnapshot().context
  if (initial.scene) syncSelection(initial.scene, initial.selection)
  lastObservedScene = initial.scene
  lastSelectionKey = selectionKey(initial.selection)

  return {
    setInspectorPanel(panel): void {
      inspectorPanel = panel
      zones.syncVisibility()
    },
    destroy(): void {
      document.removeEventListener('keydown', onKeyDown, { capture: true })
      unsubscribeSeek.unsubscribe()
      unsubscribeSeekApplied.unsubscribe()
      unsubscribeFlushPending.unsubscribe()
      unsubscribePlaybackActive.unsubscribe()
      unsubscribeCreationMode.unsubscribe()
      unsubscribePlaybackReconciled()
      unsubscribeCommitted.unsubscribe()
      unsubscribeLoaded.unsubscribe()
      unsubscribeReverted.unsubscribe()
      unsubscribeSceneHost()
      unsubscribeDecorChange()
      unsubscribeInteractionEnd()
      unsubscribeZonePlacementRequest()
      // One teardown path for everything mounted on the scene host, zone editor and tool state included.
      unmountSelectionFrame()
      mountHandle?.destroy()
      capsuleDefinitionEditor?.destroy()
      container.replaceChildren()
      session.stop()
      controller.destroy()
    },
  }
}
