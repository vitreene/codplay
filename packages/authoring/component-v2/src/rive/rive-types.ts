import type { PersoInitialCommon } from 'codplay'

export type RiveClassName =
  | string
  | Readonly<{
      add?: string
      remove?: string
    }>

export type RiveInitial = PersoInitialCommon &
  Readonly<{
    src: string
    artboard?: string
    animations?: string | readonly string[]
    autoplay?: boolean
    width?: number
    height?: number
    fit?:
      | 'fill'
      | 'contain'
      | 'cover'
      | 'fitWidth'
      | 'fitHeight'
      | 'none'
      | 'scaleDown'
      | 'layout'
    alignment?:
      | 'topLeft'
      | 'topCenter'
      | 'topRight'
      | 'centerLeft'
      | 'center'
      | 'centerRight'
      | 'bottomLeft'
      | 'bottomCenter'
      | 'bottomRight'
    style?: Readonly<Record<string, unknown>>
    className?: RiveClassName
    attr?: Readonly<Record<string, unknown>>
  }>

export type RiveActionPayload = Readonly<{
  broadcast?: Readonly<{
    type: 'START' | 'PAUSE' | 'STOP'
  }>
}>

export type RiveInputValue = number | boolean

export type RiveInputValues = Readonly<Record<string, RiveInputValue>>

export type RiveStateMachineInitial = PersoInitialCommon &
  Readonly<{
    stateMachine: string
    inputs?: RiveInputValues
  }>

export type RiveStateMachineActionPayload = RiveActionPayload & Readonly<{
  inputs?: RiveInputValues
}>
