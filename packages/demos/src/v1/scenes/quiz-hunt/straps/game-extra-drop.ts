import type { StrapFn } from "codplay/player/strap-types"

const GRID_TILE_PREFIX = "game-grid-tile-"

/** Extracts the trial id from a grid tile perso id, or returns `null` for non-grid targets. */
function resolveTrialIdFromHit(hitId: string | null): string | null {
  if (hitId === null || !hitId.startsWith(GRID_TILE_PREFIX)) {
    return null
  }

  return hitId.slice(GRID_TILE_PREFIX.length) || null
}

/** Resolves one failed tile directly from its DOM rect when point-hit lookup is unreliable. */
function resolveTrialIdFromFailedTileRects(
  clientX: number,
  clientY: number,
  trialStatus: Record<string, string>
): string | null {
  if (typeof globalThis.document?.getElementById !== "function") {
    return null
  }

  for (const [trialId, status] of Object.entries(trialStatus)) {
    if (status !== "fail") {
      continue
    }

    const element = globalThis.document.getElementById(`${GRID_TILE_PREFIX}${trialId}`)
    if (!(element instanceof HTMLElement)) {
      continue
    }

    const rect = element.getBoundingClientRect()
    const containsPoint = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
    if (containsPoint) {
      return trialId
    }
  }

  return null
}

type ResetTrialStoryStateFn = (trialId: string) => void

/** Scene-level drop handler: consumes the stored retry token only on a failed grid tile. */
export function createGameExtraDropStrap(resetTrialStoryState: ResetTrialStoryStateFn): StrapFn {
  return ({ event, state, context }) => {
  if (state.extraToken !== true) {
    return undefined
  }

  const clientX = typeof event.data?.clientX === "number" ? event.data.clientX : undefined
  const clientY = typeof event.data?.clientY === "number" ? event.data.clientY : undefined
  if (clientX === undefined || clientY === undefined) {
    return { events: [{ name: "game:extra:drag:reset" }] }
  }

  const trialStatus = (state.trialStatus as Record<string, string> | undefined) ?? {}
  const sourcePersoId = typeof event.data?.persoId === "string" ? event.data.persoId : "game-extra-token"
  const hitId = context.api.getPersoIdAt(clientX, clientY, sourcePersoId)
  const trialId = resolveTrialIdFromHit(hitId) ?? resolveTrialIdFromFailedTileRects(clientX, clientY, trialStatus)

  if (trialId === null || trialStatus[trialId] !== "fail") {
    return { events: [{ name: "game:extra:drag:reset" }] }
  }

  resetTrialStoryState(trialId)

  const nextTrialStatus = { ...trialStatus, [trialId]: "available" }
  return {
    update: { extraToken: false, extraConsumedOn: trialId, trialStatus: nextTrialStatus },
    events: [
      { name: `game:trial:${trialId}:retry` },
      { name: `game:grid:tile:${trialId}:unlocked` },
      { name: "game:extra:inventory:hide" },
      { name: "game:trial:open", data: { trialId, retry: true } }
    ]
  }
}
}
