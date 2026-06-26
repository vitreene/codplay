import type { PersoDoc, SceneStoryDoc } from "codplay/player/types"

/**
 * Timer story: a label + a progress bar. Purely passive — the countdown logic
 * (start/pause/resume/stop, the per-second tick) lives in the scene-level `game-timer` strap.
 */
export function createTimerStory(): SceneStoryDoc {
  return {
    id: "game-timer-story",
    entries: ["game-timer-root"],
    initial: undefined,
    straps: undefined,
    listen: [],
    persos: [
      {
        id: "game-timer-root",
        type: "layout",
        initial: {
          move: { parentId: "game:zone:timer" },
          markup: `
            <div class="quiz-hunt-timer">
              <span data-part="game-timer-label-slot" style="font-weight: 700; font-family: monospace; font-size: 1.1rem;"></span>
              <div data-part="game-timer-track-slot" style="height: 8px; background: rgba(15,23,42,0.12); border-radius: 4px; overflow: hidden; margin-top: 6px;"></div>
            </div>
          `,
          style: {}
        } as unknown as PersoDoc["initial"],
        actions: {}
      },
      {
        id: "game-timer-label",
        type: "tag",
        initial: {
          tag: "span",
          content: "--:--",
          move: { parentId: "game-timer-label-slot" }
        } as unknown as PersoDoc["initial"],
        actions: { "game:timer:label": {} }
      },
      {
        id: "game-timer-fill",
        type: "tag",
        initial: {
          tag: "div",
          content: "",
          style: {
            height: "100%",
            width: "100%",
            backgroundColor: "#2563eb",
            borderRadius: "4px"
          },
          move: { parentId: "game-timer-track-slot" }
        } as unknown as PersoDoc["initial"],
        actions: { "game:timer:fill": {} }
      }
    ]
  }
}
