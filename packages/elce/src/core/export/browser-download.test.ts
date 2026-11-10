/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadExportBlob } from './browser-download'

const createObjectURLDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
const revokeObjectURLDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')

describe('browser export download', () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
    vi.useRealTimers()
    if (createObjectURLDescriptor === undefined) Reflect.deleteProperty(URL, 'createObjectURL')
    else Object.defineProperty(URL, 'createObjectURL', createObjectURLDescriptor)
    if (revokeObjectURLDescriptor === undefined) Reflect.deleteProperty(URL, 'revokeObjectURL')
    else Object.defineProperty(URL, 'revokeObjectURL', revokeObjectURLDescriptor)
  })

  it('clicks a temporary download link and releases its Object URL', () => {
    vi.useFakeTimers()
    const createObjectURL = vi.fn(() => 'blob:export-download')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    const filename = downloadExportBlob(new Blob(['package']), 'Projet.sighty.zip', 'export-download')

    expect(filename).toBe('Projet.sighty.zip')
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(document.querySelector('#export-download')).toBeNull()
    expect(revokeObjectURL).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1_000)

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:export-download')
  })
})
