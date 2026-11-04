import type { SceneDoc } from "codplay";
import voiceTimeline from "./avatar-data/visemes-2.json";

const RIVE_SCENE_ID = "rive-matt-visemes";
// speech.mp3 is 14.445714 seconds; round up to the timeline's millisecond precision.
const VOICE_DURATION_MS = 14_446;
const SCENE_END_MS = VOICE_DURATION_MS;
const AVATAR_SIZE = "600px";
const MOUTH_LEAD_MS = 50;
const MOUTH_PROPERTY_NAMES = Array.from({ length: 22 }, (_, index) => `v${100 + index}`);

export const MATT_RIVE_SRC = "/avatars/my-matt-visemes.riv";
export const MATT_SPEECH_SRC = "/assets/talking-head/speech.mp3";
export const MATT_RIVE_ARTBOARD = "Matt Visemes";
export const MATT_RIVE_STATE_MACHINE = "Matt_Visemes_SM";
export const MATT_RIVE_VIEW_MODEL = "VisemesVM";
export const MATT_RIVE_INSTANCE = "Instance";

/** Creates a one-hot mouth pose; a null property selects the neutral viseme. */
function createMattVisemeValues(property: string | null, value = 100) {
  return {
    ...Object.fromEntries(MOUTH_PROPERTY_NAMES.map((name) => [name, 0])),
    [property ?? "v100"]: value,
  };
}

/** Converts the reference viseme export to ViewModel events with its 50 ms lead. */
export function buildMattVisemeEventimes() {
  return voiceTimeline.visemes.map((viseme) => ({
    name: "avatar:viseme",
    startAt: Math.max(0, Math.round(viseme.start * 1000) - MOUTH_LEAD_MS),
    data: {
      values: createMattVisemeValues(viseme.property, viseme.value),
    },
  }));
}

/** Converts exported word timings to captions and clears each word at its end. */
export function buildMattWordEventimes() {
  return voiceTimeline.words.flatMap((word) => [
    {
      name: "subtitle:word",
      startAt: Math.round(word.start * 1000),
      data: { content: word.text },
    },
    {
      name: "subtitle:word",
      startAt: Math.round(word.end * 1000),
      data: { content: "" },
    },
  ]);
}

/** Creates a V2 player scene from the reference audio, transcript, and Matt ViewModel. */
export function createScene(): SceneDoc<string> {
  return {
    id: RIVE_SCENE_ID,
    stories: {
      "avatar-story": {
        id: "avatar-story",
        initial: { move: "@root" },
        persos: [
          {
            id: "rive-matt-stage",
            type: "tag",
            initial: {
              tag: "div",
              move: "@root",
              attr: { id: "rive-matt-stage" },
              style: {
                position: "relative",
                width: AVATAR_SIZE,
                height: AVATAR_SIZE,
                overflow: "hidden",
                background: "#1a1a2e",
              },
            },
            actions: {},
          },
          {
            id: "audio",
            type: "media",
            initial: {
              tag: "audio",
              src: MATT_SPEECH_SRC,
              sync: "master",
              move: { target: "rive-matt-stage" },
              style: {
                position: "absolute",
                left: "0",
                top: "0",
                width: "1px",
                height: "1px",
                opacity: 0,
                pointerEvents: "none",
              },
            },
            actions: {
              "audio:start": { broadcast: { type: "START" } },
            },
          },
          {
            id: "avatar",
            type: "rive",
            initial: {
              src: MATT_RIVE_SRC,
              artboard: MATT_RIVE_ARTBOARD,
              animations: [],
              move: { target: "rive-matt-stage" },
              width: 600,
              height: 600,
              style: {
                position: "absolute",
                inset: "0",
                width: "100%",
                height: "100%",
                display: "block",
              },
            },
            actions: {
              "avatar:start": { broadcast: { type: "START" } },
            },
          },
          {
            id: "avatar:viseme",
            type: "rive-view-model",
            initial: {
              stateMachine: MATT_RIVE_STATE_MACHINE,
              viewModel: MATT_RIVE_VIEW_MODEL,
              instance: MATT_RIVE_INSTANCE,
              blendSpeed: 18,
              rel: { host: "avatar" },
              values: createMattVisemeValues(null),
            },
            actions: {
              "avatar:start": { broadcast: { type: "START" } },
              "avatar:talk-start": { values: { isTalking: true } },
              "avatar:talk-end": { values: { isTalking: false } },
            },
          },
          {
            id: "caption",
            type: "tag",
            initial: {
              tag: "p",
              content: "",
              move: { target: "rive-matt-stage" },
              attr: { id: "rive-matt-caption" },
              style: {
                position: "absolute",
                bottom: "12px",
                left: "50%",
                transform: "translateX(-50%)",
                margin: "0",
                padding: "4px 10px",
                color: "#fff",
                fontSize: "15px",
                background: "rgba(0,0,0,0.55)",
                borderRadius: "4px",
                minHeight: "1.6em",
                textAlign: "center",
                pointerEvents: "none",
              },
            },
            actions: {
              "subtitle:word": {},
            },
          },
        ],
        eventimes: [
          { name: "scene:start", startAt: 0 },
          { name: "audio:start", startAt: 0 },
          { name: "avatar:start", startAt: 0 },
          { name: "avatar:talk-start", startAt: 0 },
          { name: "avatar:talk-end", startAt: VOICE_DURATION_MS },
          { name: "sequence:end", startAt: SCENE_END_MS },
          ...buildMattVisemeEventimes(),
          ...buildMattWordEventimes(),
        ],
      },
    },
  };
}
