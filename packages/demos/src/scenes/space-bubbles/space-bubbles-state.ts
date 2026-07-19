import { createSpaceBubblesRunSeed, nextSeed } from "./space-bubbles-random"
import { SPACE_BUBBLE_COLORS, SPACE_BUBBLES_WORLD, type BubbleLevel, type BubbleState, type SpaceBubbleColor, type SpaceBubblesState } from "./space-bubbles-types"

const BUBBLE_ORBITS: Record<SpaceBubbleColor, BubbleState["orbit"]> = {
  red: { centerX: 500, centerY: 430, radiusX: 390, radiusY: 110, periodMs: 6080, phase: -Math.PI / 2 },
  blue: { centerX: 500, centerY: 470, radiusX: 360, radiusY: 118, periodMs: 6840, phase: Math.PI * 0.38 },
  yellow: { centerX: 500, centerY: 405, radiusX: 410, radiusY: 106, periodMs: 6570, phase: Math.PI * 0.63 },
  green: { centerX: 500, centerY: 515, radiusX: 340, radiusY: 120, periodMs: 7310, phase: Math.PI * 1.37 },
}

const TARGET_SEQUENCE: SpaceBubbleColor[] = ["red", "blue", "yellow", "green"]

/** Resolves the rendered scale for one bubble level. */
export function resolveBubbleLevelScale(level: BubbleLevel): number {
  if (level === 3) return 1.12
  if (level === 2) return 0.72
  if (level === 1) return 0.48
  return 0
}

/** Creates the four initial logical bubbles. */
export function createInitialBubbles(): Record<SpaceBubbleColor, BubbleState> {
  return Object.fromEntries(SPACE_BUBBLE_COLORS.map((color) => [
    color,
    {
      id: `bubble-${color}`,
      color,
      level: 3,
      alive: true,
      hitRadius: 78,
      orbit: BUBBLE_ORBITS[color],
    },
  ])) as Record<SpaceBubbleColor, BubbleState>
}

/** Creates one fresh deterministic game state. */
export function createInitialSpaceBubblesState(startedAtMs: number, seed = createSpaceBubblesRunSeed()): SpaceBubblesState {
  return {
    status: "playing",
    seed: nextSeed(seed),
    startedAtMs,
    endedAtMs: null,
    turretX: SPACE_BUBBLES_WORLD.width / 2,
    turretDragStartX: null,
    turretMotion: null,
    pickerActive: false,
    pickerY: 255,
    pickerPassId: 0,
    pickerHitBubbleIds: [],
    maluserActive: false,
    maluserStartedAtMs: null,
    maluserPassId: 0,
    maluserHitBubbleIds: [],
    projectileSeq: 0,
    revision: 1,
    targetSequence: TARGET_SEQUENCE,
    destructionSequence: [],
    failedOrder: false,
    bubbles: createInitialBubbles(),
    projectile: null,
  }
}

/** Returns true when one color is the next expected mission color. */
export function isExpectedDestruction(state: SpaceBubblesState, color: SpaceBubbleColor): boolean {
  return state.targetSequence[state.destructionSequence.length] === color
}

/** Resolves whether the current destruction sequence exactly matches the target. */
export function hasSuccessfulOrder(state: SpaceBubblesState): boolean {
  return state.destructionSequence.join(",") === state.targetSequence.join(",")
}
