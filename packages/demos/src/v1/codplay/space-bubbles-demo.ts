import { createSpaceBubblesScene, createSpaceBubblesStraps } from "../scenes/space-bubbles"
import { runCodPlaySceneDemo } from "./run-codplay-scene-demo"

function resolveKeyboardEventName(event: KeyboardEvent): string | null {
  if (event.code === "ArrowUp") return "space:picker:up"
  if (event.code === "ArrowDown") return "space:picker:down"
  if (event.code === "Space") return "space:fire"
  return null
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
      globalThis.addEventListener("keydown", (event) => {
        const name = resolveKeyboardEventName(event)
        if (name === null) {
          return
        }

        if (event.repeat) {
          event.preventDefault()
          return
        }

        event.preventDefault()
        void player.emit({ name, cascade: true })
      })

    },
  })
}
