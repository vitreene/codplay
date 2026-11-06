import { isRecord } from './response'

/** Sends one authenticated request and turns provider errors into operation-specific messages. */
export async function requestElevenLabs(
  url: string,
  apiKey: string,
  operation: string,
  init: RequestInit,
): Promise<Response> {
  const normalizedApiKey = apiKey.trim()
  if (normalizedApiKey === '') throw new Error('Saisissez une clé API ElevenLabs.')

  let response: Response
  try {
    const headers = new Headers(init.headers)
    headers.set('xi-api-key', normalizedApiKey)
    response = await fetch(url, {
      ...init,
      headers,
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    })
  } catch {
    throw new Error(`La connexion à ElevenLabs a échoué pendant ${operation}. Vérifiez le réseau et l’accès API.`)
  }

  if (!response.ok) throw await readElevenLabsError(response, operation, normalizedApiKey)
  return response
}

/** Converts the current and legacy ElevenLabs error shapes into a precise safe message. */
async function readElevenLabsError(response: Response, operation: string, apiKey: string): Promise<Error> {
  const body: unknown = await response.json().catch(() => null)
  const detail = isRecord(body) && isRecord(body.detail) ? body.detail : null
  const code = readString(detail?.code)
  const type = readString(detail?.type)
  const legacyStatus = readString(detail?.status)
  const message = readString(detail?.message)?.replaceAll(apiKey, '[clé masquée]')
  const requestId = readString(detail?.request_id)
  const permission = message?.match(/missing\s+(?:the\s+)?permission\s+["'`]?([a-z][a-z0-9_-]*)/iu)?.[1]
  const errorCode = code ?? legacyStatus ?? type
  const diagnostics = [
    errorCode === null ? `HTTP ${response.status}` : `HTTP ${response.status}, ${errorCode}`,
    requestId === null ? null : `référence ${requestId}`,
  ].filter((value): value is string => value !== null).join(' · ')

  if (permission !== undefined
    || code === 'insufficient_permissions'
    || code === 'missing_permissions'
    || legacyStatus === 'missing_permissions'
    || type === 'authorization_error') {
    const missingScope = permission === undefined ? '' : ` (permission « ${permission} » manquante)`
    return new Error(`La clé n’autorise pas l’opération « ${operation} »${missingScope}. ${diagnostics}.`)
  }
  if (code === 'invalid_api_key' || legacyStatus === 'invalid_api_key' || code === 'missing_api_key') {
    return new Error(`ElevenLabs a déclaré la clé API invalide ou absente pour ${operation}. ${diagnostics}.`)
  }
  if (response.status === 401) {
    return new Error(`ElevenLabs a refusé l’authentification pendant l’opération « ${operation} ». ${diagnostics}.`)
  }
  if (response.status === 403 || code === 'forbidden') {
    return new Error(`La clé n’a pas accès à l’opération « ${operation} ». ${diagnostics}.`)
  }
  if (response.status === 402 || code === 'insufficient_credits' || code === 'quota_exceeded' || type === 'payment_required') {
    return new Error(`Le compte ElevenLabs n’a pas assez de crédits pour l’opération « ${operation} ». ${diagnostics}.`)
  }
  if (response.status === 429 || code === 'rate_limit_exceeded' || code === 'concurrent_limit_exceeded' || type === 'rate_limit_error') {
    return new Error(`ElevenLabs limite actuellement l’opération « ${operation} ». Réessayez plus tard. ${diagnostics}.`)
  }

  const providerMessage = message === null ? '' : ` ${message}`
  return new Error(`ElevenLabs n’a pas pu ${operation} (${diagnostics}).${providerMessage}`)
}

/** Reads a non-empty string field from an untrusted error response. */
function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

