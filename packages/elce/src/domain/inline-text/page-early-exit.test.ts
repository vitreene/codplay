import { describe, expect, it } from 'vitest'
import { BDC_TYPE } from '../../config/document-config'
import { applyDocumentCommand, createCarouselBdcCommand } from '../commands/document-commands'
import { createInitialDocument } from '../document/document-model'
import type { RichTextDocument } from '../document/document-types'
import { pageAllowsEarlyExit, pageContainsInlinePageLink } from './page-early-exit'

describe('page early-exit setting', () => {
  it('defaults on for a page link nested in a Carousel and honors explicit overrides', () => {
    const initial = createInitialDocument()
    const page = initial.pages[0]!
    expect(pageAllowsEarlyExit(initial, page)).toBe(false)

    let document = applyDocumentCommand(initial, createCarouselBdcCommand(
      'bdc-carousel-links', page.id, page.bdcIds.length, 'bdc-carousel-link-card',
    ))
    const childCard = document.bdcs.find((bdc) => bdc.id === 'bdc-carousel-link-card')
    expect(childCard?.type).toBe(BDC_TYPE.CARD)
    if (childCard?.card === null || childCard?.card === undefined) throw new Error('La carte de test est absente.')
    const content: RichTextDocument = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{
        type: 'pageLinkLabel',
        attrs: { pageId: 'page-target', label: null, fallbackLabel: 'Page cible', presentation: 'text' },
      }] }],
    }
    document = applyDocumentCommand(document, {
      type: 'bdc.card.update',
      bdcId: childCard.id,
      card: { ...childCard.card, message: content },
    })

    const linkedPage = document.pages.find((candidate) => candidate.id === page.id)!
    expect(pageContainsInlinePageLink(document, linkedPage)).toBe(true)
    expect(pageAllowsEarlyExit(document, linkedPage)).toBe(true)

    document = applyDocumentCommand(document, {
      type: 'page.early-exit.set',
      pageId: page.id,
      allowEarlyExit: false,
    })
    const disabledPage = document.pages.find((candidate) => candidate.id === page.id)!
    expect(pageAllowsEarlyExit(document, disabledPage)).toBe(false)

    document = applyDocumentCommand(document, {
      type: 'page.early-exit.set',
      pageId: page.id,
      allowEarlyExit: null,
    })
    const resetPage = document.pages.find((candidate) => candidate.id === page.id)!
    expect(pageAllowsEarlyExit(document, resetPage)).toBe(true)
  })

  it('allows an explicit setting on a page without links', () => {
    const document = createInitialDocument()
    const page = document.pages[0]!
    const enabled = applyDocumentCommand(document, {
      type: 'page.early-exit.set',
      pageId: page.id,
      allowEarlyExit: true,
    })
    const updatedPage = enabled.pages.find((candidate) => candidate.id === page.id)!

    expect(pageContainsInlinePageLink(enabled, updatedPage)).toBe(false)
    expect(pageAllowsEarlyExit(enabled, updatedPage)).toBe(true)
  })
})
