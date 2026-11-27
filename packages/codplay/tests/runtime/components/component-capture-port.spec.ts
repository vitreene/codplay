/** @vitest-environment jsdom */
import { afterEach, expect, it } from 'vitest'
import type { RuntimeCaptureSourcePort } from '../../../src/runtime/capture'
import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import { BaseHTMLComponent, type ComponentInput, type ComponentUpdateInput } from '../../../src/runtime/components'
import { HtmlPlayerRunner } from '../../../src/runtime/runner-html'
import { SceneBuilder } from '../../../src/scene/compiled'
import type { SceneDoc } from '../../../src/scene/types'

let receivedPort: RuntimeCaptureSourcePort | undefined

/** Minimal component that keeps the capture port handed over at construction. */
class CaptureProbeComponent extends BaseHTMLComponent<Record<string, unknown>> {
  static readonly declaredServices = [] as const

  /** Records the injected player-scoped capture port. */
  constructor(input: ComponentInput<Record<string, unknown>>) {
    super(input)
    this.services.declare(CaptureProbeComponent.declaredServices)
    receivedPort = this.captureSources
  }

  /** Renders one empty root. */
  render(): string {
    return '<div></div>'
  }

  /** Has no state to project. */
  update(_input: ComponentUpdateInput): void {}
}

afterEach(() => {
  receivedPort = undefined
  document.body.replaceChildren()
})

it('hands every component the runner’s player-scoped capture port', () => {
  const catalog = createCoreRuntimeCatalog()
  catalog.registerComponent({
    type: 'capture-probe',
    component: CaptureProbeComponent,
    modules: [],
    validateInitial: () => undefined,
  })
  const scene: SceneDoc<string> = {
    id: 'component-capture-port',
    stories: { main: { id: 'main', persos: [{ id: 'probe', type: 'capture-probe', initial: { move: '@root' } }] } },
  }
  const build = new SceneBuilder(catalog.validationSnapshot()).build(scene)
  if (!build.ok) throw new Error(build.diagnostics.errors.map((issue) => issue.message).join('\n'))
  const root = document.createElement('main')
  document.body.append(root)
  const runner = new HtmlPlayerRunner({ id: 'component-capture-port', compiledScene: build.compiledScene, root, catalog })

  expect(runner.init().ok).toBe(true)
  expect(receivedPort).toBe(runner['captureSourceCircuit'])
  expect(receivedPort?.hasRules({ storyId: 'main', persoId: 'probe', source: 'scroll' })).toBe(false)
  runner.destroy()
})
