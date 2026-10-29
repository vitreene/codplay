import { describe, expect, it } from 'vitest'
import { parseScormCliArguments } from './scorm-cli-arguments'

describe('Elcé SCORM CLI adapter', () => {
  it('forwards shared options in the Elcé option shape', () => {
    expect(parseScormCliArguments(['--version=2004v4', '--monoSco', '--zip=false']))
      .toEqual({ version: '2004v4', monoSco: true, zip: false })
  })

  it('rejects options that Elcé does not transpose', () => {
    expect(() => parseScormCliArguments(['--licenseClient', 'access-key']))
      .toThrow('Option SCORM inconnue : --licenseClient')
  })
})
