export type RevelationTransition = 'cut' | 'fade' | 'swipe-left' | 'swipe-right' | 'swipe-top' | 'swipe-down' | 'zoom'

export type RevelationTransitionRef = RevelationTransition
export type CarouselTransition = RevelationTransition

export interface RevelationTransitionDefaults {
  readonly intro: RevelationTransition
  readonly outro: RevelationTransition
}

export interface RevelationTransitionOverrides {
  readonly intro: RevelationTransition | null
  readonly outro: RevelationTransition | null
}
