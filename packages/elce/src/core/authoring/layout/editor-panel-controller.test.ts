// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

import { createEditorPanelController } from './editor-panel-controller'

describe('shared editor panel controller', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('keeps one panel open on narrow screens and restores focus after Escape closes it', async () => {
    let width = 800
    const trigger = document.createElement('button')
    trigger.id = 'panel-reopen'
    document.body.append(trigger)
    const panels = createEditorPanelController({
      initialWidth: width,
      getWidth: () => width,
      update: async () => undefined,
    })

    panels.setPanelVisibility('properties', true, trigger.id)
    expect(panels.visibility).toEqual({ outline: false, properties: true })
    expect(panels.responsivePanel).toBe('properties')

    panels.setResponsivePanel(null)
    await Promise.resolve()
    expect(panels.visibility).toEqual({ outline: false, properties: false })
    expect(document.activeElement).toBe(trigger)
  })

  it('keeps the shared defaults at both breakpoints while resizing', () => {
    let width = 1200
    const panels = createEditorPanelController({
      initialWidth: width,
      getWidth: () => width,
      update: async () => undefined,
    })

    expect(panels.visibility).toEqual({ outline: true, properties: false })

    width = 1201
    panels.resize(width)
    expect(panels.visibility).toEqual({ outline: true, properties: true })

    width = 1200
    panels.resize(width)
    expect(panels.visibility).toEqual({ outline: true, properties: false })

    width = 800
    panels.resize(width)
    expect(panels.visibility).toEqual({ outline: false, properties: false })

    width = 801
    panels.resize(width)
    expect(panels.visibility).toEqual({ outline: true, properties: false })
    expect(panels.responsivePanel).toBeNull()
  })
})
