import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { BDC_TYPE, DEFAULT_PRESET_ID } from '../config/document-config'
import {
  customColorClassName,
  pageAppearanceClassNames,
} from '../builders/scene-style/appearance-class-names.ts'
import { applyDocumentCommand } from '../domain/commands/document-commands'
import { createStatisticalGraphBdcCommand } from '../domain/commands/document-commands/command-factories'
import { ElceDocument, createInitialDocument } from '../domain/document/document-model'
import type { Bdc } from '../domain/document/document-types'
import {
  appearanceThemeCssAssetPathsForDocument,
  createDocumentAppearanceStyleSheet,
} from './appearance-scene-style-sheet'

describe('appearance CSS assets for the document', () => {
  it('selects only the authored files used by resolved appearance values', () => {
    const document = createInitialDocument()
    const assetPaths = appearanceThemeCssAssetPathsForDocument(document)

    expect(assetPaths).toEqual([
      'palettes/classic.css',
      'typography/crimson-text.css',
      'typography/dm-sans.css',
      'typography/reading.css',
      'densities/normal.css',
    ])
  })

  it('keeps theme CSS as linked preview assets and local package imports', () => {
    const document = createInitialDocument()
    const previewStyleSheet = createDocumentAppearanceStyleSheet(document)
    const packageStyleSheet = createDocumentAppearanceStyleSheet(document, './')

    expect(previewStyleSheet).not.toContain('@import')
    expect(previewStyleSheet).not.toContain('--elce-appearance-')
    expect(packageStyleSheet.startsWith('@import "./appearance/css/palettes/classic.css";')).toBe(true)
    expect(packageStyleSheet).toContain('@import "./appearance/css/palettes/classic.css";')
    expect(packageStyleSheet).toContain('@import "./appearance/css/typography/crimson-text.css";')
    expect(packageStyleSheet).toContain('@import "./appearance/css/typography/dm-sans.css";')
    expect(packageStyleSheet).toContain('@import "./appearance/css/typography/reading.css";')
    expect(packageStyleSheet).not.toContain('palettes/ocean.css')
  })

  it('keeps authored density values directly in relative-unit CSS files', async () => {
    const normalDensity = await readFile(new URL('../config/appearance/css/densities/normal.css', import.meta.url), 'utf8')
    const compactDensity = await readFile(new URL('../config/appearance/css/densities/compact.css', import.meta.url), 'utf8')
    const largeDensity = await readFile(new URL('../config/appearance/css/densities/large.css', import.meta.url), 'utf8')

    expect(normalDensity).toContain('.density-normal.section.has-background')
    expect(normalDensity).toContain('padding: clamp(1rem, 3vw, 2rem)')
    expect(normalDensity).toContain('margin-block: 0 0.75em')
    expect(compactDensity).toContain('margin-block: 0 0.5em')
    expect(largeDensity).toContain('margin-block: 0 1em')
    expect(largeDensity).toContain('.density-large.card-text-image.has-background')
    expect(largeDensity).toContain('padding: clamp(1rem, 3.75cqw, 2.5rem)')
  })

  it('applies one reading measure to every BDC root', async () => {
    const readingCss = await readFile(new URL('../config/appearance/css/typography/reading.css', import.meta.url), 'utf8')
    const compactDensity = await readFile(new URL('../config/appearance/css/densities/compact.css', import.meta.url), 'utf8')
    const largeDensity = await readFile(new URL('../config/appearance/css/densities/large.css', import.meta.url), 'utf8')
    const familyCss = await readFile(new URL('../config/appearance/css/typography/dm-sans.css', import.meta.url), 'utf8')
    const document = createInitialDocument()
    const page = document.pages[0]
    if (page === undefined) throw new Error('The appearance fixture has no page.')

    expect(readingCss).toContain('  .bdc {')
    expect(readingCss).toContain('max-inline-size: min(100%, 70ch)')
    expect(readingCss).toContain('container-type: inline-size')
    expect(readingCss).toContain('@scope (.section.bdc) to (.section.bdc .bdc)')
    expect(readingCss).toContain('font-size: clamp(0.9rem, 0.6cqi + 0.7rem, 1rem)')
    expect(readingCss).toContain('margin-inline: auto')
    expect(readingCss).not.toContain('.text-reading')
    expect(readingCss).not.toContain('.elce-flow-slot')
    expect(compactDensity).toContain('.bdc.density-compact { max-inline-size: min(100%, 60ch); }')
    expect(compactDensity).toContain('font-size: clamp(0.9rem, 0.5cqi + 0.68rem, 0.95rem)')
    expect(largeDensity).toContain('.bdc.density-large { max-inline-size: min(100%, 81ch); }')
    expect(largeDensity).toContain('font-size: clamp(0.95rem, 0.6cqi + 0.85rem, 1.125rem)')
    expect(familyCss).not.toContain('font-size:')
    expect(familyCss).not.toContain('max-inline-size:')
    expect(pageAppearanceClassNames(document, page, document.bdcs)['bdc:bdc-section-1']).toContain('bdc')

    const graphDocument = applyDocumentCommand(document, createStatisticalGraphBdcCommand('bdc-graph', page.id, 1))
    const graphPage = graphDocument.pages[0]
    if (graphPage === undefined) throw new Error('The graph appearance fixture has no page.')
    const roleFixtures = [
      appearanceBdcFixture('card-short', BDC_TYPE.CARD, DEFAULT_PRESET_ID.TEXT_SHORT, graphPage.id, null),
      appearanceBdcFixture('card-image', BDC_TYPE.CARD, DEFAULT_PRESET_ID.TEXT_IMAGE, graphPage.id, null),
      appearanceBdcFixture('card-caption', BDC_TYPE.CARD, DEFAULT_PRESET_ID.IMAGE_CAPTION, graphPage.id, null),
      appearanceBdcFixture('card-photo', BDC_TYPE.CARD, DEFAULT_PRESET_ID.PHOTO, graphPage.id, null),
      appearanceBdcFixture('carousel', BDC_TYPE.CAROUSEL, DEFAULT_PRESET_ID.CAROUSEL, graphPage.id, null),
      appearanceBdcFixture('carousel-card', BDC_TYPE.CARD, DEFAULT_PRESET_ID.TEXT_SHORT, null, 'carousel'),
      appearanceBdcFixture('question', BDC_TYPE.QUESTION, DEFAULT_PRESET_ID.QUESTION, graphPage.id, null),
      appearanceBdcFixture('result', BDC_TYPE.EVALUATION_RESULT, DEFAULT_PRESET_ID.EVALUATION_RESULT, graphPage.id, null),
    ]
    const roleDocument = new ElceDocument({
      ...graphDocument.toJSON(),
      bdcs: [...graphDocument.bdcs, ...roleFixtures],
    })
    const roleClasses = pageAppearanceClassNames(roleDocument, graphPage, roleDocument.bdcs)
    for (const bdcId of [
      'card-short',
      'card-image',
      'card-caption',
      'card-photo',
      'carousel',
      'carousel-card',
      'question',
      'result',
      'bdc-graph',
    ]) {
      expect(roleClasses[`bdc:${bdcId}`]).toMatch(/\bbdc\b/)
      expect(roleClasses[`bdc:${bdcId}`]).not.toContain('text-reading')
    }
  })

  it('keeps author-entered colors in compact target-independent classes', () => {
    const document = applyDocumentCommand(createInitialDocument(), {
      type: 'appearance.background.set',
      target: { kind: 'document' },
      value: { kind: 'custom', value: '#324b5a' },
    })

    const styleSheet = createDocumentAppearanceStyleSheet(document)
    const customClass = customColorClassName('background', '#324b5a')
    expect(styleSheet).toContain(`.${customClass}:is(.project-layout)`)
    expect(styleSheet).toContain('background-color: #324b5a;')
    expect(styleSheet).not.toContain('--elce-appearance-')
  })

  it('shares one direct custom-color definition across the project stylesheet', () => {
    let document = applyDocumentCommand(createInitialDocument(), {
      type: 'appearance.background.set',
      target: { kind: 'document' },
      value: { kind: 'custom', value: '#324b5a' },
    })
    const page = document.pages[0]
    if (page === undefined) throw new Error('The appearance fixture has no page.')
    document = applyDocumentCommand(document, {
      type: 'appearance.background.set',
      target: { kind: 'page', pageId: page.id },
      value: { kind: 'custom', value: '#324b5a' },
    })

    const styleSheet = createDocumentAppearanceStyleSheet(document)
    expect(styleSheet.match(/background-color: #324b5a;/g)).toHaveLength(1)
    expect(styleSheet).toContain('.custom-bg-324b5a:is(.project-layout)')
    expect(styleSheet).toContain('.custom-bg-324b5a:is(.page-flux)')
  })
})

/** Creates a minimal BDC fixture for testing appearance role projection only. */
function appearanceBdcFixture(
  id: string,
  type: Bdc['type'],
  presetId: string,
  pageId: string | null,
  parentBdcId: string | null,
): Bdc {
  return {
    id,
    type,
    presetId,
    pageId,
    parentBdcId,
    section: null,
    question: null,
    evaluationResult: null,
    carousel: null,
    card: null,
    statisticalGraph: null,
  }
}
