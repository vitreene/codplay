import type { CompiledScrollObservation, CompiledScrollObservationEvent } from 'codplay/scene/compiled'

/** Numeric geometry consumed by the DOM-free progress calculation. */
export type ScrollProgressMetrics = Readonly<{
  offset: number
  extent: number
  viewportExtent: number
}>

/** One observation rule in compiled declaration order. */
export type ScrollObservationRule = Readonly<{
  id: string
  persoId: string
  storyId: string
  declaration: CompiledScrollObservation
}>

/** Normalized phase supplied by the HTML adapter for one observer callback. */
export type ScrollObservationPhase = 'inside' | 'outside'

/** DOM-free phase update accepted from one native observer batch. */
export type ScrollObservationPhaseUpdate = Readonly<{
  ruleId: string
  phase: ScrollObservationPhase
}>

/** Native visibility value paired with a phase update for one observed target. */
export type ScrollObservationUpdate = ScrollObservationPhaseUpdate & Readonly<{
  ratio: number
}>

/** One declared event selected by a stable observation phase transition. */
export type ScrollObservationEmission = Readonly<{
  ruleId: string
  persoId: string
  storyId: string
  phase: ScrollObservationPhase
  event: CompiledScrollObservationEvent
}>

/** Action selected by one observer callback without creating a journal event. */
export type ScrollObservationLiveAction = Readonly<{
  ruleId: string
  persoId: string
  storyId: string
  actionName: string
  ratio: number
}>

/** Ordered outputs selected from one native observer batch. */
export type ScrollObservationBatch = Readonly<{
  emissions: readonly ScrollObservationEmission[]
  liveActions: readonly ScrollObservationLiveAction[]
}>
