import { createSightyLayout } from './layout/layout'
import { resolveSightyDemo, SIGHTY_DEMO_REGISTRY } from './registry'

/** Starts the single Sighty demo page and delegates its scene to the selector. */
function main(): void {
  const app = document.querySelector<HTMLElement>('#app')
  if (app === null) throw new Error('Le point de montage #app manque pour les démos Sighty.')

  const selected = resolveSightyDemo(new URL(globalThis.location.href).searchParams.get('demo'))
  const layout = createSightyLayout({ app, demos: SIGHTY_DEMO_REGISTRY, active: selected })
  globalThis.addEventListener('beforeunload', () => layout.destroy(), { once: true })
}

main()
