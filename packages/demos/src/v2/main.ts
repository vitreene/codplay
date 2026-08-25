import { createV2DemoLayout } from './layout/v2-demo-layout'
import { resolveV2Demo, V2_DEMO_REGISTRY } from './registry'

/** Mounts the selected V2 demo through the single lazy-loaded application entry. */
async function main(): Promise<void> {
  const app = document.querySelector<HTMLElement>('#app')
  if (app === null) throw new Error('Expected #app root element.')

  const selected = resolveV2Demo(new URL(globalThis.location.href).searchParams.get('demo'))
  const layout = createV2DemoLayout({ app, active: selected, demos: V2_DEMO_REGISTRY })
  const module = await selected.load()
  const cleanup = await module.mount(layout.context)

  globalThis.addEventListener('beforeunload', () => {
    if (typeof cleanup === 'function') cleanup()
    layout.destroy()
  }, { once: true })
}

void main()
