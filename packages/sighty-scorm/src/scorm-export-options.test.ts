import { describe, expect, it } from 'vitest'
import { resolveScormExportOptions } from './scorm-export-options'

describe('SCORM export option transposition', () => {
  it.each([
    ['1.2', '1.2'],
    ['2004v3', '2004v3'],
    ['2004.3', '2004v3'],
    ['2004 3rd Edition', '2004v3'],
    ['2004v4', '2004v4'],
    ['2004.4', '2004v4'],
    ['2004 4th Edition', '2004v4'],
  ] as const)('accepts the reference version form %s', (sourceVersion, version) => {
    expect(resolveScormExportOptions({ version: sourceVersion }).version).toBe(version)
  })

  it('keeps the reference default and package-name convention', () => {
    const options = resolveScormExportOptions({}, 'Formation Éléments')

    expect(options).toMatchObject({
      version: '2004v4',
      needSummary: false,
      withSummary: false,
      monoSco: false,
      onePackagePerSco: false,
      masteryScore: 80,
      client: 'standard',
      language: 'fr',
      packageName: 'standard_formationelements_fr_scorm2004v4',
      absolutePath: '',
      zip: true,
    })
  })

  it('applies need-summary and SCORM 1.2 mono-SCO branches', () => {
    expect(resolveScormExportOptions({ version: '1.2', needSummary: true })).toMatchObject({
      needSummary: true,
      withSummary: true,
      monoSco: true,
      onePackagePerSco: false,
    })
  })

  it('uses monoSco alone to produce one package per SCO', () => {
    expect(resolveScormExportOptions({ monoSco: true })).toMatchObject({
      monoSco: false,
      onePackagePerSco: true,
    })
  })

  it('preserves explicit ZIP false and normalizes a remote launch base', () => {
    expect(resolveScormExportOptions({ zip: false, absolutePath: 'https://cdn.example/course' })).toMatchObject({
      zip: false,
      absolutePath: 'https://cdn.example/course/',
    })
  })

  it('rejects unsupported versions and leaves language selection to the host adapter', () => {
    expect(() => resolveScormExportOptions({ version: '2004' })).toThrow('Version SCORM non prise en charge')
    expect(resolveScormExportOptions({ language: 'en' }).language).toBe('en')
  })
})
