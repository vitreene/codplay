import { describe, expect, it } from 'vitest'
import { projectFluxPlayerMarkup, readFluxAnchorTargets } from './flux-anchor-player-markup'

describe('Flux player anchor markup', () => {
  it('projects an editor anchor to a full-width CodPlay flow slot', () => {
    const markup = '<p id="text">Avant <span id="part:anchor" data-elce-anchor="true" data-bdc-id="bdc-image" data-part="part:anchor" style="padding-bottom:75%;"></span> après</p>'

    const projected = projectFluxPlayerMarkup(markup)

    expect(projected).toContain('Avant ')
    expect(projected).toContain(' après')
    expect(projected).toContain('id="part:anchor-flow-slot"')
    expect(projected).toContain('class="elce-flow-slot"')
    expect(projected).toContain('data-part="part:anchor"')
    expect(projected).toContain('display:inline-block;width:0;height:0;position:static;')
    expect(projected).toContain('--elce-anchor-padding:75%')
    expect(projected).toContain('padding-bottom:calc(75% + 1rem)')
    expect(projected).toContain('margin-inline-end:100%')
    expect(projected).not.toContain('data-elce-anchor')
    expect(projected).not.toContain('data-bdc-id')
  })

  it('keeps the logical bdc target available before player projection', () => {
    const markup = '<p id="text"><span data-elce-anchor="true" data-bdc-id="bdc-image" data-part="part:anchor"></span></p>'

    expect(readFluxAnchorTargets(markup)).toEqual([{ bdcId: 'bdc-image', partId: 'part:anchor', paddingBottom: '12rem' }])
  })

  it('keeps the raw reservation when projecting markup that already has layout CSS', () => {
    const markup = '<p id="text"><span data-elce-anchor="true" data-bdc-id="bdc-image" data-part="part:anchor" style="--elce-anchor-padding:75%;padding-bottom:calc(75% + 1rem);"></span></p>'

    const projected = projectFluxPlayerMarkup(markup)

    expect(projected).toContain('--elce-anchor-padding:75%')
    expect(projected).toContain('padding-bottom:calc(75% + 1rem)')
    expect(projected).not.toContain('calc(calc(')
  })
})
