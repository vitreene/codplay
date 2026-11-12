import { describe, expect, it } from 'vitest'
import type { ResourceDocumentData } from '../../resources/document/resource-document-types'
import { resolveAppearance } from './appearance-resolver'

describe('resolveAppearance', () => {
  it('resolves resource appearance without a Learning document', () => {
    const document: ResourceDocumentData = {
      id: 'resource-only',
      pages: [],
      catalogPageIds: [],
      bdcs: [],
      catalogBdcIds: [],
      medias: [],
      appearance: { frame: false },
    }

    expect(resolveAppearance(document, { kind: 'document' }).frame).toEqual({
      value: false,
      source: { kind: 'document' },
      origin: 'local',
    })
  })
})
