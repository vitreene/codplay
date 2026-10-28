import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { BDC_TYPE, DEFAULT_PRESET_ID } from '../mods/learning/learning-definition'
import type { AppearanceBackgroundGradientId } from '../config/appearance/appearance-types'
import {
  appearanceScopeClassName,
  documentAppearanceClassNames,
  pageAppearanceClassNames,
} from '../builders/scene-style/appearance-class-names'
import { applyDocumentCommand } from '../domain/commands/document-commands'
import { createStandaloneCardBdcCommand } from '../resources/bdcs/card/authoring/card-command-factory'
import { createStatisticalGraphBdcCommand } from '../resources/bdcs/statistical-graph/authoring/statistical-graph-command-factory'
import { LearningDocument } from '../mods/learning/document/learning-document'
import { learningDocumentService } from '../mods/learning/document/learning-document-service'
import { resolveAppearance } from '../domain/appearance/appearance-resolver'
import type { LearningBdc } from '../mods/learning/document/learning-document-types'
import {
  createAppearanceTargetStyleSheet,
  appearanceThemeCssAssetPathsForDocument,
  createDocumentAppearanceStyleSheet,
} from './appearance-scene-style-sheet'
import { LEARNING_PLAYER_STYLE_SHEET } from '../mods/learning/reading/learning-player-style'

describe('appearance CSS assets for the document', () => {
  it('selects only the authored files used by resolved appearance values', () => {
    const document = learningDocumentService.createInitialDocument()
    const assetPaths = appearanceThemeCssAssetPathsForDocument(document)

    expect(assetPaths).toEqual([
      'typography/crimson-text.css',
      'typography/dm-sans.css',
      'typography/reading.css',
      'densities/normal.css',
    ])
  })

  it('keeps theme CSS as linked preview assets and local package imports', () => {
    const document = learningDocumentService.createInitialDocument()
    const previewStyleSheet = createDocumentAppearanceStyleSheet(document)
    const packageStyleSheet = createDocumentAppearanceStyleSheet(document, './')

    expect(previewStyleSheet).not.toContain('@import')
    expect(previewStyleSheet).toContain('--elce-appearance-background: #fffdf8;')
    expect(packageStyleSheet.startsWith('@import "./appearance/css/typography/crimson-text.css";')).toBe(true)
    expect(packageStyleSheet).not.toContain('/palettes/')
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

  it('keeps normal padding inside Flux BDC borders without a background', async () => {
    const noneDensity = await readFile(new URL('../config/appearance/css/densities/none.css', import.meta.url), 'utf8')

    expect(LEARNING_PLAYER_STYLE_SHEET).toMatch(/\.page-flux \.question:not\(\.has-background\),\s*\.page-flux \.carousel\s*\{[^}]*padding: clamp\(1rem, 3vw, 1\.6rem\);/s)
    expect(noneDensity).not.toMatch(/\.density-none\.question\s*\{[^}]*padding:\s*0/)
    expect(noneDensity).toContain('.density-none.evaluation-result { padding: 0; }')
  })

  it('keeps heading rhythm distinct from paragraph spacing', async () => {
    const readingCss = await readFile(new URL('../config/appearance/css/typography/reading.css', import.meta.url), 'utf8')
    const familyCss = await readFile(new URL('../config/appearance/css/typography/dm-sans.css', import.meta.url), 'utf8')

    expect(readingCss).toContain('margin-block: 1.25em 0.5em')
    expect(readingCss).toContain('line-height: 1.2')
    expect(readingCss).toContain(':is(h1, h2, h3, h4, h5, h6):first-child')
    expect(readingCss).toContain('margin-block-start: 0')
    expect(familyCss).toContain('line-height: 1.45')
    expect(LEARNING_PLAYER_STYLE_SHEET).toContain('.elce-card--text-short > .elce-card__overline:has(+ .elce-card__title)')
    expect(LEARNING_PLAYER_STYLE_SHEET).toContain('.elce-card--text-image > .elce-carousel-text-image__content > .elce-card__overline:has(+ .elce-card__title)')
    expect(LEARNING_PLAYER_STYLE_SHEET).not.toMatch(/\.elce-card--text-short\s*\{[^}]*\bgap:/s)
    expect(LEARNING_PLAYER_STYLE_SHEET).not.toMatch(/\.elce-card--text-image > \.elce-carousel-text-image__content\s*\{[^}]*\bgap:/s)
  })

  it('frames the balanced image title with translucent project colors and a light blur', async () => {
    const anchorStyleSheet = await readFile(new URL('../resources/bdcs/section/authoring/section-editor.css', import.meta.url), 'utf8')

    expect(LEARNING_PLAYER_STYLE_SHEET).toContain('.elce-card--image-title > .elce-card__title')
    expect(LEARNING_PLAYER_STYLE_SHEET).toContain('font-weight: 700;')
    expect(LEARNING_PLAYER_STYLE_SHEET).toContain('width: fit-content;')
    expect(LEARNING_PLAYER_STYLE_SHEET).toContain('max-inline-size: calc(100% - 2em);')
    expect(LEARNING_PLAYER_STYLE_SHEET).toContain('padding: 0.5em;')
    expect(LEARNING_PLAYER_STYLE_SHEET).toContain('color: var(--elce-appearance-surface-foreground);')
    expect(LEARNING_PLAYER_STYLE_SHEET).toContain('background-color: color-mix(in oklch, var(--elce-appearance-surface) 82%, transparent);')
    expect(LEARNING_PLAYER_STYLE_SHEET).toContain('backdrop-filter: blur(0.5rem);')
    expect(LEARNING_PLAYER_STYLE_SHEET).toContain('text-wrap: balance;')
    expect(LEARNING_PLAYER_STYLE_SHEET).toContain('place-items: center;')
    expect(LEARNING_PLAYER_STYLE_SHEET).not.toContain('mix-blend-mode: difference;')

    expect(anchorStyleSheet).toContain('.elce-editor-content .elce-anchor-card-preview.elce-card--image-title > .elce-card__title')
    expect(anchorStyleSheet).toContain('max-inline-size: calc(100% - 2em);')
    expect(anchorStyleSheet).toContain('padding: 0.5em;')
    expect(anchorStyleSheet).toContain('color: var(--elce-appearance-surface-foreground);')
    expect(anchorStyleSheet).toContain('background-color: color-mix(in oklch, var(--elce-appearance-surface) 82%, transparent);')
    expect(anchorStyleSheet).toContain('backdrop-filter: blur(0.5rem);')
    expect(anchorStyleSheet).toContain('text-wrap: balance;')
    expect(anchorStyleSheet).not.toContain('mix-blend-mode: difference;')
  })

  it('doubles the space between direct BDCs in a Flux page', () => {
    expect(LEARNING_PLAYER_STYLE_SHEET).toMatch(/\.elce-flux-article\s*\{[^}]*\bgap:\s*2\.5rem;/s)
  })

  it('applies one reading measure to every BDC root', async () => {
    const readingCss = await readFile(new URL('../config/appearance/css/typography/reading.css', import.meta.url), 'utf8')
    const compactDensity = await readFile(new URL('../config/appearance/css/densities/compact.css', import.meta.url), 'utf8')
    const largeDensity = await readFile(new URL('../config/appearance/css/densities/large.css', import.meta.url), 'utf8')
    const familyCss = await readFile(new URL('../config/appearance/css/typography/dm-sans.css', import.meta.url), 'utf8')
    const document = learningDocumentService.createInitialDocument()
    const page = document.pages[0]
    if (page === undefined) throw new Error('The appearance fixture has no page.')

    expect(readingCss).toContain('  .bdc {')
    expect(readingCss).toContain('max-inline-size: min(100%, 55rem)')
    expect(readingCss).toContain('container-type: inline-size')
    expect(readingCss).toContain('font-size: max(0.9rem, 2.76cqi)')
    expect(readingCss).toContain('font-size: max(1.58625rem, 5.1606cqi)')
    expect(readingCss).toContain('margin-inline: auto')
    expect(readingCss).not.toContain('.text-reading')
    expect(readingCss).not.toContain('.elce-flow-slot')
    expect(compactDensity).not.toContain('max-inline-size:')
    expect(largeDensity).not.toContain('max-inline-size:')
    expect(largeDensity).toContain('font-size: max(0.95rem, 2.76cqi)')
    expect(largeDensity).toContain('.elce-card__copy')
    expect(familyCss).not.toContain('font-size:')
    expect(familyCss).not.toContain('max-inline-size:')
    expect(pageAppearanceClassNames(document.data, page, document.bdcs)['bdc:bdc-section-1']).toContain('bdc')

    const graphDocument = applyDocumentCommand(document, createStatisticalGraphBdcCommand('bdc-graph', page.id, 1))
    const graphPage = graphDocument.pages[0]
    if (graphPage === undefined) throw new Error('The graph appearance fixture has no page.')
    const roleFixtures = [
      appearanceBdcFixture('card-short', BDC_TYPE.CARD, DEFAULT_PRESET_ID.TEXT_SHORT, graphPage.id, null),
      appearanceBdcFixture('card-image', BDC_TYPE.CARD, DEFAULT_PRESET_ID.TEXT_IMAGE, graphPage.id, null),
      appearanceBdcFixture('card-caption', BDC_TYPE.CARD, DEFAULT_PRESET_ID.IMAGE_CAPTION, graphPage.id, null),
      appearanceBdcFixture('card-title-image', BDC_TYPE.CARD, DEFAULT_PRESET_ID.IMAGE_TITLE, graphPage.id, null),
      appearanceBdcFixture('card-photo', BDC_TYPE.CARD, DEFAULT_PRESET_ID.PHOTO, graphPage.id, null),
      appearanceBdcFixture('carousel', BDC_TYPE.CAROUSEL, DEFAULT_PRESET_ID.CAROUSEL, graphPage.id, null),
      appearanceBdcFixture('carousel-card', BDC_TYPE.CARD, DEFAULT_PRESET_ID.TEXT_SHORT, null, 'carousel'),
      appearanceBdcFixture('question', BDC_TYPE.QUESTION, DEFAULT_PRESET_ID.QUESTION, graphPage.id, null),
      appearanceBdcFixture('result', BDC_TYPE.EVALUATION_RESULT, DEFAULT_PRESET_ID.EVALUATION_RESULT, graphPage.id, null),
    ]
    const framedGraphDocument = applyDocumentCommand(graphDocument, {
      type: 'appearance.property.set',
      target: { kind: 'document' },
      property: 'frame',
      value: true,
    })
    const roleDocument = new LearningDocument({
      ...framedGraphDocument.toJSON(),
      bdcs: [...framedGraphDocument.bdcs, ...roleFixtures],
    })
    const roleClasses = pageAppearanceClassNames(
      roleDocument.data,
      graphPage,
      roleDocument.bdcs,
      (bdc) => bdc.type === BDC_TYPE.EVALUATION_RESULT ? 'evaluation-result' : undefined,
    )
    for (const bdcId of [
      'card-short',
      'card-image',
      'card-caption',
      'card-title-image',
      'card-photo',
      'carousel',
      'carousel-card',
      'question',
      'result',
      'bdc-graph',
    ]) {
      expect(roleClasses[`bdc:${bdcId}`]).toMatch(/\bbdc\b/)
      expect(roleClasses[`bdc:${bdcId}`]).toContain('has-frame')
      expect(roleClasses[`bdc:${bdcId}`]).not.toContain('text-reading')
    }
  })

  it('keeps author-entered colors as exact generated palette anchors', () => {
    const document = applyDocumentCommand(learningDocumentService.createInitialDocument(), {
      type: 'appearance.background.set',
      target: { kind: 'document' },
      value: { kind: 'custom', value: '#324b5a' },
    })

    const styleSheet = createDocumentAppearanceStyleSheet(document)
    const projectClass = appearanceScopeClassName(document.data, { kind: 'document' })
    expect(styleSheet).toContain(`.${projectClass} {`)
    expect(styleSheet).toContain('--elce-appearance-background: #324b5a;')
    expect(styleSheet).toContain(`.${projectClass}.project-layout.has-background { background-color: var(--elce-appearance-background); }`)
  })

  it('derives Card gradients from the inherited project color and rejects them elsewhere', () => {
    const initial = learningDocumentService.createInitialDocument()
    const projectColor = applyDocumentCommand(initial, {
      type: 'appearance.background.set',
      target: { kind: 'document' },
      value: { kind: 'custom', value: '#324b5a' },
    })
    const withCard = applyDocumentCommand(projectColor, createStandaloneCardBdcCommand(
      'card-title-image',
      'page-a',
      DEFAULT_PRESET_ID.IMAGE_TITLE,
    ))
    const cardTarget = { kind: 'bdc', bdcId: 'card-title-image' } as const
    const gradientDocument = applyDocumentCommand(withCard, {
      type: 'appearance.background.set',
      target: cardTarget,
      value: { kind: 'gradient', id: 'background-surface' },
    })
    const resolved = resolveAppearance(gradientDocument.data, cardTarget)
    const styleSheet = createDocumentAppearanceStyleSheet(gradientDocument)
    const targetStyleSheet = createAppearanceTargetStyleSheet(gradientDocument, cardTarget)
    const scope = appearanceScopeClassName(gradientDocument.data, cardTarget)

    expect(resolved.background.value).toMatchObject({
      choice: { kind: 'gradient', id: 'background-surface' },
      color: '#324b5a',
    })
    expect(pageAppearanceClassNames(
      gradientDocument.data,
      gradientDocument.pages[0]!,
      gradientDocument.bdcs,
    )['bdc:card-title-image']).toContain('card-image-title')
    expect(styleSheet).toContain(`.${scope}.card-image-title.has-background { background-image: linear-gradient(135deg, var(--elce-appearance-background), var(--elce-appearance-surface)); }`)
    expect(targetStyleSheet).toContain('--elce-appearance-background: #324b5a;')
    expect(targetStyleSheet).not.toContain(':scope')

    expect(() => applyDocumentCommand(gradientDocument, {
      type: 'appearance.background.set',
      target: { kind: 'document' },
      value: { kind: 'gradient', id: 'background-surface' },
    })).toThrow(/réservés aux Cartes/)
    expect(() => applyDocumentCommand(gradientDocument, {
      type: 'appearance.background.set',
      target: cardTarget,
      value: { kind: 'gradient', id: 'unknown-gradient' as AppearanceBackgroundGradientId },
    })).toThrow(/dégradé/i)
  })

  it('projects one custom color to separate project and page scopes', () => {
    let document = applyDocumentCommand(learningDocumentService.createInitialDocument(), {
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
    const projectClass = appearanceScopeClassName(document.data, { kind: 'document' })
    const pageClass = appearanceScopeClassName(document.data, { kind: 'page', pageId: page.id })
    expect(styleSheet).toContain(`.${projectClass} {`)
    expect(styleSheet).toContain(`.${pageClass} {`)
    expect(styleSheet).toContain(`.${pageClass}.page-flux.has-background { background-color: var(--elce-appearance-background); }`)
  })

  it('inherits Cadre through project, page and BDC targets and resets local exceptions', () => {
    const initial = learningDocumentService.createInitialDocument()
    const page = initial.pages[0]
    if (page === undefined) throw new Error('The appearance fixture has no page.')
    const framed = applyDocumentCommand(initial, {
      type: 'appearance.property.set',
      target: { kind: 'document' },
      property: 'frame',
      value: true,
    })
    const pageClasses = pageAppearanceClassNames(framed.data, page, framed.bdcs)
    const projectClasses = documentAppearanceClassNames(framed.data)
    const projectClass = appearanceScopeClassName(framed.data, { kind: 'document' })
    const styleSheet = createDocumentAppearanceStyleSheet(framed)
    const themePaths = appearanceThemeCssAssetPathsForDocument(framed)

    expect(projectClasses['document:layout']).toContain('has-frame')
    expect(projectClasses['document:content']).not.toContain('has-frame')
    expect(pageClasses[`page:${page.id}`]).toContain('has-frame')
    expect(Object.entries(pageClasses).some(([key, classes]) => key.startsWith('bdc:') && classes.includes('has-frame'))).toBe(true)
    expect(styleSheet).toContain(`.${projectClass}.project-layout.has-frame { box-sizing: border-box; border: thin solid var(--elce-appearance-frame); }`)
    expect(styleSheet).toContain('--elce-appearance-frame: #505050;')
    expect(themePaths[themePaths.length - 1]).toBe('densities/normal.css')
    expect(resolveAppearance(framed.data, { kind: 'page', pageId: page.id }).frame).toMatchObject({
      value: true,
      source: { kind: 'document' },
      origin: 'inherited',
    })

    const pageOverride = applyDocumentCommand(framed, {
      type: 'appearance.property.set',
      target: { kind: 'page', pageId: page.id },
      property: 'frame',
      value: false,
    })
    expect(resolveAppearance(pageOverride.data, { kind: 'page', pageId: page.id }).frame.value).toBe(false)
    const resetPage = applyDocumentCommand(pageOverride, {
      type: 'appearance.property.reset',
      target: { kind: 'page', pageId: page.id },
      property: 'frame',
    })
    expect(resolveAppearance(resetPage.data, { kind: 'page', pageId: page.id }).frame.value).toBe(true)
  })

  it('uses the Normal padding rules for framed transparent and colored surfaces', async () => {
    const normalDensity = await readFile(new URL('../config/appearance/css/densities/normal.css', import.meta.url), 'utf8')

    expect(normalDensity).toContain(':scope.project-layout.has-frame { padding: clamp(1rem, 3vw, 2rem); }')
    expect(normalDensity).toContain('.page-flux.has-frame { padding: 2rem; }')
    expect(normalDensity).toContain('.page-diapo.has-frame { padding: clamp(1rem, 3vw, 2rem); }')
    expect(normalDensity).toContain('.bdc.section.has-frame { box-sizing: border-box; padding: clamp(1rem, 3vw, 2rem); }')
    expect(normalDensity).toContain('.bdc.card-text-short.has-frame { padding: clamp(1rem, 4cqw, 3rem); }')
    expect(normalDensity).toContain('.bdc.card-text-image.has-frame > .elce-carousel-text-image__content { padding: clamp(0.75rem, 3cqw, 2rem); }')
    expect(normalDensity).toContain('.bdc.card-image-caption.has-frame > .elce-card__caption { padding: 0.45rem 0.75rem; }')
    expect(normalDensity).toContain('.bdc.card-image-title.has-frame { box-sizing: border-box; padding: clamp(1rem, 3cqw, 2rem); }')
    expect(normalDensity).toContain('.bdc:is(.card-photo, .carousel, .question, .evaluation-result, .graph).has-frame')
    expect(normalDensity).not.toMatch(/has-frame[^}]*padding:\s*[^;}]*px/)
  })
})

/** Creates a minimal BDC fixture for testing appearance role projection only. */
function appearanceBdcFixture(
  id: string,
  type: LearningBdc['type'],
  presetId: string,
  pageId: string | null,
  parentBdcId: string | null,
): LearningBdc {
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
