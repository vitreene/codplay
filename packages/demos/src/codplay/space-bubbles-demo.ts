import { createSpaceBubblesScene, createSpaceBubblesStraps } from "../scenes/space-bubbles"
import { runCodPlaySceneDemo } from "./run-codplay-scene-demo"

function resolveKeyboardEventName(event: KeyboardEvent): string | null {
  if (event.code === "ArrowLeft") return "space:keyboard:left:start"
  if (event.code === "ArrowRight") return "space:keyboard:right:start"
  if (event.code === "ArrowUp") return "space:picker:up"
  if (event.code === "ArrowDown") return "space:picker:down"
  if (event.code === "Space") return "space:fire"
  return null
}

function isKeyboardMoveKey(event: KeyboardEvent): boolean {
  return event.code === "ArrowLeft" || event.code === "ArrowRight"
}

/** Runs the Space Bubbles game feasibility demo. */
export function runSpaceBubblesDemo(): Promise<void> {
  return runCodPlaySceneDemo({
    title: "Space Bubbles",
    subtitle: "Jeu graphique evenementiel : tourelle, bulles, impacts, mission de couleurs et animatiques diffusees.",
    scene: createSpaceBubblesScene(),
    strapCollection: createSpaceBubblesStraps(),
    activeDemo: "space-bubbles",
    onReady: ({ player }) => {
      const activeMoveKeys = new Set<string>()
      globalThis.addEventListener("keydown", (event) => {
        const name = resolveKeyboardEventName(event)
        if (name === null) {
          return
        }

        if (isKeyboardMoveKey(event)) {
          if (activeMoveKeys.has(event.code)) {
            event.preventDefault()
            return
          }
          const hadOtherMoveKey = activeMoveKeys.size > 0
          activeMoveKeys.clear()
          activeMoveKeys.add(event.code)
          event.preventDefault()
          void (async () => {
            if (hadOtherMoveKey) {
              await player.emit({ name: "space:keyboard:stop", cascade: true })
            }
            await player.emit({ name, cascade: true })
          })()
          return
        } else if (event.repeat) {
          event.preventDefault()
          return
        }

        event.preventDefault()
        void player.emit({ name, cascade: true })
      })

      globalThis.addEventListener("keyup", (event) => {
        if (!isKeyboardMoveKey(event) || !activeMoveKeys.has(event.code)) {
          return
        }

        activeMoveKeys.delete(event.code)
        event.preventDefault()
        void player.emit({ name: "space:keyboard:stop", cascade: true })
      })
    },
  })
}
