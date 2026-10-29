import { describe, expect, it } from 'vitest'
import { orphanedMediaIds } from './document-store'

describe('orphaned local media cleanup', () => {
  it('keeps media referenced by any cached project document', () => {
    const documents = [
      { id: 'project-a', medias: [{ id: 'shared' }, { id: 'first-only' }] },
      { id: 'project-b', medias: [{ id: 'shared' }, { id: 'second-only' }] },
    ]

    expect(orphanedMediaIds(documents, ['shared', 'first-only', 'second-only', 'redo-only']))
      .toEqual(['redo-only'])
  })

  it('removes every media blob when no local document references it', () => {
    expect(orphanedMediaIds([], ['redo-only', 'abandoned-import'])).toEqual(['redo-only', 'abandoned-import'])
  })
})
