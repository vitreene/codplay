import { parseColor, prepareInterval, prepareTween, resolveInterval, resolveTween, type ColorValue, type Tween } from 'ace'
import type { ReplaceMotionProfile } from '../../components'
import {
  computeReplaceStaggerDelays,
  computeReplaceStaggerTiming,
  type ReplaceStaggerTiming,
} from '../../capabilities/replace-presets'
import { getMediaMaskCells, setMediaMaskCoverOpacity, type MediaMaskCell } from './media-mask'
import { getRootRemSizePx, getTextUnits, toRem, type TextUnit } from './text'
import { getMaskExtent } from './masks'
import type { HtmlReplaceProfile, ResolvedMediaCellSettings } from './profile'



export type PreparedMotionTrajectories = Readonly<{
  intro: Tween
  outro: Tween
}>


const chromaColorIntervals = new WeakMap<HTMLElement, ReturnType<typeof prepareInterval>>()
const MASK_COVER_FADE_PORTION = 0.25
const maskExtentIntervals = new WeakMap<Element, Readonly<{
  extent: number
  interval: ReturnType<typeof prepareInterval>
}>>()

const slotTransitionTweens = {
  fade: prepareTween({
    from: { outgoingOpacity: 1, incomingOpacity: 0 },
    to: { outgoingOpacity: 0, incomingOpacity: 1 },
    duration: 1,
    ease: 'linear',
  }),
  fadeIn: prepareTween({
    from: { incomingOpacity: 0 },
    to: { incomingOpacity: 1 },
    duration: 1,
    ease: 'linear',
  }),
  curtainOutgoing: prepareTween({ from: { travel: 0 }, to: { travel: -100 }, duration: 1, ease: 'inOut(2)' }),
  curtainIncoming: prepareTween({ from: { travel: 100 }, to: { travel: 0 }, duration: 1, ease: 'out(2)' }),
  wipe: prepareTween({
    from: { incomingInset: 100, outgoingX: 0, outgoingInset: 0, outgoingOpacity: 1 },
    to: { incomingInset: 0, outgoingX: -18, outgoingInset: 18, outgoingOpacity: 0.75 },
    duration: 1,
    ease: 'linear',
  }),
  slideOverOutgoing: prepareTween({
    from: { scale: 1, brightness: 1 },
    to: { scale: 0.9, brightness: 0.6 },
    duration: 1,
    ease: 'inOut(2)',
  }),
  slideOverIncoming: prepareTween({ from: { travel: 100 }, to: { travel: 0 }, duration: 1, ease: 'out(2)' }),
  stackOutgoing: prepareTween({
    from: { scale: 1, brightness: 1 },
    to: { scale: 0.9, brightness: 0.5 },
    duration: 1,
    ease: 'inOut(2)',
  }),
  stackIncoming: prepareTween({ from: { travel: 100 }, to: { travel: 0 }, duration: 1, ease: 'out(2)' }),
  stackFade: prepareTween({ from: { opacity: 1 }, to: { opacity: 0 }, duration: 1, ease: 'linear' }),
} as const


/** Resolves per-cell delays and total duration from one media-grid profile. */
export function resolveMediaCellsTiming(
  duration: number,
  settings: ResolvedMediaCellSettings,
): ReplaceStaggerTiming {
  return computeReplaceStaggerTiming({
    cols: settings.columns,
    rows: settings.rows,
    durationMs: duration,
    totalStaggerMs: settings.stagger ?? Math.round(duration * 0.5),
    staggerPattern: settings.staggerPattern,
    direction: settings.direction,
  })
}


/** Samples the one source or target grid with the shared numeric trajectory. */
export function sampleSplitMediaMotion(
  outgoingSnapshot: HTMLElement,
  incomingSnapshot: HTMLElement | undefined,
  profile: ReplaceMotionProfile,
  progress: number,
  trajectories: PreparedMotionTrajectories,
  settings: ResolvedMediaCellSettings | undefined,
): void {
  if (settings === undefined) return
  const isIntro = profile.mode === 'intro'
  const cells = isIntro
    ? incomingSnapshot === undefined ? [] : getMediaMaskCells(incomingSnapshot) ?? []
    : getMediaMaskCells(outgoingSnapshot) ?? []
  const timing = resolveMediaCellsTiming(profile.duration, settings)
  const elapsed = progress * timing.totalDurationMs
  const trajectory = isIntro ? trajectories.intro : trajectories.outro
  sampleMediaMotionCells(cells, trajectory, elapsed, timing.delays, profile.duration)
}


/** Applies a per-cell trajectory using the common duration and each cell's stagger delay. */
export function sampleMediaMotionCells(
  cells: readonly MediaMaskCell[],
  trajectory: Tween,
  elapsed: number,
  delays: readonly number[],
  duration: number,
): void {
  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index]
    if (cell === undefined) continue
    const delay = delays[index] ?? 0
    const localProgress = duration === 0
      ? (elapsed >= delay ? 1 : 0)
      : (elapsed - delay) / duration
    const bounded = clampProgress(localProgress)
    applyMotionPose(cell.element, resolveMotionTrajectory(trajectory, bounded))
  }
}


/** Samples one established slot CSS profile on the source mask cells. */
export function sampleSlotMediaCells(
  outgoingSnapshot: HTMLElement,
  profile: HtmlReplaceProfile,
  progress: number,
  settings: ResolvedMediaCellSettings | undefined,
): void {
  if (settings === undefined) return
  const cells = getMediaMaskCells(outgoingSnapshot) ?? []
  const duration = profile.duration ?? 0
  const timing = resolveMediaCellsTiming(duration, settings)
  const elapsed = progress * timing.totalDurationMs
  if (profile.transition === 'mask-reveal') {
    setMediaMaskCoverOpacity(outgoingSnapshot, progress / MASK_COVER_FADE_PORTION)
  }
  for (let index = 0; index < cells.length; index += 1) {
    const local = duration === 0
      ? (elapsed >= (timing.delays[index] ?? 0) ? 1 : 0)
      : (elapsed - (timing.delays[index] ?? 0)) / duration
    const value = clampProgress(local)
    const cell = cells[index]
    if (cell !== undefined) sampleSlotMediaMaskCell(profile.transition, cell.element, value)
  }
}


/** Maps a slot profile to one source-mask pose while the persistent target stays below. */
function sampleSlotMediaMaskCell(
  transition: string,
  cell: MotionStyleElement,
  value: number,
): void {
  switch (transition) {
    case 'fade':
    case 'fade-in':
      cell.style.opacity = String(1 - value)
      break
    case 'mask-reveal':
      cell.style.opacity = '1'
      cell.style.scale = String(1 - value)
      break
    case 'curtain': {
      const pose = resolveMotionTrajectory(slotTransitionTweens.curtainOutgoing, value)
      setVerticalTravel(cell, pose.travel ?? -100)
      break
    }
    case 'wipe':
      cell.style.clipPath = `inset(0 0 0 ${value * 100}%)`
      break
    case 'slide-over': {
      const pose = resolveMotionTrajectory(slotTransitionTweens.slideOverOutgoing, value)
      cell.style.scale = String(pose.scale ?? 1)
      cell.style.filter = `brightness(${pose.brightness ?? 1})`
      cell.style.opacity = String(1 - value)
      break
    }
    case 'stack': {
      const coverProgress = Math.min(1, value / 0.7)
      const pose = resolveMotionTrajectory(slotTransitionTweens.stackOutgoing, coverProgress)
      const fadePose = resolveMotionTrajectory(slotTransitionTweens.stackFade, (value - 0.7) / 0.3)
      cell.style.scale = String(pose.scale ?? 1)
      cell.style.filter = `brightness(${pose.brightness ?? 1})`
      cell.style.opacity = value < 0.7 ? '1' : String(fadePose.opacity ?? 1)
      break
    }
    default:
      throw new Error(`Unsupported slot replacement transition: ${transition}`)
  }
}


/** Samples one slot transition and reports when stack can reveal the live root. */
export function sampleSlotTransition(
  transition: string,
  outgoingSnapshot: MotionStyleElement,
  incomingSnapshot: MotionStyleElement,
  value: number,
): boolean {
  switch (transition) {
    case 'fade': {
      const pose = resolveMotionTrajectory(slotTransitionTweens.fade, value)
      outgoingSnapshot.style.opacity = String(pose.outgoingOpacity)
      incomingSnapshot.style.opacity = String(pose.incomingOpacity)
      return false
    }
    case 'fade-in': {
      const pose = resolveMotionTrajectory(slotTransitionTweens.fadeIn, value)
      incomingSnapshot.style.opacity = String(pose.incomingOpacity)
      return false
    }
    case 'mask-reveal': {
      outgoingSnapshot.style.opacity = '1'
      const maskSize = `${resolveMaskExtent(incomingSnapshot, value)}% auto`
      incomingSnapshot.style.setProperty('mask-size', maskSize)
      incomingSnapshot.style.setProperty('-webkit-mask-size', maskSize)
      return false
    }
    case 'curtain': {
      const outgoingTravel = resolveMotionTrajectory(slotTransitionTweens.curtainOutgoing, value)
      const incomingTravel = resolveMotionTrajectory(slotTransitionTweens.curtainIncoming, value)
      setVerticalTravel(outgoingSnapshot, outgoingTravel.travel ?? 0)
      setVerticalTravel(incomingSnapshot, incomingTravel.travel ?? 100)
      outgoingSnapshot.style.opacity = '1'
      incomingSnapshot.style.opacity = '1'
      return false
    }
    case 'wipe': {
      const pose = resolveMotionTrajectory(slotTransitionTweens.wipe, value)
      incomingSnapshot.style.clipPath = `inset(0 0 0 ${pose.incomingInset}%)`
      outgoingSnapshot.style.translate = `${pose.outgoingX}% 0`
      outgoingSnapshot.style.clipPath = `inset(0 0 0 ${pose.outgoingInset}%)`
      outgoingSnapshot.style.opacity = String(pose.outgoingOpacity)
      return false
    }
    case 'slide-over': {
      const outgoingPose = resolveMotionTrajectory(slotTransitionTweens.slideOverOutgoing, value)
      const incomingTravel = resolveMotionTrajectory(slotTransitionTweens.slideOverIncoming, value)
      outgoingSnapshot.style.scale = String(outgoingPose.scale)
      outgoingSnapshot.style.filter = `brightness(${outgoingPose.brightness})`
      setVerticalTravel(incomingSnapshot, incomingTravel.travel ?? 100)
      return false
    }
    case 'stack': {
      const coverProgress = Math.min(1, value / 0.7)
      const outgoingPose = resolveMotionTrajectory(slotTransitionTweens.stackOutgoing, coverProgress)
      const incomingTravel = resolveMotionTrajectory(slotTransitionTweens.stackIncoming, coverProgress)
      outgoingSnapshot.style.scale = String(outgoingPose.scale)
      outgoingSnapshot.style.filter = `brightness(${outgoingPose.brightness})`
      outgoingSnapshot.style.opacity = value < 0.7 ? '1' : '0'
      setVerticalTravel(incomingSnapshot, incomingTravel.travel ?? 100)
      const fadePose = resolveMotionTrajectory(slotTransitionTweens.stackFade, (value - 0.7) / 0.3)
      const incomingOpacity = fadePose.opacity ?? 1
      incomingSnapshot.style.opacity = value < 0.7 ? '1' : String(incomingOpacity)
      return value >= 0.7
    }
    default:
      throw new Error(`Unsupported slot replacement transition: ${transition}`)
  }
}


/** Resolves the ACE interval for the current measured extent, refreshing after resize. */
function resolveMaskExtent(snapshot: MotionStyleElement, progress: number): number {
  const extent = getMaskExtent(snapshot)
  const cached = maskExtentIntervals.get(snapshot)
  const interval = cached?.extent === extent
    ? cached.interval
    : prepareInterval(0, extent)
  if (cached?.extent !== extent) maskExtentIntervals.set(snapshot, { extent, interval })
  const resolved = resolveInterval(interval, clampProgress(progress))
  return typeof resolved === 'number' ? resolved : extent
}


/** Hides duplicate outgoing fragments for unchanged indexed slot-roll units. */
export function applyUnchangedTextUnits(
  outgoingSnapshot: HTMLElement,
  incomingSnapshot: HTMLElement | undefined,
  profile: ReplaceMotionProfile,
): void {
  if (profile.mode !== 'replace' || profile.skipUnchanged !== true || incomingSnapshot === undefined) return
  const outgoing = getTextUnits(outgoingSnapshot) ?? []
  const incoming = getTextUnits(incomingSnapshot) ?? []
  const count = Math.min(outgoing.length, incoming.length)
  for (let index = 0; index < count; index += 1) {
    const oldUnit = outgoing[index]
    const newUnit = incoming[index]
    if (oldUnit === undefined || newUnit === undefined || oldUnit.text === '' || oldUnit.text !== newUnit.text) continue
    oldUnit.static = true
    newUnit.static = true
    for (const span of oldUnit.spans) span.style.visibility = 'hidden'
  }
}


/** Computes the total duration including the last text-unit propagation delay. */
export function getSplitDuration(
  outgoingSnapshot: HTMLElement,
  incomingSnapshot: HTMLElement | undefined,
  profile: ReplaceMotionProfile,
): number {
  const outgoingCount = profile.mode === 'intro' ? 0 : getTextUnits(outgoingSnapshot)?.length ?? 0
  const incomingCount = profile.mode === 'outro' ? 0 : getTextUnits(incomingSnapshot ?? outgoingSnapshot)?.length ?? 0
  const count = Math.max(outgoingCount, incomingCount)
  if (count <= 1) return profile.duration
  const totalStagger = profile.stagger ?? Math.round(profile.duration * (profile.slot === undefined ? 0.4 : 0.5))
  const delays = computeReplaceStaggerDelays({
    cols: count,
    rows: 1,
    totalStaggerMs: totalStagger,
    direction: profile.direction,
  })
  return profile.duration + Math.max(...delays, 0)
}


/** Samples outgoing and incoming text units with V1 total-envelope propagation timing. */
export function sampleSplitTextMotion(
  outgoingSnapshot: HTMLElement,
  incomingSnapshot: HTMLElement | undefined,
  profile: ReplaceMotionProfile,
  progress: number,
  trajectories: PreparedMotionTrajectories,
): void {
  const outgoing = profile.mode === 'intro' ? [] : getTextUnits(outgoingSnapshot) ?? []
  const incoming = profile.mode === 'outro' || incomingSnapshot === undefined
    ? []
    : getTextUnits(incomingSnapshot) ?? []
  const count = Math.max(outgoing.length, incoming.length)
  if (count === 0) return
  const totalStagger = profile.stagger ?? Math.round(profile.duration * (profile.slot === undefined ? 0.4 : 0.5))
  const delays = computeReplaceStaggerDelays({
    cols: count,
    rows: 1,
    totalStaggerMs: totalStagger,
    direction: profile.direction,
  })
  const totalDuration = profile.duration + Math.max(...delays, 0)
  const elapsed = progress * totalDuration
  sampleTextUnits(outgoing, trajectories.outro, elapsed, delays, profile, incoming.length, false)
  sampleTextUnits(incoming, trajectories.intro, elapsed, delays, profile, incoming.length, true)
}


/** Applies one eased trajectory to every fragment belonging to each visible text unit. */
export function sampleTextUnits(
  units: readonly TextUnit[],
  trajectory: Tween,
  elapsed: number,
  delays: readonly number[],
  profile: ReplaceMotionProfile,
  incomingCount: number,
  incoming: boolean,
): void {
  const remSizePx = getRootRemSizePx()
  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index]
    if (unit === undefined || unit.static === true) continue
    const bounce = profile.slot?.bounce ?? 0
    const delayBase = delays[index] ?? 0
    const delay = bounce > 0
      ? Math.max(0, Math.round(delayBase * (1 + bounce * 0.25 * deterministicWobble(index, 2))))
      : delayBase
    const isTail = index >= incomingCount
    const duration = bounce > 0
      ? Math.max(80, Math.round(profile.duration * (isTail ? 0.75 : 1) * (1 + bounce * 0.45 * deterministicWobble(index, 1))))
      : profile.duration
    const faceDelay = incoming && bounce > 0 ? Math.round(duration * 0.12) : 0
    const localProgress = duration === 0
      ? (elapsed >= delay + faceDelay ? 1 : 0)
      : (elapsed - delay - faceDelay) / duration
    const boundedProgress = clampProgress(localProgress)
    for (const span of unit.spans) {
      applyMotionPose(span, resolveMotionTrajectory(trajectory, boundedProgress), remSizePx)
      if (incoming && profile.slot?.chroma === true) applyChromaColor(span, index, units.length, boundedProgress)
    }
  }
}


/** Produces a repeatable pseudo-random value for one slot-roll unit and channel. */
export function deterministicWobble(index: number, salt: number): number {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453
  return (value - Math.floor(value)) * 2 - 1
}


/** Interpolates the slot-roll hue back to each fragment's authored computed color. */
export function applyChromaColor(span: HTMLElement, index: number, count: number, progress: number): void {
  const interval = getChromaColorInterval(span, index, count)
  if (interval === undefined) return
  const resolved = resolveInterval(interval, clampProgress(progress))
  if (!isColorValue(resolved) || resolved.space !== 'srgb') return
  const channels = resolved.coords.map((value) => Math.round(value * 255))
  span.style.color = `rgb(${channels.join(', ')})`
}


/** Prepares one ACE color interval for a glyph's deterministic chroma path. */
export function getChromaColorInterval(
  span: HTMLElement,
  index: number,
  count: number,
): ReturnType<typeof prepareInterval> | undefined {
  const cached = chromaColorIntervals.get(span)
  if (cached !== undefined) return cached
  const rawTarget = span.dataset.replaceTargetColor
  if (rawTarget === undefined || rawTarget.length === 0) return undefined
  let target: ColorValue
  try {
    target = parseColor(rawTarget)
  } catch {
    return undefined
  }
  if (target.space !== 'srgb') return undefined
  const hue = count <= 1 ? 0 : (index / (count - 1)) * 300
  const sourceChannels = hslToRgb(hue, 0.9, 0.6)
  const source: ColorValue = {
    kind: 'color',
    space: 'srgb',
    coords: sourceChannels.map((value) => value / 255),
    alpha: 1,
  }
  const interval = prepareInterval(source, { ...target, alpha: 1 })
  chromaColorIntervals.set(span, interval)
  return interval
}


/** Narrows one ACE interpolation result to its prepared color value. */
export function isColorValue(value: unknown): value is ColorValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Partial<ColorValue>
  return candidate.kind === 'color'
    && (candidate.space === 'srgb' || candidate.space === 'oklch')
    && Array.isArray(candidate.coords)
    && typeof candidate.alpha === 'number'
}


/** Converts one HSL hue and saturation into an RGB slot-roll accent. */
export function hslToRgb(hueDegrees: number, saturation: number, lightness: number): readonly [number, number, number] {
  const hue = ((hueDegrees % 360) + 360) % 360 / 360
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const section = hue * 6
  const secondary = chroma * (1 - Math.abs(section % 2 - 1))
  const [red, green, blue] = section < 1 ? [chroma, secondary, 0]
    : section < 2 ? [secondary, chroma, 0]
      : section < 3 ? [0, chroma, secondary]
        : section < 4 ? [0, secondary, chroma]
          : section < 5 ? [secondary, 0, chroma]
            : [chroma, 0, secondary]
  const offset = lightness - chroma / 2
  return [(red + offset) * 255, (green + offset) * 255, (blue + offset) * 255]
}


/** Prepares both replace trajectories through ACE before any frame is sampled. */
export function prepareMotionTrajectories(profile: ReplaceMotionProfile): PreparedMotionTrajectories {
  const prepare = (properties: ReplaceMotionProfile['intro']): Tween => {
    const from: Record<string, number> = {}
    const to: Record<string, number> = {}
    for (const [property, range] of Object.entries(properties)) {
      from[property] = range.from ?? defaultMotionOrigin(property)
      to[property] = range.to
    }
    return prepareTween({
      from,
      to,
      duration: Math.max(1, profile.duration),
      ease: profile.ease ?? 'out(2)',
    })
  }
  return { intro: prepare(profile.intro), outro: prepare(profile.outro) }
}


/** Resolves one prepared ACE trajectory at a normalized unit progress. */
export function resolveMotionTrajectory(trajectory: Tween, progress: number): Readonly<Record<string, number>> {
  const value = resolveTween(trajectory, clampProgress(progress) * trajectory.duration)
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Readonly<Record<string, number>>
    : {}
}


/** Applies one ACE-resolved preset pose to a temporary view. */
export function applyMotionPose(
  snapshot: MotionStyleElement,
  values: Readonly<Record<string, number>>,
  remSizePx?: number,
): void {
  if (values.opacity !== undefined) {
    snapshot.style.opacity = String(Math.min(1, Math.max(0, values.opacity)))
  }
  const x = values.x ?? 0
  const y = values.y ?? 0
  snapshot.style.translate = x === 0 && y === 0
    ? 'none'
    : remSizePx === undefined
      ? `${x}px ${y}px`
      : `${toRem(x, remSizePx)} ${toRem(y, remSizePx)}`
  const scaleX = values.scaleX ?? values.scale ?? 1
  const scaleY = values.scaleY ?? values.scale ?? 1
  snapshot.style.scale = scaleX === 1 && scaleY === 1 ? 'none' : `${scaleX} ${scaleY}`
  const rotate = values.rotate ?? 0
  snapshot.style.rotate = rotate === 0 ? 'none' : `${rotate}deg`
}


/** Returns the neutral transform value used when a trajectory omits its source bound. */
export function defaultMotionOrigin(property: string): number {
  if (property === 'opacity' || property === 'scale' || property === 'scaleX' || property === 'scaleY') return 1
  return 0
}


/** Moves a view along one axis while clipping the part outside the slot rectangle. */
export function setVerticalTravel(snapshot: MotionStyleElement, distancePercent: number): void {
  const distance = clampProgress(Math.abs(distancePercent) / 100) * 100
  snapshot.style.translate = `0 ${distancePercent}%`
  snapshot.style.clipPath = distancePercent < 0
    ? `inset(${distance}% 0 0 0)`
    : `inset(0 0 ${distance}% 0)`
}

type MotionStyleElement = HTMLElement | SVGElement


/** Clamps one sampled progress value to its normalized interval. */
export function clampProgress(progress: number): number {
  return Math.min(1, Math.max(0, progress))
}
