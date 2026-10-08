export const ELCE_API_PORT = 5181
export const DEFAULT_ELCE_API_ORIGIN = `http://127.0.0.1:${ELCE_API_PORT}`
export const PROJECT_SYNC_DEBOUNCE_MS = 500

declare global {
  interface Window {
    __ELCE_API_ORIGIN__?: string
  }
}

/** Reads the API origin provided by the local Remix server or its local default. */
export function elceApiOrigin(): string {
  if (typeof window === 'undefined') return DEFAULT_ELCE_API_ORIGIN
  return window.__ELCE_API_ORIGIN__ ?? DEFAULT_ELCE_API_ORIGIN
}
