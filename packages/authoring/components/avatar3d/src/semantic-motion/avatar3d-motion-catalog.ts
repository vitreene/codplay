import { BONE_MORPH_NAMES, GESTURE_TEMPLATES, MORPH_ALIASES, POSE_TEMPLATES } from '@codplay/avatar-engine'
import type { Avatar3DMotion, Avatar3DMotionCatalog, Avatar3DMotionSupport } from './avatar3d-motion-types.js'

const ARKIT_MORPH_NAMES = [
  'eyeBlinkLeft', 'eyeBlinkRight', 'eyeLookDownLeft', 'eyeLookDownRight',
  'eyeLookInLeft', 'eyeLookInRight', 'eyeLookOutLeft', 'eyeLookOutRight',
  'eyeLookUpLeft', 'eyeLookUpRight', 'eyeSquintLeft', 'eyeSquintRight',
  'eyeWideLeft', 'eyeWideRight', 'jawForward', 'jawLeft', 'jawRight', 'jawOpen',
  'mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthLeft', 'mouthRight',
  'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight',
  'mouthDimpleLeft', 'mouthDimpleRight', 'mouthStretchLeft', 'mouthStretchRight',
  'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper',
  'mouthPressLeft', 'mouthPressRight', 'mouthLowerDownLeft', 'mouthLowerDownRight',
  'mouthUpperUpLeft', 'mouthUpperUpRight', 'browDownLeft', 'browDownRight',
  'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight', 'cheekPuff',
  'cheekSquintLeft', 'cheekSquintRight', 'noseSneerLeft', 'noseSneerRight',
  'tongueOut',
  'viseme_sil', 'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD',
  'viseme_kk', 'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR',
  'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U',
] as const

export const DEFAULT_AVATAR3D_MOTION_CHANNELS = new Set<string>([
  ...ARKIT_MORPH_NAMES,
  ...BONE_MORPH_NAMES,
  ...Object.keys(MORPH_ALIASES),
  'eyesRotateX',
  'eyesRotateY',
  'eyeContact',
  'headMove',
  'gesture',
  'pose',
])

export const DEFAULT_AVATAR3D_GESTURE_NAMES = new Set<string>(Object.keys(GESTURE_TEMPLATES))
export const DEFAULT_AVATAR3D_POSE_NAMES = new Set<string>(Object.keys(POSE_TEMPLATES))

/**
 * Built-in semantic motions adapted from lhupyn/motion-engine `motions_th.json`.
 *
 * Source: https://github.com/lhupyn/motion-engine
 * License: MIT
 * Copyright (c) 2026 lhupyn
 *
 * Adaptation notes:
 * - morph/bone-morph channels are sampled into a pose layer;
 * - pose and gesture entries are routed to dedicated semantic controllers;
 * - rotation overlay entries are sampled as deterministic skeletal deltas;
 * - trajectories are expanded to explicit fade-in / hold / fade-out samples so
 *   the current CodPlay motion sampler can reconstruct play(t) = seek(t).
 */
export const BUILTIN_AVATAR3D_MOTIONS: Avatar3DMotionCatalog = {
  neutral: {
    _description: 'Default relaxed state with no strong emotion; resets MotionEngine mood-track morphs',
    _tags: ['calm', 'default', 'reset'],
    _track: 'mood',
  },

  happy: {
    _description: 'Visible positive MotionEngine mood for RPM avatars',
    _tags: ['joy', 'positive', 'warm'],
    _track: 'mood',
    dt: [700, 1800, 700],
    vs: {
      mouthSmile: [0, 0.55, 0.55, 0.55],
      eyeSquintLeft: [0, 0.25, 0.25, 0.25],
      eyeSquintRight: [0, 0.25, 0.25, 0.25],
      browInnerUp: [0, 0.25, 0.25, 0.25],
    },
  },

  sleep: {
    _description: 'Eyes closed drowsy MotionEngine mood',
    _tags: ['tired', 'sleeping', 'rest'],
    _track: 'mood',
    dt: [1000, 3000, 1000],
    vs: {
      eyeBlinkLeft: [0, 0.9, 0.9, 0.9],
      eyeBlinkRight: [0, 0.9, 0.9, 0.9],
      eyeSquintLeft: [0, 0.5, 0.5, 0.5],
      eyeSquintRight: [0, 0.5, 0.5, 0.5],
      browDownLeft: [0, 0.2, 0.2, 0.2],
      browDownRight: [0, 0.2, 0.2, 0.2],
      jawOpen: [0, 0.05, 0.05, 0.05],
    },
  },

  surprise: {
    _description: 'Persistent surprised MotionEngine mood',
    _tags: ['surprise', 'shock', 'expression'],
    _track: 'mood',
    dt: [300, 1800, 600],
    vs: {
      browInnerUp: [0, 0.8, 0.8, 0.8],
      eyeWideLeft: [0, 0.7, 0.7, 0.7],
      eyeWideRight: [0, 0.7, 0.7, 0.7],
      jawOpen: [0, 0.5, 0.5, 0.5],
      mouthFunnel: [0, 0.3, 0.3, 0.3],
      headRotateX: [0, -0.1, -0.1, -0.1],
      bodyRotateX: [0, -0.05, -0.05, -0.05],
    },
  },

  pose_side: {
    _description: 'TH default side body pose baseline',
    _tags: ['pose', 'body', 'idle'],
    _track: 'action',
    dt: [1200],
    vs: {
      pose: ['side'],
    },
  },

  pose_straight: {
    _description: 'TH straight body pose baseline',
    _tags: ['pose', 'body', 'idle'],
    _track: 'action',
    dt: [1200],
    vs: {
      pose: ['straight'],
    },
  },

  pose_hip: {
    _description: 'TH hand-on-hip body pose baseline',
    _tags: ['pose', 'body', 'idle'],
    _track: 'action',
    dt: [1200],
    vs: {
      pose: ['hip'],
    },
  },

  pose_turn: {
    _description: 'TH turned body pose baseline',
    _tags: ['pose', 'body', 'idle'],
    _track: 'action',
    dt: [1200],
    vs: {
      pose: ['turn'],
    },
  },

  pose_wide: {
    _description: 'TH wide expressive body pose baseline',
    _tags: ['pose', 'body', 'idle'],
    _track: 'action',
    dt: [1200],
    vs: {
      pose: ['wide'],
    },
  },

  neutral_face: {
    _description: 'Neutral blank stare with straight pose and wide eyes',
    _tags: ['expression', 'neutral'],
    _track: 'action',
    dt: [300, 2000],
    rescale: [0, 1],
    vs: {
      browInnerUp: [0.4],
      eyeWideLeft: [0.7],
      eyeWideRight: [0.7],
      mouthPressLeft: [0.6],
      mouthPressRight: [0.6],
      mouthRollLower: [0.3],
      mouthStretchLeft: [1],
      mouthStretchRight: [1],
    },
  },

  smug: {
    _description: 'Smug side-glance with one-sided smirk and raised brow',
    _tags: ['expression', 'attitude'],
    _track: 'action',
    dt: [300, 2000],
    rescale: [0, 1],
    vs: {
      eyeContact: [0],
      browDownRight: [0.1],
      browInnerUp: [0.7],
      browOuterUpRight: [0.2],
      eyeLookInRight: [0.7],
      eyeLookOutLeft: [0.7],
      eyeSquintLeft: [1],
      eyeSquintRight: [0.8],
      mouthLeft: [0.4],
      mouthPucker: [0.4],
      mouthShrugLower: [0.3],
      mouthShrugUpper: [0.2],
      mouthSmile: [0.2],
      mouthSmileLeft: [0.4],
      mouthSmileRight: [0.2],
      mouthStretchLeft: [0.5],
      mouthUpperUpLeft: [0.6],
      noseSneerLeft: [0.7],
    },
  },

  slight_smile: {
    _description: 'Subtle gentle smile',
    _tags: ['expression', 'happy'],
    _track: 'action',
    dt: [300, 1400, 300],
    vs: {
      mouthSmile: [0, 0.5, 0.5, 0],
    },
  },

  warm_smile: {
    _description: 'Warm smile with squinted eyes and nose crinkle',
    _tags: ['expression', 'happy'],
    _track: 'action',
    dt: [300, 1400, 300],
    vs: {
      browInnerUp: [0, 0.6, 0.6, 0],
      eyeSquintLeft: [0, 1, 1, 0],
      eyeSquintRight: [0, 1, 1, 0],
      mouthSmile: [0, 0.7, 0.7, 0],
      noseSneerLeft: [0, 0.7, 0.7, 0],
      noseSneerRight: [0, 0.7, 0.7, 0],
    },
  },

  grin: {
    _description: 'Big grin with open mouth and dimples',
    _tags: ['expression', 'happy'],
    _track: 'action',
    dt: [300, 2000],
    rescale: [0, 1],
    vs: {
      browInnerUp: [0.6],
      jawOpen: [0.1],
      mouthDimpleLeft: [0.2],
      mouthDimpleRight: [0.2],
      mouthOpen: [0.3],
      mouthPressLeft: [0.3],
      mouthPressRight: [0.3],
      mouthRollLower: [0.4],
      mouthShrugUpper: [0.4],
      mouthSmile: [0.7],
      mouthUpperUpLeft: [0.3],
      mouthUpperUpRight: [0.3],
      noseSneerLeft: [0.4],
      noseSneerRight: [0.4],
    },
  },

  open_grin: {
    _description: 'Wide-eyed grin with open mouth',
    _tags: ['expression', 'happy'],
    _track: 'action',
    dt: [300, 2000],
    rescale: [0, 1],
    vs: {
      browInnerUp: [0.6],
      eyeWideLeft: [0.7],
      eyeWideRight: [0.7],
      jawOpen: [0.1],
      mouthDimpleLeft: [0.2],
      mouthDimpleRight: [0.2],
      mouthOpen: [0.3],
      mouthPressLeft: [0.3],
      mouthPressRight: [0.3],
      mouthRollLower: [0.4],
      mouthShrugUpper: [0.4],
      mouthSmile: [0.7],
      mouthUpperUpLeft: [0.3],
      mouthUpperUpRight: [0.3],
      noseSneerLeft: [0.4],
      noseSneerRight: [0.4],
    },
  },

  squint_smile: {
    _description: 'Happy squinting smile with jaw open',
    _tags: ['expression', 'happy'],
    _track: 'action',
    dt: [300, 2000],
    rescale: [0, 1],
    vs: {
      browInnerUp: [0.3],
      eyeSquintLeft: [1],
      eyeSquintRight: [1],
      jawOpen: [0.2],
      mouthDimpleLeft: [0.2],
      mouthDimpleRight: [0.2],
      mouthOpen: [0.3],
      mouthPressLeft: [0.3],
      mouthPressRight: [0.3],
      mouthRollLower: [0.4],
      mouthShrugUpper: [0.4],
      mouthSmile: [0.7],
      mouthUpperUpLeft: [0.3],
      mouthUpperUpRight: [0.3],
      noseSneerLeft: [0.4],
      noseSneerRight: [0.4],
    },
  },

  beam: {
    _description: 'Beaming closed-eye grin',
    _tags: ['expression', 'happy'],
    _track: 'action',
    dt: [300, 2000],
    rescale: [0, 1],
    vs: {
      browInnerUp: [0.3],
      eyeSquintLeft: [1],
      eyeSquintRight: [1],
      jawOpen: [0.3],
      mouthDimpleLeft: [0.2],
      mouthDimpleRight: [0.2],
      mouthPressLeft: [0.5],
      mouthPressRight: [0.5],
      mouthShrugUpper: [0.4],
      mouthSmile: [0.7],
      mouthUpperUpLeft: [0.3],
      mouthUpperUpRight: [0.3],
      noseSneerLeft: [0.4],
      noseSneerRight: [0.4],
    },
  },

  laugh_closed: {
    _description: 'Eyes-closed laughing with wide grin',
    _tags: ['expression', 'happy'],
    _track: 'action',
    dt: [300, 1400, 300],
    vs: {
      browInnerUp: [0, 0.3, 0.3, 0],
      eyesClosed: [0, 0.6, 0.6, 0],
      jawOpen: [0, 0.3, 0.3, 0],
      mouthSmile: [0, 0.7, 0.7, 0],
      mouthShrugUpper: [0, 0.4, 0.4, 0],
    },
  },

  sad_frown: {
    _description: 'Simple frown with pursed lower lip',
    _tags: ['expression', 'sad'],
    _track: 'action',
    dt: [500, 1000, 500],
    vs: {
      mouthFrownLeft: [0, 1, 1, 0],
      mouthFrownRight: [0, 1, 1, 0],
      mouthPucker: [0, 0.1, 0.1, 0],
      mouthRollLower: [0, 0.8, 0.8, 0],
    },
  },

  kiss_eyes_closed: {
    _description: 'Sweet kiss with closed eyes and puckered lips',
    _tags: ['expression', 'love'],
    _track: 'action',
    dt: [500, 1000, 500],
    vs: {
      browInnerUp: [0, 0.6, 0.6, 0],
      eyeBlinkLeft: [0, 1, 1, 0],
      eyeBlinkRight: [0, 1, 1, 0],
      mouthPucker: [0, 0.5, 0.5, 0],
      viseme_U: [0, 1, 1, 0],
    },
  },

  crying_laugh: {
    _description: 'Laughing so hard with tears, eyes squinted shut',
    _tags: ['expression', 'happy'],
    _track: 'action',
    dt: [300, 2000],
    rescale: [0, 1],
    vs: {
      browInnerUp: [0.3],
      eyeSquintLeft: [1],
      eyeSquintRight: [1],
      eyesClosed: [0.6],
      jawOpen: [0.3],
      mouthDimpleLeft: [0.2],
      mouthDimpleRight: [0.2],
      mouthPressLeft: [0.5],
      mouthPressRight: [0.5],
      mouthShrugUpper: [0.4],
      mouthSmile: [0.7],
      mouthUpperUpLeft: [0.3],
      mouthUpperUpRight: [0.3],
      noseSneerLeft: [0.4],
      noseSneerRight: [0.4],
    },
  },

  disappointed: {
    _description: 'Disappointed look with drooped eyes and slumped posture',
    _tags: ['expression', 'sad'],
    _track: 'action',
    dt: [1000, 1000],
    rescale: [0, 1],
    vs: {
      browInnerUp: [0.7],
      eyeSquintLeft: [1],
      eyeSquintRight: [1],
      eyesClosed: [0.5],
      bodyRotateX: [0.3],
      mouthClose: [0.2],
      mouthFrownLeft: [1],
      mouthFrownRight: [1],
      mouthPucker: [1],
      mouthRollLower: [1],
      mouthShrugLower: [0.2],
      mouthUpperUpLeft: [0.8],
      mouthUpperUpRight: [0.8],
    },
  },

  side_glance: {
    _description: 'Suspicious side glance with eyes only',
    _tags: ['expression', 'attitude'],
    _track: 'action',
    dt: [500, 1500],
    rescale: [0, 1],
    vs: {
      eyeContact: [0],
      headRotateY: [0.12, 0.12, 0],
    },
  },

  hand_raise: {
    _description: 'Raise right hand with smile',
    _tags: ['gesture', 'greeting'],
    _track: 'action',
    dt: [300, 2000],
    rescale: [0, 1],
    vs: {
      mouthSmile: [0.5],
      gesture: [['handup', null, true], null],
    },
  },

  hand_raise_left: {
    _description: 'Raise left hand with smile',
    _tags: ['gesture', 'greeting'],
    _track: 'action',
    dt: [300, 2000],
    rescale: [0, 1],
    vs: {
      mouthSmile: [0.5],
      gesture: [['handup', null], null],
    },
  },

  thumbs_up: {
    _description: 'Thumbs up with smile',
    _tags: ['gesture', 'positive'],
    _track: 'action',
    dt: [300, 2000],
    rescale: [0, 1],
    vs: {
      mouthSmile: [0.5],
      gesture: [['thumbup', null], null],
    },
  },

  thumbs_down: {
    _description: 'Thumbs down with angry frown',
    _tags: ['gesture', 'negative'],
    _track: 'action',
    dt: [300, 2000],
    rescale: [0, 1],
    vs: {
      browDownLeft: [1],
      browDownRight: [1],
      eyesLookUp: [0.2],
      jawForward: [0.3],
      mouthFrownLeft: [1],
      mouthFrownRight: [1],
      bodyRotateX: [0.15],
      gesture: [['thumbdown', null], null],
    },
  },

  ok_sign: {
    _description: 'OK hand sign with smile',
    _tags: ['gesture', 'positive'],
    _track: 'action',
    dt: [300, 2000],
    rescale: [0, 1],
    vs: {
      mouthSmile: [0.5],
      gesture: [['ok', null], null],
    },
  },

  shrug_both: {
    _description: 'Confused shrug with both palms up',
    _tags: ['gesture', 'confused'],
    _track: 'action',
    dt: [1000, 1500],
    rescale: [0, 1],
    vs: {
      gesture: [['shrug', null], null],
    },
  },

  pray: {
    _description: 'Prayer hands with closed eyes and slight bow',
    _tags: ['gesture', 'respect'],
    _track: 'action',
    dt: [1500, 300, 1000],
    rescale: [0, 1, 0],
    vs: {
      eyeBlinkLeft: [0, 1],
      eyeBlinkRight: [0, 1],
      bodyRotateX: [0],
      bodyRotateZ: [0.1],
      gesture: [['namaste', null], null],
    },
  },

  rage: {
    _description: 'Furious rage with furrowed brows and forward lean',
    _tags: ['expression', 'angry'],
    _track: 'action',
    dt: [500, 1200, 500],
    vs: {
      browDownLeft: [0, 1, 1, 0],
      browDownRight: [0, 1, 1, 0],
      eyesLookUp: [0, 0.2, 0.2, 0],
      jawForward: [0, 0.3, 0.3, 0],
      mouthFrownLeft: [0, 1, 1, 0],
      mouthFrownRight: [0, 1, 1, 0],
      bodyRotateX: [0, 0.15, 0.15, 0],
    },
  },

  scream: {
    _description: 'Screaming in terror with wide eyes and open jaw',
    _tags: ['expression', 'fear'],
    _track: 'action',
    dt: [500, 1200, 500],
    vs: {
      browInnerUp: [0, 0.8, 0.8, 0],
      eyeWideLeft: [0, 0.5, 0.5, 0],
      eyeWideRight: [0, 0.5, 0.5, 0],
      jawOpen: [0, 0.7, 0.7, 0],
      mouthFunnel: [0, 0.5, 0.5, 0],
    },
  },

  nod: {
    _description: 'Affirmative head nod',
    _tags: ['gesture', 'agreement', 'head'],
    _track: 'action',
    dt: [350, 350, 350],
    vs: {
      headRotateX: [0, 0.15, 0.1, 0],
      headRotateZ: [0, 0, 0, 0],
    },
  },

  head_shake: {
    _description: 'Disapproving head shake',
    _tags: ['gesture', 'disagreement', 'head'],
    _track: 'action',
    dt: [350, 350, 350, 350],
    vs: {
      headRotateY: [0, -0.08, 0.08, -0.08, 0],
      headRotateZ: [0, 0, 0, 0, 0],
    },
  },

  look_up: {
    _description: 'Looking upward with wide eyes and raised brows, as if pondering',
    _tags: ['thinking', 'curious', 'head'],
    _track: 'action',
    dt: [800, 1000, 800],
    rescale: [0, 1, 0],
    vs: {
      headMove: [0],
      headRotateX: [-0.3, -0.3, 0],
      bodyRotateX: [-0.1, -0.1, 0],
      eyeWideLeft: [0.5, 0.5, 0],
      eyeWideRight: [0.5, 0.5, 0],
      browInnerUp: [0.6, 0.6, 0],
      browOuterUpLeft: [0.4, 0.4, 0],
      browOuterUpRight: [0.4, 0.4, 0],
      mouthOpen: [0.1, 0.1, 0],
    },
  },

  look_down: {
    _description: 'Looking downward with squinted eyes, reflective or shy',
    _tags: ['thinking', 'shy', 'head'],
    _track: 'action',
    dt: [600, 800, 600],
    rescale: [0, 1, 0],
    vs: {
      headMove: [0],
      headRotateX: [0.25, 0.25, 0],
      bodyRotateX: [0.08, 0.08, 0],
      eyeSquintLeft: [0.5, 0.5, 0],
      eyeSquintRight: [0.5, 0.5, 0],
    },
  },

  bow: {
    _description: 'Respectful bow with closed eyes and gentle smile',
    _tags: ['respect', 'formal', 'body'],
    _track: 'action',
    dt: [600, 300, 800, 800],
    rescale: [0, 0, 1, 0],
    vs: {
      headMove: [0],
      bodyRotateX: [0.2, 0.25, 0.25, 0],
      headRotateX: [0.15, 0.2, 0.2, 0],
      eyeBlinkLeft: [0, 0.8, 0.8, 0],
      eyeBlinkRight: [0, 0.8, 0.8, 0],
      mouthSmile: [0.2],
    },
  },

  jump: {
    _description: 'Excited jump with wide eyes and big smile',
    _tags: ['excitement', 'energy', 'body'],
    _track: 'action',
    dt: [250, 200, 150, 200, 400],
    vs: {
      headMove: [0],
      bodyRotateX: [0.15, -0.1, -0.1, 0.1, 0],
      headRotateX: [0.1, -0.15, -0.1, 0.08, 0],
      mouthOpen: [0, 0.3, 0.3, 0, 0],
      eyeWideLeft: [0, 0.6, 0.6, 0, 0],
      eyeWideRight: [0, 0.6, 0.6, 0, 0],
      browInnerUp: [0, 0.5, 0.5, 0, 0],
      mouthSmile: [0, 0.6, 0.6, 0, 0],
    },
    _overlay: {
      bones: {
        Hips: { freq: 0, amp: [0, 0, 0], phase: 0, custom: 'jump' },
      },
      delay: 0,
      duration: 1200,
    },
  },

  surprised: {
    _description: 'Shocked expression with wide eyes, open mouth, and slight lean back',
    _tags: ['surprise', 'shock', 'expression'],
    _track: 'action',
    dt: [200, 1500, 500],
    rescale: [0, 1, 0],
    vs: {
      browInnerUp: [0.8],
      eyeWideLeft: [0.7],
      eyeWideRight: [0.7],
      jawOpen: [0.5],
      mouthFunnel: [0.3],
      headRotateX: [-0.1, -0.1, 0],
      bodyRotateX: [-0.05, -0.05, 0],
    },
  },

  wink: {
    _description: 'Playful wink with left eye, body lean, and cheeky smile',
    _tags: ['playful', 'flirty', 'wink', 'expression'],
    _track: 'action',
    dt: [500, 200, 500, 500],
    rescale: [0, 0, 0, 1],
    vs: {
      mouthSmile: [0.5],
      mouthOpen: [0.2],
      mouthSmileLeft: [0, 0.5, 0],
      eyeBlinkLeft: [0, 0.7, 0],
      bodyRotateX: [0.05, 0.05, 0.05, 0],
      bodyRotateZ: [-0.05, -0.05, -0.05, 0],
      browDownLeft: [0, 0.7, 0],
      cheekSquintLeft: [0, 0.7, 0],
      eyeSquintLeft: [0, 1, 0],
    },
  },

  laugh: {
    _description: 'Hearty laugh with body shakes, wide smile, and spine oscillation',
    _tags: ['joy', 'humor', 'expression', 'body'],
    _track: 'action',
    dt: [300, 300, 300, 300, 300, 500],
    vs: {
      mouthSmile: [0.9],
      mouthOpen: [0.3, 0.5, 0.3, 0.5, 0.3, 0],
      jawOpen: [0.2, 0.4, 0.2, 0.4, 0.2, 0],
      eyeSquintLeft: [0.8],
      eyeSquintRight: [0.8],
      cheekSquintLeft: [0.6],
      cheekSquintRight: [0.6],
      noseSneerLeft: [0.3],
      noseSneerRight: [0.3],
      bodyRotateX: [0.05, -0.02, 0.05, -0.02, 0.05, 0],
    },
    _overlay: {
      bones: {
        Spine: { freq: 10, amp: [0.02, 0, 0.01] },
        Head: { freq: 10, amp: [0.01, 0, 0.01], phase: 1.5707963267948966 },
      },
      delay: 200,
      duration: 1800,
    },
  },

  yawn: {
    _description: 'Tired yawn with wide jaw, squinted eyes, and slight lean back',
    _tags: ['tired', 'bored', 'expression'],
    _track: 'action',
    dt: [800, 1500, 800],
    rescale: [0, 1, 0],
    vs: {
      jawOpen: [0.8],
      mouthOpen: [0.7],
      mouthFunnel: [0.5],
      eyeSquintLeft: [0.9],
      eyeSquintRight: [0.9],
      eyesClosed: [0.4],
      browInnerUp: [0.7],
      headRotateX: [-0.1, -0.1, 0],
      bodyRotateX: [-0.05, -0.05, 0],
    },
  },

  tongue_out: {
    _description: 'Playful tongue out with closed eyes and big smile',
    _tags: ['expression', 'playful'],
    _track: 'action',
    dt: [300, 100, 1500, 500, 500],
    rescale: [0, 0, 1, 0, 0],
    vs: {
      browInnerUp: [0.8],
      eyesClosed: [1],
      jawOpen: [0.7],
      mouthFunnel: [0.5],
      mouthSmile: [1],
      tongueOut: [0, 1, 1, 0],
    },
  },

  eyeroll: {
    _description: 'Eye roll with raised brows and mild annoyance',
    _tags: ['attitude', 'eyes'],
    _track: 'action',
    dt: [500, 800, 500],
    rescale: [0, 1, 0],
    vs: {
      browInnerUp: [0.6],
      eyeWideLeft: [0.4],
      eyeWideRight: [0.4],
      eyesRotateX: [0.7],
      mouthPucker: [0.3],
      mouthRollLower: [0.3],
      mouthRollUpper: [0.3],
    },
  },

  cheek_puff: {
    _description: 'Cheek puff with closed pressed mouth',
    _tags: ['expression', 'mouth'],
    _track: 'action',
    dt: [300, 1200, 500],
    rescale: [0, 1, 0],
    vs: {
      cheekPuff: [1],
      mouthClose: [0.8],
      mouthPressLeft: [0.4],
      mouthPressRight: [0.4],
      eyeSquintLeft: [0.2],
      eyeSquintRight: [0.2],
    },
  },

  sigh: {
    _description: 'Sigh with chest inhale, head drop, closed eyes, and frown',
    _tags: ['breath', 'sad', 'body'],
    _track: 'action',
    dt: [800, 1200, 800],
    rescale: [0, 1, 0],
    vs: {
      chestInhale: [1],
      bodyRotateX: [0.1],
      headRotateX: [0.12],
      eyesClosed: [0.4],
      eyeSquintLeft: [0.5],
      eyeSquintRight: [0.5],
      mouthOpen: [0.2],
      mouthFrownLeft: [0.4],
      mouthFrownRight: [0.4],
      browInnerUp: [0.4],
    },
  },

  deep_breath: {
    _description: 'Deep breath with visible chest inhale and relaxed face',
    _tags: ['breath', 'calm', 'body'],
    _track: 'action',
    dt: [1000, 1200, 1000],
    rescale: [0, 1, 0],
    vs: {
      chestInhale: [1],
      bodyRotateX: [-0.05],
      headRotateX: [-0.05],
      eyeBlinkLeft: [0.4],
      eyeBlinkRight: [0.4],
      mouthOpen: [0.15],
      browInnerUp: [0.3],
    },
  },

  point: {
    _description: 'Pointing gesture with focused expression',
    _tags: ['direction', 'attention', 'hand'],
    _track: 'action',
    dt: [300, 2000, 500],
    rescale: [0, 1, 0],
    vs: {
      browDownLeft: [0.3],
      browDownRight: [0.3],
      eyeSquintLeft: [0.4],
      eyeSquintRight: [0.4],
      mouthPressLeft: [0.3],
      mouthPressRight: [0.3],
      gesture: [['point', null, true], null],
    },
  },

  celebrate: {
    _description: 'Joyful celebration with raised hand, hip bounce, and beaming smile',
    _tags: ['joy', 'celebration', 'energy', 'hand'],
    _track: 'action',
    dt: [300, 800, 800, 500],
    rescale: [0, 0.5, 0.5, 0],
    vs: {
      mouthSmile: [0.8],
      mouthOpen: [0.3],
      eyeSquintLeft: [0.6],
      eyeSquintRight: [0.6],
      browInnerUp: [0.5],
      noseSneerLeft: [0.5],
      noseSneerRight: [0.5],
      jawOpen: [0.2],
      gesture: [['handup', null, true], null],
    },
    _overlay: {
      bones: {
        RightHand: { freq: 10, amp: [0.08, 0.12, 0.08] },
        Hips: { freq: 4, amp: [0, 0.03, 0] },
      },
      delay: 400,
      duration: 2000,
    },
  },

  turn_around: {
    _description: 'Playful 360-degree spin with a smile',
    _tags: ['playful', 'body'],
    _track: 'action',
    dt: [600, 600, 600, 400],
    vs: {
      headMove: [0],
      bodyRotateY: [-0.8, -1.6, -2.4, 0],
      mouthSmile: [0.2],
    },
  },

  applause: {
    _description: 'Clapping hands with joyful expression and hand oscillation overlay',
    _tags: ['approval', 'celebration', 'hand'],
    _track: 'action',
    dt: [300, 2000, 500],
    rescale: [0, 1, 0],
    vs: {
      mouthSmile: [0.7],
      eyeSquintLeft: [0.4],
      eyeSquintRight: [0.4],
      browInnerUp: [0.4],
      noseSneerLeft: [0.3],
      noseSneerRight: [0.3],
      gesture: [['namaste', null], null],
    },
    _overlay: {
      bones: {
        RightHand: { freq: 12, amp: [0.06, 0.06, 0], phase: 0 },
        LeftHand: { freq: 12, amp: [0.06, 0.06, 0], phase: 3.14159265358979 },
        RightForeArm: { freq: 12, amp: [0.03, 0, 0.03], phase: 0 },
        LeftForeArm: { freq: 12, amp: [0.03, 0, 0.03], phase: 3.14159265358979 },
      },
      delay: 300,
      duration: 2200,
    },
  },

  dance: {
    _description: 'Rhythmic dance with hip bounce, arm wave, and spine sway',
    _tags: ['joy', 'energy', 'body', 'hand'],
    _track: 'action',
    dt: [300, 400, 400, 400, 400, 400, 300],
    vs: {
      mouthSmile: [0.7],
      eyeSquintLeft: [0.3],
      eyeSquintRight: [0.3],
      headRotateZ: [0.1, -0.1, 0.1, -0.1, 0.1, -0.1, 0],
      bodyRotateZ: [0.05, -0.05, 0.05, -0.05, 0.05, -0.05, 0],
      gesture: [['handup', null, true], null],
    },
    _overlay: {
      bones: {
        Hips: { freq: 5, amp: [0, 0.04, 0.03] },
        RightHand: { freq: 5, amp: [0.05, 0.08, 0.05], phase: 0 },
        Spine: { freq: 2.5, amp: [0.02, 0, 0.02] },
      },
      delay: 200,
      duration: 2800,
    },
  },

  facepalm: {
    _description: 'Facepalm with hand to forehead, closed eyes, and slight body slump',
    _tags: ['frustration', 'disbelief', 'hand'],
    _track: 'action',
    dt: [600, 1500, 600],
    rescale: [0, 1, 0],
    vs: {
      browDownLeft: [0.6],
      browDownRight: [0.6],
      eyesClosed: [0.5],
      mouthFrownLeft: [0.5],
      mouthFrownRight: [0.5],
      headRotateX: [0.15, 0.15, 0],
      bodyRotateX: [0.1, 0.1, 0],
      gesture: [['handup', null, true], null],
    },
  },

  excited: {
    _description: 'Bursting with excitement: wide eyes, rapid hand wave, and hip bounce',
    _tags: ['excitement', 'energy', 'hand', 'body'],
    _track: 'action',
    dt: [200, 300, 300, 300, 300, 300],
    vs: {
      mouthSmile: [0.9],
      mouthOpen: [0.4],
      eyeWideLeft: [0.6],
      eyeWideRight: [0.6],
      browInnerUp: [0.7],
      browOuterUpLeft: [0.5],
      browOuterUpRight: [0.5],
      cheekSquintLeft: [0.4],
      cheekSquintRight: [0.4],
      bodyRotateX: [-0.05, 0.05, -0.05, 0.05, -0.05, 0],
      gesture: [['handup', null, true], null],
    },
    _overlay: {
      bones: {
        RightHand: { freq: 10, amp: [0.06, 0.1, 0.06], phase: 0 },
        Hips: { freq: 6, amp: [0.01, 0.03, 0.01] },
      },
      delay: 100,
      duration: 1700,
    },
  },

  dismiss: {
    _description: 'Dismissive wave-off with head turn and disinterested expression',
    _tags: ['dismissal', 'negative', 'hand'],
    _track: 'action',
    dt: [300, 1500, 500],
    rescale: [0, 1, 0],
    vs: {
      browDownLeft: [0.4],
      browDownRight: [0.4],
      eyeSquintLeft: [0.3],
      eyeSquintRight: [0.3],
      mouthFrownLeft: [0.3],
      mouthFrownRight: [0.3],
      mouthPressLeft: [0.3],
      headRotateY: [-0.15, -0.15, 0],
      bodyRotateY: [-0.08, -0.08, 0],
      gesture: [['side', null, true], null],
    },
    _overlay: {
      bones: {
        RightHand: { freq: 6, amp: [0, 0.08, 0.08], phase: 0 },
        RightForeArm: { freq: 6, amp: [0.03, 0, 0.05], phase: 1.5707963267948966 },
      },
      delay: 300,
      duration: 1500,
    },
  },

  head_circles: {
    _description: 'Small head circles with procedural overlay',
    _tags: ['head', 'idle', 'motion'],
    _track: 'action',
    dt: [300, 1800, 300],
    rescale: [0, 1, 0],
    vs: {
      headMove: [0],
      headRotateX: [0.08],
      headRotateZ: [0.08],
    },
    _overlay: {
      bones: {
        Head: { freq: 5, amp: [0.06, 0, 0.06], phase: 1.5707963267948966 },
      },
      delay: 0,
      duration: 1800,
    },
  },

  shiver: {
    _description: 'Quick shiver with tense face and body vibration',
    _tags: ['nervous', 'cold', 'body'],
    _track: 'action',
    dt: [200, 1200, 300],
    rescale: [0, 1, 0],
    vs: {
      eyeSquintLeft: [0.5],
      eyeSquintRight: [0.5],
      mouthPressLeft: [0.5],
      mouthPressRight: [0.5],
      jawOpen: [0.1],
    },
    _overlay: {
      bones: {
        Spine: { freq: 18, amp: [0.02, 0.02, 0.02] },
        Head: { freq: 18, amp: [0.015, 0.015, 0.015] },
      },
      delay: 0,
      duration: 1200,
    },
  },

  chew: {
    _description: 'Chewing mouth motion with cheek puff',
    _tags: ['mouth', 'loop'],
    _track: 'action',
    dt: [180, 180, 180, 180, 180, 300],
    vs: {
      jawOpen: [0.15, 0.35, 0.12, 0.32, 0.1, 0],
      mouthClose: [0.2, 0.6, 0.2, 0.6, 0.2, 0],
      mouthPressLeft: [0.2, 0.4, 0.2, 0.4, 0.2, 0],
      mouthPressRight: [0.2, 0.4, 0.2, 0.4, 0.2, 0],
      cheekPuff: [0.2, 0.5, 0.2, 0.5, 0.2, 0],
    },
  },

  vibrate: {
    _description: 'Excited vibration with wide eyes and smile',
    _tags: ['energy', 'body'],
    _track: 'action',
    dt: [200, 1200, 300],
    rescale: [0, 1, 0],
    vs: {
      eyeWideLeft: [0.5],
      eyeWideRight: [0.5],
      mouthSmile: [0.6],
    },
    _overlay: {
      bones: {
        Spine: { freq: 20, amp: [0.015, 0.015, 0.015] },
        Head: { freq: 20, amp: [0.01, 0.01, 0.01] },
      },
      delay: 0,
      duration: 1200,
    },
  },

  wink_smile: {
    _description: 'Charming wink with smile and body lean',
    _tags: ['expression', 'playful'],
    _track: 'action',
    dt: [500, 200, 500, 500],
    rescale: [0, 0, 0, 1],
    vs: {
      mouthSmile: [0.5],
      mouthOpen: [0.2],
      mouthSmileLeft: [0, 0.5, 0],
      eyeBlinkLeft: [0, 0.7, 0],
      eyeBlinkRight: [0, 0, 0],
      bodyRotateX: [0.05, 0.05, 0.05, 0],
      bodyRotateZ: [-0.05, -0.05, -0.05, 0],
      browDownLeft: [0, 0.7, 0],
      cheekSquintLeft: [0, 0.7, 0],
      eyeSquintLeft: [0, 1, 0],
      eyesClosed: [0],
    },
  },

  sobbing: {
    _description: 'Heavy crying with open mouth and furrowed brows',
    _tags: ['expression', 'sad'],
    _track: 'action',
    dt: [1000, 1000],
    rescale: [0, 1],
    vs: {
      browInnerUp: [1],
      eyeSquintLeft: [1],
      eyeSquintRight: [1],
      eyesClosed: [0.1],
      jawOpen: [0],
      mouthFrownLeft: [1],
      mouthFrownRight: [1],
      mouthOpen: [0.5],
      mouthPucker: [0.5],
      mouthUpperUpLeft: [0.6],
      mouthUpperUpRight: [0.6],
    },
  },

  puppy_eyes: {
    _description: 'Pleading puppy-dog eyes with pouty lip',
    _tags: ['expression', 'sad'],
    _track: 'action',
    dt: [1000, 1000],
    rescale: [0, 1],
    vs: {
      browDownLeft: [0.2],
      browDownRight: [0.2],
      browInnerUp: [1],
      eyeWideLeft: [0.9],
      eyeWideRight: [0.9],
      eyesClosed: [0.1],
      mouthClose: [0.2],
      mouthFrownLeft: [1],
      mouthFrownRight: [1],
      mouthPressLeft: [0.4],
      mouthPressRight: [0.4],
      mouthPucker: [1],
      mouthRollLower: [0.6],
      mouthRollUpper: [0.2],
      mouthUpperUpLeft: [0.8],
      mouthUpperUpRight: [0.8],
    },
  },

  pensive: {
    _description: 'Pensive sadness with closed eyes and pressed lips',
    _tags: ['expression', 'sad'],
    _track: 'action',
    dt: [1000, 1000],
    rescale: [0, 1],
    vs: {
      browInnerUp: [1],
      eyeSquintLeft: [1],
      eyeSquintRight: [1],
      eyesClosed: [0.5],
      bodyRotateX: [0.3],
      mouthClose: [0.2],
      mouthFrownLeft: [1],
      mouthFrownRight: [1],
      mouthPressLeft: [0.4],
      mouthPressRight: [0.4],
      mouthPucker: [1],
      mouthRollLower: [0.6],
      mouthRollUpper: [0.2],
      mouthUpperUpLeft: [0.8],
      mouthUpperUpRight: [0.8],
    },
  },

  flushed: {
    _description: 'Flushed embarrassment with wide eyes and pursed lips',
    _tags: ['expression', 'surprise'],
    _track: 'action',
    dt: [1000, 1000],
    rescale: [0, 1],
    vs: {
      browInnerUp: [1],
      eyeWideLeft: [0.5],
      eyeWideRight: [0.5],
      eyesRotateY: [0.05],
      eyesRotateX: [0.05],
      mouthClose: [0.2],
      mouthFunnel: [0.5],
      mouthPucker: [0.4],
      mouthRollLower: [0.4],
      mouthRollUpper: [0.4],
    },
  },

  blow_kiss: {
    _description: 'Blowing a kiss with wink and body lean',
    _tags: ['expression', 'love'],
    _track: 'action',
    dt: [500, 500, 200, 500],
    rescale: [0, 0, 0, 1],
    vs: {
      browInnerUp: [0.6],
      eyeBlinkLeft: [0, 0, 1, 0],
      eyeBlinkRight: [0],
      eyesRotateY: [0],
      bodyRotateY: [0],
      bodyRotateX: [0, 0.05, 0.05, 0],
      bodyRotateZ: [0, -0.05, -0.05, 0],
      eyeSquintLeft: [1],
      eyeSquintRight: [1],
      mouthPucker: [0, 0.5, 0],
      noseSneerLeft: [0, 0.7],
      noseSneerRight: [0.7],
      viseme_U: [0, 1],
    },
  },

  heart_eyes: {
    _description: 'Starstruck admiration with wide smile and open mouth',
    _tags: ['expression', 'love'],
    _track: 'action',
    dt: [1000, 1000],
    rescale: [0, 1],
    vs: {
      browInnerUp: [0.6],
      jawOpen: [0.1],
      mouthDimpleLeft: [0.2],
      mouthDimpleRight: [0.2],
      mouthOpen: [0.3],
      mouthPressLeft: [0.3],
      mouthPressRight: [0.3],
      mouthRollLower: [0.4],
      mouthShrugUpper: [0.4],
      mouthSmile: [0.7],
      mouthUpperUpLeft: [0.3],
      mouthUpperUpRight: [0.3],
      noseSneerLeft: [0.4],
      noseSneerRight: [0.4],
    },
  },

  grimace_teeth: {
    _description: 'Nervous grimace showing clenched teeth',
    _tags: ['expression', 'nervous'],
    _track: 'action',
    dt: [500, 1500],
    rescale: [0, 1],
    vs: {
      browDownLeft: [1],
      browDownRight: [1],
      browInnerUp: [1],
      mouthDimpleLeft: [0.5],
      mouthDimpleRight: [0.5],
      mouthLowerDownLeft: [1],
      mouthLowerDownRight: [1],
      mouthPressLeft: [0.4],
      mouthPressRight: [0.4],
      mouthPucker: [0.5],
      mouthSmile: [0.1],
      mouthSmileLeft: [0.2],
      mouthSmileRight: [0.2],
      mouthStretchLeft: [1],
      mouthStretchRight: [1],
      mouthUpperUpLeft: [1],
      mouthUpperUpRight: [1],
    },
  },

  curious: {
    _description: 'Curious mood with raised brow, wide eyes, tilted head, and small smile',
    _tags: ['emotion', 'curious', 'attention'],
    _track: 'mood',
    dt: [500, 2000, 500],
    vs: {
      browInnerUp: [0, 0.5, 0.5, 0.5],
      browOuterUpLeft: [0, 0.4, 0.4, 0.4],
      eyeWideLeft: [0, 0.5, 0.5, 0.5],
      eyeWideRight: [0, 0.5, 0.5, 0.5],
      headRotateZ: [0, 0.08, 0.08, 0.08],
      headRotateY: [0, 0.08, 0.08, 0.08],
      mouthSmile: [0, 0.25, 0.25, 0.25],
      mouthOpen: [0, 0.1, 0.1, 0.1],
    },
  },

  disgust: {
    _description: 'Disgusted mood with sneer, frown, and head recoil',
    _tags: ['emotion', 'negative', 'disgust'],
    _track: 'mood',
    dt: [500, 2000, 500],
    vs: {
      noseSneerLeft: [0, 1, 1, 1],
      noseSneerRight: [0, 0.7, 0.7, 0.7],
      mouthFrownLeft: [0, 0.7, 0.7, 0.7],
      mouthFrownRight: [0, 0.7, 0.7, 0.7],
      browDownLeft: [0, 0.7, 0.7, 0.7],
      browDownRight: [0, 0.3, 0.3, 0.3],
      mouthUpperUpLeft: [0, 0.3, 0.3, 0.3],
      mouthUpperUpRight: [0, 0.3, 0.3, 0.3],
      headRotateX: [0, -0.08, -0.08, -0.08],
      bodyRotateX: [0, -0.05, -0.05, -0.05],
    },
  },

  squint: {
    _description: 'Persistent squint mood with furrowed brows and nose sneer',
    _tags: ['emotion', 'suspicious', 'eyes'],
    _track: 'mood',
    dt: [400, 2000, 400],
    vs: {
      eyeSquintLeft: [0, 1, 1, 1],
      eyeSquintRight: [0, 1, 1, 1],
      browDownLeft: [0, 0.5, 0.5, 0.5],
      browDownRight: [0, 0.5, 0.5, 0.5],
      noseSneerLeft: [0, 0.5, 0.5, 0.5],
      noseSneerRight: [0, 0.5, 0.5, 0.5],
    },
  },

  grimace: {
    _description: 'Persistent nervous grimace with clenched mouth and raised brows',
    _tags: ['emotion', 'nervous', 'grimace'],
    _track: 'mood',
    dt: [500, 2000, 500],
    vs: {
      browDownLeft: [0, 0.8, 0.8, 0.8],
      browDownRight: [0, 0.8, 0.8, 0.8],
      browInnerUp: [0, 0.8, 0.8, 0.8],
      mouthDimpleLeft: [0, 0.5, 0.5, 0.5],
      mouthDimpleRight: [0, 0.5, 0.5, 0.5],
      mouthLowerDownLeft: [0, 1, 1, 1],
      mouthLowerDownRight: [0, 1, 1, 1],
      mouthPressLeft: [0, 0.4, 0.4, 0.4],
      mouthPressRight: [0, 0.4, 0.4, 0.4],
      mouthStretchLeft: [0, 1, 1, 1],
      mouthStretchRight: [0, 1, 1, 1],
      mouthUpperUpLeft: [0, 1, 1, 1],
      mouthUpperUpRight: [0, 1, 1, 1],
    },
  },

  pleading: {
    _description: 'Persistent pleading puppy eyes with pouty lip and raised inner brows',
    _tags: ['emotion', 'sad', 'pleading'],
    _track: 'mood',
    dt: [800, 2000, 800],
    vs: {
      browDownLeft: [0, 0.2, 0.2, 0.2],
      browDownRight: [0, 0.2, 0.2, 0.2],
      browInnerUp: [0, 1, 1, 1],
      eyeWideLeft: [0, 0.9, 0.9, 0.9],
      eyeWideRight: [0, 0.9, 0.9, 0.9],
      eyesClosed: [0, 0.1, 0.1, 0.1],
      mouthClose: [0, 0.2, 0.2, 0.2],
      mouthFrownLeft: [0, 1, 1, 1],
      mouthFrownRight: [0, 1, 1, 1],
      mouthPucker: [0, 1, 1, 1],
      mouthRollLower: [0, 0.6, 0.6, 0.6],
      mouthUpperUpLeft: [0, 0.8, 0.8, 0.8],
      mouthUpperUpRight: [0, 0.8, 0.8, 0.8],
      headRotateX: [0, 0.08, 0.08, 0.08],
      bodyRotateX: [0, 0.08, 0.08, 0.08],
    },
  },

  fear: {
    _description: 'Fearful state with wide eyes, raised brows, and tense mouth',
    _tags: ['emotion', 'negative'],
    _track: 'mood',
    dt: [800, 3000, 800],
    vs: {
      browInnerUp: [0, 0.7, 0.7, 0.7],
      eyeSquintLeft: [0, 0.5, 0.5, 0.5],
      eyeSquintRight: [0, 0.5, 0.5, 0.5],
      eyeWideLeft: [0, 0.6, 0.6, 0.6],
      eyeWideRight: [0, 0.6, 0.6, 0.6],
      mouthClose: [0, 0.1, 0.1, 0.1],
      mouthFunnel: [0, 0.3, 0.3, 0.3],
      mouthShrugLower: [0, 0.5, 0.5, 0.5],
      mouthShrugUpper: [0, 0.5, 0.5, 0.5],
    },
  },

  love: {
    _description: 'Loving gaze with soft eyes, gentle smile, and slight forward lean',
    _tags: ['emotion', 'positive'],
    _track: 'mood',
    dt: [1000, 3000, 1000],
    vs: {
      browInnerUp: [0, 0.4, 0.4, 0.4],
      browOuterUpLeft: [0, 0.2, 0.2, 0.2],
      browOuterUpRight: [0, 0.2, 0.2, 0.2],
      mouthSmile: [0, 0.2, 0.2, 0.2],
      eyeBlinkLeft: [0, 0.6, 0.6, 0.6],
      eyeBlinkRight: [0, 0.6, 0.6, 0.6],
      eyeWideLeft: [0, 0.7, 0.7, 0.7],
      eyeWideRight: [0, 0.7, 0.7, 0.7],
      bodyRotateX: [0, 0.1, 0.1, 0.1],
      mouthDimpleLeft: [0, 0.1, 0.1, 0.1],
      mouthDimpleRight: [0, 0.1, 0.1, 0.1],
      mouthPressLeft: [0, 0.2, 0.2, 0.2],
      mouthShrugUpper: [0, 0.2, 0.2, 0.2],
      mouthUpperUpLeft: [0, 0.1, 0.1, 0.1],
      mouthUpperUpRight: [0, 0.1, 0.1, 0.1],
    },
  },

  angry: {
    _description: 'Persistent anger with furrowed brows, frown, clenched jaw, and forward energy',
    _tags: ['emotion', 'negative', 'anger'],
    _track: 'mood',
    dt: [500, 2000, 500],
    vs: {
      browDownLeft: [0, 1, 1, 1],
      browDownRight: [0, 1, 1, 1],
      jawForward: [0, 0.3, 0.3, 0.3],
      mouthFrownLeft: [0, 1, 1, 1],
      mouthFrownRight: [0, 1, 1, 1],
      bodyRotateX: [0, 0.15, 0.15, 0.15],
      handFistLeft: [0, 1, 1, 1],
      handFistRight: [0, 1, 1, 1],
    },
  },

  sad: {
    _description: 'Persistent sadness with raised inner brows, squinted eyes, frown, and slumped posture',
    _tags: ['emotion', 'negative', 'sadness'],
    _track: 'mood',
    dt: [800, 2000, 800],
    vs: {
      browInnerUp: [0, 1, 1, 1],
      eyeSquintLeft: [0, 1, 1, 1],
      eyeSquintRight: [0, 1, 1, 1],
      eyesClosed: [0, 0.3, 0.3, 0.3],
      mouthFrownLeft: [0, 1, 1, 1],
      mouthFrownRight: [0, 1, 1, 1],
      mouthPucker: [0, 0.5, 0.5, 0.5],
      bodyRotateX: [0, 0.2, 0.2, 0.2],
      headRotateX: [0, 0.15, 0.15, 0.15],
    },
  },

  thinking: {
    _description: 'Persistent thinking face with asymmetric brow, squinted eye, pursed mouth, and tilted head',
    _tags: ['emotion', 'thinking', 'contemplation'],
    _track: 'mood',
    dt: [500, 2000, 500],
    vs: {
      browDownLeft: [0, 1, 1, 1],
      browOuterUpRight: [0, 1, 1, 1],
      eyeSquintLeft: [0, 0.6, 0.6, 0.6],
      mouthFrownLeft: [0, 0.7, 0.7, 0.7],
      mouthFrownRight: [0, 0.7, 0.7, 0.7],
      mouthRight: [0, 0.5, 0.5, 0.5],
      mouthRollLower: [0, 0.5, 0.5, 0.5],
      mouthPressRight: [0, 0.4, 0.4, 0.4],
      headRotateY: [0, 0.15, 0.15, 0.15],
      headRotateZ: [0, 0.05, 0.05, 0.05],
      bodyRotateY: [0, 0.1, 0.1, 0.1],
    },
  },

  nervous: {
    _description: 'Persistent nervous expression with wide eyes, tense mouth, and small head/body shifts',
    _tags: ['emotion', 'nervous', 'anxiety'],
    _track: 'mood',
    dt: [800, 2000, 800],
    vs: {
      browInnerUp: [0, 0.6, 0.6, 0.6],
      eyeWideLeft: [0, 0.3, 0.3, 0.3],
      eyeWideRight: [0, 0.3, 0.3, 0.3],
      mouthPressLeft: [0, 0.4, 0.4, 0.4],
      mouthPressRight: [0, 0.4, 0.4, 0.4],
      mouthStretchLeft: [0, 0.2, 0.2, 0.2],
      mouthStretchRight: [0, 0.2, 0.2, 0.2],
      headRotateY: [0, 0.06, 0.06, 0.06],
      bodyRotateY: [0, 0.03, 0.03, 0.03],
    },
  },

  shy: {
    _description: 'Persistent shy face with bashful smile, squinted eyes, and downcast head turn',
    _tags: ['emotion', 'shy', 'embarrassment'],
    _track: 'mood',
    dt: [500, 1500, 500],
    vs: {
      mouthSmile: [0, 0.3, 0.3, 0.3],
      eyeSquintLeft: [0, 0.6, 0.6, 0.6],
      eyeSquintRight: [0, 0.6, 0.6, 0.6],
      eyesClosed: [0, 0.3, 0.3, 0.3],
      browInnerUp: [0, 0.5, 0.5, 0.5],
      headRotateY: [0, 0.2, 0.2, 0.2],
      headRotateX: [0, 0.1, 0.1, 0.1],
      headRotateZ: [0, 0.08, 0.08, 0.08],
      bodyRotateY: [0, 0.1, 0.1, 0.1],
    },
  },

  listen: {
    _description: 'Persistent attentive listening pose with head tilt, soft eyes, and slight smile',
    _tags: ['emotion', 'attention', 'listening'],
    _track: 'mood',
    dt: [500, 2000, 500],
    vs: {
      headRotateZ: [0, 0.08, 0.08, 0.08],
      headRotateY: [0, 0.1, 0.1, 0.1],
      browInnerUp: [0, 0.3, 0.3, 0.3],
      eyeSquintLeft: [0, 0.2, 0.2, 0.2],
      mouthSmile: [0, 0.2, 0.2, 0.2],
      mouthPressLeft: [0, 0.2, 0.2, 0.2],
    },
  },
}

const REMOTE_AVATAR3D_MOTION_ALIASES: Record<string, string> = {
  wave_right: 'hand_raise',
  wave_left: 'hand_raise_left',
  thumbup_right: 'thumbs_up',
  thumbdown_right: 'thumbs_down',
  ok_wink: 'ok_sign',
  shrug_confused: 'shrug_both',
  namaste_bow: 'pray',
  nod_yes: 'nod',
  shake_no: 'head_shake',
  tongueout: 'tongue_out',
  kiss: 'kiss_eyes_closed',
  smirk: 'smug',
  close_eyes: 'sleep',
  frown: 'sad_frown',
  open_mouth: 'scream',
  raise_eyebrows: 'surprised',
  look_left: 'side_glance',
  look_right: 'side_glance',
  sleeping: 'sleep',
  zzz: 'sleep',
  adoring: 'love',
  rage: 'angry',
  unamused: 'smug',
  thinking_face: 'thinking',
}

for (const [alias, target] of Object.entries(REMOTE_AVATAR3D_MOTION_ALIASES)) {
  if (BUILTIN_AVATAR3D_MOTIONS[alias] === undefined && BUILTIN_AVATAR3D_MOTIONS[target] !== undefined) {
    BUILTIN_AVATAR3D_MOTIONS[alias] = { ...BUILTIN_AVATAR3D_MOTIONS[target] }
  }
}

/** Returns true when a non-numeric MotionEngine gesture channel is structurally supported. */
function resolveGestureChannelSupport(values: readonly unknown[]): { supportedCount: number; unsupportedFeatures: string[] } {
  const unsupportedFeatures: string[] = []
  let supportedCount = 0

  for (const value of values) {
    if (value === null) continue
    if (!Array.isArray(value) || typeof value[0] !== 'string') {
      unsupportedFeatures.push('channel:gesture:invalid_command')
      continue
    }
    if (!DEFAULT_AVATAR3D_GESTURE_NAMES.has(value[0])) {
      unsupportedFeatures.push(`gesture:${value[0]}:unknown`)
      continue
    }
    supportedCount += 1
  }

  return { supportedCount, unsupportedFeatures }
}

/** Returns support for a MotionEngine `pose` channel. */
function resolvePoseChannelSupport(values: readonly unknown[]): { supportedCount: number; unsupportedFeatures: string[] } {
  const unsupportedFeatures: string[] = []
  let supportedCount = 0

  for (const value of values) {
    if (value === null) continue
    if (typeof value !== 'string') {
      unsupportedFeatures.push('channel:pose:invalid_command')
      continue
    }
    if (!DEFAULT_AVATAR3D_POSE_NAMES.has(value)) {
      unsupportedFeatures.push(`pose:${value}:unknown`)
      continue
    }
    supportedCount += 1
  }

  return { supportedCount, unsupportedFeatures }
}

/** Returns support for a MotionEngine `_overlay` block. */
function resolveOverlaySupport(motion: Avatar3DMotion): { supportedCount: number; unsupportedFeatures: string[] } {
  const unsupportedFeatures: string[] = []
  let supportedCount = 0

  for (const [boneName, overlay] of Object.entries(motion._overlay?.bones ?? {})) {
    if (overlay.custom && overlay.custom !== 'jump') {
      unsupportedFeatures.push(`overlay:${boneName}:custom:${overlay.custom}`)
      continue
    }
    if (overlay.amp !== undefined && !overlay.amp.every((value) => typeof value === 'number' && Number.isFinite(value))) {
      unsupportedFeatures.push(`overlay:${boneName}:invalid_amp`)
      continue
    }
    supportedCount += 1
  }

  return { supportedCount, unsupportedFeatures }
}

/** Resolves whether one motion can be played by a given channel set. */
export function resolveAvatar3DMotionSupport(
  motion: Avatar3DMotion,
  supportedChannels: ReadonlySet<string> = DEFAULT_AVATAR3D_MOTION_CHANNELS,
): Avatar3DMotionSupport {
  const unsupportedChannels: string[] = []
  const unsupportedFeatures: string[] = []
  const channels = motion.vs ?? {}
  let supportedChannelCount = 0

  const overlaySupport = resolveOverlaySupport(motion)
  supportedChannelCount += overlaySupport.supportedCount
  unsupportedFeatures.push(...overlaySupport.unsupportedFeatures)

  for (const [name, values] of Object.entries(channels)) {
    if (name === 'gesture') {
      const support = resolveGestureChannelSupport(values)
      supportedChannelCount += support.supportedCount
      unsupportedFeatures.push(...support.unsupportedFeatures)
      continue
    }

    if (name === 'pose') {
      const support = resolvePoseChannelSupport(values)
      supportedChannelCount += support.supportedCount
      unsupportedFeatures.push(...support.unsupportedFeatures)
      continue
    }

    if (!values.every((value) => typeof value === 'number' && Number.isFinite(value))) {
      unsupportedFeatures.push(`channel:${name}:non_numeric`)
      continue
    }

    if (!supportedChannels.has(name)) {
      unsupportedChannels.push(name)
      continue
    }

    supportedChannelCount += 1
  }

  const hasChannels = Object.keys(channels).length > 0
  const status =
    motion._track === 'mood' && !hasChannels && motion._overlay === undefined ? 'supported'
    : unsupportedChannels.length === 0 && unsupportedFeatures.length === 0 ? 'supported'
    : supportedChannelCount > 0 ? 'partial'
    : hasChannels ? 'unsupported'
    : 'unsupported'

  return { status, unsupportedChannels, unsupportedFeatures }
}

/** Returns support status for a built-in motion name. */
export function resolveBuiltinAvatar3DMotionSupport(
  name: string,
  supportedChannels: ReadonlySet<string> = DEFAULT_AVATAR3D_MOTION_CHANNELS,
): Avatar3DMotionSupport | null {
  const motion = BUILTIN_AVATAR3D_MOTIONS[name]
  return motion === undefined ? null : resolveAvatar3DMotionSupport(motion, supportedChannels)
}

/** Returns built-in motion names in stable display order. */
export function listBuiltinAvatar3DMotionNames(): string[] {
  return Object.keys(BUILTIN_AVATAR3D_MOTIONS)
}
