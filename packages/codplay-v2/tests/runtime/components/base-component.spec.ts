import { describe, expect, it } from 'vitest'
import { BaseComponent, BaseHTMLComponent } from '../../../src/runtime/components'
import type {
  ComponentInput,
  ComponentUpdateInput,
  HTMLComponentInput,
} from '../../../src/runtime/components'

class GenericComponent extends BaseComponent<Record<string, unknown>> {
  readonly updates: number[] = []

  /** Applies state without requiring a markup representation or substrate service. */
  update(input: ComponentUpdateInput): void {
    this.updates.push(input.timeMs)
  }
}

class HtmlProbeComponent extends BaseHTMLComponent<Record<string, unknown>> {
  /** Creates one HTML probe with the specialized service boundary. */
  constructor(input: HTMLComponentInput) {
    super(input)
  }

  /** Provides the markup consumed by the HTML materializer. */
  render(): string {
    return '<div></div>'
  }

  /** Applies no state in this boundary probe. */
  update(_input: ComponentUpdateInput): void {}
}

describe('component base boundaries', () => {
  it('keeps the generic base independent from markup and substrate services', () => {
    const input: ComponentInput = {
      perso: { id: 'generic', storyId: 'main', initial: {} },
    }
    const component = new GenericComponent(input)

    component.update({ state: {}, timeMs: 12 })

    expect(component.updates).toEqual([12])
    expect('render' in component).toBe(false)
  })

  it('keeps markup concerns on the HTML specialization', () => {
    const input: HTMLComponentInput = {
      perso: { id: 'html', storyId: 'main', initial: {} },
      services: { apply: () => undefined },
    }
    const component = new HtmlProbeComponent(input)

    expect(component.render()).toBe('<div></div>')
    expect(component.node).toBeNull()
  })
})
