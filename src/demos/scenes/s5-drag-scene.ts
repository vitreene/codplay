import type { TransformFn } from "../../player"
import type { PlayerSceneLifecycleOptions, SceneDoc, StrictSceneDoc } from "../../player/types"

const trackMove: TransformFn = (event) => {
  const { dx, dy, baseX, baseY } = event.data as { dx: number; dy: number; baseX: number; baseY: number }
  return [{
    name: "drag:tracking",
    cascade: true,
    data: {
      style: {
        x: { to: baseX + dx, duration: 0 },
        y: { to: baseY + dy, duration: 0 },
      },
    },
  }]
}

const dragToStyle: TransformFn = (event) => {
  const { fromX, fromY, toX, toY, duration } = event.data as {
    fromX: number; fromY: number; toX: number; toY: number; duration: number
  }
  return [{
    name: "drag:apply",
    cascade: true,
    data: {
      style: {
        x: { from: fromX, to: toX, duration },
        y: { from: fromY, to: toY, duration },
      },
    },
  }]
}

export function createS5DragScene(): SceneDoc {
  return {
    id: "s5-drag-scene",
    rootStories: ["s5-drag-story"],
    initial: undefined,
    straps: [],
    listen: [],
    stories: {
      "s5-drag-story": {
        id: "s5-drag-story",
        entries: ["draggable"],
        initial: undefined,
        straps: [],
        listen: [
          { on: "drag:moved", transform: [trackMove] },
          { on: "drag:ended", transform: [dragToStyle] },
        ],
        eventimes: [{ name: "sequence:end", startAt: 60000 }],
        persos: [
          {
            id: "draggable",
            type: "text",
            initial: {
              content: "Déplacez-moi",
              style: {
                position: "absolute",
                top: "200px",
                left: "200px",
                padding: "12px 20px",
                background: "#4f46e5",
                color: "#fff",
                borderRadius: "8px",
                cursor: "grab",
                userSelect: "none",
              },
            },
            emit: {
              pointerdown: {
                event: { name: "drag:started", cascade: true },
                capture: {
                  event: { name: "drag:moved" },
                  endEvent: { name: "drag:ended" },
                  duration: 400,
                  snapAt: "end",
                },
              },
            },
            // TODO: amélioration future — les actions vides sont requises pour que le director
            // route les events vers le perso. Un perso sans action déclarée ignore l'event,
            // même si le payload event contient un style valide. Envisager une déclaration
            // implicite ou un mode "passthrough" pour les events portant un payload style.
            actions: {
              "drag:tracking": {},
              "drag:apply": {},
            },
          },
        ],
      },
    },
    init(scene: StrictSceneDoc, options: PlayerSceneLifecycleOptions) {
      options.mount(scene.rootStories[0])
    },
    tracks: {},
  } as unknown as SceneDoc
}
