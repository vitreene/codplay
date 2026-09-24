import { createV2DemoLayout } from './layout/layout'
import { resolveV2Demo, V2_DEMO_REGISTRY, V2_FAME_DEMO_REGISTRY } from './registry'

/** Mounts the selected V2 demo through the single lazy-loaded application entry. */
async function main(): Promise<void> {
  const app = document.querySelector<HTMLElement>('#app')
  if (app === null) throw new Error('Expected #app root element.')

  const demos = app.dataset.v2DemoCollection === 'fame' ? V2_FAME_DEMO_REGISTRY : V2_DEMO_REGISTRY
  const selected = resolveV2Demo(new URL(globalThis.location.href).searchParams.get('demo'), demos)
  const layout = createV2DemoLayout({ app, active: selected, demos })
  const module = await selected.load()
  await layout.mount(module)

  globalThis.addEventListener('beforeunload', () => {
    layout.destroy()
  }, { once: true })
}

void main()
