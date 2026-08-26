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
  mountableParts: readonly string[]
  stageClassName: string
  stageLabel: string
  load: () => Promise<V2DemoModule>
}>

/** V2 demos are loaded on demand so the selector does not import every scene. */
export const V2_DEMO_REGISTRY: readonly V2DemoDefinition[] = [
  {
    id: 'flip-stress',
    path: '?demo=flip-stress',
    label: 'FLIP stress test',
    title: 'FLIP stress test',
    description: 'Les deux listes se déplacent pendant que leurs éléments sont échangés un par un, y compris lorsque la fenêtre est redimensionnée.',
    durationMs: 10_000,
    rootStoryId: 'main',
    mountableParts: [
      'stress-a-outlet',
      'stress-b-outlet',
      'stress-c-outlet',
      'stress-d-outlet',
      'transfer-q-outlet',
      'transfer-k-outlet',
    ],
    stageClassName: 'stress-stage',
    stageLabel: 'scène FLIP stress déclarative',
    load: async () => import('./demos/flip-stress/main'),
  },
]

/** Resolves one selected V2 demo and falls back to the first registered entry. */
export function resolveV2Demo(id: string | null): V2DemoDefinition {
  return V2_DEMO_REGISTRY.find((demo) => demo.id === id) ?? V2_DEMO_REGISTRY[0]!
}
