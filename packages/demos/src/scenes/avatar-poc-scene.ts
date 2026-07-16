import type { SceneDoc } from "codplay/player/types";
import { createBlinkScheduleFn, createBreathTriggerFn, createHeadDriftFn } from "@codplay/avatar3d";
import { MOUTH_CUES, PRESTON_TO_TH, phraseWordsFR } from "./avatar-data/phrase-fr";

// End of speech, derived from the forced-alignment data (last viseme/word boundary)
// rather than a guessed constant — sequence:end fires exactly when the voice ends.
const SPEECH_END_MS = Math.max(
  Math.round(MOUTH_CUES[MOUTH_CUES.length - 1]!.end * 1000),
  phraseWordsFR[phraseWordsFR.length - 1]!.endMs,
);
const MOTION_DEMO_START_MS = SPEECH_END_MS + 700;
const AVATAR_GESTURE_TRACK_ID = "avatar-poc-gesture-track";
const AVATAR_GESTURE_TRACK_START_MS = 250;
const AVATAR_GESTURE_TRACK_STEP_MS = 1800;
const AVATAR_GESTURE_MOTIONS = [
  "celebrate",
  "applause",
  "dance",
  "excited",
  "facepalm",
  "dismiss",
  "namaste_bow",
  "pray",
  "shrug_confused",
  "shrug_both",
  "ok_wink",
  "ok_sign",
  "thumbup_right",
  "thumbdown_right",
  "thumbs_up",
  "thumbs_down",
  "point",
  "wave_right",
  "wave_left",
  "hand_raise",
  "hand_raise_left",
] as const;
const AVATAR_GESTURE_TRACK_END_MS = AVATAR_GESTURE_TRACK_START_MS + AVATAR_GESTURE_TRACK_STEP_MS * AVATAR_GESTURE_MOTIONS.length;
const SCENE_END_MS = Math.max(MOTION_DEMO_START_MS + 8500, AVATAR_GESTURE_TRACK_END_MS + 1200);
const AVATAR_STANDARD_CAMERA = {
  fov: 10.5,
  position: { x: 0, y: 1.5, z: 3.85 },
  lookAt: { x: 0, y: 1.38, z: 0 },
};
const AVATAR_POINT_CAMERA = {
  fov: 14,
  position: { x: 0, y: 1.38, z: 5.25 },
  lookAt: { x: 0, y: 1.22, z: 0 },
  durationMs: 450,
};

type AvatarGestureTrackEvent = { ms: number; name: string; payload?: Record<string, unknown> };

function handleGestureTrackToggle(state: Readonly<Record<string, unknown>>) {
  const enabled = state.gestureTrackEnabled !== false;
  if (enabled) {
    return {
      update: { gestureTrackEnabled: false },
      events: [
        { name: "track:deactivate", data: { trackIds: [AVATAR_GESTURE_TRACK_ID] } },
        { name: "avatar:gesture-track:disabled" },
        { name: "avatar:motion", data: { motion: null } },
        { name: "avatar:motion", data: { motion: "pose_side" } },
      ],
    };
  }

  return {
    update: { gestureTrackEnabled: true },
    events: [
      { name: "track:activate", data: { trackIds: [AVATAR_GESTURE_TRACK_ID] } },
      { name: "avatar:gesture-track:enabled" },
      { name: "subtitle:word", data: { content: `Geste : ${AVATAR_GESTURE_MOTIONS[0]}` } },
      { name: "avatar:motion", data: { motion: AVATAR_GESTURE_MOTIONS[0] } },
    ],
  };
}

function handlePointGestureToggle(state: Readonly<Record<string, unknown>>) {
  const enabled = state.pointGestureEnabled === true;
  if (enabled) {
    return {
      update: { pointGestureEnabled: false },
      events: [
        { name: "avatar:point-gesture:disabled" },
        { name: "avatar:motion", data: { motion: null } },
        { name: "avatar:motion", data: { motion: "pose_side" } },
        { name: "avatar:camera", data: { camera: { ...AVATAR_STANDARD_CAMERA, durationMs: 450 } } },
      ],
    };
  }

  return {
    update: { pointGestureEnabled: true },
    events: [
      { name: "avatar:point-gesture:enabled" },
      { name: "subtitle:word", data: { content: "Geste : point" } },
      { name: "avatar:camera", data: { camera: AVATAR_POINT_CAMERA } },
      { name: "avatar:motion", data: { motion: "point" } },
    ],
  };
}

function buildVisemeEventimes() {
  return MOUTH_CUES.map((c) => ({
    name: "avatar:viseme",
    startAt: Math.round(c.start * 1000),
    data: {
      viseme: PRESTON_TO_TH[c.value] ?? null,
      endMs: Math.round(c.end * 1000),
    },
  }));
}

function buildWordEventimes() {
  return phraseWordsFR.map((w) => ({
    name: "subtitle:word",
    startAt: w.startMs,
    data: { content: w.word },
  }));
}

function createAvatarGestureTrack() {
  const events: AvatarGestureTrackEvent[] = AVATAR_GESTURE_MOTIONS.flatMap((motion, index) => {
    const ms = AVATAR_GESTURE_TRACK_START_MS + index * AVATAR_GESTURE_TRACK_STEP_MS;
    return [
      { ms: Math.max(0, ms - 250), name: "subtitle:word", payload: { content: `Geste : ${motion}` } },
      { ms, name: "avatar:motion", payload: { motion } },
    ];
  });

  return {
    id: AVATAR_GESTURE_TRACK_ID,
    active: false,
    order: 20,
    source: "story",
    events,
  };
}

export function createAvatarPocScene(): SceneDoc {
  return {
    id: "avatar-poc-scene",
    stories: {
      "avatar-story": {
        id: "avatar-story",
        initial: { move: "@root" },
        init: () => ({ gestureTrackEnabled: false, pointGestureEnabled: false }),
        straps: {
          "avatar-gesture-track-toggle": ({ state }) => handleGestureTrackToggle(state),
          "avatar-point-gesture-toggle": ({ state }) => handlePointGestureToggle(state),
        },
        listen: [
          { on: "avatar:gesture-track:toggle", straps: ["avatar-gesture-track-toggle"] },
          { on: "avatar:point-gesture:toggle", straps: ["avatar-point-gesture-toggle"] },
        ],
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
              // Tight centered bust framing; the avatar model carries the three-quarter yaw.
              camera: AVATAR_STANDARD_CAMERA,
              modelRotationY: 0.22,
            },
            actions: {
              "avatar:viseme":    true,
              "avatar:morph":     true,
              "avatar:pose":      true,
              "avatar:motion":    true,
              "avatar:camera":    true,
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
          {
            id: "avatar-gesture-track-toggle",
            type: "tag",
            initial: {
              tag: "button",
              content: "Activer les gestes",
              attr: { type: "button", title: "Activer/desactiver la piste de gestes" },
              move: { parentId: "avatar-stage" },
              style: {
                position: "absolute",
                top: "12px",
                right: "12px",
                zIndex: 4,
                padding: "7px 10px",
                border: "1px solid rgba(255,255,255,0.45)",
                borderRadius: "999px",
                color: "#fff",
                background: "rgba(22,163,74,0.88)",
                boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              },
            },
            emit: {
              click: {
                event: { name: "avatar:gesture-track:toggle" },
              },
            },
            actions: {
              "avatar:gesture-track:enabled": {
                content: "Désactiver les gestes",
                style: { background: "rgba(185,28,28,0.88)" },
              },
              "avatar:gesture-track:disabled": {
                content: "Activer les gestes",
                style: { background: "rgba(22,163,74,0.88)" },
              },
            },
          },
          {
            id: "avatar-point-gesture-toggle",
            type: "tag",
            initial: {
              tag: "button",
              content: "Pointer du doigt",
              attr: { type: "button", title: "Activer/desactiver le geste pointer du doigt" },
              move: { parentId: "avatar-stage" },
              style: {
                position: "absolute",
                top: "50px",
                right: "12px",
                zIndex: 4,
                padding: "7px 10px",
                border: "1px solid rgba(255,255,255,0.45)",
                borderRadius: "999px",
                color: "#fff",
                background: "rgba(22,163,74,0.88)",
                boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              },
            },
            emit: {
              click: {
                event: { name: "avatar:point-gesture:toggle" },
              },
            },
            actions: {
              "avatar:point-gesture:enabled": {
                content: "Arrêter de pointer",
                style: { background: "rgba(185,28,28,0.88)" },
              },
              "avatar:point-gesture:disabled": {
                content: "Pointer du doigt",
                style: { background: "rgba(22,163,74,0.88)" },
              },
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
          { name: "avatar:motion", startAt: 0, data: { motion: "pose_side" } },
          // MotionEngine-style gesture motions from the built-in avatar3d catalog.
          { name: "avatar:motion", startAt: 6800, data: { motion: "pose_straight" } },
          { name: "avatar:motion", startAt: 10200, data: { motion: "pose_side" } },
          { name: "avatar:motion", startAt: 11200, data: { motion: "thumbs_up" } },
          { name: "avatar:motion", startAt: 13600, data: { motion: "pose_turn" } },
          { name: "avatar:motion", startAt: 14000, data: { motion: "ok_sign" } },
          { name: "avatar:motion", startAt: 16400, data: { motion: "pose_side" } },
          { name: "avatar:motion", startAt: 16800, data: { motion: "shrug_both" } },
          // Semantic motions from the built-in avatar3d catalog.
          { name: "subtitle:word", startAt: MOTION_DEMO_START_MS - 500, data: { content: "Mood MotionEngine : thinking" } },
          { name: "avatar:motion", startAt: MOTION_DEMO_START_MS - 250, data: { motion: "thinking" } },
          { name: "subtitle:word", startAt: MOTION_DEMO_START_MS + 1350, data: { content: "Mood MotionEngine : angry" } },
          { name: "avatar:motion", startAt: MOTION_DEMO_START_MS + 1600, data: { motion: "angry" } },
          { name: "subtitle:word", startAt: MOTION_DEMO_START_MS + 3000, data: { content: "Mood MotionEngine : neutral" } },
          { name: "avatar:motion", startAt: MOTION_DEMO_START_MS + 3200, data: { motion: "neutral" } },
          { name: "subtitle:word", startAt: MOTION_DEMO_START_MS + 4050, data: { content: "Motion intégrée : warm_smile" } },
          { name: "avatar:motion", startAt: MOTION_DEMO_START_MS + 4300, data: { motion: "warm_smile" } },
          { name: "subtitle:word", startAt: MOTION_DEMO_START_MS + 5200, data: { content: "Motion tête : nod" } },
          { name: "avatar:motion", startAt: MOTION_DEMO_START_MS + 5400, data: { motion: "nod" } },
          { name: "subtitle:word", startAt: MOTION_DEMO_START_MS + 6300, data: { content: "Motion tête : head_shake" } },
          { name: "avatar:motion", startAt: MOTION_DEMO_START_MS + 6500, data: { motion: "head_shake" } },
          { name: "subtitle:word", startAt: MOTION_DEMO_START_MS + 7300, data: { content: "Fin de la séquence avatar3d" } },
          // Fires after speech and semantic-motion demo events so the full update is visible.
          { name: "sequence:end", startAt: SCENE_END_MS },
          ...buildVisemeEventimes(),
          ...buildWordEventimes(),
        ],
      },
    },
    tracks: {
      [AVATAR_GESTURE_TRACK_ID]: createAvatarGestureTrack(),
    },
  } as unknown as SceneDoc;
}
