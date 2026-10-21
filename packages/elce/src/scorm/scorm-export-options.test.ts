import { describe, expect, it } from 'vitest'
import { resolveScormExportOptions } from './scorm-export-options'

describe('Elcé SCORM export options', () => {
  it('uses French until Elcé supports additional languages', () => {
    expect(resolveScormExportOptions({}).language).toBe('fr')
    expect(() => resolveScormExportOptions({ language: 'en' })).toThrow('langue fr')
  })
})
