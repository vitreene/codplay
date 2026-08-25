import type { V2DemoModule } from './layout/types'

/** Static metadata used to render the selector before a demo module is loaded. */
export type V2DemoDefinition = Readonly<{
  id: string
  label: string
  title: string
  description: string
  load: () => Promise<V2DemoModule>
}>

/** V2 demos are loaded on demand so the selector does not import every scene. */
export const V2_DEMO_REGISTRY: readonly V2DemoDefinition[] = [
  {
    id: 'flip-stress',
    label: 'FLIP stress',
    title: 'FLIP stress',
    description: 'Fixture de référence pour les transitions, le reparentage et le resize.',
    load: async () => import('./demos/flip-stress/main'),
  },
]

/** Resolves one selected demo and falls back to the first registered entry. */
export function resolveV2Demo(id: string | null): V2DemoDefinition {
  return V2_DEMO_REGISTRY.find((demo) => demo.id === id) ?? V2_DEMO_REGISTRY[0]!
}
