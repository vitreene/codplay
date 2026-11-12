import { CAROUSEL_CONFIG } from '../carousel-config'
import { CAROUSEL_TRANSITION_OPTIONS } from '../../../revelation/revelation-config'
import { ELCE_EDITOR_SETTINGS } from '../../../../config/editor-settings'
import type { CarouselPlaybackMode } from '../carousel-config'
import type { CarouselTransition } from '../../../revelation/revelation-types'
import type { BdcId } from '../../../../core/document/content-document-types'
import type { CarouselAspectRatio, CarouselBdcEntry, CarouselContent, CarouselCueWordReference } from './carousel-types'
import type { RevelationTransitionDefaults } from '../../../revelation/revelation-types'
import { ElceEditorSettingsResolver } from '../../../../domain/editor-settings/editor-settings-resolver'

const editorSettingsResolver = new ElceEditorSettingsResolver()

/** Resolves each view's start by accumulating its authored duration. */
export function resolveCarouselViewStarts(content: CarouselContent): readonly number[] {
  return content.cards.reduce<number[]>((starts, _entry, index) => [
    ...starts,
    index === 0 ? 0 : starts[index - 1]! + (content.cards[index - 1]!.durationMs ?? content.defaultViewDurationMs),
  ], [])
}

export type LegacyCarouselContent = Omit<CarouselContent, 'cards'> & Readonly<{
  cards: readonly (Omit<CarouselBdcEntry, 'cue'> & Readonly<{
    cue?: Readonly<{ startAtMs?: number; word?: CarouselCueWordReference }>
  }>)[]
}>

/** Converts v11 absolute cue starts into persisted per-view durations. */
export function migrateLegacyCarouselCueDurations(
  content: LegacyCarouselContent,
  voiceDurationMs?: number,
): CarouselContent {
  if (!content.cards.some((entry) => entry.cue?.startAtMs !== undefined)) {
    return { ...content, cards: content.cards.map(({ cue, ...entry }) => ({
      ...entry,
      ...(cue?.word === undefined ? {} : { cue: { word: cue.word } }),
    })) }
  }
  const starts = content.cards.reduce<number[]>((times, entry, index) => [
    ...times,
    entry.cue?.startAtMs ?? (index === 0 ? 0 : times[index - 1]! + (content.cards[index - 1]!.durationMs ?? content.defaultViewDurationMs)),
  ], [])
  const cards = content.cards.map((entry, index) => {
    const startAtMs = starts[index]!
    const fallbackDuration = entry.durationMs ?? content.defaultViewDurationMs
    const endAtMs = starts[index + 1]
      ?? (voiceDurationMs !== undefined && voiceDurationMs > startAtMs ? voiceDurationMs : startAtMs + fallbackDuration)
    const durationMs = endAtMs > startAtMs ? endAtMs - startAtMs : fallbackDuration
    const { cue, ...card } = entry
    return {
      ...card,
      durationMs,
      ...(cue?.word === undefined ? {} : { cue: { word: cue.word } }),
    }
  })
  return {
    ...content,
    cards,
  }
}

/** Owns Carousel playback settings and its ordered illustration BDC relationships. */
export class ElceCarouselService {
  /** Creates default playback settings with one initial Card child. */
  public createDefault(initialCardBdcId: BdcId): CarouselContent {
    return {
      defaultViewDurationMs: CAROUSEL_CONFIG.defaultViewDurationMs,
      playbackMode: CAROUSEL_CONFIG.defaultPlaybackMode,
      repeatCount: CAROUSEL_CONFIG.defaultRepeatCount,
      aspectRatio: CAROUSEL_CONFIG.defaultAspectRatio,
      revelation: { intro: null, outro: null },
      cards: [{ bdcId: initialCardBdcId, durationMs: null, introTransitionRef: null, outroTransitionRef: null }],
    }
  }

  /** Adds one child relationship at the end of the Carousel sequence. */
  public addCard(content: CarouselContent, bdcId: BdcId): CarouselContent {
    return { ...content, cards: [...content.cards, { bdcId, durationMs: null, introTransitionRef: null, outroTransitionRef: null }] }
  }

  /** Removes one child relationship while retaining at least one presentation. */
  public removeCard(content: CarouselContent, bdcId: BdcId): CarouselContent {
    if (content.cards.length <= 1) return content
    return { ...content, cards: content.cards.filter((entry) => entry.bdcId !== bdcId) }
  }

  /** Reorders one child relationship before the requested sequence index. */
  public moveCard(content: CarouselContent, bdcId: BdcId, index: number): CarouselContent {
    const sourceIndex = content.cards.findIndex((entry) => entry.bdcId === bdcId)
    if (sourceIndex < 0) return content
    const cards = [...content.cards]
    const [entry] = cards.splice(sourceIndex, 1)
    if (entry === undefined) return content
    cards.splice(Math.max(0, Math.min(index, cards.length)), 0, entry)
    return { ...content, cards }
  }

  /** Recalculates per-view durations from word associations and free views. */
  public reconcileCueDurations(
    content: CarouselContent,
    changedBdcId: BdcId | undefined,
    resolveWordStartAt: (word: CarouselCueWordReference) => number | undefined,
    voiceDurationMs?: number,
    options: Readonly<{ clearLaterAssociationsOvertaken?: boolean }> = {},
  ): CarouselContent {
    if (voiceDurationMs === undefined && !content.cards.some((entry) => entry.cue !== undefined)) return content
    const changedIndex = changedBdcId === undefined ? -1 : content.cards.findIndex((entry) => entry.bdcId === changedBdcId)
    if (changedBdcId !== undefined && changedIndex < 0) return content
    const changedStartAtMs = changedIndex < 0 ? undefined : content.cards[changedIndex]?.cue?.word === undefined
      ? undefined : resolveWordStartAt(content.cards[changedIndex]!.cue!.word)
    const cards: readonly CarouselBdcEntry[] = content.cards.map((entry, index) => {
      if (index === 0 && entry.cue !== undefined) {
        const { cue: _cue, ...withoutCue } = entry
        return withoutCue
      }
      const laterWordStartAtMs = entry.cue?.word === undefined ? undefined : resolveWordStartAt(entry.cue.word)
      if (options.clearLaterAssociationsOvertaken === true && index > changedIndex
        && changedStartAtMs !== undefined && laterWordStartAtMs !== undefined && laterWordStartAtMs <= changedStartAtMs) {
        const { cue: _cue, ...withoutCue } = entry
        return withoutCue
      }
      return entry
    })
    const markers = cards.slice(1).reduce<Readonly<{ values: readonly Readonly<{ index: number; startAtMs: number }>[]; lastStartAtMs: number }>>(
      (result, entry, offset) => {
        const index = offset + 1
        const word = entry.cue?.word
        const startAtMs = word === undefined ? undefined : resolveWordStartAt(word)
        if (startAtMs === undefined || startAtMs <= result.lastStartAtMs) return result
        return { values: [...result.values, { index, startAtMs }], lastStartAtMs: startAtMs }
      },
      { values: [{ index: 0, startAtMs: 0 }], lastStartAtMs: 0 },
    ).values
    const durations = cards.map((entry) => entry.durationMs ?? content.defaultViewDurationMs)
    markers.slice(1).forEach((next, markerIndex) => {
      const previous = markers[markerIndex]!
      const count = next.index - previous.index
      const durationMs = (next.startAtMs - previous.startAtMs) / count
      Array.from({ length: count }, (_, offset) => previous.index + offset)
        .forEach((index) => { durations[index] = durationMs })
    })
    const lastMarker = markers.at(-1)!
    const tailCount = cards.length - lastMarker.index
    if (tailCount > 0 && voiceDurationMs !== undefined && voiceDurationMs > lastMarker.startAtMs) {
      const remainingMs = voiceDurationMs - lastMarker.startAtMs
      const tailIndices = Array.from({ length: tailCount }, (_, offset) => lastMarker.index + offset)
      const preFinalIndices = tailIndices.slice(0, -1)
      const preFinalDuration = preFinalIndices.reduce((total, index) => total + durations[index]!, 0)
      if (preFinalDuration >= remainingMs) {
        const durationMs = remainingMs / tailCount
        tailIndices.forEach((index) => { durations[index] = durationMs })
      }
      if (preFinalDuration < remainingMs) {
        const finalIndex = tailIndices.at(-1)!
        durations[finalIndex] = remainingMs - preFinalDuration
      }
    }
    return {
      ...content,
      cards: cards.map((entry, index) => ({ ...entry, durationMs: durations[index]! })),
    }
  }

  /** Changes the shared automatic duration used by entries without an override. */
  public setDefaultViewDuration(content: CarouselContent, durationMs: number): CarouselContent {
    return { ...content, defaultViewDurationMs: durationMs }
  }

  /** Sets or clears one child entry's duration override. */
  public setCardDuration(content: CarouselContent, bdcId: BdcId, durationMs: number | null): CarouselContent {
    return {
      ...content,
      cards: content.cards.map((entry) => entry.bdcId === bdcId ? { ...entry, durationMs } : entry),
    }
  }

  /** Switches between automatic and point-controlled playback. */
  public setPlaybackMode(content: CarouselContent, playbackMode: CarouselPlaybackMode): CarouselContent {
    return { ...content, playbackMode }
  }

  /** Sets the finite number of additional automatic Carousel passes. */
  public setRepeatCount(content: CarouselContent, repeatCount: number): CarouselContent {
    return { ...content, repeatCount }
  }

  /** Updates the Carousel frame ratio without changing Card content. */
  public setAspectRatio(content: CarouselContent, aspectRatio: CarouselAspectRatio): CarouselContent {
    return { ...content, aspectRatio }
  }

  /** Changes the transition used by the Carousel sequence. */
  public setTransition(content: CarouselContent, transition: CarouselTransition): CarouselContent {
    return { ...content, revelation: ELCE_EDITOR_SETTINGS.revelation.transitionPairs[transition] }
  }

  /** Resolves the one author-facing pair that matches the effective enter and exit refs. */
  public transitionPreset(
    content: CarouselContent,
    projectDefaults: RevelationTransitionDefaults,
  ): CarouselTransition | null {
    const resolved = editorSettingsResolver.resolveOverrides(projectDefaults, content.revelation)
    const entry = Object.entries(ELCE_EDITOR_SETTINGS.revelation.transitionPairs)
      .find(([, pair]) => pair.intro === resolved.intro && pair.outro === resolved.outro)
    return entry?.[0] as CarouselTransition | undefined ?? null
  }

  /** Validates Carousel settings and unique ordered child BDC relationships. */
  public assertValid(content: CarouselContent): void {
    if (content.cards.length === 0) throw new Error('Un BDC Carousel doit contenir au moins une vue.')
    if (!Number.isFinite(content.defaultViewDurationMs) || content.defaultViewDurationMs <= 0) {
      throw new Error('La durée par défaut d’une vue Carousel doit être positive.')
    }
    const repeatCount = content.repeatCount ?? CAROUSEL_CONFIG.defaultRepeatCount
    if (!Number.isInteger(repeatCount)
      || repeatCount < CAROUSEL_CONFIG.minimumRepeatCount
      || repeatCount > CAROUSEL_CONFIG.maximumRepeatCount) {
      throw new Error(`Le nombre de répétitions Carousel doit être compris entre ${CAROUSEL_CONFIG.minimumRepeatCount} et ${CAROUSEL_CONFIG.maximumRepeatCount}.`)
    }
    if (!Number.isFinite(content.aspectRatio.width) || !Number.isFinite(content.aspectRatio.height)
      || content.aspectRatio.width <= 0 || content.aspectRatio.height <= 0) {
      throw new Error('Le ratio du Carousel doit avoir deux valeurs positives.')
    }
    const childBdcIds = content.cards.map((entry) => entry.bdcId)
    if (new Set(childBdcIds).size !== childBdcIds.length) {
      throw new Error('Un même BDC ne peut apparaître qu’une fois dans un Carousel.')
    }
    for (const entry of content.cards) {
      if (entry.durationMs !== null && (!Number.isFinite(entry.durationMs) || entry.durationMs <= 0)) {
        throw new Error(`La durée de la vue ${entry.bdcId} doit être positive.`)
      }
      assertTransitionOverride(entry.introTransitionRef)
      assertTransitionOverride(entry.outroTransitionRef)
    }
    assertTransitionOverride(content.revelation.intro)
    assertTransitionOverride(content.revelation.outro)
  }
}

/** Validates an optional Capsule Automation reference without constraining inheritance. */
function assertTransitionOverride(reference: CarouselContent['revelation']['intro']): void {
  switch (reference) {
    case null:
      return
    default:
      switch (CAROUSEL_TRANSITION_OPTIONS.some((option) => option.value === reference)) {
        case true:
          return
        case false:
          throw new Error(`Référence de transition inconnue : ${reference}`)
      }
  }
}
