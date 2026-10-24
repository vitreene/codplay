import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { customColorClassName } from '../builders/scene-style/appearance-class-names.ts'
import { applyDocumentCommand } from '../domain/commands/document-commands'
import { createInitialDocument } from '../domain/document/document-model'
import {
  appearanceThemeCssAssetPathsForDocument,
  createDocumentAppearanceStyleSheet,
} from './appearance-scene-style-sheet'

describe('appearance CSS assets for the document', () => {
  it('selects only the authored files used by resolved appearance values', () => {
    const document = createInitialDocument()
    const assetPaths = appearanceThemeCssAssetPathsForDocument(document)

    expect(assetPaths).toEqual([
      'appearance-surface.css',
      'palettes/classic.css',
      'typography/crimson-dm-sans.css',
      'densities/normal.css',
    ])
  })

  it('keeps theme CSS as linked preview assets and local package imports', () => {
    const document = createInitialDocument()
    const previewStyleSheet = createDocumentAppearanceStyleSheet(document)
    const packageStyleSheet = createDocumentAppearanceStyleSheet(document, './')

    expect(previewStyleSheet).not.toContain('@import')
    expect(previewStyleSheet).not.toContain('--elce-palette-background:')
    expect(packageStyleSheet.startsWith('@import "./appearance/css/appearance-surface.css";')).toBe(true)
    expect(packageStyleSheet).toContain('@import "./appearance/css/palettes/classic.css";')
    expect(packageStyleSheet).not.toContain('palettes/ocean.css')
  })

  it('keeps authored density values directly in relative-unit CSS files', async () => {
    const normalDensity = await readFile(new URL('../config/appearance/css/densities/normal.css', import.meta.url), 'utf8')
    const largeDensity = await readFile(new URL('../config/appearance/css/densities/large.css', import.meta.url), 'utf8')

    expect(normalDensity).toContain('.elce-appearance-density-normal.elce-appearance-role-section')
    expect(normalDensity).toContain('padding: clamp(1rem, 3vw, 2rem)')
    expect(largeDensity).toContain('.elce-appearance-density-large.elce-appearance-role-card-text-image')
    expect(largeDensity).toContain('padding: clamp(1rem, 3.75cqw, 2.5rem)')
  })

  it('keeps author-entered colors in compact target-independent classes', () => {
    const document = applyDocumentCommand(createInitialDocument(), {
      type: 'appearance.property.set',
      target: { kind: 'document' },
      property: 'background',
      value: { kind: 'custom', value: '#324b5a' },
    })

    const styleSheet = createDocumentAppearanceStyleSheet(document)
    const customClass = customColorClassName('background', '#324b5a')
    expect(styleSheet).toContain(`.${customClass} {`)
    expect(styleSheet).toContain('--elce-appearance-background-color: #324b5a;')
  })
})
