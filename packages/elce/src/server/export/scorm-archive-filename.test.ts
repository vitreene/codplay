import { describe, expect, it } from 'vitest'
import { createScormArchiveFilename } from './scorm-archive-filename'

describe('SCORM archive filename', () => {
  it('uses the project, SCORM format, UTC date, and selected edition in a stable order', () => {
    expect(createScormArchiveFilename(
      'Démo 5 / comparaison Elcé',
      '2004v4',
      false,
      new Date('2026-10-22T23:59:00.000Z'),
    )).toBe('Demo-5-comparaison-Elce-scorm-2026-10-22(2004v4).zip')
  })

  it('adds monosco only when the option is selected', () => {
    expect(createScormArchiveFilename(
      'Demo5',
      '1.2',
      true,
      new Date('2026-10-22T12:00:00.000Z'),
    )).toBe('Demo5-scorm-monosco-2026-10-22(1.2).zip')
  })

  it('uses a safe fallback when the document name contains no filename characters', () => {
    expect(createScormArchiveFilename(
      '---',
      '2004v4',
      false,
      new Date('2026-10-22T12:00:00.000Z'),
    )).toBe('elce-scorm-2026-10-22(2004v4).zip')
  })
})
