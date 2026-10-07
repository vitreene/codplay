export const ELCE_API_PORT = 5181
export const DEFAULT_ELCE_API_ORIGIN = `http://127.0.0.1:${ELCE_API_PORT}`
export const PROJECT_SYNC_DEBOUNCE_MS = 500

/** Reads the local server origin from Vite configuration when provided. */
export function elceApiOrigin(): string {
  return import.meta.env.VITE_ELCE_API_ORIGIN ?? DEFAULT_ELCE_API_ORIGIN
}
