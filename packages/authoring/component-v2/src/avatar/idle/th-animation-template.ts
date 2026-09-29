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

type TemplateCycle = Readonly<{
  times: readonly number[]
  targets: Readonly<Record<string, readonly (number | null)[]>>
  endAt: number
}>

/** Holds the completed cycle and random stream of one Play loop. */
export type ThTemplateCursor = {
  lastElapsedMs: number
  random: RandomSource | undefined
  state: Record<string, number>
  markers: { startAt: number; value: number }[]
  cycleStartAt: number
  cycleIndex: number
  cycleMarkerIndex: number
  interruptionIndex: number
  activeCycle: TemplateCycle | undefined
}

/** Creates a private cursor; Seek uses a fresh cursor or the pure evaluator. */
export function createThTemplateCursor(): ThTemplateCursor {
  return {
    lastElapsedMs: -1,
    random: undefined,
    state: {},
    markers: [],
    cycleStartAt: 0,
    cycleIndex: 0,
    cycleMarkerIndex: 1,
    interruptionIndex: 0,
    activeCycle: undefined,
  }
}

/** Samples one looped TalkingHead template at an absolute elapsed time. */
export function sampleLoopedTemplate(
  template: ThAnimationTemplate,
  elapsedMs: number,
  seed: number,
  baseline: Readonly<Record<string, number>> = {},
  initialValues: Readonly<Record<string, number>> = {},
  cursor?: ThTemplateCursor,
): Readonly<Record<string, number>> {
  return cursor === undefined
    ? sampleLoopedTemplates(() => template, elapsedMs, seed, baseline, initialValues).values
    : sampleLoopedTemplatesLive(() => template, elapsedMs, seed, baseline, initialValues, undefined, cursor).values
}

/** Samples a loop whose template is selected anew for every native cycle. */
export function sampleLoopedAlternatives(
  alternatives: readonly ThTemplateAlternative[],
  elapsedMs: number,
  seed: number,
  baseline: Readonly<Record<string, number>> = {},
  initialValues: Readonly<Record<string, number>> = {},
  interruptions: readonly Readonly<{ channel: string; at: number; value: number }>[] = [],
  cursor?: ThTemplateCursor,
): Readonly<Record<string, number>> {
  if (alternatives.length === 0) return {}
  const choose = (random: RandomSource): ThAnimationTemplate => chooseAlternative(alternatives, random)
  return cursor === undefined
    ? sampleLoopedTemplates(choose, elapsedMs, seed, baseline, initialValues, undefined, interruptions).values
    : sampleLoopedTemplatesLive(choose, elapsedMs, seed, baseline, initialValues, undefined, cursor, interruptions).values
}

/** Samples one alternative loop and its discrete native control occurrences. */
export function sampleLoopedAlternativeMarkers(
  alternatives: readonly ThTemplateAlternative[],
  elapsedMs: number,
  seed: number,
  markerName: string,
  baseline: Readonly<Record<string, number>> = {},
  initialValues: Readonly<Record<string, number>> = {},
  cursor?: ThTemplateCursor,
): Readonly<{
  values: Readonly<Record<string, number>>
  markers: readonly Readonly<{ startAt: number; value: number }>[]
}> {
  if (alternatives.length === 0) return { values: {}, markers: [] }
  const choose = (random: RandomSource): ThAnimationTemplate => chooseAlternative(alternatives, random)
  return cursor === undefined
    ? sampleLoopedTemplates(choose, elapsedMs, seed, baseline, initialValues, markerName)
    : sampleLoopedTemplatesLive(choose, elapsedMs, seed, baseline, initialValues, markerName, cursor)
}

/** Advances only newly completed TH cycles while retaining their final values. */
function sampleLoopedTemplatesLive(
  resolveTemplate: (random: RandomSource) => ThAnimationTemplate,
  elapsedMs: number,
  seed: number,
  baseline: Readonly<Record<string, number>>,
  initialValues: Readonly<Record<string, number>>,
  markerName: string | undefined,
  cursor: ThTemplateCursor,
  interruptions: readonly Readonly<{ channel: string; at: number; value: number }>[] = [],
): Readonly<{
  values: Readonly<Record<string, number>>
  markers: readonly Readonly<{ startAt: number; value: number }>[]
}> {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return { values: {}, markers: [] }
  if (elapsedMs < cursor.lastElapsedMs) Object.assign(cursor, createThTemplateCursor())
  cursor.lastElapsedMs = elapsedMs
  cursor.random ??= createRandomSource(seed)

  while (cursor.cycleIndex < 10_000) {
    if (cursor.activeCycle === undefined) {
      const template = resolveTemplate(cursor.random)
      for (const name of Object.keys(template.vs)) {
        if (!(name in cursor.state)) cursor.state[name] = initialValues[name] ?? baseline[name] ?? 0
      }
      cursor.activeCycle = createTemplateCycle(template, cursor.cycleStartAt, baseline, cursor.random)
    }
    const active = cursor.activeCycle
    const values = { ...cursor.state }
    while (interruptions[cursor.interruptionIndex]?.at < cursor.cycleStartAt) {
      cursor.interruptionIndex += 1
    }
    let interruption: Readonly<{ channel: string; at: number; value: number }> | undefined
    for (let index = cursor.interruptionIndex; index < interruptions.length; index += 1) {
      const candidate = interruptions[index]!
      if (candidate.at > elapsedMs || candidate.at > active.endAt) break
      interruption = candidate
    }
    if (elapsedMs < active.times[0]!) {
      if (interruption !== undefined) values[interruption.channel] = interruption.value
      return { values, markers: cursor.markers }
    }
    if (markerName !== undefined) {
      const targets = active.targets[markerName] ?? []
      while (cursor.cycleMarkerIndex < targets.length
        && cursor.cycleMarkerIndex < active.times.length
        && active.times[cursor.cycleMarkerIndex]! <= elapsedMs) {
        const index = cursor.cycleMarkerIndex
        if (typeof targets[index] === 'number') {
          cursor.markers.push({ startAt: active.times[index]!, value: targets[index]! })
        }
        cursor.cycleMarkerIndex += 1
      }
    }
    if (elapsedMs <= active.endAt) {
      sampleTemplateChannels(active.targets, active.times, elapsedMs, values)
      if (interruption !== undefined) values[interruption.channel] = interruption.value
      return { values, markers: cursor.markers }
    }
    applyTemplateTargets(active.targets, cursor.state)
    if (interruption !== undefined) cursor.state[interruption.channel] = interruption.value
    cursor.cycleStartAt = active.endAt
    cursor.cycleIndex += 1
    cursor.cycleMarkerIndex = 1
    cursor.activeCycle = undefined
  }
  return { values: cursor.state, markers: cursor.markers }
}

/** Runs the common absolute-time evaluator for a fixed or selected template. */
function sampleLoopedTemplates(
  resolveTemplate: (random: RandomSource) => ThAnimationTemplate,
  elapsedMs: number,
  seed: number,
  baseline: Readonly<Record<string, number>>,
  initialValues: Readonly<Record<string, number>>,
  markerName?: string,
  interruptions: readonly Readonly<{ channel: string; at: number; value: number }>[] = [],
): Readonly<{
  values: Readonly<Record<string, number>>
  markers: readonly Readonly<{ startAt: number; value: number }>[]
}> {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return { values: {}, markers: [] }

  const random = createRandomSource(seed)
  const state: Record<string, number> = {}
  const markers: { startAt: number; value: number }[] = []
  let cursor = 0

  for (let cycle = 0; cycle < 10_000; cycle += 1) {
    const template = resolveTemplate(random)
    for (const name of Object.keys(template.vs)) {
      if (!(name in state)) state[name] = initialValues[name] ?? baseline[name] ?? 0
    }
    const { times, endAt, targets } = createTemplateCycle(template, cursor, baseline, random)
    const interruption = interruptions
      .filter(({ at }) => at >= cursor && at <= endAt && at <= elapsedMs)
      .sort((left, right) => right.at - left.at)[0]
    if (elapsedMs < times[0]!) {
      if (interruption !== undefined) state[interruption.channel] = interruption.value
      return { values: state, markers }
    }
    if (markerName !== undefined) {
      const values = targets[markerName] ?? []
      for (let index = 1; index < values.length && index < times.length; index += 1) {
        const value = values[index]
        const startAt = times[index]!
        if (typeof value === 'number' && startAt <= elapsedMs) {
          markers.push({ startAt, value })
        }
      }
    }
    if (elapsedMs <= endAt) {
      sampleTemplateChannels(targets, times, elapsedMs, state)
      if (interruption !== undefined) state[interruption.channel] = interruption.value
      return { values: state, markers }
    }
    applyTemplateTargets(targets, state)
    if (interruption !== undefined) state[interruption.channel] = interruption.value
    cursor = endAt
  }

  return { values: state, markers }
}

/** Draws the same delay, segment durations and targets for Play and Seek. */
function createTemplateCycle(
  template: ThAnimationTemplate,
  startAt: number,
  baseline: Readonly<Record<string, number>>,
  random: RandomSource,
): TemplateCycle {
  const delay = sampleTemplateNumber(template.delay ?? 0, random)
  const times = [startAt + delay]
  for (const duration of template.dt ?? inferInstantDurations(template.vs)) {
    times.push(times[times.length - 1]! + Math.max(0, sampleTemplateNumber(duration, random)))
  }
  return {
    times,
    endAt: times[times.length - 1]!,
    targets: sampleTemplateTargets(template.vs, baseline, random),
  }
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
