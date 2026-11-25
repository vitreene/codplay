// CapsuleBounds — resolves the entry/exit bounds of every child of a capsule tree, once, for every
// caller (an editor timeline preview and a scene builder read the same result). Pure computation,
// primitive inputs only, no editor type. Contract: `specs/capsule-distribution-spec.md` §5–§7.
import { resolveAutoCapsuleDefaults } from '../config/default-config'
import { DEFAULT_AUTO_CAPSULE_EVENT_DEFINITIONS } from '../config/event-definitions'
import type { AutoCapsuleType } from '../types/public'
import { CapsuleDistribution, type ChildInput } from './capsule-distribution'
import { CapsulePreset, type CapsuleDistributionSetting } from './capsule-preset'
import { TransitionTiming } from './transition-timing'

/** Author-explicit entry or exit transition of one bound. A `cut`/`--` transition has duration `0`. */
export type BoundTransitionInput = Readonly<{ ref: string | null; durationMs: number }>

/**
 * One authored bound. Locked: the author fixed its instant. Linked: the author owns the bound's own
 * attributes (here, its transition) while its instant stays computed by the parent capsule.
 */
export type BoundInput =
  | Readonly<{ timeMs: number; transition?: BoundTransitionInput }>
  | Readonly<{ linked: true; transition?: BoundTransitionInput }>

/** One child of a capsule; `capsule` is present when the child is itself a capsule. */
export type BoundsNodeInput = Readonly<{
  id: string
  /** First bound; absent when the bound is implicit (fully inherited). */
  intro?: BoundInput
  /** Last bound; absent when the bound is implicit (fully inherited). */
  outro?: BoundInput
  capsule?: BoundsCapsuleInput
}>

export type BoundsCapsuleInput = Readonly<{
  kind: AutoCapsuleType
  distribution?: CapsuleDistributionSetting
  /** Capsule-level default transition refs; unset falls back to the type, then global default. */
  defaultTransitionIn?: string | null
  defaultTransitionOut?: string | null
  /** Children in their distribution order. */
  children: readonly BoundsNodeInput[]
}>

export type CapsuleBoundsInput = Readonly<{
  /** Scene duration; the root window ends at the later of this value and the last root bound. */
  durationMs: number
  order?: 'forward' | 'backward'
  /** Implicit scene root capsule: it has no bounds of its own and never fuses its children's edges. */
  root: BoundsCapsuleInput
}>

export type ResolvedBoundTransition = Readonly<{
  /** `fused`: the bound sits on its capsule's window edge, the capsule's own transition covers it. */
  source: 'explicit' | 'default' | 'fused'
  /** Event ref; `null` when no transition plays (no default outro for the type). */
  ref: string | null
  durationMs: number
}>

export type ResolvedBound = Readonly<{
  /** Keyframe instant: end of the entry transition for an intro, start of the exit transition for an outro. */
  timeMs: number
  origin: 'implicit' | 'linked' | 'locked'
  transition: ResolvedBoundTransition
}>

/** Presence interval: from the start of the entry transition to the end of the exit transition. */
export type BoundsWindow = Readonly<{ startMs: number; endMs: number }>

export type ResolvedNodeBounds = Readonly<{
  id: string
  intro: ResolvedBound
  outro: ResolvedBound
  window: BoundsWindow
  /** `false` when the child falls outside its capsule window. */
  visible: boolean
}>

/** One capsule's own distribution result; `minDurationMs` is relative to `window.startMs`. */
export type ResolvedCapsuleBounds = Readonly<{ window: BoundsWindow; minDurationMs: number }>

export type CapsuleBoundsDiagnostic = Readonly<{
  code: 'distribution-unresolved'
  /** `null` for the scene root. */
  capsuleId: string | null
  kind: AutoCapsuleType
  childCount: number
  message: string
}>

export type CapsuleBoundsOutput = Readonly<{
  /** Builder-only lead-in before the author's time `0`; every time above is in author time. */
  preRollMs: number
  root: ResolvedCapsuleBounds | undefined
  nodes: ReadonlyMap<string, ResolvedNodeBounds>
  capsules: ReadonlyMap<string, ResolvedCapsuleBounds>
  diagnostics: readonly CapsuleBoundsDiagnostic[]
}>

/** Tolerance for "the bound sits on its capsule's window edge" with computed fractional times. */
const EDGE_EPSILON_MS = 1e-6

type CapsuleDefaults = Readonly<{ intro: ResolvedBoundTransition; outro: ResolvedBoundTransition }>

export class CapsuleBounds {
  /** Resolves every bound of the capsule tree, from the scene root down to the leaves. */
  static resolve(input: CapsuleBoundsInput): CapsuleBoundsOutput {
    const preRollMs = CapsuleBounds.computePreRollMs(input.root)
    const nodes = new Map<string, ResolvedNodeBounds>()
    const capsules = new Map<string, ResolvedCapsuleBounds>()
    const diagnostics: CapsuleBoundsDiagnostic[] = []
    const lastRootBoundMs = input.root.children.reduce((max, child) => Math.max(max, lockedTime(child.outro) ?? lockedTime(child.intro) ?? max), 0)
    const rootWindow = { startMs: -preRollMs, endMs: Math.max(input.durationMs, lastRootBoundMs) }

    const resolveCapsule = (capsuleId: string | null, capsule: BoundsCapsuleInput, window: BoundsWindow): ResolvedCapsuleBounds | undefined => {
      const preset = CapsulePreset.find({ capsuleType: capsule.kind, distribution: capsule.distribution })
      if (preset === undefined) {
        diagnostics.push({
          code: 'distribution-unresolved',
          capsuleId,
          kind: capsule.kind,
          childCount: capsule.children.length,
          message: `Capsule type '${capsule.kind}' has no structural distribution; an explicit distribution is required.`,
        })
        return undefined
      }
      const fuses = capsuleId !== null
      const defaults = capsuleDefaults(capsule)
      const clipDurationMs = window.endMs - window.startMs
      // A locked bound fuses when its authored instant sits on the window edge; a computed bound
      // fuses when its slot starts (intro) or ends (outro) on that edge.
      const introTransition = (child: BoundsNodeInput, slotIntroMs: number) => {
        const lockedMs = lockedTime(child.intro)
        const onEdge = lockedMs === undefined ? slotIntroMs : lockedMs - window.startMs
        return effectiveTransition(child.intro, defaults.intro, fuses && Math.abs(onEdge) <= EDGE_EPSILON_MS)
      }
      const outroTransition = (child: BoundsNodeInput, slotOutroMs: number) => {
        const lockedMs = lockedTime(child.outro)
        const onEdge = lockedMs === undefined ? slotOutroMs : lockedMs - window.startMs
        return effectiveTransition(child.outro, defaults.outro, fuses && Math.abs(onEdge - clipDurationMs) <= EDGE_EPSILON_MS)
      }

      const distribution = CapsuleDistribution.compute({
        clipDurationMs,
        ...preset,
        order: input.order,
        children: capsule.children.map((child): ChildInput => {
          const introMs = lockedTime(child.intro)
          const outroMs = lockedTime(child.outro)
          return {
            trackId: child.id,
            lockedIntroMs: introMs === undefined
              ? undefined
              : TransitionTiming.lockedIntroMs({
                timeMs: introMs - window.startMs,
                transitionInDurationMs: introTransition(child, introMs - window.startMs).durationMs,
              }),
            lockedOutroMs: outroMs === undefined ? undefined : TransitionTiming.lockedOutroMs({ timeMs: outroMs - window.startMs }),
          }
        }),
      })

      capsule.children.forEach((child, index) => {
        const slot = distribution.children[index]!
        const intro = introTransition(child, slot.introMs)
        const outro = outroTransition(child, slot.outroMs)
        const resolved: ResolvedNodeBounds = {
          id: child.id,
          intro: { timeMs: window.startMs + slot.introMs + intro.durationMs, origin: boundOrigin(child.intro), transition: intro },
          outro: { timeMs: window.startMs + slot.outroMs, origin: boundOrigin(child.outro), transition: outro },
          window: { startMs: window.startMs + slot.introMs, endMs: window.startMs + slot.outroMs + outro.durationMs },
          visible: slot.visible,
        }
        nodes.set(child.id, resolved)
        if (child.capsule === undefined) return
        const nested = resolveCapsule(child.id, child.capsule, resolved.window)
        if (nested !== undefined) capsules.set(child.id, nested)
      })
      return { window, minDurationMs: distribution.minDurationMs }
    }

    const root = resolveCapsule(null, input.root, rootWindow)
    return { preRollMs, root, nodes, capsules, diagnostics }
  }

  /**
   * Scene pre-roll: the longest entry duration among locked first bounds of every level, each with
   * its explicit transition or its parent capsule's default (`TransitionTiming.computeScenePreRollMs`).
   */
  private static computePreRollMs(root: BoundsCapsuleInput): number {
    const firstKeyframes: Array<{ firstKeyframe?: { timeMs: number; transitionInDurationMs: number } }> = []
    const visit = (capsule: BoundsCapsuleInput) => {
      const defaultIntro = capsuleDefaults(capsule).intro
      for (const child of capsule.children) {
        const timeMs = lockedTime(child.intro)
        if (timeMs !== undefined) {
          firstKeyframes.push({ firstKeyframe: { timeMs, transitionInDurationMs: effectiveTransition(child.intro, defaultIntro, false).durationMs } })
        }
        if (child.capsule !== undefined) visit(child.capsule)
      }
    }
    visit(root)
    return TransitionTiming.computeScenePreRollMs(firstKeyframes)
  }
}

/** Returns the authored instant of a locked bound, `undefined` for a linked or implicit one. */
function lockedTime(bound: BoundInput | undefined): number | undefined {
  return bound !== undefined && 'timeMs' in bound ? bound.timeMs : undefined
}

/** Names the bound's placement origin. */
function boundOrigin(bound: BoundInput | undefined): ResolvedBound['origin'] {
  if (bound === undefined) return 'implicit'
  return 'timeMs' in bound ? 'locked' : 'linked'
}

/** An author's explicit transition wins; otherwise an edge bound is fused, else it takes the default. */
function effectiveTransition(bound: BoundInput | undefined, fallback: ResolvedBoundTransition, onEdge: boolean): ResolvedBoundTransition {
  if (bound?.transition !== undefined) return { source: 'explicit', ...bound.transition }
  if (onEdge) return { source: 'fused', ref: 'cut', durationMs: 0 }
  return fallback
}

/** Resolves a capsule's default entry/exit transitions with the same rule as `AutoCapsule`. */
function capsuleDefaults(capsule: BoundsCapsuleInput): CapsuleDefaults {
  const defaults = resolveAutoCapsuleDefaults(capsule.kind, {
    introTransitionRef: capsule.defaultTransitionIn,
    outroTransitionRef: capsule.defaultTransitionOut,
  })
  return {
    intro: { source: 'default', ref: defaults.introTransitionRef, durationMs: refDurationMs(defaults.introTransitionRef) },
    outro: defaults.generateDefaultOutro
      ? { source: 'default', ref: defaults.outroTransitionRef, durationMs: refDurationMs(defaults.outroTransitionRef) }
      : { source: 'default', ref: null, durationMs: 0 },
  }
}

/** Reads a default transition duration from the shared event catalog; `cut`/`--`/none last 0 ms. */
function refDurationMs(ref: string | null): number {
  if (ref === null || ref === '--') return 0
  return Math.max(0, DEFAULT_AUTO_CAPSULE_EVENT_DEFINITIONS[ref]?.durationMs ?? 0)
}
