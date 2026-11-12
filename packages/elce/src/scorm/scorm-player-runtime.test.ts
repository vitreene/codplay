/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { PAGE_LOCATION } from '../mods/learning/organization/learning-page-placement'
import { applyDocumentCommand, createDefaultPageCommand } from '../domain/commands/document-commands'
import { learningDocumentService } from '../mods/learning/document/learning-document-service'
import { INITIAL_PROJECT_TEST_STATE } from '../mods/learning/reading/learning-test-state-types'
import { learningPreviewService } from '../mods/learning/preview/learning-preview-service'
import type { PipwerksScormApi } from '@codplay/sighty-scorm'
import { encodeScormReaderState } from './scorm-state-codec'
import { startScormPlayerRuntime } from './scorm-player-runtime'

/** Supplies a small in-memory LMS API to the real Sighty player runtime. */
class FakePipwerksApi implements PipwerksScormApi {
  public version = ''
  public readonly values = new Map<string, string>()
  public initialized = false
  public quitCount = 0

  /** Starts the fake LMS session. */
  public init(): boolean {
    this.initialized = true
    return true
  }

  /** Reads a value from the fake CMI store. */
  public get(parameter: string): string {
    if (parameter === 'cmi.interactions._count') return '0'
    return this.values.get(parameter) ?? ''
  }

  /** Writes a value into the fake CMI store. */
  public set(parameter: string, value: string): boolean {
    this.values.set(parameter, value)
    return true
  }

  /** Accepts the current session data. */
  public save(): boolean {
    return true
  }

  /** Terminates the fake LMS session. */
  public quit(): boolean {
    this.quitCount += 1
    return true
  }
}

describe('SCORM player runtime', () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.unstubAllGlobals()
  })

  it('restores state before Sighty starts and persists an admitted page transition', async () => {
    const api = new FakePipwerksApi()
    api.values.set('cmi.location', 'page-a')
    api.values.set('cmi.suspend_data', encodeScormReaderState({
      schemaVersion: 1,
      currentPageId: 'page-a',
      projectTestState: { ...INITIAL_PROJECT_TEST_STATE, finishedPageIds: ['page-a'] },
    }, '2004v4'))
    const initial = learningDocumentService.createInitialDocument()
    const pageCommand = createDefaultPageCommand(initial, { kind: PAGE_LOCATION.SCENARIO })
    const documentModel = applyDocumentCommand(initial, pageCommand)
    const stage = document.createElement('div')
    document.body.append(stage)

    const runtime = await startScormPlayerRuntime({ version: '2004v4', api, stage, document: documentModel })
    expect(stage.querySelector('.elce-player-title')?.textContent).toBe('Page A')
    expect(api.version).toBe('2004')

    stage.querySelector<HTMLButtonElement>('.elce-player-navigation__button--next')?.click()
    await new Promise<void>((resolve) => setTimeout(resolve, 35))

    expect(stage.querySelector('.elce-player-title')?.textContent).toBe('Page B')
    expect(api.values.get('cmi.location')).toBe(pageCommand.pageId)
    expect(JSON.parse(api.values.get('cmi.suspend_data') ?? '{}').currentPageId).toBe(pageCommand.pageId)

    await runtime.close()
    await runtime.close()
    expect(api.quitCount).toBe(1)
  })

  it('keeps SCORM inactive in the existing author preview', async () => {
    const api = new FakePipwerksApi()
    vi.stubGlobal('pipwerks', { SCORM: api })
    const stage = document.createElement('div')
    document.body.append(stage)
    const preview = learningPreviewService.createPlayer(stage, {
      documentModel: learningDocumentService.createInitialDocument(),
      selectedPageId: null,
      mediaSources: {},
    })

    await preview?.initialize()

    expect(api.initialized).toBe(false)
    preview?.destroy()
  })
})
