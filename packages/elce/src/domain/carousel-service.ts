import { CAROUSEL_CONFIG } from '../config/document-config'
import type { CarouselPlaybackMode, CarouselTransition } from '../config/document-config-types'
import type { BdcId } from './document-types'
import type { CarouselAspectRatio, CarouselContent } from './carousel-types'

/** Owns Carousel playback settings and its ordered Card relationships. */
export class ElceCarouselService {
  /** Creates default playback settings with one initial Card child. */
  public createDefault(initialCardBdcId: BdcId): CarouselContent {
    return {
      defaultViewDurationMs: CAROUSEL_CONFIG.defaultViewDurationMs,
      playbackMode: CAROUSEL_CONFIG.defaultPlaybackMode,
      repeatCount: CAROUSEL_CONFIG.defaultRepeatCount,
      aspectRatio: CAROUSEL_CONFIG.defaultAspectRatio,
      transition: CAROUSEL_CONFIG.defaultTransition,
      cards: [{ bdcId: initialCardBdcId, durationMs: null }],
    }
  }

  /** Adds a Card relationship at the end of the Carousel sequence. */
  public addCard(content: CarouselContent, bdcId: BdcId): CarouselContent {
    return { ...content, cards: [...content.cards, { bdcId, durationMs: null }] }
  }

  /** Removes one Card relationship while retaining at least one presentation. */
  public removeCard(content: CarouselContent, bdcId: BdcId): CarouselContent {
    if (content.cards.length <= 1) return content
    return { ...content, cards: content.cards.filter((entry) => entry.bdcId !== bdcId) }
  }

  /** Reorders a Card relationship before the requested sequence index. */
  public moveCard(content: CarouselContent, bdcId: BdcId, index: number): CarouselContent {
    const sourceIndex = content.cards.findIndex((entry) => entry.bdcId === bdcId)
    if (sourceIndex < 0) return content
    const cards = [...content.cards]
    const [entry] = cards.splice(sourceIndex, 1)
    if (entry === undefined) return content
    cards.splice(Math.max(0, Math.min(index, cards.length)), 0, entry)
    return { ...content, cards }
  }

  /** Changes the shared automatic duration used by entries without an override. */
  public setDefaultViewDuration(content: CarouselContent, durationMs: number): CarouselContent {
    return { ...content, defaultViewDurationMs: durationMs }
  }

  /** Sets or clears one Card entry's duration override. */
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
    return { ...content, transition }
  }

  /** Validates Carousel settings and unique ordered Card relationships. */
  public assertValid(content: CarouselContent): void {
    if (content.cards.length === 0) throw new Error('Un BDC Carousel doit contenir au moins une carte.')
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
    const cardBdcIds = content.cards.map((entry) => entry.bdcId)
    if (new Set(cardBdcIds).size !== cardBdcIds.length) {
      throw new Error('Un BDC Carte ne peut apparaître qu’une fois dans un Carousel.')
    }
    for (const entry of content.cards) {
      if (entry.durationMs !== null && (!Number.isFinite(entry.durationMs) || entry.durationMs <= 0)) {
        throw new Error(`La durée de la carte ${entry.bdcId} doit être positive.`)
      }
    }
  }
}
