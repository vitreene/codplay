import { demo1 } from './demo1/main'
import { demo2 } from './demo2/main'
import { demo3 } from './demo3/main'
import type { SightyDemoDefinition } from './layout/types'

/** Lists the Sighty scenarios available from the single shared demo page. */
export const SIGHTY_DEMO_REGISTRY: readonly SightyDemoDefinition[] = [demo1, demo2, demo3]

/** Resolves a selector value and falls back to demo 1 for an unknown value. */
export function resolveSightyDemo(id: string | null): SightyDemoDefinition {
  return SIGHTY_DEMO_REGISTRY.find((demo) => demo.id === id) ?? SIGHTY_DEMO_REGISTRY[0]!
}
