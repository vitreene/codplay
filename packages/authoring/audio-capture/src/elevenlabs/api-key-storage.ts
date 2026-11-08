const API_KEY_STORAGE_KEY = 'codplay.audio-capture.elevenlabs.api-key.v1'

/** Loads the optional ElevenLabs key saved for this browser origin. */
export function loadRememberedElevenLabsApiKey(): string | null {
  const storage = browserLocalStorage()
  if (storage === null) return null

  try {
    return storage.getItem(API_KEY_STORAGE_KEY)
  } catch {
    return null
  }
}

/** Saves an ElevenLabs key only in this browser's local storage. */
export function rememberElevenLabsApiKey(apiKey: string): boolean {
  const storage = browserLocalStorage()
  if (storage === null || apiKey.trim() === '') return false

  try {
    storage.setItem(API_KEY_STORAGE_KEY, apiKey.trim())
    return true
  } catch {
    return false
  }
}

/** Removes the saved ElevenLabs key from this browser's local storage. */
export function clearRememberedElevenLabsApiKey(): boolean {
  const storage = browserLocalStorage()
  if (storage === null) return false

  try {
    storage.removeItem(API_KEY_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

/** Returns local storage when the current browser allows access to it. */
function browserLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}
