// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import {
  consumeChooserMod,
  elceDocumentRoute,
  PENDING_AUTHORING_MOD_KEY,
  resolveElceAuthoringLocation,
} from './elce-authoring-routes'

describe('Elcé authoring routes', () => {
  afterEach(() => sessionStorage.clear())

  it('resolves chooser and mod-specific document paths', () => {
    expect(resolveElceAuthoringLocation('/')).toEqual({ kind: 'chooser', pathname: '/' })
    expect(resolveElceAuthoringLocation('/new')).toEqual({ kind: 'chooser', pathname: '/new' })
    expect(resolveElceAuthoringLocation('/learning/project-a')).toEqual({
      kind: 'document', mod: 'learning', documentId: 'project-a',
    })
    expect(resolveElceAuthoringLocation('/hunt/project-a')).toEqual({
      kind: 'document', mod: 'quiz-hunt', documentId: 'project-a',
    })
  })

  it('encodes document identities and rejects unmatched or malformed paths', () => {
    expect(elceDocumentRoute('quiz-hunt', 'projet avec espaces')).toBe('/hunt/projet%20avec%20espaces')
    expect(resolveElceAuthoringLocation('/hunt/projet%20avec%20espaces')).toEqual({
      kind: 'document', mod: 'quiz-hunt', documentId: 'projet avec espaces',
    })
    expect(resolveElceAuthoringLocation('/document/project-a')).toEqual({ kind: 'not-found' })
    expect(resolveElceAuthoringLocation('/learning/%E0%A4%A')).toEqual({ kind: 'not-found' })
  })

  it('uses Learning by default and consumes a one-use chooser mod selection', () => {
    expect(consumeChooserMod(sessionStorage)).toBe('learning')
    sessionStorage.setItem(PENDING_AUTHORING_MOD_KEY, 'quiz-hunt')
    expect(consumeChooserMod(sessionStorage)).toBe('quiz-hunt')
    expect(consumeChooserMod(sessionStorage)).toBe('learning')
  })
})
