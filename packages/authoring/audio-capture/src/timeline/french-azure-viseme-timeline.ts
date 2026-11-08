import type { AudioCharacter } from '../audio/types'

export type FrenchAzureViseme = Readonly<{
  shape: number
  value: number
  property: string
  start: number
  end: number
  letters: string
}>

type TimelineCue = { v: number; s: number; e: number; txt: string }

const frenchMulti = [
  ['eaux', [8]], ['eau', [8]], ['ain', [4]], ['ein', [4]], ['oin', [7, 4]], ['ou', [7]],
  ['oi', [7, 2]], ['ai', [4]], ['ei', [4]], ['au', [8]], ['eu', [8]], ['œu', [8]],
  ['on', [8]], ['om', [8]], ['an', [2]], ['am', [2]], ['en', [2]], ['em', [2]],
  ['in', [4]], ['im', [4]], ['un', [4]], ['ch', [16]], ['gn', [19, 6]], ['qu', [20]],
  ['ph', [18]], ['th', [19]], ['ce', [15, 4]], ['ci', [15, 6]], ['ge', [16, 4]],
  ['gi', [16, 6]], ['ll', [14]], ['ss', [15]],
] as const satisfies readonly (readonly [string, readonly number[]])[]

const frenchSingle: Readonly<Record<string, readonly number[]>> = {
  a: [2], à: [2], â: [2], b: [21], c: [20], ç: [15], d: [19], e: [4], é: [4], è: [4], ê: [4],
  f: [18], g: [20], h: [], i: [6], î: [6], j: [16], k: [20], l: [14], m: [21], n: [19], o: [8],
  ô: [8], p: [21], q: [20], r: [13], s: [15], t: [19], u: [7], û: [7], v: [18], w: [7],
  x: [20, 15], y: [6], z: [15],
}

/** Converts aligned French characters with the Azure 22 rules used by AniMattor. */
export function buildFrenchAzureVisemes(characters: readonly AudioCharacter[]): readonly FrenchAzureViseme[] {
  const source = characters.map(({ text, start, end }) => ({ text, start, end, lower: text.toLowerCase() }))
  const cues: TimelineCue[] = []
  const addMapped = (shapes: readonly number[], start: number, end: number, text: string): void => {
    if (shapes.length === 0) {
      cues.push({ v: -2, s: start, e: end, txt: text })
      return
    }
    const part = (end - start) / shapes.length
    shapes.forEach((shape, index) => cues.push({ v: shape, s: start + part * index, e: start + part * (index + 1), txt: text }))
  }

  for (let index = 0; index < source.length;) {
    const character = source[index]!
    if (/\s/u.test(character.lower)) {
      cues.push({ v: -1, s: character.start, e: character.end, txt: ' ' })
      index++
      continue
    }
    if (!isLetter(character.lower)) {
      cues.push({ v: /[.,!?;:…—–-]/u.test(character.lower) ? 0 : -1, s: character.start, e: character.end, txt: character.text })
      index++
      continue
    }

    const matched = frenchMulti.find(([graph]) =>
      index + graph.length <= source.length
      && source.slice(index, index + graph.length).map(({ lower }) => lower).join('') === graph)
    if (matched !== undefined) {
      const [graph, shapes] = matched
      addMapped(shapes, character.start, source[index + graph.length - 1]!.end, source.slice(index, index + graph.length).map(({ text }) => text).join(''))
      index += graph.length
      continue
    }

    if ('estdxzp'.includes(character.lower)) {
      const next = source[index + 1]?.lower
      let previousLetters = 0
      for (let previous = index - 1; previous >= 0 && isLetter(source[previous]!.lower); previous--) previousLetters++
      if ((next === undefined || !isLetter(next)) && previousLetters >= 2) {
        cues.push({ v: -2, s: character.start, e: character.end, txt: character.text })
        index++
        continue
      }
    }

    const mapped = frenchSingle[character.lower]
      ?? frenchSingle[character.lower.normalize('NFD').replace(/\p{M}/gu, '')]
      ?? []
    addMapped(mapped, character.start, character.end, character.text)
    index++
  }

  const timeline: TimelineCue[] = []
  cues.forEach((cue) => {
    const previous = timeline[timeline.length - 1]
    if (cue.v === -2) {
      if (previous !== undefined) previous.e = cue.e
      return
    }
    if (cue.v === -1) {
      if (cue.e - cue.s < 0.12 && previous !== undefined) {
        previous.e = cue.e
        return
      }
      cue.v = 0
    }
    if (previous !== undefined && previous.v === cue.v) {
      previous.e = cue.e
      previous.txt += cue.txt
      return
    }
    if (previous !== undefined && cue.s > previous.e) {
      if (cue.s - previous.e > 0.12) timeline.push({ v: 0, s: previous.e, e: cue.s, txt: '' })
      else previous.e = cue.s
    }
    timeline.push({ ...cue })
  })

  const first = timeline[0]
  if (first !== undefined && first.s > 0.02) timeline.unshift({ v: 0, s: 0, e: first.s, txt: '' })
  const last = timeline[timeline.length - 1]
  if (last !== undefined && last.v !== 0) timeline.push({ v: 0, s: last.e, e: last.e + 0.25, txt: '' })
  return timeline.map(({ v, s, e, txt }) => ({
    shape: v,
    value: v + 100,
    property: `v${v + 100}`,
    start: s,
    end: e,
    letters: txt,
  }))
}

/** Identifies letters while leaving punctuation to the demo's neutral-shape rules. */
function isLetter(value: string): boolean {
  return /\p{L}/u.test(value)
}
