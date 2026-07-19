import type { StrapCollection, StrapFn, StrapReturnValue } from "codplay/player/strap-types"
import { circleHitsCircle, rectHitsCircle, segmentHitsCircle } from "./space-bubbles-collisions"
import { seedToUnit } from "./space-bubbles-random"
import { FAILURE_FALL_DURATION_MS, buildBubbleImpactEvents, buildFailureFallEvents, buildGameEndEvents, buildGameStartEvents, buildImpactClearEvents, buildMaluserEndEvents, buildMaluserHitBubbleEvents, buildMaluserHitClearEvents, buildMaluserShotClearEvents, buildMaluserShotEvents, buildMaluserSpawnEvents, buildPickerEndEvents, buildPickerHeightEvents, buildPickerSpawnEvents, buildProjectileFireEvents, buildTurretMoveEvent, buildTurretRecoilClearEvents } from "./space-bubbles-render-events"
import { createInitialSpaceBubblesState, hasSuccessfulOrder, isExpectedDestruction } from "./space-bubbles-state"
import { resolveBubblePosition, resolveProjectilePosition } from "./space-bubbles-trajectories"
import { SPACE_BUBBLE_COLORS, SPACE_BUBBLES_WORLD, type BubbleState, type ProjectileState, type SpaceBubbleColor, type SpaceBubblesState, type SpaceBubblesStatus } from "./space-bubbles-types"

const TURRET_STEP = 70
const TURRET_KEYBOARD_SPEED = 520
const IMPACT_SCAN_STEP_MS = 24
const PICKER_DURATION_MS = 5200
const PICKER_CHECK_EVERY_MS = 240
const PICKER_LANE_STEP = 76
const PICKER_MIN_Y = 315
const PICKER_MAX_Y = 610
const MALUSER_DURATION_MS = 6200
const MALUSER_CHECK_EVERY_MS = 260
const MALUSER_HIT_RADIUS = 42
const FINAL_SEQUENCE_END_DELAY_MS = 2000

type ImpactCandidate =
  | { target: "bubble"; color: SpaceBubbleColor; impactAtMs: number }
  | { target: "maluser"; impactAtMs: number }

function readGameState(rawState: Readonly<Record<string, unknown>>): SpaceBubblesState | null {
  return rawState.status === "playing" || rawState.status === "intro" || rawState.status === "success" || rawState.status === "fail"
    ? rawState as SpaceBubblesState
    : null
}

function clampTurretX(x: number): number {
  return Math.max(70, Math.min(SPACE_BUBBLES_WORLD.width - 70, x))
}

function resolveTurretXAt(state: SpaceBubblesState, timelineMs: number): number {
  const motion = state.turretMotion
  if (motion === null || motion.durationMs <= 0) {
    return state.turretX
  }

  const progress = Math.max(0, Math.min(1, (timelineMs - motion.startedAtMs) / motion.durationMs))
  return clampTurretX(motion.fromX + (motion.toX - motion.fromX) * progress)
}

function resolveWorldUnitsPerClientPixel(): number {
  const worldNode = globalThis.document?.querySelector?.(".space-bubbles-world")
  if (!(worldNode instanceof Element)) {
    return 1
  }

  const rect = worldNode.getBoundingClientRect()
  return rect.width > 0 ? SPACE_BUBBLES_WORLD.width / rect.width : 1
}

function cloneBubbles(bubbles: SpaceBubblesState["bubbles"]): SpaceBubblesState["bubbles"] {
  return Object.fromEntries(SPACE_BUBBLE_COLORS.map((color) => [color, { ...bubbles[color] }])) as SpaceBubblesState["bubbles"]
}

function resolveBubbleCircle(bubble: BubbleState, timelineMs: number, startedAtMs: number) {
  const position = resolveBubblePosition(bubble, timelineMs, startedAtMs)
  return { ...position, radius: bubble.hitRadius }
}

function resolvePickerX(elapsedMs: number): number {
  const progress = Math.max(0, Math.min(1, elapsedMs / PICKER_DURATION_MS))
  return 1080 + (-120 - 1080) * progress
}

function resolveMaluserPosition(elapsedMs: number) {
  const progress = Math.max(0, Math.min(1, elapsedMs / MALUSER_DURATION_MS))
  return {
    x: -90 + (1090 + 90) * progress,
    y: 650 + (335 - 650) * progress,
  }
}

function resolveMaluserCircle(state: SpaceBubblesState, timelineMs: number) {
  if (!state.maluserActive || state.maluserStartedAtMs === null) {
    return null
  }

  const elapsedMs = timelineMs - state.maluserStartedAtMs
  if (elapsedMs < 0 || elapsedMs > MALUSER_DURATION_MS) {
    return null
  }

  return { ...resolveMaluserPosition(elapsedMs), radius: MALUSER_HIT_RADIUS }
}

function createBonusSchedule(state: SpaceBubblesState, context: Parameters<StrapFn>[0]["context"]): StrapReturnValue[] {
  const pickerDelay = 6200 + Math.round(seedToUnit(state.seed) * 1400)
  const maluserDelay = 15500 + Math.round(seedToUnit(state.seed ^ 0x9e3779b9) * 2600)
  return [
    context.planned.delay(pickerDelay, { event: { name: "space:picker:spawn" } }),
    context.planned.delay(maluserDelay, { event: { name: "space:maluser:spawn" } }),
  ]
}

function findFirstProjectileImpact(state: SpaceBubblesState, projectile: ProjectileState): ImpactCandidate | null {
  if (state.startedAtMs === null) {
    return null
  }

  let earliest: ImpactCandidate | null = null
  for (let localMs = IMPACT_SCAN_STEP_MS; localMs <= projectile.durationMs; localMs += IMPACT_SCAN_STEP_MS) {
    const fromMs = projectile.firedAtMs + localMs - IMPACT_SCAN_STEP_MS
    const toMs = projectile.firedAtMs + localMs
    const from = resolveProjectilePosition(projectile, fromMs)
    const to = resolveProjectilePosition(projectile, toMs)

    for (const color of SPACE_BUBBLE_COLORS) {
      const bubble = state.bubbles[color]
      if (!bubble.alive) {
        continue
      }

      const circle = resolveBubbleCircle(bubble, toMs, state.startedAtMs)
      if (segmentHitsCircle(from, to, { ...circle, radius: circle.radius + SPACE_BUBBLES_WORLD.projectileRadius })) {
        earliest = { target: "bubble", color, impactAtMs: toMs }
        break
      }
    }

    if (earliest !== null) {
      return earliest
    }

    const maluserCircle = resolveMaluserCircle(state, toMs)
    if (maluserCircle !== null && segmentHitsCircle(from, to, { ...maluserCircle, radius: maluserCircle.radius + SPACE_BUBBLES_WORLD.projectileRadius })) {
      return { target: "maluser", impactAtMs: toMs }
    }
  }

  return null
}

function startGameStrap(): StrapFn {
  return ({ meta, context }) => {
    const startedAtMs = meta.ms ?? 0
    const state = createInitialSpaceBubblesState(startedAtMs)
    return [
      {
        update: state as unknown as Record<string, unknown>,
        events: buildGameStartEvents(state),
      },
      ...createBonusSchedule(state, context),
    ]
  }
}

function moveTurretStrap(direction: -1 | 1): StrapFn {
  return ({ state }) => {
    const gameState = readGameState(state)
    if (gameState === null || gameState.status !== "playing") {
      return undefined
    }

    if (gameState.pickerActive) {
      const pickerY = Math.max(PICKER_MIN_Y, Math.min(PICKER_MAX_Y, gameState.pickerY + direction * PICKER_LANE_STEP))
      return {
        update: { pickerY, revision: gameState.revision + 1 },
        events: buildPickerHeightEvents(pickerY),
      }
    }

    const turretX = clampTurretX(gameState.turretX + direction * TURRET_STEP)
    return {
      update: { turretX },
      events: [buildTurretMoveEvent(turretX)],
    }
  }
}

function moveTurretFromCapture(direction: -1 | 1): StrapFn {
  return ({ event, state, context }) => {
    const gameState = readGameState(state)
    if (gameState === null || gameState.status !== "playing") {
      return undefined
    }

    const elapsedMs = typeof event.data?.elapsedMs === "number" ? event.data.elapsedMs : 0
    const baseX = typeof event.data?.baseX === "number" ? event.data.baseX : gameState.turretX
    const turretX = clampTurretX(baseX + direction * TURRET_KEYBOARD_SPEED * (elapsedMs / 1000))
    context.api.setNodePose("space-turret", { x: turretX })
    return {
      update: { turretX, turretMotion: null },
    }
  }
}

function movePickerStrap(direction: -1 | 1): StrapFn {
  return ({ state }) => {
    const gameState = readGameState(state)
    if (gameState === null || gameState.status !== "playing" || !gameState.pickerActive) {
      return undefined
    }

    const pickerY = Math.max(PICKER_MIN_Y, Math.min(PICKER_MAX_Y, gameState.pickerY + direction * PICKER_LANE_STEP))
    return {
      update: { pickerY, revision: gameState.revision + 1 },
      events: buildPickerHeightEvents(pickerY),
    }
  }
}

const turretDragStartStrap: StrapFn = ({ state, meta }) => {
  const gameState = readGameState(state)
  if (gameState === null || gameState.status !== "playing") {
    return undefined
  }

  const turretX = resolveTurretXAt(gameState, meta.ms ?? 0)
  return {
    update: { turretX, turretDragStartX: turretX, turretMotion: null },
    events: [buildTurretMoveEvent(turretX, { fromX: turretX, durationMs: 0, ease: "linear" })],
  }
}

const turretDragStrap: StrapFn = ({ event, state }) => {
  const gameState = readGameState(state)
  if (gameState === null || gameState.status !== "playing") {
    return undefined
  }

  const dx = typeof event.data?.dx === "number" ? event.data.dx : 0
  const baseX = gameState.turretDragStartX ?? gameState.turretX
  const turretX = clampTurretX(baseX + dx * resolveWorldUnitsPerClientPixel())
  return {
    update: { turretX, turretMotion: null },
    events: [buildTurretMoveEvent(turretX, { durationMs: 0, ease: "linear" })],
  }
}

const turretDragEndStrap: StrapFn = () => ({ update: { turretDragStartX: null } })

const fireStrap: StrapFn = ({ state, meta, context }) => {
  const gameState = readGameState(state)
  if (gameState === null || gameState.status !== "playing") {
    return undefined
  }

  const nowMs = meta.ms ?? 0
  const projectileStillFlying = gameState.projectile?.active === true && nowMs <= gameState.projectile.firedAtMs + gameState.projectile.durationMs + 80
  if (projectileStillFlying) {
    return undefined
  }

  const turretX = resolveTurretXAt(gameState, nowMs)
  const projectile: ProjectileState = {
    id: `shot-${gameState.projectileSeq + 1}`,
    x: turretX,
    startY: SPACE_BUBBLES_WORLD.projectileY,
    endY: SPACE_BUBBLES_WORLD.projectileEndY,
    firedAtMs: nowMs,
    durationMs: SPACE_BUBBLES_WORLD.projectileDurationMs,
    active: true,
  }
  const nextRevision = gameState.revision + 1
  const nextState: Partial<SpaceBubblesState> = {
    projectile,
    projectileSeq: gameState.projectileSeq + 1,
    turretX,
    revision: nextRevision,
  }
  const events = buildProjectileFireEvents(projectile.x, projectile.durationMs)
  const planned: StrapReturnValue[] = [
    {
      update: nextState as Record<string, unknown>,
      events,
    },
    context.planned.delay(140, { event: { name: "space:turret:recoil-clear" } }),
  ]

  const impact = findFirstProjectileImpact({ ...gameState, ...nextState } as SpaceBubblesState, projectile)
  if (impact === null) {
    planned.push(context.planned.delay(projectile.durationMs, {
      event: { name: "space:projectile:clear", data: { projectileId: projectile.id, revision: nextRevision } },
    }))
    return planned
  }

  planned.push(context.planned.delay(Math.max(0, impact.impactAtMs - nowMs), {
      event: {
        name: "space:projectile:impact-check",
        data: impact.target === "bubble"
          ? { projectileId: projectile.id, target: impact.target, bubbleColor: impact.color, revision: nextRevision }
          : { projectileId: projectile.id, target: impact.target, revision: nextRevision },
      },
    }))
  return planned
}

const clearProjectileStrap: StrapFn = ({ event, state }) => {
  const gameState = readGameState(state)
  if (gameState === null || gameState.projectile === null) {
    return undefined
  }

  if (event.data?.projectileId !== gameState.projectile.id) {
    return undefined
  }

  return {
    update: { projectile: null, revision: gameState.revision + 1 },
    events: [{ name: "space:projectile:hide", data: { style: { opacity: 0 } } }],
  }
}

const impactCheckStrap: StrapFn = ({ event, state, meta, context }) => {
  const gameState = readGameState(state)
  const bubbleColor = event.data?.bubbleColor as SpaceBubbleColor | undefined
  if (
    gameState === null ||
    gameState.status !== "playing" ||
    gameState.projectile === null ||
    event.data?.projectileId !== gameState.projectile.id ||
    gameState.startedAtMs === null
  ) {
    return undefined
  }

  const nowMs = meta.ms ?? 0
  const projectilePosition = resolveProjectilePosition(gameState.projectile, nowMs)
  if (event.data?.target === "maluser") {
    const maluserCircle = resolveMaluserCircle(gameState, nowMs)
    const isStillHit = maluserCircle !== null && circleHitsCircle(
      { ...projectilePosition, radius: SPACE_BUBBLES_WORLD.projectileRadius },
      maluserCircle,
    )
    if (!isStillHit) {
      return {
        update: { projectile: null, revision: gameState.revision + 1 },
        events: [{ name: "space:projectile:hide", data: { style: { opacity: 0 } } }],
      }
    }

    return [
      {
        update: { projectile: null, maluserActive: false, maluserStartedAtMs: null, revision: gameState.revision + 1 },
        events: buildMaluserShotEvents(projectilePosition),
      },
      context.planned.delay(220, { event: { name: "space:maluser:hit-clear" } }),
    ]
  }

  if (bubbleColor === undefined || !SPACE_BUBBLE_COLORS.includes(bubbleColor)) {
    return undefined
  }

  const bubble = gameState.bubbles[bubbleColor]
  if (!bubble.alive) {
    return undefined
  }

  const bubbleCircle = resolveBubbleCircle(bubble, nowMs, gameState.startedAtMs)
  const isStillHit = circleHitsCircle(
    { ...projectilePosition, radius: SPACE_BUBBLES_WORLD.projectileRadius },
    bubbleCircle,
  )
  if (!isStillHit) {
    return {
      update: { projectile: null, revision: gameState.revision + 1 },
      events: [{ name: "space:projectile:hide", data: { style: { opacity: 0 } } }],
    }
  }

  const bubbles = cloneBubbles(gameState.bubbles)
  const nextLevel = Math.max(0, bubble.level - 1) as BubbleState["level"]
  const destroyed = nextLevel === 0
  const accomplished = destroyed && isExpectedDestruction(gameState, bubbleColor)
  bubbles[bubbleColor] = {
    ...bubble,
    level: nextLevel,
    alive: !destroyed,
  }

  const destructionSequence = destroyed ? [...gameState.destructionSequence, bubbleColor] : gameState.destructionSequence
  const failedOrder = gameState.failedOrder || (destroyed && !accomplished)
  const allDestroyed = SPACE_BUBBLE_COLORS.every((color) => !bubbles[color].alive)
  const shouldEndNow = allDestroyed || failedOrder
  const partialState: Partial<SpaceBubblesState> = {
    bubbles,
    destructionSequence,
    failedOrder,
    projectile: null,
    revision: gameState.revision + 1,
  }

  let status: SpaceBubblesStatus = gameState.status
  let endedAtMs = gameState.endedAtMs
  if (shouldEndNow) {
    const finalState = { ...gameState, ...partialState, endedAtMs: nowMs } as SpaceBubblesState
    status = allDestroyed && !failedOrder && hasSuccessfulOrder(finalState) ? "success" : "fail"
    endedAtMs = nowMs
    partialState.status = status
    partialState.endedAtMs = endedAtMs
  }

  const nextState = { ...gameState, ...partialState } as SpaceBubblesState
  const endEvents = shouldEndNow
    ? nextState.status === "fail"
      ? buildFailureFallEvents(nextState)
      : buildGameEndEvents(nextState)
    : []
  const result: StrapReturnValue[] = [
    {
      update: partialState as Record<string, unknown>,
      events: [
        ...buildBubbleImpactEvents({ color: bubbleColor, point: projectilePosition, nextLevel, destroyed, accomplished }),
        ...endEvents,
      ],
    },
    context.planned.delay(220, { event: { name: "space:impact:clear", data: { bubbleColor } } }),
  ]
  if (shouldEndNow && nextState.status === "fail") {
    result.push(context.planned.delay(FAILURE_FALL_DURATION_MS, { event: { name: "space:game:final-message" } }))
    result.push(context.planned.delay(FAILURE_FALL_DURATION_MS + FINAL_SEQUENCE_END_DELAY_MS, { event: { name: "sequence:end" } }))
  } else if (shouldEndNow) {
    result.push(context.planned.delay(FINAL_SEQUENCE_END_DELAY_MS, { event: { name: "sequence:end" } }))
  }
  return result
}

const impactClearStrap: StrapFn = ({ event }) => {
  const color = event.data?.bubbleColor as SpaceBubbleColor | undefined
  if (color === undefined || !SPACE_BUBBLE_COLORS.includes(color)) {
    return undefined
  }

  return { events: buildImpactClearEvents(color) }
}

const pickerSpawnStrap: StrapFn = ({ state, context }) => {
  const gameState = readGameState(state)
  if (gameState === null || gameState.status !== "playing" || gameState.pickerActive) {
    return undefined
  }

  const passId = gameState.pickerPassId + 1
  const pickerY = PICKER_MIN_Y + Math.round(seedToUnit(gameState.seed ^ passId) * (PICKER_MAX_Y - PICKER_MIN_Y))
  const result: StrapReturnValue[] = [
    {
      update: { pickerActive: true, pickerY, pickerPassId: passId, pickerHitBubbleIds: [] },
      events: buildPickerSpawnEvents(pickerY, PICKER_DURATION_MS),
    },
    context.planned.delay(PICKER_DURATION_MS, { event: { name: "space:picker:end", data: { passId } } }),
  ]

  const checks = Math.floor(PICKER_DURATION_MS / PICKER_CHECK_EVERY_MS)
  for (let index = 1; index <= checks; index += 1) {
    result.push(context.planned.delay(index * PICKER_CHECK_EVERY_MS, {
      event: { name: "space:picker:contact-check", data: { passId, elapsedMs: index * PICKER_CHECK_EVERY_MS } },
    }))
  }

  return result
}

const pickerContactCheckStrap: StrapFn = ({ event, state, meta, context }) => {
  const gameState = readGameState(state)
  const passId = typeof event.data?.passId === "number" ? event.data.passId : null
  const elapsedMs = typeof event.data?.elapsedMs === "number" ? event.data.elapsedMs : null
  if (gameState === null || gameState.status !== "playing" || !gameState.pickerActive || passId !== gameState.pickerPassId || elapsedMs === null || gameState.startedAtMs === null) {
    return undefined
  }

  const x = resolvePickerX(elapsedMs)
  const rect = { left: x - 120, right: x + 78, top: gameState.pickerY - 24, bottom: gameState.pickerY + 24 }
  const nowMs = meta.ms ?? 0
  for (const color of SPACE_BUBBLE_COLORS) {
    const bubble = gameState.bubbles[color]
    if (!bubble.alive || gameState.pickerHitBubbleIds.includes(color)) {
      continue
    }

    if (!rectHitsCircle(rect, resolveBubbleCircle(bubble, nowMs, gameState.startedAtMs))) {
      continue
    }

    const bubbles = cloneBubbles(gameState.bubbles)
    const nextLevel = Math.max(0, bubble.level - 1) as BubbleState["level"]
    const destroyed = nextLevel === 0
    const accomplished = destroyed && isExpectedDestruction(gameState, color)
    bubbles[color] = { ...bubble, level: nextLevel, alive: !destroyed }
    const destructionSequence = destroyed ? [...gameState.destructionSequence, color] : gameState.destructionSequence
    const failedOrder = gameState.failedOrder || (destroyed && !accomplished)
    const allDestroyed = SPACE_BUBBLE_COLORS.every((candidate) => !bubbles[candidate].alive)
    const shouldEndNow = allDestroyed || failedOrder
    const partialState: Partial<SpaceBubblesState> = {
        bubbles,
        destructionSequence,
        failedOrder,
        pickerHitBubbleIds: [...gameState.pickerHitBubbleIds, color],
        revision: gameState.revision + 1,
      }
    if (shouldEndNow) {
      const finalState = { ...gameState, ...partialState, endedAtMs: nowMs } as SpaceBubblesState
      partialState.status = allDestroyed && !failedOrder && hasSuccessfulOrder(finalState) ? "success" : "fail"
      partialState.endedAtMs = nowMs
    }

    const nextState = { ...gameState, ...partialState } as SpaceBubblesState
    const endEvents = shouldEndNow
      ? nextState.status === "fail"
        ? buildFailureFallEvents(nextState)
        : buildGameEndEvents(nextState)
      : []
    return [
      {
        update: partialState as Record<string, unknown>,
        events: [
          { name: "space:picker:bump", data: { className: { add: "is-bumping" } } },
          ...buildBubbleImpactEvents({ color, point: { x, y: gameState.pickerY }, nextLevel, destroyed, accomplished }),
          ...endEvents,
        ],
      },
      context.planned.delay(190, { event: { name: "space:picker:bump-clear", data: { className: { remove: "is-bumping" } } } }),
      context.planned.delay(220, { event: { name: "space:impact:clear", data: { bubbleColor: color } } }),
      ...(shouldEndNow && nextState.status === "fail"
        ? [
            context.planned.delay(FAILURE_FALL_DURATION_MS, { event: { name: "space:game:final-message" } }),
            context.planned.delay(FAILURE_FALL_DURATION_MS + FINAL_SEQUENCE_END_DELAY_MS, { event: { name: "sequence:end" } }),
          ]
        : shouldEndNow
          ? [context.planned.delay(FINAL_SEQUENCE_END_DELAY_MS, { event: { name: "sequence:end" } })]
        : []),
    ]
  }

  return undefined
}

const pickerEndStrap: StrapFn = ({ event, state }) => {
  const gameState = readGameState(state)
  if (gameState === null || event.data?.passId !== gameState.pickerPassId) {
    return undefined
  }

  return { update: { pickerActive: false }, events: buildPickerEndEvents() }
}

const maluserSpawnStrap: StrapFn = ({ state, meta, context }) => {
  const gameState = readGameState(state)
  if (gameState === null || gameState.status !== "playing" || gameState.maluserActive) {
    return undefined
  }

  const passId = gameState.maluserPassId + 1
  const nowMs = meta.ms ?? 0
  const result: StrapReturnValue[] = [
    {
      update: { maluserActive: true, maluserStartedAtMs: nowMs, maluserPassId: passId, maluserHitBubbleIds: [] },
      events: buildMaluserSpawnEvents(MALUSER_DURATION_MS),
    },
    context.planned.delay(MALUSER_DURATION_MS, { event: { name: "space:maluser:end", data: { passId } } }),
  ]

  const checks = Math.floor(MALUSER_DURATION_MS / MALUSER_CHECK_EVERY_MS)
  for (let index = 1; index <= checks; index += 1) {
    result.push(context.planned.delay(index * MALUSER_CHECK_EVERY_MS, {
      event: { name: "space:maluser:contact-check", data: { passId, elapsedMs: index * MALUSER_CHECK_EVERY_MS } },
    }))
  }
  return result
}

const maluserContactCheckStrap: StrapFn = ({ event, state, meta, context }) => {
  const gameState = readGameState(state)
  const passId = typeof event.data?.passId === "number" ? event.data.passId : null
  const elapsedMs = typeof event.data?.elapsedMs === "number" ? event.data.elapsedMs : null
  if (gameState === null || gameState.status !== "playing" || !gameState.maluserActive || passId !== gameState.maluserPassId || elapsedMs === null || gameState.startedAtMs === null) {
    return undefined
  }

  const position = resolveMaluserPosition(elapsedMs)
  const nowMs = meta.ms ?? 0
  for (const color of SPACE_BUBBLE_COLORS) {
    const bubble = gameState.bubbles[color]
    if (!bubble.alive || bubble.level >= 3 || gameState.maluserHitBubbleIds.includes(color)) {
      continue
    }

    if (!circleHitsCircle({ ...position, radius: MALUSER_HIT_RADIUS }, resolveBubbleCircle(bubble, nowMs, gameState.startedAtMs))) {
      continue
    }

    const bubbles = cloneBubbles(gameState.bubbles)
    const nextLevel = Math.min(3, bubble.level + 1) as BubbleState["level"]
    bubbles[color] = { ...bubble, level: nextLevel, alive: true }
    return [
      {
        update: {
          bubbles,
          maluserHitBubbleIds: [...gameState.maluserHitBubbleIds, color],
          revision: gameState.revision + 1,
        },
        events: buildMaluserHitBubbleEvents(color, nextLevel),
      },
      context.planned.delay(220, { event: { name: "space:maluser:hit-clear" } }),
    ]
  }

  return undefined
}

const maluserEndStrap: StrapFn = ({ event, state }) => {
  const gameState = readGameState(state)
  if (gameState === null || event.data?.passId !== gameState.maluserPassId) {
    return undefined
  }

  return { update: { maluserActive: false, maluserStartedAtMs: null }, events: buildMaluserEndEvents() }
}

const maluserHitClearStrap: StrapFn = ({ state }) => {
  const gameState = readGameState(state)
  return { events: gameState?.maluserActive === false ? buildMaluserShotClearEvents() : buildMaluserHitClearEvents() }
}

const finalMessageStrap: StrapFn = ({ state }) => {
  const gameState = readGameState(state)
  if (gameState === null || (gameState.status !== "success" && gameState.status !== "fail")) {
    return undefined
  }

  return { events: buildGameEndEvents(gameState) }
}

const visualOnlyStrap: StrapFn = ({ event }) => {
  if (event.name === "space:turret:recoil-clear") {
    return { events: buildTurretRecoilClearEvents() }
  }
  return undefined
}

/** Builds the scene-level straps used by the Space Bubbles demo. */
export function createSpaceBubblesStraps(): StrapCollection {
  return {
    "space-bubbles-start": startGameStrap(),
    "space-bubbles-left": moveTurretStrap(-1),
    "space-bubbles-right": moveTurretStrap(1),
    "space-bubbles-turret-key-left": moveTurretFromCapture(-1),
    "space-bubbles-turret-key-right": moveTurretFromCapture(1),
    "space-bubbles-turret-drag-start": turretDragStartStrap,
    "space-bubbles-turret-drag": turretDragStrap,
    "space-bubbles-turret-drag-end": turretDragEndStrap,
    "space-bubbles-picker-up": movePickerStrap(-1),
    "space-bubbles-picker-down": movePickerStrap(1),
    "space-bubbles-fire": fireStrap,
    "space-bubbles-projectile-clear": clearProjectileStrap,
    "space-bubbles-impact-check": impactCheckStrap,
    "space-bubbles-impact-clear": impactClearStrap,
    "space-bubbles-picker-spawn": pickerSpawnStrap,
    "space-bubbles-picker-contact": pickerContactCheckStrap,
    "space-bubbles-picker-end": pickerEndStrap,
    "space-bubbles-maluser-spawn": maluserSpawnStrap,
    "space-bubbles-maluser-contact": maluserContactCheckStrap,
    "space-bubbles-maluser-end": maluserEndStrap,
    "space-bubbles-maluser-hit-clear": maluserHitClearStrap,
    "space-bubbles-final-message": finalMessageStrap,
    "space-bubbles-visual-only": visualOnlyStrap,
  }
}
