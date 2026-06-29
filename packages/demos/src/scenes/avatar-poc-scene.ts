import type { SceneDoc } from "codplay/player/types";
import { createBlinkScheduleFn, createBreathTriggerFn, createHeadDriftFn } from "@codplay/avatar3d";
import { MOUTH_CUES, PRESTON_TO_TH, phraseWordsFR } from "./avatar-data/phrase-fr";

// End of speech, derived from the forced-alignment data (last viseme/word boundary)
// rather than a guessed constant — sequence:end fires exactly when the voice ends.
const SPEECH_END_MS = Math.max(
  Math.round(MOUTH_CUES[MOUTH_CUES.length - 1]!.end * 1000),
  phraseWordsFR[phraseWordsFR.length - 1]!.endMs,
);

function buildVisemeEventimes() {
  return MOUTH_CUES.map((c) => ({
    name: "avatar:viseme",
    startAt: Math.round(c.start * 1000),
    data: { viseme: PRESTON_TO_TH[c.value] ?? null },
  }));
}

function buildWordEventimes() {
  return phraseWordsFR.map((w) => ({
    name: "subtitle:word",
    startAt: w.startMs,
    data: { content: w.word },
  }));
}

export function createAvatarPocScene(): SceneDoc {
  return {
    id: "avatar-poc-scene",
    rootStories: ["avatar-story"],
    stories: {
      "avatar-story": {
        id: "avatar-story",
        persos: [
          {
            id: "avatar-stage",
            type: "tag",
            initial: {
              tag: "div",
              move: "@root",
              style: {
                position: "relative",
                width: "600px",
                height: "600px",
                overflow: "hidden",
              },
            },
            actions: {},
          },
          {
            id: "audio",
            type: "media",
            initial: {
              tag: "video",
              src: "/assets/1_7b_e.mp3",
              master: true,
              move: { parentId: "avatar-stage" },
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
            type: "avatar3d",
            initial: {
              move: { parentId: "avatar-stage" },
              src: "/avatars/avatarsdk.glb",
              // avatarsdk.glb is a ReadyPlayerMe model: morph names are prefixed "Wolf3D_Head_" etc.
              morphPrefix: /^Wolf3D_[^_]+_/,
              retarget: {
                Neck:          { z: -0.01, rx: -0.15 },
                Neck1:         { z: -0.01, rx: -0.15 },
                Neck2:         { z: -0.01, rx: -0.15 },
                LeftShoulder:  { rz: -0.3 },
                RightShoulder: { rz: 0.3 },
                scaleToEyesLevel: 1.0,
                origin: { y: -0.1 },
              },
              width: 600,
              height: 600,
              // Tight FOV (10°) framing head-to-shoulders.
              // camZ=3, camY=1.5 → visible range [1.24, 1.76] at that depth.
              camera: { fov: 10, position: { y: 1.5, z: 3 } },
            },
            actions: {
              "avatar:viseme":    true,
              "avatar:morph":     true,
              "avatar:gesture":   true,
              "avatar:gaze":      true,
              "avatar:mood":      true,
              "avatar:blink":      { blink:      createBlinkScheduleFn() },
              "avatar:head-drift": { headDrift:  createHeadDriftFn() },
              "avatar:breathe":    { breathe:    createBreathTriggerFn() },
            },
          },
          {
            id: "caption",
            type: "text",
            initial: {
              tag: "p",
              content: "",
              move: { parentId: "avatar-stage" },
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
          // Idle animations — seek-safe: direct eventimes replayed on any seek.
          { name: "avatar:blink", startAt: 0 },
          { name: "avatar:breathe", startAt: 0 },
          { name: "avatar:head-drift", startAt: 0 },
          // Gaze always on — seek-safe
          { name: "avatar:gaze", startAt: 0, data: { enabled: true } },
          // Gesture sequence — seeds from eventSeq → deterministic at seek
          { name: "avatar:gesture", startAt: 0, data: { gesture: "shrug" } },
          { name: "avatar:gesture", startAt: 3000, data: { gesture: "handup" } },
          { name: "avatar:gesture", startAt: 8000, data: { gesture: "shrug" } },
          { name: "avatar:gesture", startAt: 12500, data: { gesture: null } },
          // Fires exactly when the voice ends (forced-alignment derived) — stops idle loops.
          { name: "sequence:end", startAt: SPEECH_END_MS },
          ...buildVisemeEventimes(),
          ...buildWordEventimes(),
        ],
      },
    },
  } as unknown as SceneDoc;
}
