import type { SceneStoryDoc } from "codplay/player/types"

const ELAPSED_RING_RADIUS = 132
const ELAPSED_RING_CIRCUMFERENCE = 2 * Math.PI * ELAPSED_RING_RADIUS

/** Formats a timer duration for the chrono display. */
function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

/** Builds the SVG clock face reused from the chrono demo. */
function buildClockFaceMarkup(): string {
  const cx = 150
  const cy = 150
  const outerR = 143
  const majorInnerR = 118
  const minorInnerR = 132
  const textR = 102

  const parts: string[] = []

  for (let i = 0; i < 60; i += 1) {
    const rad = (i * 6 - 90) * (Math.PI / 180)
    const isMajor = i % 5 === 0
    const innerR = isMajor ? majorInnerR : minorInnerR
    const x1 = (cx + innerR * Math.cos(rad)).toFixed(2)
    const y1 = (cy + innerR * Math.sin(rad)).toFixed(2)
    const x2 = (cx + outerR * Math.cos(rad)).toFixed(2)
    const y2 = (cy + outerR * Math.sin(rad)).toFixed(2)
    const stroke = isMajor ? "#cbd5e1" : "#475569"
    const sw = isMajor ? "2.8" : "1.2"
    parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`)
  }

  for (let i = 1; i <= 12; i += 1) {
    const sec = i * 5
    const rad = (sec * 6 - 90) * (Math.PI / 180)
    const x = (cx + textR * Math.cos(rad)).toFixed(2)
    const y = (cy + textR * Math.sin(rad)).toFixed(2)
    const label = sec === 60 ? "60" : String(sec).padStart(2, "0")
    parts.push(`<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="#e2e8f0" font-size="13" font-family="monospace" font-weight="700">${label}</text>`)
  }

  return `
    <svg class="quiz-hunt-chrono-face" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
      <circle cx="150" cy="150" r="146" fill="#0f172a"/>
      <circle cx="150" cy="150" r="${ELAPSED_RING_RADIUS}" fill="none" stroke="rgba(148, 163, 184, 0.22)" stroke-width="28"/>
      <g data-part="game-timer-elapsed-slot"></g>
      ${parts.join("")}
    </svg>
  `
}

/** Builds the elapsed-time SVG arc fragment inserted into the clock face slot. */
function buildElapsedArcMarkup(): string {
  return `<circle class="quiz-hunt-chrono-elapsed-ring" cx="150" cy="150" r="${ELAPSED_RING_RADIUS}" fill="none" stroke-width="28" stroke-linecap="butt" stroke-dasharray="${ELAPSED_RING_CIRCUMFERENCE}" stroke-dashoffset="${ELAPSED_RING_CIRCUMFERENCE}" transform="rotate(-90 150 150)"/>`
}

/**
 * Timer story: chrono-style clock face. Purely passive — the countdown logic
 * (start/pause/resume/stop, the per-second tick) lives in the scene-level `game-timer` strap.
 */
export function createTimerStory(totalMs: number): SceneStoryDoc {
  return {
    id: "game-timer-story",
    initial: { move: { parentId: "game:zone:timer" } },
    straps: undefined,
    listen: [],
    persos: [
      {
        id: "game-timer-root",
        type: "list",
        initial: {
          move: "@root",
          className: "quiz-hunt-chrono-timer"
        },
        actions: {}
      },
      {
        id: "game-timer-wrapper",
        type: "list",
        initial: {
          move: { parentId: "game-timer-root" },
          className: "quiz-hunt-chrono-wrapper"
        },
        actions: {}
      },
      {
        id: "game-timer-face",
        type: "layout",
        initial: {
          move: { parentId: "game-timer-wrapper" },
          format: "svg",
          markup: buildClockFaceMarkup()
        },
        actions: {}
      },
      {
        id: "game-timer-elapsed",
        type: "layout",
        initial: {
          move: { parentId: "game-timer-elapsed-slot" },
          format: "svg",
          markup: buildElapsedArcMarkup()
        },
        actions: {
          "game:timer:elapsed": {},
          "game:timer:elapsed-set": {}
        }
      },
      {
        id: "game-timer-needle",
        type: "list",
        initial: {
          move: { parentId: "game-timer-wrapper" },
          className: "quiz-hunt-chrono-needle"
        },
        actions: {
          "game:timer:needle": {},
          "game:timer:needle-set": {}
        }
      },
      {
        id: "game-timer-dot",
        type: "list",
        initial: {
          move: { parentId: "game-timer-wrapper" },
          className: "quiz-hunt-chrono-dot"
        },
        actions: {}
      },
      {
        id: "game-timer-display",
        type: "text",
        initial: {
          move: { parentId: "game-timer-wrapper" },
          content: formatDuration(totalMs),
          className: "quiz-hunt-chrono-display"
        },
        actions: {
          "game:timer:display": {},
          "game:timer:display-set": {}
        }
      }
    ]
  }
}
