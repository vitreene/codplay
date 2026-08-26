import type { V2DemoModule } from './layout/types'

/** Static metadata used by the common layout before a demo scene is loaded. */
export type V2DemoDefinition = Readonly<{
  id: string
  path: string
  label: string
  title: string
  description: string
  durationMs: number
  rootStoryId: string
  stageClassName: string
  stageLabel: string
  load: () => Promise<V2DemoModule>
}>

/** V2 demos are loaded on demand so the selector does not import every scene. */
export const V2_DEMO_REGISTRY: readonly V2DemoDefinition[] = [
  {
    id: 'flip-list',
    path: '?demo=flip-list',
    label: 'Des éléments passent d’une liste à l’autre',
    title: 'Des éléments passent d’une liste à l’autre',
    description: 'Deux listes échangent leurs éléments un par un pendant que leurs conteneurs se déplacent et que la fenêtre peut être redimensionnée.',
    durationMs: 10_000,
    rootStoryId: 'main',
    stageClassName: 'stress-stage',
    stageLabel: 'scène FLIP stress déclarative',
    load: async () => import('./demos/flip-stress/main'),
  },
  {
    id: 'components',
    path: '?demo=components',
    label: 'Image, input et polygone',
    title: 'Image, input et polygone',
    description: 'Une scène présente une image, un polygone SVG et une question interactive sur la même timeline.',
    durationMs: 3_800,
    rootStoryId: 'main',
    stageClassName: 'components-stage-host',
    stageLabel: 'scène des composants core V2',
    load: async () => {
      await import('./demos/components/style.css')
      const module = await import('./demos/components/components-scene')
      return { createScene: module.createComponentsScene }
    },
  },
]

/** Resolves one selected V2 demo and falls back to the first registered entry. */
export function resolveV2Demo(id: string | null): V2DemoDefinition {
  return V2_DEMO_REGISTRY.find((demo) => demo.id === id) ?? V2_DEMO_REGISTRY[0]!
}
