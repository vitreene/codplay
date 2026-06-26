import type { GameDraw, QuizHuntContent } from "./types"

const EXTRA_OFFSET_MIN_MS = 800
const EXTRA_OFFSET_MAX_MS = 2200

/** Creates a deterministic PRNG (mulberry32) from one numeric seed. */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Shuffles one array in place using the Fisher-Yates algorithm. */
function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Resolves every seed-driven choice for one game session, in a fixed
 * consumption order so the same seed always produces the same game:
 * 1) grid tile order, 2) trial hosting the extra, 3) extra time offset,
 * 4) color supplying the final question.
 */
export function deriveGameDraw(content: QuizHuntContent, seed: number): GameDraw {
  const random = createSeededRandom(seed)

  const gridOrder = shuffle(content.words.map((word) => word.id), random)

  const extraWordId = content.words[Math.floor(random() * content.words.length)].id

  const extraOffsetMs = Math.round(EXTRA_OFFSET_MIN_MS + random() * (EXTRA_OFFSET_MAX_MS - EXTRA_OFFSET_MIN_MS))

  const finalColor = content.colors[Math.floor(random() * content.colors.length)]

  return { gridOrder, extraWordId, extraOffsetMs, finalColor }
}
