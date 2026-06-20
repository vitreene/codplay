export type RiveInitial = {
  src: string
  artboard?: string
  width?: number
  height?: number
  style?: Record<string, unknown>
  className?: string | { add?: string; remove?: string }
  attr?: Record<string, unknown>
  move?: { parentId: string }
}

export type RiveStateMachineInitial = RiveInitial & {
  stateMachine: string
}

export type CoachRiveInitial = RiveStateMachineInitial

export type RiveActionPayload = {
  style?: Record<string, unknown>
  className?: string | { add?: string; remove?: string }
  attr?: Record<string, unknown>
  broadcast?: { type: string }
}

export type CoachRiveActionPayload = RiveActionPayload & {
  viseme?: string | null
  emotion?: number
}
