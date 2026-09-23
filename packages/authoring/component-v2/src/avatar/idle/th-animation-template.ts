/**
 * Small absolute-time evaluator for TalkingHead animation templates.
 *
 * TalkingHead creates a fresh template instance every time a looping task
 * finishes.  This module keeps that rule while replacing its mutable queue by
 * a deterministic sample function suitable for CodPlay seek reconstruction.
 * Values returned by this evaluator are offsets from a morph baseline.
 */

import { sampleTalkingHeadEasing } from '../avatar-easing.js'
import type {
  RandomSource,
  ThAnimationTemplate,
  ThTemplateAlternative,
  ThTemplateChannel,
  ThTemplateNumber,
} from '../avatar-types.js'

/** Samples one looped TalkingHead template at an absolute elapsed time. */
export function sampleLoopedTemplate(
  template: ThAnimationTemplate,
  elapsedMs: number,
  seed: number,
  baseline: Readonly<Record<string, number>> = {},
): Readonly<Record<string, number>> {
  return sampleLoopedTemplates(
    () => template,
    elapsedMs,
    seed,
    baseline,
  )
}

/** Samples a loop whose template is selected anew for every native cycle. */
export function sampleLoopedAlternatives(
  alternatives: readonly ThTemplateAlternative[],
  elapsedMs: number,
  seed: number,
  baseline: Readonly<Record<string, number>> = {},
): Readonly<Record<string, number>> {
  if (alternatives.length === 0) return {}
  return sampleLoopedTemplates(
    (random) => chooseAlternative(alternatives, random),
    elapsedMs,
    seed,
    baseline,
  )
}

/** Runs the common absolute-time evaluator for a fixed or selected template. */
function sampleLoopedTemplates(
  resolveTemplate: (random: RandomSource) => ThAnimationTemplate,
  elapsedMs: number,
  seed: number,
  baseline: Readonly<Record<string, number>>,
): Readonly<Record<string, number>> {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return {}

  const random = createRandomSource(seed)
  const state: Record<string, number> = {}
  let cursor = 0

  for (let cycle = 0; cycle < 10_000; cycle += 1) {
    const template = resolveTemplate(random)
    for (const name of Object.keys(template.vs)) {
      if (!(name in state)) state[name] = baseline[name] ?? 0
    }
    const delay = sampleTemplateNumber(template.delay ?? 0, random)
    const times = [cursor + delay]
    const durations = template.dt ?? inferInstantDurations(template.vs)
    for (const duration of durations) {
      times.push(times[times.length - 1]! + Math.max(0, sampleTemplateNumber(duration, random)))
    }

    const endAt = times[times.length - 1]!
    const targets = sampleTemplateTargets(template.vs, baseline, random)
    if (elapsedMs < times[0]!) return state
    if (elapsedMs <= endAt) {
      sampleTemplateChannels(targets, times, elapsedMs, state)
      return state
    }
    applyTemplateTargets(targets, state)
    cursor = endAt
  }

  return state
}

/** Selects one alternative using TalkingHead's remaining-probability rule. */
function chooseAlternative(
  alternatives: readonly ThTemplateAlternative[],
  random: RandomSource,
): ThAnimationTemplate {
  const unspecified = alternatives.filter((alternative) => alternative.probability === undefined).length
  const specified = alternatives.reduce(
    (total, alternative) => total + Math.max(0, alternative.probability ?? 0),
    0,
  )
  const remaining = Math.max(0, 1 - specified)
  const coin = random.random()
  let cumulative = 0
  for (const alternative of alternatives) {
    const weight = alternative.probability === undefined
      ? (unspecified === 0 ? 0 : remaining / unspecified)
      : Math.max(0, alternative.probability)
    cumulative += weight
    if (coin < cumulative) return alternative.template
  }
  return alternatives[alternatives.length - 1]!.template
}

/** Samples every channel during one generated template cycle. */
function sampleTemplateChannels(
  channels: Readonly<Record<string, readonly (number | null)[]>>,
  times: readonly number[],
  elapsedMs: number,
  state: Record<string, number>,
): void {
  for (const [name, values] of Object.entries(channels)) {
    const value = sampleChannel(values, times, elapsedMs, state[name] ?? 0)
    if (value !== undefined) state[name] = value
  }
}

/** Samples one channel with TalkingHead's implicit zero/start value. */
function sampleChannel(
  values: readonly (number | null)[],
  times: readonly number[],
  elapsedMs: number,
  initialValue: number,
): number | undefined {
  const segmentCount = times.length - 1
  if (segmentCount <= 0 || values.length === 0 || elapsedMs < times[0]!) return undefined

  let current = initialValue

  for (let index = 0; index < segmentCount; index += 1) {
    const start = times[index]!
    const end = times[index + 1]!
    const target = values[Math.min(index + 1, values.length - 1)]
    if (target !== null && target !== undefined) {
      if (elapsedMs <= end || end <= start) {
        if (end <= start) return target
        const progress = sampleTalkingHeadEasing((elapsedMs - start) / (end - start))
        const source = values[index]
        const from = source === null || source === undefined ? current : source
        return from + (target - from) * progress
      }
      current = target
    }
    if (elapsedMs <= end) return current
  }

  return current
}

/** Creates the zero-length time slots used by templates without an explicit dt. */
function inferInstantDurations(
  channels: Readonly<Record<string, ThTemplateChannel>>,
): readonly number[] {
  const count = Object.values(channels).reduce((longest, values) => Math.max(longest, values.length), 0)
  return Array.from({ length: count }, () => 0)
}

/** Resolves all random targets once, preserving the native object iteration order. */
function sampleTemplateTargets(
  channels: Readonly<Record<string, ThTemplateChannel>>,
  baseline: Readonly<Record<string, number>>,
  random: RandomSource,
): Readonly<Record<string, readonly (number | null)[]>> {
  const targets: Record<string, readonly (number | null)[]> = {}
  for (const [name, values] of Object.entries(channels)) {
    const base = baseline[name] ?? 0
    targets[name] = [
      null,
      ...values.map((value) => value === null
        ? null
        : base + sampleTemplateNumber(value, random)),
    ]
  }
  return targets
}

/** Applies the final values of one completed template cycle to the held state. */
function applyTemplateTargets(
  channels: Readonly<Record<string, readonly (number | null)[]>>,
  state: Record<string, number>,
): void {
  for (const [name, values] of Object.entries(channels)) {
    for (let index = values.length - 1; index >= 0; index -= 1) {
      const value = values[index]
      if (value !== null && value !== undefined) {
        state[name] = value
        break
      }
    }
  }
}

/** Reproduces TalkingHead's gaussianRandom(start, end, skew, samples). */
export function sampleTemplateNumber(value: ThTemplateNumber, random: RandomSource): number {
  if (typeof value === 'number') return value
  const min = value[0] ?? 0
  const max = value[1] ?? min
  const skew = value[2] ?? 1
  const samples = Math.max(1, Math.round(value[3] ?? 5))
  let total = 0
  for (let index = 0; index < samples; index += 1) total += random.random()
  return min + Math.pow(total / samples, skew) * (max - min)
}

/** Creates the deterministic random source used by every template cycle. */
export function createRandomSource(seed: number): RandomSource {
  let state = (seed | 0) || 0x6d2b79f5
  return {
    random: () => {
      state = Math.imul(state ^ (state >>> 15), state | 1)
      state ^= state + Math.imul(state ^ (state >>> 7), state | 61)
      return ((state ^ (state >>> 14)) >>> 0) / 0x1_0000_0000
    },
  }
}
