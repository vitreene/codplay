import { describe, expect, it } from 'vitest'
import { isNetworkPreviewApiRequestAllowed } from './network-preview-api-policy'

const previewOrigin = 'http://192.168.1.20:4173'
const origin = previewOrigin

describe('Elcé network preview API policy', () => {
  it('allows project reads and media reads from the configured preview', () => {
    expect(allowed('GET', '/api/projects/project-a')).toBe(true)
    expect(allowed('HEAD', '/api/projects/project-a/media/media-a')).toBe(true)
    expect(allowed('GET', '/api/projects/project-a/media/media-a', null)).toBe(true)
  })

  it('allows test-state reads and compare-and-swap writes only from the exact preview origin', () => {
    expect(allowed('GET', '/api/projects/project-a/test-state')).toBe(true)
    expect(allowed('PUT', '/api/projects/project-a/test-state')).toBe(true)
    expect(allowed('PUT', '/api/projects/project-a/test-state', 'http://192.168.1.21:4173')).toBe(false)
    expect(allowed('PUT', '/api/projects/project-a/test-state', null)).toBe(false)
  })

  it('keeps all project and media mutations closed to network preview', () => {
    expect(allowed('PUT', '/api/projects/project-a/document')).toBe(false)
    expect(allowed('PATCH', '/api/projects/project-a')).toBe(false)
    expect(allowed('DELETE', '/api/projects/project-a')).toBe(false)
    expect(allowed('PUT', '/api/projects/project-a/media/media-a')).toBe(false)
  })

  it('admits the test-state preflight but not document-write preflight', () => {
    expect(allowed('OPTIONS', '/api/projects/project-a/test-state', origin, 'PUT')).toBe(true)
    expect(allowed('OPTIONS', '/api/projects/project-a/document', origin, 'PUT')).toBe(false)
  })
})

/** Evaluates one synthetic request against the configured preview origin. */
function allowed(method: string, pathname: string, requestOrigin: string | null = origin, requestedMethod?: string): boolean {
  return isNetworkPreviewApiRequestAllowed({ method, pathname, origin: requestOrigin ?? undefined, requestedMethod }, previewOrigin)
}
