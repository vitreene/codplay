import type { ThEmojiMotion } from '../avatar-types.js'

/**
 * Exact emoji templates exposed by TalkingHead's `playGesture` path.
 *
 * They stay data-only. Avatar V2 evaluates them with its absolute-time
 * sampler, so no TalkingHead runtime is imported into the component package.
 */
export const TH_EMOJI_MOTIONS: Readonly<Record<string, ThEmojiMotion>> = {
  '😐': { dt: [300, 2000], rescale: [0, 1], vs: { pose: ['straight'], browInnerUp: [0.4], eyeWideLeft: [0.7], eyeWideRight: [0.7], mouthPressLeft: [0.6], mouthPressRight: [0.6], mouthRollLower: [0.3], mouthStretchLeft: [1], mouthStretchRight: [1] } },
  '😶': { link: '😐', vs: {} },
  '😏': { dt: [300, 2000], rescale: [0, 1], vs: { eyeContact: [0], browDownRight: [0.1], browInnerUp: [0.7], browOuterUpRight: [0.2], eyeLookInRight: [0.7], eyeLookOutLeft: [0.7], eyeSquintLeft: [1], eyeSquintRight: [0.8], eyesRotateY: [0.7], mouthLeft: [0.4], mouthPucker: [0.4], mouthShrugLower: [0.3], mouthShrugUpper: [0.2], mouthSmile: [0.2], mouthSmileLeft: [0.4], mouthSmileRight: [0.2], mouthStretchLeft: [0.5], mouthUpperUpLeft: [0.6], noseSneerLeft: [0.7] } },
  '🙂': { dt: [300, 2000], rescale: [0, 1], vs: { mouthSmile: [0.5] } },
  '🙃': { link: '🙂', vs: {} },
  '😊': { dt: [300, 2000], rescale: [0, 1], vs: { browInnerUp: [0.6], eyeSquintLeft: [1], eyeSquintRight: [1], mouthSmile: [0.7], noseSneerLeft: [0.7], noseSneerRight: [0.7] } },
  '😇': { link: '😊', vs: {} },
  '😀': { dt: [300, 2000], rescale: [0, 1], vs: { browInnerUp: [0.6], jawOpen: [0.1], mouthDimpleLeft: [0.2], mouthDimpleRight: [0.2], mouthOpen: [0.3], mouthPressLeft: [0.3], mouthPressRight: [0.3], mouthRollLower: [0.4], mouthShrugUpper: [0.4], mouthSmile: [0.7], mouthUpperUpLeft: [0.3], mouthUpperUpRight: [0.3], noseSneerLeft: [0.4], noseSneerRight: [0.4] } },
  '😃': { dt: [300, 2000], rescale: [0, 1], vs: { browInnerUp: [0.6], eyeWideLeft: [0.7], eyeWideRight: [0.7], jawOpen: [0.1], mouthDimpleLeft: [0.2], mouthDimpleRight: [0.2], mouthOpen: [0.3], mouthPressLeft: [0.3], mouthPressRight: [0.3], mouthRollLower: [0.4], mouthShrugUpper: [0.4], mouthSmile: [0.7], mouthUpperUpLeft: [0.3], mouthUpperUpRight: [0.3], noseSneerLeft: [0.4], noseSneerRight: [0.4] } },
  '😄': { dt: [300, 2000], rescale: [0, 1], vs: { browInnerUp: [0.3], eyeSquintLeft: [1], eyeSquintRight: [1], jawOpen: [0.2], mouthDimpleLeft: [0.2], mouthDimpleRight: [0.2], mouthOpen: [0.3], mouthPressLeft: [0.3], mouthPressRight: [0.3], mouthRollLower: [0.4], mouthShrugUpper: [0.4], mouthSmile: [0.7], mouthUpperUpLeft: [0.3], mouthUpperUpRight: [0.3], noseSneerLeft: [0.4], noseSneerRight: [0.4] } },
  '😁': { dt: [300, 2000], rescale: [0, 1], vs: { browInnerUp: [0.3], eyeSquintLeft: [1], eyeSquintRight: [1], jawOpen: [0.3], mouthDimpleLeft: [0.2], mouthDimpleRight: [0.2], mouthPressLeft: [0.5], mouthPressRight: [0.5], mouthShrugUpper: [0.4], mouthSmile: [0.7], mouthUpperUpLeft: [0.3], mouthUpperUpRight: [0.3], noseSneerLeft: [0.4], noseSneerRight: [0.4] } },
  '😆': { dt: [300, 2000], rescale: [0, 1], vs: { browInnerUp: [0.3], eyeSquintLeft: [1], eyeSquintRight: [1], eyesClosed: [0.6], jawOpen: [0.3], mouthDimpleLeft: [0.2], mouthDimpleRight: [0.2], mouthPressLeft: [0.5], mouthPressRight: [0.5], mouthShrugUpper: [0.4], mouthSmile: [0.7], mouthUpperUpLeft: [0.3], mouthUpperUpRight: [0.3], noseSneerLeft: [0.4], noseSneerRight: [0.4] } },
  '😝': { dt: [300, 100, 1500, 500, 500], rescale: [0, 0, 1, 0, 0], vs: { browInnerUp: [0.8], eyesClosed: [1], jawOpen: [0.7], mouthFunnel: [0.5], mouthSmile: [1], tongueOut: [0, 1, 1, 0] } },
  '😋': { link: '😝', vs: {} },
  '😛': { link: '😝', vs: {} },
  '😜': { link: '😝', vs: {} },
  '🤪': { link: '😝', vs: {} },
  '😂': { dt: [300, 2000], rescale: [0, 1], vs: { browInnerUp: [0.3], eyeSquintLeft: [1], eyeSquintRight: [1], eyesClosed: [0.6], jawOpen: [0.3], mouthDimpleLeft: [0.2], mouthDimpleRight: [0.2], mouthPressLeft: [0.5], mouthPressRight: [0.5], mouthShrugUpper: [0.4], mouthSmile: [0.7], mouthUpperUpLeft: [0.3], mouthUpperUpRight: [0.3], noseSneerLeft: [0.4], noseSneerRight: [0.4] } },
  '🤣': { link: '😂', vs: {} },
  '😅': { link: '😂', vs: {} },
  '😉': { dt: [500, 200, 500, 500], rescale: [0, 0, 0, 1], vs: { mouthSmile: [0.5], mouthOpen: [0.2], mouthSmileLeft: [0, 0.5, 0], eyeBlinkLeft: [0, 0.7, 0], eyeBlinkRight: [0, 0, 0], bodyRotateX: [0.05, 0.05, 0.05, 0], bodyRotateZ: [-0.05, -0.05, -0.05, 0], browDownLeft: [0, 0.7, 0], cheekSquintLeft: [0, 0.7, 0], eyeSquintLeft: [0, 1, 0], eyesClosed: [0] } },
  '😭': { dt: [1000, 1000], rescale: [0, 1], vs: { browInnerUp: [1], eyeSquintLeft: [1], eyeSquintRight: [1], eyesClosed: [0.1], jawOpen: [0], mouthFrownLeft: [1], mouthFrownRight: [1], mouthOpen: [0.5], mouthPucker: [0.5], mouthUpperUpLeft: [0.6], mouthUpperUpRight: [0.6] } },
  '🥺': { dt: [1000, 1000], rescale: [0, 1], vs: { browDownLeft: [0.2], browDownRight: [0.2], browInnerUp: [1], eyeWideLeft: [0.9], eyeWideRight: [0.9], eyesClosed: [0.1], mouthClose: [0.2], mouthFrownLeft: [1], mouthFrownRight: [1], mouthPressLeft: [0.4], mouthPressRight: [0.4], mouthPucker: [1], mouthRollLower: [0.6], mouthRollUpper: [0.2], mouthUpperUpLeft: [0.8], mouthUpperUpRight: [0.8] } },
  '😞': { dt: [1000, 1000], rescale: [0, 1], vs: { browInnerUp: [0.7], eyeSquintLeft: [1], eyeSquintRight: [1], eyesClosed: [0.5], bodyRotateX: [0.3], mouthClose: [0.2], mouthFrownLeft: [1], mouthFrownRight: [1], mouthPucker: [1], mouthRollLower: [1], mouthShrugLower: [0.2], mouthUpperUpLeft: [0.8], mouthUpperUpRight: [0.8] } },
  '😔': { dt: [1000, 1000], rescale: [0, 1], vs: { browInnerUp: [1], eyeSquintLeft: [1], eyeSquintRight: [1], eyesClosed: [0.5], bodyRotateX: [0.3], mouthClose: [0.2], mouthFrownLeft: [1], mouthFrownRight: [1], mouthPressLeft: [0.4], mouthPressRight: [0.4], mouthPucker: [1], mouthRollLower: [0.6], mouthRollUpper: [0.2], mouthUpperUpLeft: [0.8], mouthUpperUpRight: [0.8] } },
  '😳': { dt: [1000, 1000], rescale: [0, 1], vs: { browInnerUp: [1], eyeWideLeft: [0.5], eyeWideRight: [0.5], eyesRotateY: [0.05], eyesRotateX: [0.05], mouthClose: [0.2], mouthFunnel: [0.5], mouthPucker: [0.4], mouthRollLower: [0.4], mouthRollUpper: [0.4] } },
  '☹️': { dt: [500, 1500], rescale: [0, 1], vs: { mouthFrownLeft: [1], mouthFrownRight: [1], mouthPucker: [0.1], mouthRollLower: [0.8] } },
  '😚': { dt: [500, 1000, 1000], rescale: [0, 1, 0], vs: { browInnerUp: [0.6], eyeBlinkLeft: [1], eyeBlinkRight: [1], eyeSquintLeft: [1], eyeSquintRight: [1], mouthPucker: [0, 0.5], noseSneerLeft: [0, 0.7], noseSneerRight: [0, 0.7], viseme_U: [0, 1] } },
  '😘': { dt: [500, 500, 200, 500], rescale: [0, 0, 0, 1], vs: { browInnerUp: [0.6], eyeBlinkLeft: [0, 0, 1, 0], eyeBlinkRight: [0], eyesRotateY: [0], bodyRotateY: [0], bodyRotateX: [0, 0.05, 0.05, 0], bodyRotateZ: [0, -0.05, -0.05, 0], eyeSquintLeft: [1], eyeSquintRight: [1], mouthPucker: [0, 0.5, 0], noseSneerLeft: [0, 0.7], noseSneerRight: [0.7], viseme_U: [0, 1] } },
  '🥰': { dt: [1000, 1000], rescale: [0, 1], vs: { browInnerUp: [0.6], eyeSquintLeft: [1], eyeSquintRight: [1], mouthSmile: [0.7], noseSneerLeft: [0.7], noseSneerRight: [0.7] } },
  '😍': { dt: [1000, 1000], rescale: [0, 1], vs: { browInnerUp: [0.6], jawOpen: [0.1], mouthDimpleLeft: [0.2], mouthDimpleRight: [0.2], mouthOpen: [0.3], mouthPressLeft: [0.3], mouthPressRight: [0.3], mouthRollLower: [0.4], mouthShrugUpper: [0.4], mouthSmile: [0.7], mouthUpperUpLeft: [0.3], mouthUpperUpRight: [0.3], noseSneerLeft: [0.4], noseSneerRight: [0.4] } },
  '🤩': { link: '😍', vs: {} },
  '😡': { dt: [1000, 1500], rescale: [0, 1], vs: { browDownLeft: [1], browDownRight: [1], eyesLookUp: [0.2], jawForward: [0.3], mouthFrownLeft: [1], mouthFrownRight: [1], bodyRotateX: [0.15] } },
  '😠': { dt: [1000, 1500], rescale: [0, 1], vs: { browDownLeft: [1], browDownRight: [1], eyesLookUp: [0.2], jawForward: [0.3], mouthFrownLeft: [1], mouthFrownRight: [1], bodyRotateX: [0.15] } },
  '🤬': { link: '😠', vs: {} },
  '😒': { dt: [1000, 1000], rescale: [0, 1], vs: { eyeContact: [0], browDownRight: [0.1], browInnerUp: [0.7], browOuterUpRight: [0.2], eyeLookInRight: [0.7], eyeLookOutLeft: [0.7], eyeSquintLeft: [1], eyeSquintRight: [0.8], eyesRotateY: [0.7], mouthFrownLeft: [1], mouthFrownRight: [1], mouthLeft: [0.2], mouthPucker: [0.5], mouthRollLower: [0.2], mouthRollUpper: [0.2], mouthShrugLower: [0.2], mouthShrugUpper: [0.2], mouthStretchLeft: [0.5] } },
  '😱': { dt: [500, 1500], rescale: [0, 1], vs: { browInnerUp: [0.8], eyeWideLeft: [0.5], eyeWideRight: [0.5], jawOpen: [0.7], mouthFunnel: [0.5] } },
  '😬': { dt: [500, 1500], rescale: [0, 1], vs: { browDownLeft: [1], browDownRight: [1], browInnerUp: [1], mouthDimpleLeft: [0.5], mouthDimpleRight: [0.5], mouthLowerDownLeft: [1], mouthLowerDownRight: [1], mouthPressLeft: [0.4], mouthPressRight: [0.4], mouthPucker: [0.5], mouthSmile: [0.1], mouthSmileLeft: [0.2], mouthSmileRight: [0.2], mouthStretchLeft: [1], mouthStretchRight: [1], mouthUpperUpLeft: [1], mouthUpperUpRight: [1] } },
  '🙄': { dt: [500, 1500], rescale: [0, 1], vs: { browInnerUp: [0.8], eyeWideLeft: [1], eyeWideRight: [1], eyesRotateX: [-0.8], bodyRotateX: [0.15], mouthPucker: [0.5], mouthRollLower: [0.6], mouthRollUpper: [0.5], mouthShrugLower: [0], mouthSmile: [0] } },
  '🤔': { dt: [500, 1500], rescale: [0, 1], vs: { browDownLeft: [1], browOuterUpRight: [1], eyeSquintLeft: [0.6], mouthFrownLeft: [0.7], mouthFrownRight: [0.7], mouthLowerDownLeft: [0.3], mouthPressRight: [0.4], mouthPucker: [0.1], mouthRight: [0.5], mouthRollLower: [0.5], mouthRollUpper: [0.2], handRight: [{ x: 0.1, y: 0.1, z: 0.1, d: 1000 }, { d: 1000 }], handFistRight: [0.1] } },
  '👀': { dt: [500, 1500], rescale: [0, 1], vs: { eyesRotateY: [-0.8] } },
  '😴': { dt: [5000, 5000], rescale: [0, 1], vs: { eyeBlinkLeft: [1], eyeBlinkRight: [1], bodyRotateX: [0.2], bodyRotateZ: [0.1] } },
  '✋': { dt: [300, 2000], rescale: [0, 1], vs: { mouthSmile: [0.5], gesture: [['handup', 2, true], null] } },
  '🤚': { dt: [300, 2000], rescale: [0, 1], vs: { mouthSmile: [0.5], gesture: [['handup', 2], null] } },
  '👋': { link: '✋', vs: {} },
  '👍': { dt: [300, 2000], rescale: [0, 1], vs: { mouthSmile: [0.5], gesture: [['thumbup', 2], null] } },
  '👎': { dt: [300, 2000], rescale: [0, 1], vs: { browDownLeft: [1], browDownRight: [1], eyesLookUp: [0.2], jawForward: [0.3], mouthFrownLeft: [1], mouthFrownRight: [1], bodyRotateX: [0.15], gesture: [['thumbdown', 2], null] } },
  '👌': { dt: [300, 2000], rescale: [0, 1], vs: { mouthSmile: [0.5], gesture: [['ok', 2], null] } },
  '🤷‍♂️': { dt: [1000, 1500], rescale: [0, 1], vs: { gesture: [['shrug', 2], null] } },
  '🤷‍♀️': { link: '🤷‍♂️', vs: {} },
  '🤷': { link: '🤷‍♂️', vs: {} },
  '🙏': { dt: [1500, 300, 1000], rescale: [0, 1, 0], vs: { eyeBlinkLeft: [0, 1], eyeBlinkRight: [0, 1], bodyRotateX: [0], bodyRotateZ: [0.1], gesture: [['namaste', 2], null] } },
  yes: { dt: [[200, 500], [200, 500], [200, 500], [200, 500]], vs: { headMove: [0], headRotateX: [[0.1, 0.2], 0.1, [0.1, 0.2], 0], headRotateZ: [[-0.2, 0.2]] } },
  no: { dt: [[200, 500], [200, 500], [200, 500], [200, 500], [200, 500]], vs: { headMove: [0], headRotateY: [[-0.1, -0.05], [0.05, 0.1], [-0.1, -0.05], [0.05, 0.1], 0], headRotateZ: [[-0.2, 0.2]] } },
}

/** Emoji and textual aliases retained for the MotionEngine catalogue fallback. */
export const TH_EMOJI_MOTION_NAMES: Readonly<Record<string, string>> = {
  '😐': 'neutral_face', '😶': 'neutral_face', '😏': 'smirk',
  '🙂': 'slight_smile', '🙃': 'slight_smile', '😊': 'warm_smile', '😇': 'warm_smile',
  '😀': 'grin', '😃': 'open_grin', '😄': 'squint_smile', '😁': 'beam', '😆': 'crying_laugh',
  '😝': 'tongue_out', '😋': 'tongue_out', '😛': 'tongue_out', '😜': 'tongue_out', '🤪': 'tongue_out',
  '😂': 'crying_laugh', '🤣': 'crying_laugh', '😅': 'crying_laugh', '😉': 'wink_smile',
  '😭': 'sobbing', '🥺': 'puppy_eyes', '😞': 'disappointed', '😔': 'pensive',
  '😳': 'flushed', '☹️': 'sad_frown', '😚': 'kiss_eyes_closed', '😘': 'blow_kiss',
  '🥰': 'adoring', '😍': 'heart_eyes', '🤩': 'heart_eyes', '😡': 'rage', '😠': 'rage',
  '🤬': 'rage', '😒': 'unamused', '😱': 'scream', '😬': 'grimace_teeth',
  '🙄': 'eyeroll', '🤔': 'thinking_face', '👀': 'look_left', '😴': 'zzz',
  '✋': 'hand_raise', '🤚': 'hand_raise_left', '👋': 'hand_raise', '👍': 'thumbs_up',
  '👎': 'thumbs_down', '👌': 'ok_sign', '🤷‍♂️': 'shrug_both', '🤷‍♀️': 'shrug_both',
  '🤷': 'shrug_both', '🙏': 'pray', yes: 'nod', no: 'head_shake',
}

/** Resolves one linked TH emoji template without importing the TH runtime. */
export function resolveThEmojiTemplate(name: string): ThEmojiMotion | undefined {
  let current = TH_EMOJI_MOTIONS[name]
  for (let depth = 0; current?.link !== undefined && depth < 8; depth += 1) {
    current = TH_EMOJI_MOTIONS[current.link]
  }
  return current
}

/** Resolves one TH emoji or textual alias to the optional MotionEngine name. */
export function resolveThEmojiMotion(name: string): string | undefined {
  return TH_EMOJI_MOTION_NAMES[name]
}
