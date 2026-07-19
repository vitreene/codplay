export const SPACE_BUBBLES_WORLD = {
  width: 1000,
  height: 1000,
  turretY: 900,
  projectileY: 830,
  projectileEndY: 40,
  projectileRadius: 9,
  projectileDurationMs: 920,
} as const

export const SPACE_BUBBLES_MAX_DURATION_MS = 90000

export const SPACE_BUBBLE_COLORS = ["red", "blue", "yellow", "green"] as const

export type SpaceBubbleColor = typeof SPACE_BUBBLE_COLORS[number]

export type BubbleLevel = 0 | 1 | 2 | 3

export type BubbleOrbit = {
  centerX: number
  centerY: number
  radiusX: number
  radiusY: number
  periodMs: number
  phase: number
}

export type BubbleState = {
  id: string
  color: SpaceBubbleColor
  level: BubbleLevel
  alive: boolean
  hitRadius: number
  orbit: BubbleOrbit
}

export type ProjectileState = {
  id: string
  x: number
  startY: number
  endY: number
  firedAtMs: number
  durationMs: number
  active: boolean
}

export type TurretMotionState = {
  fromX: number
  toX: number
  startedAtMs: number
  durationMs: number
} | null

export type SpaceBubblesStatus = "intro" | "playing" | "success" | "fail"

export type SpaceBubblesState = {
  status: SpaceBubblesStatus
  seed: number
  startedAtMs: number | null
  endedAtMs: number | null
  turretX: number
  turretDragStartX: number | null
  turretMotion: TurretMotionState
  pickerActive: boolean
  pickerY: number
  pickerPassId: number
  pickerHitBubbleIds: SpaceBubbleColor[]
  maluserActive: boolean
  maluserStartedAtMs: number | null
  maluserPassId: number
  maluserHitBubbleIds: SpaceBubbleColor[]
  projectileSeq: number
  revision: number
  targetSequence: SpaceBubbleColor[]
  destructionSequence: SpaceBubbleColor[]
  failedOrder: boolean
  bubbles: Record<SpaceBubbleColor, BubbleState>
  projectile: ProjectileState | null
}

export type WorldPoint = {
  x: number
  y: number
}

export type WorldCircle = WorldPoint & {
  radius: number
}

export type WorldRect = {
  left: number
  top: number
  right: number
  bottom: number
}
