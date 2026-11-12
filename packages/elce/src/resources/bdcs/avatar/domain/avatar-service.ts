import { AVATAR_POSITIONS, AVATAR_PROFILE_ID } from '../avatar-config'
import type { AvatarContent, AvatarTake } from './avatar-types'
import type { RiveTalkingAvatarFrame } from '@codplay/story/rive-talking-avatar'

/** Creates an empty authorable Avatar using the supplied transparent rig. */
export function createDefaultAvatar(): AvatarContent {
  return { profileId: AVATAR_PROFILE_ID, autoStart: false, placement: { position: 'top-right', widthPercent: 24 }, take: null }
}

/** Validates persisted Avatar settings and the final voice timeline at the document boundary. */
export function assertAvatarContent(content: AvatarContent): void {
  if (content.profileId !== AVATAR_PROFILE_ID || typeof content.autoStart !== 'boolean'
    || !AVATAR_POSITIONS.some(({ value }) => value === content.placement.position)
    || !Number.isFinite(content.placement.widthPercent)
    || content.placement.widthPercent < 10 || content.placement.widthPercent > 60) {
    throw new Error('Réglages Avatar invalides : largeur attendue entre 10 et 60 %.')
  }
  const take = content.take
  if (take === null) return
  if (!take.id || !take.audioMediaId || !Number.isInteger(take.durationMs) || take.durationMs <= 0
    || take.words.length === 0) throw new Error('La prise doit identifier une voix et son transcript horodaté.')
  if (take.words.some((word, index) => !word.text.trim() || !Number.isInteger(word.startAtMs)
    || !Number.isInteger(word.endAtMs) || word.startAtMs < 0 || word.endAtMs <= word.startAtMs
    || word.endAtMs > take.durationMs || word.startAtMs < (take.words[index - 1]?.startAtMs ?? 0))) {
    throw new Error('Le transcript doit suivre le temps de la voix.')
  }
  if (take.frames.some((frame) => !Number.isInteger(frame.startAt) || frame.startAt < 0
    || frame.startAt > take.durationMs || Object.values(frame.values).some((value) => typeof value === 'number' && !Number.isFinite(value)))) {
    throw new Error('La piste de l’Avatar est hors de la durée de la voix.')
  }
}

/** Adapts the supplied timeline and optional head motion to the current rig. */
export function parseAvatarTimeline(value: unknown, identity: Pick<AvatarTake, 'id' | 'audioMediaId' | 'durationMs'>): AvatarTake {
  if (typeof value !== 'object' || value === null || !('words' in value) || !Array.isArray(value.words)
    || !('visemes' in value) || !Array.isArray(value.visemes)
    || ('headMotion' in value && !Array.isArray(value.headMotion))) {
    throw new Error('Le fichier JSON doit contenir les mots et les visèmes de la prise.')
  }
  const words = value.words.map((word: unknown) => {
    if (typeof word !== 'object' || word === null || !('text' in word) || typeof word.text !== 'string'
      || !('start' in word) || typeof word.start !== 'number' || !('end' in word) || typeof word.end !== 'number') {
      throw new Error('Occurrence de transcript invalide.')
    }
    return { text: word.text, startAtMs: Math.round(word.start * 1000), endAtMs: Math.round(word.end * 1000) }
  })
  const mouthNames = Array.from({ length: 22 }, (_, index) => `v${100 + index}`)
  const visemeFrames = value.visemes.map((viseme: unknown) => {
    if (typeof viseme !== 'object' || viseme === null || !('property' in viseme)
      || typeof viseme.property !== 'string' || !mouthNames.includes(viseme.property)
      || !('value' in viseme) || typeof viseme.value !== 'number'
      || !('start' in viseme) || typeof viseme.start !== 'number') throw new Error('Visème invalide pour ce personnage.')
    const strength = viseme.value
    return {
      startAt: Math.max(0, Math.round(viseme.start * 1000) - 50),
      values: Object.fromEntries(mouthNames.map((name) => [name, name === viseme.property ? strength : 0])),
    }
  })
  const headMotionFrames = ('headMotion' in value && Array.isArray(value.headMotion) ? value.headMotion : [])
    .map((sample: unknown) => {
      if (typeof sample !== 'object' || sample === null || !('startAtMs' in sample)
        || typeof sample.startAtMs !== 'number' || !Number.isInteger(sample.startAtMs)
        || !('values' in sample) || typeof sample.values !== 'object' || sample.values === null
        || !('headX' in sample.values) || typeof sample.values.headX !== 'number'
        || !('headY' in sample.values) || typeof sample.values.headY !== 'number'
        || !('headTilt' in sample.values) || typeof sample.values.headTilt !== 'number') {
        throw new Error('Position de tête invalide.')
      }
      const { headX, headY, headTilt } = sample.values
      if (![headX, headY, headTilt].every((position) => Number.isFinite(position) && position >= 0 && position <= 100)) {
        throw new Error('Position de tête hors limites.')
      }
      return { startAt: sample.startAtMs, values: { headX, headY, headTilt } }
    })
  const framesByTime = [...visemeFrames, ...headMotionFrames]
    .reduce((byTime, frame) => {
      const existing = byTime.get(frame.startAt)
      byTime.set(frame.startAt, existing === undefined
        ? frame
        : { startAt: frame.startAt, values: { ...existing.values, ...frame.values } })
      return byTime
    }, new Map<number, RiveTalkingAvatarFrame>())
  const frames = [...framesByTime.values()].sort((first, second) => first.startAt - second.startAt)
  const take = { ...identity, words, frames }
  assertAvatarContent({ ...createDefaultAvatar(), take })
  return take
}
