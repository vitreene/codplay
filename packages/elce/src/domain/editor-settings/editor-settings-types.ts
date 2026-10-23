import type { BdcId, RevelationTransitionDefaults } from '../document/document-types'
import type { ELCE_EDITOR_SETTINGS } from '../../config/editor-settings'

export type ElceScrollObservationZone = Readonly<{ threshold: number }>
export type ElceCardMediaMotion = Readonly<{
  readonly fromTranslateX: string
  readonly toTranslateX: string
  readonly duration: number
  readonly ease: 'outCubic' | 'inCubic'
}>

export interface ResolvedCarouselRevelationSettings {
  readonly defaults: RevelationTransitionDefaults
  readonly entries: Readonly<Record<BdcId, RevelationTransitionDefaults>>
  readonly generateDefaultOutro: boolean
}

export interface ResolvedCardMediaMotion {
  readonly intro: ElceCardMediaMotion | null
  readonly outro: ElceCardMediaMotion | null
  readonly imageOpacity: number
  readonly suppressCardOpacityTransitionForImages: boolean
}

export type ElceResolvedPlayerSettings = typeof ELCE_EDITOR_SETTINGS.player

/** Contains every effective revelation value needed to project one page. */
export interface ElceResolvedPageSettings {
  readonly player: ElceResolvedPlayerSettings
  readonly revelation: Readonly<{
    readonly byBdcId: Readonly<Record<BdcId, RevelationTransitionDefaults>>
    readonly carouselsByBdcId: Readonly<Record<BdcId, ResolvedCarouselRevelationSettings>>
    readonly cardMediaMotionByBdcId: Readonly<Record<BdcId, ResolvedCardMediaMotion>>
    readonly cardObservationZone: ElceScrollObservationZone
    readonly graphObservation: Readonly<{
      readonly initial: 'enter'
      readonly zone: ElceScrollObservationZone
    }>
    readonly imageEntrance: Readonly<{
      readonly initial: 'enter'
      readonly zone: ElceScrollObservationZone
      readonly once: true
      readonly restingTranslateX: string
      readonly fromTranslateX: string
      readonly toTranslateX: string
      readonly duration: number
      readonly ease: 'outCubic'
    }>
  }>
}
