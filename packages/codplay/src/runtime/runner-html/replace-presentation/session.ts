import type { ReplaceComponentSurface, ReplacePresentationSession } from '../../components'
import {
  normalizeProfile,
  resolveMediaCellSettings,
  type HtmlReplaceProfile,
  type ResolvedMediaCellSettings,
} from './profile'
import {
  cloneSnapshotNode, createPresentationComposite, createPresentationLayer, getMotionContentRoot,
  getOffsetFromParent, isHtmlElement, positionPresentationLayer, positionSnapshot, removeSnapshot,
  restoreParentPosition, sanitizeSnapshot, type SnapshotGeometry,
} from './dom'
import {
  areMediaFramesReady, createMotionSnapshot, freezeMediaClone, releaseFrozenMediaClone,
  resizeFrozenMediaFrames, watchMediaFrames,
} from './media'
import {
  buildMediaMaskGrid, createMediaMaskHost, removeMediaMaskGrid, removeMediaMaskHost,
  resizeMediaMaskGrid,
} from './media-mask'
import {
  buildTextUnitLayer, getRootRemSizePx, registerCompositeTextUnitLayer,
} from './text'
import {
  applyMotionPose, applyUnchangedTextUnits, clampProgress, getSplitDuration, resolveMediaCellsTiming,
  prepareMotionTrajectories, resolveMotionTrajectory, sampleSlotMediaCells, sampleSlotTransition,
  sampleSplitMediaMotion, sampleSplitTextMotion,
} from './motion'
import { setMaskImage } from './masks'

/** Width slack in CSS pixels keeps text snapshots clear of measurement drift. */
const SNAPSHOT_WIDTH_SAFETY_MARGIN = 8


/** Creates a presentation-only replace surface for one materialized HTML root. */
export function createHtmlReplacePresentationSurface(
  root: unknown,
): ReplaceComponentSurface {
  return {
    begin: (profile = 'fade', sourceSnapshot) => createReplaceSession(
      root,
      normalizeProfile(profile),
      sourceSnapshot,
    ),
  }
}


/** Captures outgoing content before an update and animates only temporary snapshots. */
function createReplaceSession(
  root: unknown,
  profile: HtmlReplaceProfile,
  sourceSnapshot?: unknown,
): ReplacePresentationSession | undefined {
  if (!isHtmlElement(root)) return undefined
  const parent = root.parentElement
  if (parent === null) return undefined

  const interruptedSource = isHtmlElement(sourceSnapshot) ? sourceSnapshot : undefined
  const outgoingSource = interruptedSource ?? root
  const preserveTextViewDimensions = profile.motion !== undefined
    && profile.motion.split !== 'cells'
    && !profile.freezeMedia
  let outgoingGeometry: SnapshotGeometry | undefined = preserveTextViewDimensions
    ? getOffsetFromParent(root, parent, SNAPSHOT_WIDTH_SAFETY_MARGIN)
    : undefined
  let incomingGeometry: SnapshotGeometry | undefined
  const outgoingSnapshot = profile.motion === undefined && !profile.freezeMedia
    ? cloneSnapshotNode(outgoingSource)
    : createMotionSnapshot(outgoingSource, 'outgoing', profile.freezeMedia && profile.mediaCells === undefined)
  if (!isHtmlElement(outgoingSnapshot)) return undefined
  const outgoingContent = getMotionContentRoot(outgoingSnapshot) ?? outgoingSnapshot
  if (profile.mediaCells !== undefined && !freezeMediaClone(outgoingSource, outgoingContent)) return undefined

  const originalVisibility = root.style.visibility
  const originalParentPosition = parent.style.position
  const rootStyles = getComputedStyle(root)
  const outgoingOpacity = profile.motion === undefined ? rootStyles.opacity || '1' : '1'
  const rootZIndex = rootStyles.zIndex
  const snapshotZIndex = Number.isFinite(Number(rootZIndex)) ? String(Number(rootZIndex) + 1) : '1'
  const motionTrajectories = profile.motion === undefined
    ? undefined
    : prepareMotionTrajectories(profile.motion)
  let currentProgress = 0
  let effectiveDuration = profile.motion?.duration ?? profile.duration ?? 0
  let resolvedMediaCells: ResolvedMediaCellSettings | undefined
  if (originalParentPosition === '' || originalParentPosition === 'static') {
    parent.style.position = 'relative'
  }

  const presentationLayer = profile.clipToSlot
    ? createPresentationLayer(root, snapshotZIndex)
    : undefined
  if (presentationLayer !== undefined) {
    parent.insertBefore(presentationLayer, root)
    positionPresentationLayer(presentationLayer, root, parent)
  }

  sanitizeSnapshot(outgoingSnapshot, 'outgoing')
  outgoingSnapshot.style.opacity = outgoingOpacity
  outgoingSnapshot.style.zIndex = presentationLayer === undefined ? snapshotZIndex : '0'
  positionSnapshot(
    outgoingSnapshot,
    root,
    parent,
    presentationLayer,
    profile.motion === undefined ? 'hidden' : 'visible',
    outgoingGeometry,
  )
  if (presentationLayer === undefined) parent.insertBefore(outgoingSnapshot, root)
  else presentationLayer.append(outgoingSnapshot)
  if (profile.motion?.split !== undefined && profile.motion.split !== 'cells') {
    if (interruptedSource === undefined) buildTextUnitLayer(outgoingSnapshot, profile.motion.split)
    else registerCompositeTextUnitLayer(outgoingSnapshot)
  }
  root.style.visibility = 'hidden'

  let incomingSnapshot: HTMLElement | undefined
  let mediaMaskHost: SVGSVGElement | undefined
  let hasOutgoingMediaMask = false
  let hasIncomingMediaMask = false
  let state: 'prepared' | 'started' | 'finished' | 'cancelled' = 'prepared'
  let mediaMaskShape: HtmlReplaceProfile['shape']
  const frameWaiters = new Set<() => void>()

  /** Measures one responsive grid request against the current media box. */
  const resolveCurrentMediaCells = (): ResolvedMediaCellSettings | undefined => {
    if (profile.mediaCells === undefined) return undefined
    const rect = root.getBoundingClientRect()
    resolvedMediaCells = resolveMediaCellSettings(
      profile.mediaCells,
      rect.width,
      rect.height,
    )
    effectiveDuration = resolveMediaCellsTiming(
      profile.motion?.duration ?? profile.duration ?? 0,
      resolvedMediaCells,
    ).totalDurationMs
    return resolvedMediaCells
  }

  if (profile.mediaCells !== undefined) resolveCurrentMediaCells()

  /** Stops every pending native-media readiness listener owned by this session. */
  const cancelFrameWaiters = (): void => {
    for (const cancelWait of frameWaiters) cancelWait()
    frameWaiters.clear()
  }

  /** Removes the clipping layer or the direct media snapshots for this session. */
  const removePresentation = (): void => {
    if (hasOutgoingMediaMask) removeMediaMaskGrid(outgoingSnapshot)
    if (hasIncomingMediaMask) removeMediaMaskGrid(root)
    if (mediaMaskHost !== undefined) {
      removeMediaMaskHost(mediaMaskHost)
      mediaMaskHost = undefined
    }
    releaseFrozenMediaClone(outgoingContent)
    if (presentationLayer !== undefined) {
      removeSnapshot(presentationLayer, parent)
      return
    }
    removeSnapshot(outgoingSnapshot, parent)
    if (incomingSnapshot !== undefined) removeSnapshot(incomingSnapshot, parent)
  }

  /** Rebuilds one session grid with the latest resolved counts and shape. */
  const rebuildMediaMask = (viewKey: HTMLElement, target: HTMLElement): boolean => {
    removeMediaMaskGrid(viewKey)
    if (mediaMaskHost === undefined || resolvedMediaCells === undefined) return false
    return buildMediaMaskGrid({
      viewKey,
      target,
      host: mediaMaskHost,
      settings: resolvedMediaCells,
      shape: mediaMaskShape,
    }) !== undefined
  }

  /** Creates the incoming snapshot after the slot has received its new content. */
  const start = (): boolean => {
    if (state === 'started') return true
    if (state !== 'prepared') return false
    root.style.visibility = originalVisibility
    const mode = profile.motion?.mode ?? 'replace'
    if (mode === 'intro') removeSnapshot(outgoingSnapshot, parent)
    if (profile.mediaCells !== undefined) {
      if (profile.freezeMedia) {
        const sourceReady = mode === 'intro' || areMediaFramesReady(outgoingContent)
        const targetReady = mode === 'outro' || areMediaFramesReady(root)
        if (!sourceReady || !targetReady) {
          root.style.visibility = 'hidden'
          return false
        }
      }
      const settings = resolveCurrentMediaCells()
      if (settings === undefined) {
        finish()
        return true
      }
      mediaMaskHost = createMediaMaskHost(parent)
      mediaMaskShape = profile.shape ?? (profile.transition === 'mask-reveal' ? 'circle' : undefined)
      if (mode === 'intro') {
        releaseFrozenMediaClone(outgoingContent)
      }
      const maskSource = mode === 'intro'
        ? { viewKey: root, target: root }
        : { viewKey: outgoingSnapshot, target: outgoingContent }
      const mediaMaskGrid = buildMediaMaskGrid({
        ...maskSource,
        host: mediaMaskHost,
        settings,
        shape: mediaMaskShape,
      })
      if (mediaMaskGrid === undefined) {
        finish()
        return true
      }
      if (mode === 'intro') {
        hasIncomingMediaMask = true
      } else {
        hasOutgoingMediaMask = true
      }
      root.style.visibility = mode === 'outro' ? 'hidden' : originalVisibility
      state = 'started'
      sample(0)
      return true
    }

    if (profile.motion?.mode !== 'outro') {
      const nextSnapshot = profile.motion === undefined && !profile.freezeMedia
        ? cloneSnapshotNode(root)
        : createMotionSnapshot(root, 'incoming', profile.freezeMedia)
      if (!isHtmlElement(nextSnapshot)) {
        if (profile.freezeMedia && !areMediaFramesReady(root)) {
          root.style.visibility = 'hidden'
          return false
        }
        finish()
        return true
      }
      sanitizeSnapshot(nextSnapshot, 'incoming')
      nextSnapshot.style.opacity = profile.motion === undefined ? getComputedStyle(root).opacity || '1' : '1'
      incomingGeometry = preserveTextViewDimensions
        ? getOffsetFromParent(root, parent, SNAPSHOT_WIDTH_SAFETY_MARGIN)
        : undefined
      nextSnapshot.style.zIndex = presentationLayer === undefined
        ? String(Number(snapshotZIndex) + 1)
        : '1'
      positionSnapshot(
        nextSnapshot,
        root,
        parent,
        presentationLayer,
        profile.motion === undefined ? 'hidden' : 'visible',
        incomingGeometry,
      )
      if (presentationLayer === undefined) parent.insertBefore(nextSnapshot, root)
      else presentationLayer.append(nextSnapshot)
      incomingSnapshot = nextSnapshot
      if (profile.motion?.split !== undefined && profile.motion.split !== 'cells') {
        buildTextUnitLayer(nextSnapshot, profile.motion.split)
      }
    }
    if (profile.motion?.split !== undefined && profile.motion.split !== 'cells') {
      applyUnchangedTextUnits(outgoingSnapshot, incomingSnapshot, profile.motion)
      effectiveDuration = getSplitDuration(outgoingSnapshot, incomingSnapshot, profile.motion)
    }
    root.style.visibility = 'hidden'
    state = 'started'
    if (incomingSnapshot !== undefined && profile.transition === 'mask-reveal') {
      setMaskImage(incomingSnapshot, profile.shape ?? 'circle')
    }
    sample(0)
    return true
  }

  /** Watches the current persistent media source until its displayed frame can be copied. */
  const waitForIncomingFrame = (onReady: (readyState: 'ready' | 'error') => void): (() => void) => {
    if (state !== 'prepared') return () => undefined
    if (profile.mediaCells !== undefined) {
      let active = true
      let sourceReady = profile.motion?.mode === 'intro'
      let targetReady = profile.motion?.mode === 'outro'
      const removeListeners: Array<() => void> = []
      const cancel = (): void => {
        if (!active) return
        active = false
        for (const removeListener of removeListeners) removeListener()
        removeListeners.length = 0
      }
      const settle = (kind: 'source' | 'target', result: 'ready' | 'error'): void => {
        if (!active) return
        if (result === 'error') {
          cancel()
          onReady('error')
          return
        }
        if (kind === 'source') sourceReady = true
        else targetReady = true
        if (sourceReady && targetReady) {
          cancel()
          onReady('ready')
        }
      }
      if (!sourceReady) removeListeners.push(watchMediaFrames(outgoingContent, (result) => settle('source', result)))
      if (!targetReady) removeListeners.push(watchMediaFrames(root, (result) => settle('target', result)))
      frameWaiters.add(cancel)
      return () => {
        cancel()
        frameWaiters.delete(cancel)
      }
    }
    const cancelWait = watchMediaFrames(root, onReady)
    frameWaiters.add(cancelWait)
    return () => {
      cancelWait()
      frameWaiters.delete(cancelWait)
    }
  }

  /** Applies one normalized progress value to the selected slot transition. */
  const sample = (progress: number): void => {
    if (state !== 'started') return
    const value = clampProgress(progress)
    currentProgress = value
    if (presentationLayer !== undefined) positionPresentationLayer(presentationLayer, root, parent)
    positionSnapshot(
      outgoingSnapshot,
      root,
      parent,
      presentationLayer,
      profile.motion === undefined ? 'hidden' : 'visible',
      outgoingGeometry,
    )
    if (incomingSnapshot !== undefined) {
      positionSnapshot(
        incomingSnapshot,
        root,
        parent,
        presentationLayer,
        profile.motion === undefined ? 'hidden' : 'visible',
        incomingGeometry,
      )
    }

    if (profile.motion !== undefined && motionTrajectories !== undefined) {
      if (profile.motion.split !== undefined && profile.motion.split !== 'cells') {
        sampleSplitTextMotion(outgoingSnapshot, incomingSnapshot, profile.motion, value, motionTrajectories)
      } else if (profile.motion.split === 'cells') {
        sampleSplitMediaMotion(
          outgoingSnapshot,
          profile.motion.mode === 'outro' ? undefined : root,
          profile.motion,
          value,
          motionTrajectories,
          resolvedMediaCells,
        )
      } else {
        if (profile.motion.mode !== 'intro') {
          applyMotionPose(
            outgoingSnapshot,
            resolveMotionTrajectory(motionTrajectories.outro, value),
            profile.freezeMedia ? undefined : getRootRemSizePx(),
          )
        }
        if (profile.motion.mode !== 'outro' && incomingSnapshot !== undefined) {
          applyMotionPose(
            incomingSnapshot,
            resolveMotionTrajectory(motionTrajectories.intro, value),
            profile.freezeMedia ? undefined : getRootRemSizePx(),
          )
        }
      }
      return
    }
    if (profile.mediaCells !== undefined) {
      sampleSlotMediaCells(
        outgoingSnapshot,
        profile,
        value,
        resolvedMediaCells,
      )
      return
    }
    if (incomingSnapshot === undefined) return

    const revealPersistentRoot = sampleSlotTransition(
      profile.transition,
      outgoingSnapshot,
      incomingSnapshot,
      value,
    )
    root.style.visibility = revealPersistentRoot ? originalVisibility : 'hidden'
  }

  /** Completes the effect, removes its snapshots, and reveals the persistent root. */
  const finish = (): void => {
    if (state === 'finished' || state === 'cancelled') return
    cancelFrameWaiters()
    removePresentation()
    root.style.visibility = originalVisibility
    restoreParentPosition(parent, originalParentPosition)
    state = 'finished'
  }

  /** Cancels the effect and restores the live slot without owning its content. */
  const cancel = (): void => {
    if (state === 'finished' || state === 'cancelled') return
    cancelFrameWaiters()
    removePresentation()
    root.style.visibility = originalVisibility
    restoreParentPosition(parent, originalParentPosition)
    state = 'cancelled'
  }

  /** Rebuilds visible text fragments after a resize while retaining current progress. */
  const reflow = (): void => {
    if (state !== 'started' && state !== 'prepared') return
    if (profile.mediaCells !== undefined) {
      const previous = resolvedMediaCells
      const next = resolveCurrentMediaCells()
      if (next === undefined) return
      if (outgoingSnapshot.parentNode === parent) {
        positionSnapshot(outgoingSnapshot, root, parent, presentationLayer, 'visible')
      }
      if (state === 'started') {
        const countsChanged = previous?.columns !== next.columns || previous.rows !== next.rows
        if (countsChanged) {
          if (hasOutgoingMediaMask) {
            hasOutgoingMediaMask = rebuildMediaMask(outgoingSnapshot, outgoingContent)
          }
          if (hasIncomingMediaMask) hasIncomingMediaMask = rebuildMediaMask(root, root)
        } else {
          resizeMediaMaskGrid(outgoingSnapshot)
          resizeMediaMaskGrid(root)
        }
        sample(currentProgress)
      }
      return
    }
    if (profile.freezeMedia || profile.mediaCells !== undefined || profile.motion?.split === 'cells') {
      positionSnapshot(outgoingSnapshot, root, parent, presentationLayer, 'visible')
      if (incomingSnapshot !== undefined) {
        positionSnapshot(incomingSnapshot, root, parent, presentationLayer, 'visible')
      }
      resizeFrozenMediaFrames(outgoingSnapshot, root)
      if (incomingSnapshot !== undefined) resizeFrozenMediaFrames(incomingSnapshot, root)
      if (state === 'started') sample(currentProgress)
      return
    }
    if (state !== 'started') return
    if (profile.motion?.split === undefined) return
    outgoingGeometry = undefined
    incomingGeometry = undefined
    positionSnapshot(outgoingSnapshot, root, parent, presentationLayer, 'visible')
    if (incomingSnapshot !== undefined) {
      positionSnapshot(incomingSnapshot, root, parent, presentationLayer, 'visible')
    }
    if (profile.motion.mode !== 'intro' && interruptedSource === undefined) {
      buildTextUnitLayer(outgoingSnapshot, profile.motion.split)
    }
    if (profile.motion.mode !== 'outro' && incomingSnapshot !== undefined) {
      buildTextUnitLayer(incomingSnapshot, profile.motion.split)
    }
    applyUnchangedTextUnits(outgoingSnapshot, incomingSnapshot, profile.motion)
    sample(currentProgress)
  }

  const captureCurrent = (): unknown => {
    if (state !== 'prepared' && state !== 'started') return undefined
    const visibleSnapshots = profile.mediaCells !== undefined
      ? [
        ...(profile.motion?.mode === 'intro' || outgoingSnapshot.parentNode === null ? [] : [outgoingSnapshot]),
        ...(profile.motion?.mode === 'outro' ? [] : [root]),
      ]
      : [outgoingSnapshot, incomingSnapshot]
        .filter((snapshot): snapshot is HTMLElement => snapshot !== undefined && snapshot.parentNode !== null)
    const composite = createPresentationComposite(visibleSnapshots)
    if (composite !== undefined && mediaMaskHost !== undefined) {
      composite.append(mediaMaskHost.cloneNode(true))
    }
    return composite
  }

  return {
    start,
    tryStart: start,
    waitForIncomingFrame,
    sample,
    finish,
    cancel,
    getDuration: () => {
      resolveCurrentMediaCells()
      return effectiveDuration
    },
    reflow,
    captureCurrent,
  }
}
