import type { SceneDoc, SceneStoryDoc } from "codplay/player/types"
import { createInitialBubbles, resolveBubbleLevelScale } from "./space-bubbles-state"
import { resolveBubblePosition } from "./space-bubbles-trajectories"
import { SPACE_BUBBLE_COLORS, SPACE_BUBBLES_MAX_DURATION_MS, SPACE_BUBBLES_WORLD, type BubbleState, type SpaceBubbleColor } from "./space-bubbles-types"

const INTRO_TRACK_ID = "space-bubbles-intro-track"
const GAME_START_MS = 1100
const SCENE_END_MS = SPACE_BUBBLES_MAX_DURATION_MS

const BUBBLE_VISUAL: Record<SpaceBubbleColor, { order: number; label: string; hex: string; orbitRadius: number }> = {
  red: { order: 1, label: "Rouge", hex: "#fb7185", orbitRadius: 70 },
  blue: { order: 2, label: "Bleu", hex: "#60a5fa", orbitRadius: 82 },
  yellow: { order: 3, label: "Jaune", hex: "#facc15", orbitRadius: 76 },
  green: { order: 4, label: "Vert", hex: "#4ade80", orbitRadius: 68 },
}

/** Creates the decorative HTML night sky behind the SVG gameplay layer. */
function createNightSkyMarkup(): string {
  const stars = [
    [9, 9, 3], [18, 14, 2], [28, 7, 2], [39, 13, 2], [51, 8, 3], [64, 19, 2], [74, 8, 2], [91, 24, 2],
    [11, 31, 2], [23, 25, 3], [35, 33, 2], [48, 25, 2], [62, 33, 2], [78, 31, 3], [91, 38, 2],
    [6, 50, 2], [18, 44, 2], [30, 52, 3], [45, 44, 2], [57, 55, 2], [70, 47, 2], [85, 55, 3], [96, 49, 2],
  ]

  return `
    <div class="space-night-backdrop" aria-hidden="true">
      <div class="space-night-moon"></div>
      <div class="space-constellation space-constellation-a">
        <span></span><span></span><span></span><span></span>
      </div>
      <div class="space-constellation space-constellation-b">
        <span></span><span></span><span></span><span></span>
      </div>
      ${stars.map(([left, top, size]) => `<i class="space-star" style="left: ${left}%; top: ${top}%; width: ${size}px; height: ${size}px;"></i>`).join("")}
    </div>
  `
}

function createRootStory(): SceneStoryDoc {
  return {
    id: "space-root-story",
    initial: { move: "@root" },
    straps: undefined,
    listen: [],
    persos: [
      {
        id: "space-stage",
        type: "layout",
        initial: {
          move: "@root",
          className: "space-bubbles-shell",
          markup: `
            <div class="space-bubbles-frame">
              ${createNightSkyMarkup()}
              <svg class="space-bubbles-world" data-part="space-stage:world" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <radialGradient id="space-bubble-gloss" cx="32%" cy="28%" r="70%">
                    <stop offset="0%" stop-color="rgba(255,255,255,0.95)" />
                    <stop offset="34%" stop-color="rgba(255,255,255,0.28)" />
                    <stop offset="100%" stop-color="rgba(255,255,255,0)" />
                  </radialGradient>
                </defs>
              </svg>
              <div class="space-bubbles-hud" data-part="space-stage:hud"></div>
              <div class="space-bubbles-overlay" data-part="space-stage:overlay"></div>
            </div>
          `,
        },
        actions: {
          "space:stage:fade-in": {},
          "space:stage:end": {},
          "space:fx:stage-shake": {},
          "space:fx:stage-shake-clear": {},
        },
      },
      {
        id: "space-intro-go",
        type: "tag",
        initial: {
          tag: "div",
          move: { parentId: "space-stage:overlay" },
          className: "space-intro-go is-hidden",
          content: "Go!",
        },
        actions: {
          "space:intro:go-show": {},
          "space:intro:go-hide": {},
        },
      },
    ],
  }
}

function createBubbleMarkup(color: SpaceBubbleColor): string {
  const visual = BUBBLE_VISUAL[color]
  return `
    <g>
      <g class="space-bubble-visual">
        <circle class="space-bubble-core" r="58" fill="${visual.hex}" />
        <circle class="space-bubble-gloss" cx="-18" cy="-22" r="34" fill="url(#space-bubble-gloss)" />
        <circle class="space-bubble-spark" cx="-30" cy="-34" r="7" />
        <text class="space-bubble-label" x="0" y="12">${visual.order}</text>
      </g>
    </g>
  `
}

function resolveInitialBubbleStyle(color: SpaceBubbleColor): Record<string, unknown> {
  const bubble = createInitialBubbles()[color]
  const position = resolveBubblePosition(bubble, GAME_START_MS, GAME_START_MS)
  return {
    x: position.x,
    y: position.y,
    "--bubble-level-scale": resolveBubbleLevelScale(bubble.level),
  }
}

function createBubbleOrbitAction(bubble: BubbleState): Record<string, unknown> {
  const current = resolveBubblePosition(bubble, GAME_START_MS, GAME_START_MS)
  const oppositeX = current.x < bubble.orbit.centerX
    ? bubble.orbit.centerX + bubble.orbit.radiusX
    : bubble.orbit.centerX - bubble.orbit.radiusX
  const oppositeY = current.y <= bubble.orbit.centerY
    ? bubble.orbit.centerY + bubble.orbit.radiusY
    : bubble.orbit.centerY - bubble.orbit.radiusY

  return {
    style: {
      x: {
        from: current.x,
        to: oppositeX,
        duration: bubble.orbit.periodMs / 2,
        ease: "inOutSine",
        alternate: true,
        loop: true,
        ignoreDuration: true,
      },
      y: {
        from: current.y,
        to: oppositeY,
        duration: bubble.orbit.periodMs / 4,
        ease: "inOutSine",
        alternate: true,
        loop: true,
        ignoreDuration: true,
      },
    },
  }
}

function createWorldStory(): SceneStoryDoc {
  const bubbles = createInitialBubbles()
  return {
    id: "space-world-story",
    initial: { move: "@root" },
    straps: undefined,
    listen: [],
    persos: [
      ...SPACE_BUBBLE_COLORS.map((color) => ({
        id: `space-bubble-${color}`,
        type: "layout" as const,
        initial: {
          move: { parentId: "space-stage:world" },
          format: "svg" as const,
          className: `space-bubble space-bubble-${color}`,
          style: resolveInitialBubbleStyle(color),
          markup: createBubbleMarkup(color),
        },
        actions: {
          "space:bubbles:orbit:start": createBubbleOrbitAction(bubbles[color]),
          [`space:bubble:${color}:set-level`]: {},
          [`space:bubble:${color}:shock`]: {},
          [`space:bubble:${color}:shock-clear`]: {},
          [`space:bubble:${color}:pop`]: {},
          [`space:bubble:${color}:fall`]: {},
        },
      })),
      {
        id: "space-turret",
        type: "layout",
        initial: {
          move: { parentId: "space-stage:world" },
          format: "svg",
          className: "space-turret",
          style: { x: SPACE_BUBBLES_WORLD.width / 2, y: SPACE_BUBBLES_WORLD.turretY },
          markup: `
            <g class="space-turret-toy">
              <ellipse class="space-turret-shadow" cx="0" cy="44" rx="78" ry="13" />
              <path class="space-turret-cannon" d="M -30 -92 H 30 L 22 -8 H -22 Z" />
              <rect class="space-turret-cannon-band" x="-34" y="-92" width="68" height="15" rx="5" />
              <path class="space-turret-cannon-shine" d="M -11 -75 C -16 -53 -15 -32 -10 -14" />
              <path class="space-turret-base" d="M -72 36 C -72 -10 -45 -40 0 -40 C 45 -40 72 -10 72 36 Z" />
              <circle class="space-turret-core" cx="0" cy="-4" r="24" />
              <circle class="space-turret-eye" cx="-28" cy="-11" r="6" />
              <circle class="space-turret-eye" cx="28" cy="-11" r="6" />
              <path class="space-turret-smile" d="M -20 12 Q 0 26 22 12" />
              <circle class="space-turret-cheek" cx="-45" cy="8" r="8" />
              <circle class="space-turret-cheek" cx="45" cy="8" r="8" />
              <circle class="space-turret-wheel" cx="-52" cy="36" r="17" />
              <circle class="space-turret-wheel" cx="52" cy="36" r="17" />
              <circle class="space-turret-hub" cx="-52" cy="36" r="6" />
              <circle class="space-turret-hub" cx="52" cy="36" r="6" />
            </g>
          `,
        },
        actions: {
          "space:turret:move": {},
          "space:turret:key:end": {},
          "space:turret:recoil": {},
          "space:turret:recoil-clear": {},
        },
        emit: {
          keydown: [
            {
              keyCode: "ArrowLeft",
              preventDefault: true,
              event: { name: "space:turret:key:start", cascade: true },
              capture: {
                event: { name: "space:turret:key:left", cascade: true },
                endEvent: { name: "space:turret:key:end", cascade: true },
                duration: 120,
                replay: true,
                trackOn: [],
                endOn: ["keyup"],
              },
            },
            {
              keyCode: "ArrowRight",
              preventDefault: true,
              event: { name: "space:turret:key:start", cascade: true },
              capture: {
                event: { name: "space:turret:key:right", cascade: true },
                endEvent: { name: "space:turret:key:end", cascade: true },
                duration: 120,
                replay: true,
                trackOn: [],
                endOn: ["keyup"],
              },
            },
          ],
        },
      },
      {
        id: "space-projectile",
        type: "layout",
        initial: {
          move: { parentId: "space-stage:world" },
          format: "svg",
          className: "space-projectile",
          style: { x: SPACE_BUBBLES_WORLD.width / 2, y: SPACE_BUBBLES_WORLD.projectileY, opacity: 0 },
          markup: `
            <g>
              <circle class="space-projectile-core" r="9" />
              <path class="space-projectile-tail" d="M 0 8 C -10 42, 10 42, 0 8" />
            </g>
          `,
        },
        actions: {
          "space:projectile:fly": {},
          "space:projectile:hide": {},
        },
      },
      {
        id: "space-impact-flash",
        type: "layout",
        initial: {
          move: { parentId: "space-stage:world" },
          format: "svg",
          className: "space-impact-flash",
          style: { x: 0, y: 0 },
          markup: `
            <g>
              <circle class="space-impact-ring" r="48" />
              <circle class="space-impact-dot" r="12" />
            </g>
          `,
        },
        actions: {
          "space:fx:impact-flash": {},
          "space:fx:impact-flash-clear": {},
        },
      },
      {
        id: "space-picker",
        type: "layout",
        initial: {
          move: { parentId: "space-stage:world" },
          format: "svg",
          className: "space-picker is-hidden",
          style: { x: 1080, y: 460 },
          markup: `
            <g>
              <path class="space-picker-body" d="M -70 -18 H 38 L 74 0 L 38 18 H -70 Z" />
              <path class="space-picker-sting" d="M -80 0 H -118" />
              <circle class="space-picker-light" cx="32" cy="0" r="8" />
            </g>
          `,
        },
        actions: {
          "space:picker:spawn": {},
          "space:picker:set-height": {},
          "space:picker:bump": {},
          "space:picker:bump-clear": {},
          "space:picker:hide": {},
        },
      },
      {
        id: "space-maluser",
        type: "layout",
        initial: {
          move: { parentId: "space-stage:world" },
          format: "svg",
          className: "space-maluser is-hidden",
          style: { x: -90, y: 650 },
          markup: `
            <g>
              <circle class="space-maluser-core" r="36" />
              <path class="space-maluser-grin" d="M -20 8 Q 0 28 22 8" />
              <circle class="space-maluser-eye" cx="-14" cy="-10" r="5" />
              <circle class="space-maluser-eye" cx="16" cy="-10" r="5" />
            </g>
          `,
        },
        actions: {
          "space:maluser:spawn": {},
          "space:maluser:hide": {},
          "space:maluser:hit-bubble": {},
        },
      },
    ],
  }
}

function createHudStory(): SceneStoryDoc {
  return {
    id: "space-hud-story",
    initial: { move: "@root" },
    straps: undefined,
    listen: [],
    persos: [
      {
        id: "space-hud-status",
        type: "tag",
        initial: {
          tag: "div",
          move: { parentId: "space-stage:hud" },
          className: "space-hud-status",
          content: "Appuie sur play pour lancer la mission.",
        },
        actions: { "space:hud:status": {} },
      },
      {
        id: "space-hud-timer",
        type: "tag",
        initial: {
          tag: "div",
          move: { parentId: "space-stage:hud" },
          className: "space-hud-timer",
          content: "00.0",
        },
        actions: { "space:hud:timer": {}, "space:hud:timer-stop": "stop" },
      },
      {
        id: "space-mission",
        type: "layout",
        initial: {
          move: { parentId: "space-stage:hud" },
          className: "space-mission",
          markup: SPACE_BUBBLE_COLORS.map((color) => {
            const visual = BUBBLE_VISUAL[color]
            return `<div class="space-mission-bubble space-mission-${color}" data-part="space-mission:${color}"><span>${visual.order}</span></div>`
          }).join(""),
        },
        actions: {},
      },
      ...SPACE_BUBBLE_COLORS.map((color) => ({
        id: `space-mission-${color}`,
        type: "tag" as const,
        initial: {
          tag: "div",
          move: { parentId: `space-mission:${color}` },
          className: "space-mission-mark",
          content: "×",
        },
        actions: {
          [`space:mission:${color}:reset`]: {},
          [`space:mission:${color}:accomplished`]: {},
          [`space:mission:${color}:failed`]: {},
        },
      })),
      {
        id: "space-control-left",
        type: "tag",
        initial: { tag: "button", move: { parentId: "space-stage:hud" }, className: "space-touch-control space-touch-left", content: "←" },
        emit: { click: { event: { name: "space:control:left", cascade: true } } },
        actions: { "space:controls:left:picker-mode": {}, "space:controls:left:turret-mode": {} },
      },
      {
        id: "space-control-right",
        type: "tag",
        initial: { tag: "button", move: { parentId: "space-stage:hud" }, className: "space-touch-control space-touch-right", content: "→" },
        emit: { click: { event: { name: "space:control:right", cascade: true } } },
        actions: { "space:controls:right:picker-mode": {}, "space:controls:right:turret-mode": {} },
      },
      {
        id: "space-control-fire",
        type: "tag",
        initial: { tag: "button", move: { parentId: "space-stage:hud" }, className: "space-touch-control space-touch-fire", content: "Tir" },
        emit: { click: { event: { name: "space:fire", cascade: true } } },
        actions: {},
      },
      {
        id: "space-turret-drag-zone",
        type: "tag",
        initial: {
          tag: "div",
          move: { parentId: "space-stage:overlay" },
          className: "space-turret-drag-zone",
          content: "",
        },
        emit: {
          pointerdown: {
            event: { name: "space:turret:drag-start", cascade: true },
            capture: {
              event: { name: "space:turret:drag", cascade: true },
              endEvent: { name: "space:turret:drag-end", cascade: true },
              duration: 120,
              snapAt: "end",
            },
          },
        },
        actions: {},
      },
    ],
  }
}

function createResultStory(): SceneStoryDoc {
  return {
    id: "space-result-story",
    initial: { move: "@root" },
    straps: undefined,
    listen: [],
    persos: [
      {
        id: "space-result-panel",
        type: "tag",
        initial: {
          tag: "div",
          move: { parentId: "space-stage:overlay" },
          className: "space-result-panel is-hidden",
          content: "",
        },
        actions: {
          "space:result:show": {},
          "space:result:hide": {},
        },
      },
    ],
  }
}

/** Creates the Space Bubbles game demo scene. */
export function createSpaceBubblesScene(): SceneDoc {
  return {
    id: "space-bubbles-scene",
    initial: { status: "intro" },
    straps: undefined,
    listen: [
      { on: "space:game:start", straps: ["space-bubbles-start"] },
      { on: "space:control:left", straps: ["space-bubbles-left"] },
      { on: "space:control:right", straps: ["space-bubbles-right"] },
      { on: "space:turret:key:left", straps: ["space-bubbles-turret-key-left"] },
      { on: "space:turret:key:right", straps: ["space-bubbles-turret-key-right"] },
      { on: "space:turret:drag-start", straps: ["space-bubbles-turret-drag-start"] },
      { on: "space:turret:drag", straps: ["space-bubbles-turret-drag"] },
      { on: "space:turret:drag-end", straps: ["space-bubbles-turret-drag-end"] },
      { on: "space:picker:up", straps: ["space-bubbles-picker-up"] },
      { on: "space:picker:down", straps: ["space-bubbles-picker-down"] },
      { on: "space:fire", straps: ["space-bubbles-fire"] },
      { on: "space:projectile:clear", straps: ["space-bubbles-projectile-clear"] },
      { on: "space:projectile:impact-check", straps: ["space-bubbles-impact-check"] },
      { on: "space:impact:clear", straps: ["space-bubbles-impact-clear"] },
      { on: "space:picker:spawn", straps: ["space-bubbles-picker-spawn"] },
      { on: "space:picker:contact-check", straps: ["space-bubbles-picker-contact"] },
      { on: "space:picker:end", straps: ["space-bubbles-picker-end"] },
      { on: "space:maluser:spawn", straps: ["space-bubbles-maluser-spawn"] },
      { on: "space:maluser:contact-check", straps: ["space-bubbles-maluser-contact"] },
      { on: "space:maluser:end", straps: ["space-bubbles-maluser-end"] },
      { on: "space:maluser:hit-clear", straps: ["space-bubbles-maluser-hit-clear"] },
      { on: "space:game:final-message", straps: ["space-bubbles-final-message"] },
      { on: "space:turret:recoil-clear", straps: ["space-bubbles-visual-only"] },
    ],
    stories: {
      "space-root-story": createRootStory(),
      "space-world-story": createWorldStory(),
      "space-hud-story": createHudStory(),
      "space-result-story": createResultStory(),
    },
    tracks: {
      [INTRO_TRACK_ID]: {
        id: INTRO_TRACK_ID,
        active: true,
        order: 1,
        source: "story",
        events: [
          { ms: 100, name: "space:intro:go-show", payload: { className: { add: "is-visible", remove: "is-hidden" } } },
          { ms: 100, name: "space:stage:fade-in", payload: { className: { add: "is-intro" } } },
          { ms: GAME_START_MS, name: "space:intro:go-hide", payload: { className: { add: "is-hidden", remove: "is-visible" } } },
          { ms: GAME_START_MS, name: "space:bubbles:orbit:start" },
          { ms: GAME_START_MS, name: "space:game:start" },
          { ms: SCENE_END_MS, name: "sequence:end" },
        ],
      },
    },
  }
}
