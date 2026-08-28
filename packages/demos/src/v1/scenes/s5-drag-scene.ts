import type { StrapCollection } from "codplay-v1/player/strap-types";
import type { CaptureEndFn, CaptureInitFn, CaptureTrackFn, PointerCaptureSample } from "codplay-v1/runtime/capture-types";
import type { SceneDoc } from "codplay-v1/player/types";

type DragStoryState = { draggableX: number; draggableY: number };
type DragCaptureState = { x: number; y: number };

const initDragCaptureState: CaptureInitFn = ({ state }) => {
  const dragState = state as DragStoryState;
  return { x: dragState.draggableX, y: dragState.draggableY };
};

const trackDrag: CaptureTrackFn = ({ sample, captureState }) => {
  const pointerSample = sample as PointerCaptureSample;
  const dragCaptureState = captureState as DragCaptureState;
  const x = dragCaptureState.x + pointerSample.movementX;
  const y = dragCaptureState.y + pointerSample.movementY;

  return {
    action: { actionName: "drag:tracking", data: { style: { x, y } } },
    captureState: { x, y },
  };
};

const endDragCapture: CaptureEndFn = ({ captureState, state }) => {
  const dragCaptureState = captureState as DragCaptureState;
  const dragState = state as DragStoryState;

  return {
    events: [
      {
        name: "drag:dropped",
        data: {
          x: dragCaptureState.x,
          y: dragCaptureState.y,
          style: {
            x: { from: dragState.draggableX, to: dragCaptureState.x },
            y: { from: dragState.draggableY, to: dragCaptureState.y },
          },
        },
      },
    ],
    durationMode: "capture",
  };
};

const s5Straps: StrapCollection = {
  "drag-settle": ({ event }) => {
    const data = event.data as { x: number; y: number };
    return { update: { draggableX: data.x, draggableY: data.y } };
  },
};

export function createS5DragScene(): SceneDoc {
  return {
    id: "s5-drag-scene",
    initial: undefined,
    straps: [],
    listen: [],
    stories: {
      "s5-drag-story": {
        id: "s5-drag-story",
        state: { draggableX: 0, draggableY: 0 },
        initial: { move: "@root" },
        straps: s5Straps,
        listen: [
          { on: "drag:dropped", straps: ["drag-settle"] },
        ],
        eventimes: [{ name: "sequence:end", startAt: 6000 }],
        persos: [
          {
            id: "draggable",
            type: "tag",
            initial: {
              move: "@root",
              content: "Déplacez-moi",
              style: {
                x: 0,
                y: 0,
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
                  trackOn: ["pointermove"],
                  endOn: ["pointerup"],
                  initCaptureState: initDragCaptureState,
                  trackCommand: trackDrag,
                  endEmit: { name: "drag:dropped" },
                  endCapture: endDragCapture,
                },
              },
            },
            actions: {
              "drag:tracking": {},
              "drag:dropped": {},
            },
          },
        ],
      },
    },
    tracks: {},
  } as unknown as SceneDoc;
}
