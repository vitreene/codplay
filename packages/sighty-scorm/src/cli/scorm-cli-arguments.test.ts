import { describe, expect, it } from 'vitest'
import { parseScormCliArguments } from './scorm-cli-arguments'

describe('SCORM CLI arguments', () => {
  it('parses the source option names and their separated values', () => {
    expect(parseScormCliArguments([
      '--version', '2004 4th Edition',
      '--title', 'Formation',
      '--needShellSummary',
      '--monoSco=false',
      '--masteryScore', '75',
      '--absolutePath=https://cdn.example/course',
    ])).toEqual({
      version: '2004 4th Edition',
      title: 'Formation',
      needSummary: true,
      monoSco: false,
      masteryScore: 75,
      absolutePath: 'https://cdn.example/course',
    })
  })

  it('accepts false for ZIP and summary flags', () => {
    expect(parseScormCliArguments(['--zip=false', '--withShellSummary=false']))
      .toEqual({ zip: false, withSummary: false })
  })

  it('rejects options deliberately excluded from Elcé and malformed values', () => {
    expect(() => parseScormCliArguments(['--licenseClient', 'client-key']))
      .toThrow('Option SCORM inconnue : --licenseClient')
    expect(() => parseScormCliArguments(['--masteryScore=forty']))
      .toThrow('--masteryScore attend un nombre')
    expect(() => parseScormCliArguments(['--version']))
      .toThrow('--version attend une valeur')
  })
})
