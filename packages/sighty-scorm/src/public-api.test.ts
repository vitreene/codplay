import { describe, expect, it } from 'vitest'
import {
  parseScormCliArguments,
  resolveScormExportOptions,
  ScormSession,
} from '@codplay/sighty-scorm'
import type { PipwerksScormApi } from '@codplay/sighty-scorm'

/** Provides a minimal fake LMS for a consumer importing the package entry. */
class ConsumerLmsApi implements PipwerksScormApi {
  public version = ''
  /** Opens the fake LMS session. */
  public init(): boolean { return true }
  /** Reads an empty value from the fake LMS. */
  public get(): string { return '' }
  /** Accepts a write to the fake LMS. */
  public set(): boolean { return true }
  /** Commits fake LMS state. */
  public save(): boolean { return true }
  /** Ends the fake LMS session. */
  public quit(): boolean { return true }
}

describe('shared SCORM package public entry', () => {
  it('lets a host project use the command options and a generic LMS session', async () => {
    const options = parseScormCliArguments(['--version=2004v4', '--monoSco', '--withShellSummary'])
    const resolved = resolveScormExportOptions(options)
    const session = new ScormSession({ version: resolved.version, api: new ConsumerLmsApi() })

    expect(resolved.monoSco).toBe(true)
    expect(await session.initialize()).toEqual({ location: '', suspendData: '', mode: '' })
    await session.close()
  })
})
