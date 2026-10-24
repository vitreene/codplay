import { describe, expect, it } from 'vitest'
import { CodPlay } from 'codplay'
import {
  SCROLL_CONTAINER_COMPONENT_DEFINITION,
  SCROLL_CONTAINER_MODULE_DEFINITION,
} from '@codplay/component-v2'
import { BDC_LOCATION, BDC_TYPE, DEFAULT_PRESET_ID, PAGE_LOCATION, PAGE_TYPE, STATISTICAL_GRAPH_RENDERING } from '../../config/document-config'
import { applyDocumentCommand, createDefaultPageCommand, createStatisticalGraphBdcCommand, createStatisticalGraphCarouselBdcCommand } from '../../domain/commands/document-commands'
import { createInitialDocument } from '../../domain/document/document-model'
import type { RichTextDocument } from '../../domain/document/document-types'
import { buildDiapoScene } from '../diapo/diapo-scene-builder'
import { buildFluxScene } from '../flux/flux-scene-builder'

describe('Statistical Graph placement through Elcé scene builders', () => {
  it('builds direct Flux and Diapo graphs through the real CodPlay scene boundary', () => {
    const initial = createInitialDocument()
    const flux = applyDocumentCommand(initial, createStatisticalGraphBdcCommand('graph-flux', 'page-a', 1))
    const fluxBuild = buildFluxScene(flux.pages.find((page) => page.id === 'page-a')!, flux.bdcs)
    const fluxStory = fluxBuild.sceneDoc.stories['page-a-page']
    const article = fluxStory?.persos.find((perso) => perso.id === 'page-a-article')
    const fluxVisual = fluxStory?.persos.find((perso) => perso.id.endsWith('-viewport-visual'))
    const fluxMarkup = article?.initial !== undefined && 'markup' in article.initial ? String(article.initial.markup) : ''
    const fluxVisualMarkup = fluxVisual?.initial !== undefined && 'markup' in fluxVisual.initial ? String(fluxVisual.initial.markup) : ''

    expect(fluxMarkup).toContain('id="page-a-graph-flux-graph"')
    expect(fluxMarkup).toContain('data-part="page-a:graph-flux:statistical-graph:visual"')
    expect(fluxMarkup).not.toContain('<svg')
    expect(fluxVisualMarkup).toContain('<svg')
    expect(compileScene(fluxBuild.sceneDoc).ok).toBe(true)

    const diapoPage = createDefaultPageCommand(initial, { kind: PAGE_LOCATION.SCENARIO }, 'Graphe', PAGE_TYPE.DIAPO)
    let diapo = applyDocumentCommand(initial, diapoPage)
    diapo = applyDocumentCommand(diapo, { type: 'bdc.carousel.delete', bdcId: diapoPage.bdcId })
    diapo = applyDocumentCommand(diapo, createStatisticalGraphBdcCommand('graph-diapo', diapoPage.pageId, 0))
    const diapoBuild = buildDiapoScene(diapo.pages.find((page) => page.id === diapoPage.pageId)!, diapo.bdcs)
    const diapoStory = diapoBuild.sceneDoc.stories[`${diapoPage.pageId}-diapo-page`]
    const diapoHost = diapoStory?.persos.find((perso) => perso.id === `${diapoPage.pageId}-diapo-content`)
    const diapoVisual = diapoStory?.persos.find((perso) => perso.id.endsWith('-viewport-visual'))
    const diapoMarkup = diapoHost?.initial !== undefined && 'markup' in diapoHost.initial ? String(diapoHost.initial.markup) : ''
    const diapoVisualMarkup = diapoVisual?.initial !== undefined && 'markup' in diapoVisual.initial ? String(diapoVisual.initial.markup) : ''

    expect(diapoMarkup).toContain(`id="${diapoPage.pageId}-graph-diapo-graph"`)
    expect(diapoMarkup).toContain(`data-part="${diapoPage.pageId}:graph-diapo:statistical-graph:visual"`)
    expect(diapoMarkup).not.toContain('<svg')
    expect(diapoVisualMarkup).toContain('<svg')
    expect(compileScene(diapoBuild.sceneDoc).ok).toBe(true)
  })

  it('sequences a Graph child through the existing Carousel capsule and keeps it as the completion view', () => {
    const initial = createInitialDocument()
    const pageCommand = createDefaultPageCommand(initial, { kind: PAGE_LOCATION.SCENARIO }, 'Carousel Graphe', PAGE_TYPE.DIAPO)
    let document = applyDocumentCommand(initial, pageCommand)
    const firstCardId = document.bdcs.find((bdc) => bdc.id === pageCommand.bdcId)?.carousel?.cards[0]?.bdcId
    if (firstCardId === undefined) throw new Error('La Diapo de test doit commencer par une vue Carte.')
    document = applyDocumentCommand(document, createStatisticalGraphCarouselBdcCommand('graph-slide', pageCommand.bdcId, 1))
    const page = document.pages.find((candidate) => candidate.id === pageCommand.pageId)!
    const build = buildDiapoScene(page, document.bdcs)
    const story = build.sceneDoc.stories[`${page.id}-diapo-page`]
    const graphView = story?.persos.find((perso) => perso.id === `${page.id}:${pageCommand.bdcId}-card-graph-slide`)
    const graphVisual = story?.persos.find((perso) => perso.id.endsWith('-viewport-visual'))
    const graphMarkup = graphView?.initial !== undefined && 'markup' in graphView.initial ? String(graphView.initial.markup) : ''
    const graphVisualMarkup = graphVisual?.initial !== undefined && 'markup' in graphVisual.initial ? String(graphVisual.initial.markup) : ''
    const completion = story?.persos.find((perso) => perso.id.endsWith('-completion-marker'))

    expect(document.bdcs.find((bdc) => bdc.id === pageCommand.bdcId)?.carousel?.cards.map((entry) => entry.bdcId)).toEqual([
      firstCardId,
      'graph-slide',
    ])
    expect(graphMarkup).toContain(`data-part="${page.id}:${pageCommand.bdcId}:card:graph-slide:visual"`)
    expect(graphMarkup).not.toContain('<svg')
    expect(graphVisualMarkup).toContain('<svg')
    expect(graphMarkup).toContain(`<!-- data-part="${page.id}:${pageCommand.bdcId}:card:graph-slide:root" -->`)
    expect(completion?.emit?.observe).toMatchObject({ root: `${page.id}-${pageCommand.bdcId}-diapo-end-scrollport` })
    expect(compileScene(build.sceneDoc).ok).toBe(true)
  })

  it('attaches a catalog Graph through the existing Section anchor circuit', () => {
    let document = createInitialDocument()
    document = applyDocumentCommand(document, {
      type: 'bdc.create',
      bdcId: 'graph-anchor',
      bdcType: BDC_TYPE.STATISTICAL_GRAPH,
      presetId: DEFAULT_PRESET_ID.STATISTICAL_GRAPH_ABOVE_TEXT,
      placement: { kind: BDC_LOCATION.CATALOG },
    })
    const partId = 'page-a:graph-anchor:inline'
    const content: RichTextDocument = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Avant ' },
          { type: 'elceAnchor', attrs: { bdcId: 'graph-anchor', partId } },
          { type: 'text', text: ' après' },
        ],
      }],
    }
    const markup = `<p id="section-paragraph"><span id="${partId}" data-elce-anchor="true" data-bdc-id="graph-anchor" data-part="${partId}" style="padding-bottom:12rem"></span></p>`
    document = applyDocumentCommand(document, {
      type: 'bdc.anchor.attach',
      sectionBdcId: 'bdc-section-1',
      pageId: 'page-a',
      bdcId: 'graph-anchor',
      markup,
      content,
    })
    const build = buildFluxScene(document.pages[0]!, document.bdcs)
    const story = build.sceneDoc.stories['page-a-page']
    const article = story?.persos.find((perso) => perso.id === 'page-a-article')
    const articleMarkup = article?.initial !== undefined && 'markup' in article.initial ? String(article.initial.markup) : ''
    const graphRoot = story?.persos.find((perso) => perso.id === 'page-a-graph-anchor-graph')
    const graphVisual = story?.persos.find((perso) => perso.id.endsWith('-viewport-visual'))
    const graphVisualMarkup = graphVisual?.initial !== undefined && 'markup' in graphVisual.initial ? String(graphVisual.initial.markup) : ''
    const graphStyle = graphRoot?.initial !== undefined && 'style' in graphRoot.initial ? graphRoot.initial.style : undefined
    const graphClassName = graphRoot?.initial !== undefined && 'className' in graphRoot.initial ? String(graphRoot.initial.className) : ''
    const graphRules = build.styleSheets.join('\n')

    expect(document.bdcs.find((bdc) => bdc.id === 'graph-anchor')?.parentBdcId).toBe('bdc-section-1')
    expect(articleMarkup).toContain('class="elce-flow-slot elce-flow-slot-')
    expect(article?.initial).toMatchObject({
      flowReservations: [{ partId, blockSize: 'calc(56.25% + 1rem + 1rem)' }],
    })
    expect(graphRoot?.initial).toMatchObject({
      move: { target: partId },
      markup: expect.stringContaining(`data-part="${partId}:visual"`),
    })
    expect(graphStyle).not.toHaveProperty('aspectRatio')
    expect(graphClassName).toContain('elce-flux-anchor-illustration-')
    expect(graphRules).toContain('aspect-ratio: 16 / 9;')
    expect(graphRoot?.emit?.observe).toMatchObject({ root: 'page-a-scrollport', initial: 'enter' })
    expect(graphVisual?.initial).toMatchObject({ move: { target: `${partId}:visual` } })
    expect(graphVisualMarkup).toContain('<svg')
    expect(graphClassName).toContain('elce-statistical-graph--bar')
    expect(graphClassName).toContain('elce-flux-graph-root')
    expect(compileScene(build.sceneDoc).ok).toBe(true)
  })

  it('gives an anchored HTML table its natural height and reserves the responsive text width', () => {
    let document = createInitialDocument()
    document = applyDocumentCommand(document, {
      type: 'bdc.create',
      bdcId: 'graph-table-anchor',
      bdcType: BDC_TYPE.STATISTICAL_GRAPH,
      presetId: DEFAULT_PRESET_ID.STATISTICAL_GRAPH_ABOVE_TEXT,
      placement: { kind: BDC_LOCATION.CATALOG },
    })
    const graph = document.bdcs.find((bdc) => bdc.id === 'graph-table-anchor')
    if (graph?.statisticalGraph == null) throw new Error('Le Graphe de la fixture doit être complet.')
    document = applyDocumentCommand(document, {
      type: 'bdc.statistical-graph.update',
      bdcId: graph.id,
      statisticalGraph: { ...graph.statisticalGraph, rendering: STATISTICAL_GRAPH_RENDERING.TABLE },
    })
    const partId = 'page-a:graph-table-anchor:inline'
    const markup = `<p id="section-paragraph"><span id="${partId}" data-elce-anchor="true" data-bdc-id="graph-table-anchor" data-part="${partId}" style="padding-bottom:12rem"></span></p>`
    document = applyDocumentCommand(document, {
      type: 'bdc.anchor.attach',
      sectionBdcId: 'bdc-section-1',
      pageId: 'page-a',
      bdcId: 'graph-table-anchor',
      markup,
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'elceAnchor', attrs: { bdcId: 'graph-table-anchor', partId } }] }] },
    })

    const build = buildFluxScene(document.pages[0]!, document.bdcs)
    const story = build.sceneDoc.stories['page-a-page']
    const article = story?.persos.find((perso) => perso.id === 'page-a-article')
    const graphRoot = story?.persos.find((perso) => perso.id === 'page-a-graph-table-anchor-graph')
    const graphVisual = story?.persos.find((perso) => perso.id.endsWith('-viewport-visual'))
    const graphVisualMarkup = graphVisual?.initial !== undefined && 'markup' in graphVisual.initial ? String(graphVisual.initial.markup) : ''
    const graphStyle = graphRoot?.initial !== undefined && 'style' in graphRoot.initial ? graphRoot.initial.style : undefined
    const graphClassName = graphRoot?.initial !== undefined && 'className' in graphRoot.initial ? String(graphRoot.initial.className) : ''
    const graphRules = build.styleSheets.join('\n')

    expect(article?.initial).toMatchObject({
      flowReservations: [{ partId, blockSize: 'calc(100% + 1rem + 1rem)' }],
    })
    expect(graphStyle).not.toHaveProperty('height')
    expect(graphStyle).not.toHaveProperty('aspectRatio')
    expect(graphClassName).toContain('elce-statistical-graph--table')
    expect(graphClassName).toContain('elce-flux-anchor-illustration-')
    expect(graphRules).toContain('height: auto;')
    expect(graphRules).toContain('position-anchor: --')
    expect(graphRoot?.initial).toMatchObject({ markup: expect.stringContaining(`data-part="${partId}:visual"`) })
    expect(graphVisualMarkup).toContain('<table')
    expect(compileScene(build.sceneDoc).ok).toBe(true)
  })
})

/** Compiles an Elcé scene using the installed CodPlay scroll-container capability. */
function compileScene(scene: Parameters<CodPlay['build']>[0]['scene']) {
  const codplay = new CodPlay({
    pauseOnDocumentHidden: false,
    engine: {
      idle: false,
      components: { register: [SCROLL_CONTAINER_COMPONENT_DEFINITION] },
      modules: { register: [SCROLL_CONTAINER_MODULE_DEFINITION] },
    },
  })
  try {
    return codplay.build({ scene })
  } finally {
    codplay.destroy()
  }
}
