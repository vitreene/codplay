import type { ProjectEditGrant } from './project-persistence'

/** Reads the page and acquisition pair required for a project mutation. */
export function projectEditGrantFrom(request: Request): ProjectEditGrant | null {
  const pageId = request.headers.get('X-Elce-Page-Id')
  const grantId = request.headers.get('X-Elce-Edit-Grant')
  if (pageId === null || pageId.length === 0 || grantId === null || grantId.length === 0) return null
  return { pageId, grantId }
}

/** Reports a request that did not present an editing grant. */
export function missingProjectEditGrant(): Response {
  return Response.json({ error: 'edit_access_required' }, { status: 428 })
}

/** Reports a grant that no longer owns the requested project. */
export function lostProjectEditGrant(): Response {
  return Response.json({ error: 'edit_access_lost' }, { status: 409 })
}
