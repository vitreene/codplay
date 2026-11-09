export type ElceAuthoringMod = 'learning' | 'quiz-hunt'

export type ElceAuthoringLocation =
  | Readonly<{ kind: 'chooser'; pathname: '/' | '/new' }>
  | Readonly<{ kind: 'document'; mod: ElceAuthoringMod; documentId: string }>
  | Readonly<{ kind: 'not-found' }>

export const PENDING_AUTHORING_MOD_KEY = 'elce-pending-authoring-mod'

/** Resolves an authoring pathname to its chooser or mod-specific document. */
export function resolveElceAuthoringLocation(pathname: string): ElceAuthoringLocation {
  if (pathname === '/' || pathname === '/new') return { kind: 'chooser', pathname }
  const match = /^\/(learning|hunt)\/([^/]+)$/.exec(pathname)
  if (match === null) return { kind: 'not-found' }
  const documentId = decodeDocumentId(match[2] ?? '')
  if (documentId === null) return { kind: 'not-found' }
  return { kind: 'document', mod: match[1] === 'hunt' ? 'quiz-hunt' : 'learning', documentId }
}

/** Converts an authoring mod and document identity into its canonical route. */
export function elceDocumentRoute(mod: ElceAuthoringMod, documentId: string): string {
  const prefix = mod === 'quiz-hunt' ? 'hunt' : 'learning'
  return `/${prefix}/${encodeURIComponent(documentId)}`
}

/** Consumes a one-use mod choice for a chooser route and otherwise selects Learning. */
export function consumeChooserMod(storage: Storage | null): ElceAuthoringMod {
  const selected = storage?.getItem(PENDING_AUTHORING_MOD_KEY) ?? null
  storage?.removeItem(PENDING_AUTHORING_MOD_KEY)
  return selected === 'quiz-hunt' ? 'quiz-hunt' : 'learning'
}

/** Decodes a route identity while treating malformed escapes as an unmatched route. */
function decodeDocumentId(value: string): string | null {
  try {
    const documentId = decodeURIComponent(value)
    return documentId.length === 0 ? null : documentId
  } catch {
    return null
  }
}
