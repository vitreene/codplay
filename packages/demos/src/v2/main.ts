import { createV2DemoLayout } from './layout/layout'
import { resolveV2Demo, V2_DEMO_REGISTRY } from './registry'

/** Mounts the selected V2 demo through the single lazy-loaded application entry. */
async function main(): Promise<void> {
  const app = document.querySelector<HTMLElement>('#app')
  if (app === null) throw new Error('Expected #app root element.')

  const selected = resolveV2Demo(new URL(globalThis.location.href).searchParams.get('demo'))
  const layout = createV2DemoLayout({ app, active: selected, demos: V2_DEMO_REGISTRY })
  const module = await selected.load()
  await layout.mount(module)

  globalThis.addEventListener('beforeunload', () => {
    layout.destroy()
  }, { once: true })
}

void main()
