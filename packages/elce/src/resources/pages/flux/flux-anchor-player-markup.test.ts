import { describe, expect, it } from 'vitest'
import { projectFluxPlayerMarkup, readFluxAnchorTargets } from './flux-anchor-player-markup'

describe('Flux player anchor markup', () => {
  it('projects an editor anchor to a full-width CodPlay flow slot', () => {
    const markup = '<p id="text">Avant <span id="part:anchor" data-elce-anchor="true" data-bdc-id="bdc-image" data-part="part:anchor" style="padding-bottom:75%;"></span> après</p>'

    const projected = projectFluxPlayerMarkup(markup)

    expect(projected).toContain('Avant ')
    expect(projected).toContain(' après')
    expect(projected).toContain('id="part:anchor-flow-slot"')
    expect(projected).toMatch(/class="elce-flow-slot elce-flow-slot-/)
    expect(projected).toContain('data-part="part:anchor"')
    expect(projected).not.toContain('style=')
    expect(projected).not.toContain('data-elce-anchor')
    expect(projected).not.toContain('data-bdc-id')
  })

  it('keeps the logical bdc target available before player projection', () => {
    const markup = '<p id="text"><span data-elce-anchor="true" data-bdc-id="bdc-image" data-part="part:anchor"></span></p>'

    expect(readFluxAnchorTargets(markup)).toEqual([{ bdcId: 'bdc-image', partId: 'part:anchor', paddingBottom: '75%' }])
  })

  it('projects an existing anchor as a class without copying its inline layout values', () => {
    const markup = '<p id="text"><span data-elce-anchor="true" data-bdc-id="bdc-image" data-part="part:anchor" style="--elce-anchor-padding:75%;padding-bottom:calc(75% + 1rem);"></span></p>'

    const projected = projectFluxPlayerMarkup(markup)

    expect(projected).toMatch(/class="elce-flow-slot elce-flow-slot-/)
    expect(projected).not.toContain('style=')
    expect(readFluxAnchorTargets(markup)[0]?.paddingBottom).toBe('75%')
  })

  it('projects a graph anchor through the same flow slot class', () => {
    const markup = '<p id="text"><span data-elce-anchor="true" data-bdc-id="graph-1" data-part="part:graph"></span></p>'

    const projected = projectFluxPlayerMarkup(markup)

    expect(projected).toMatch(/class="elce-flow-slot elce-flow-slot-/)
    expect(projected).toContain('data-part="part:graph"')
    expect(projected).not.toContain('style=')
  })
})
