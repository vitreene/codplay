import { CAROUSEL_CONFIG } from '../carousel-config'
import { CAROUSEL_TRANSITION_OPTIONS } from '../../../revelation/revelation-config'
import { ELCE_EDITOR_SETTINGS } from '../../../../config/editor-settings'
import type { CarouselPlaybackMode } from '../carousel-config'
import type { CarouselTransition } from '../../../revelation/revelation-types'
import type { BdcId } from '../../../../core/document/content-document-types'
import type { CarouselAspectRatio, CarouselContent, CarouselCueWordReference } from './carousel-types'
import type { RevelationTransitionDefaults } from '../../../revelation/revelation-types'
import { ElceEditorSettingsResolver } from '../../../../domain/editor-settings/editor-settings-resolver'

const editorSettingsResolver = new ElceEditorSettingsResolver()

/** Resolves each view's start from its cue or the existing duration settings. */
export function resolveCarouselCueStarts(content: CarouselContent): readonly number[] {
  return content.cards.reduce<number[]>((starts, entry, index) => [
    ...starts,
    entry.cue?.startAtMs ?? (index === 0 ? 0 : starts[index - 1]! + (content.cards[index - 1]!.durationMs ?? content.defaultViewDurationMs)),
  ], [])
}

/** Projects authored cue times through the Carousel's existing automatic schedule. */
export function projectCarouselCues(content: CarouselContent, voiceDurationMs?: number): CarouselContent {
  if (!content.cards.some((entry) => entry.cue !== undefined)) return content
  const starts = resolveCarouselCueStarts(content)
  if (starts[0] !== 0 || starts.some((time, index) => !Number.isInteger(time) || time < 0
    || (index > 0 && time <= starts[index - 1]!))) throw new Error('Les temps des cartes doivent commencer à zéro et être croissants.')
  if (voiceDurationMs !== undefined && starts.at(-1)! >= voiceDurationMs) throw new Error('Une carte commence après la fin du son. Ajustez ses repères.')
  return {
    ...content,
    playbackMode: 'automatic',
    repeatCount: 0,
    cards: content.cards.map((entry, index) => ({
      ...entry,
      durationMs: index < starts.length - 1 ? starts[index + 1]! - starts[index]!
        : voiceDurationMs === undefined ? entry.durationMs : voiceDurationMs - starts[index]!,
    })),
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

  /** Reconciles narrated word links and free cue times after one child is reordered. */
  public reconcileMovedCueTimes(
    content: CarouselContent,
    movedBdcId: BdcId,
    resolveWordStartAt: (word: CarouselCueWordReference) => number | undefined,
    voiceDurationMs?: number,
  ): CarouselContent {
    if (!content.cards.some((entry) => entry.cue !== undefined)) return content

    const movedIndex = content.cards.findIndex((entry) => entry.bdcId === movedBdcId)
    if (movedIndex < 0) return content
    const cards = content.cards.map((entry, index) => index === 0
      ? { ...entry, cue: { startAtMs: 0 } }
      : entry)
    const activeMarkers = new Map<number, number>([[0, 0]])
    const wordStarts = new Map<number, number>()

    cards.forEach((entry, index) => {
      const word = entry.cue?.word
      if (index === 0 || word === undefined) return
      const startAtMs = resolveWordStartAt(word)
      if (startAtMs === undefined) return
      wordStarts.set(index, startAtMs)
      if (entry.bdcId !== movedBdcId && entry.cue?.startAtMs === startAtMs) activeMarkers.set(index, startAtMs)
    })

    wordStarts.forEach((startAtMs, index) => {
      if (activeMarkers.has(index) || !wordStartFitsSequence(index, startAtMs, activeMarkers)) return
      activeMarkers.set(index, startAtMs)
    })

    const orderedMarkers = [...activeMarkers.entries()].sort(([left], [right]) => left - right)
    const starts = new Array<number>(cards.length)
    starts[0] = 0

    orderedMarkers.slice(1).forEach(([nextIndex, nextStartAtMs], markerIndex) => {
      const [previousIndex, previousStartAtMs] = orderedMarkers[markerIndex]!
      const freeIndices = Array.from({ length: nextIndex - previousIndex - 1 }, (_, index) => previousIndex + index + 1)
      assignEvenCueTimes(starts, freeIndices, previousStartAtMs, nextStartAtMs)
      starts[nextIndex] = nextStartAtMs
    })

    const [lastMarkerIndex, lastMarkerStartAtMs] = orderedMarkers.at(-1)!
    const tailIndices = Array.from({ length: cards.length - lastMarkerIndex - 1 }, (_, index) => lastMarkerIndex + index + 1)
    let previousStartAtMs = lastMarkerStartAtMs
    tailIndices.forEach((index) => {
      previousStartAtMs += cards[index - 1]!.durationMs ?? content.defaultViewDurationMs
      starts[index] = previousStartAtMs
    })
    if (voiceDurationMs !== undefined && tailIndices.length > 0 && previousStartAtMs >= voiceDurationMs) {
      assignEvenCueTimes(starts, tailIndices, lastMarkerStartAtMs, voiceDurationMs)
    }

    return {
      ...content,
      cards: cards.map((entry, index) => {
        const startAtMs = starts[index]!
        const word = entry.cue?.word
        return { ...entry, cue: word === undefined ? { startAtMs } : { startAtMs, word } }
      }),
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
    projectCarouselCues(content)
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

/** Checks whether a word start fits between its nearest active sequence markers. */
function wordStartFitsSequence(index: number, startAtMs: number, markers: ReadonlyMap<number, number>): boolean {
  const previous = [...markers.entries()]
    .filter(([markerIndex]) => markerIndex < index)
    .sort(([left], [right]) => right - left)[0]
  const next = [...markers.entries()]
    .filter(([markerIndex]) => markerIndex > index)
    .sort(([left], [right]) => left - right)[0]
  return startAtMs > (previous?.[1] ?? 0) && startAtMs < (next?.[1] ?? Number.POSITIVE_INFINITY)
}

/** Assigns free cues at even integer steps inside a fixed time interval. */
function assignEvenCueTimes(starts: number[], indices: readonly number[], startAtMs: number, endAtMs: number): void {
  if (indices.length === 0) return
  const intervalMs = endAtMs - startAtMs
  if (intervalMs <= indices.length) throw new Error('L’intervalle narré est trop court pour répartir les cartes libres.')
  indices.forEach((index, position) => {
    starts[index] = startAtMs + Math.floor(intervalMs * (position + 1) / (indices.length + 1))
  })
}
