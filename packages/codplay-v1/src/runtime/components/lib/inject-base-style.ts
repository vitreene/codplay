const injected = new Set<string>()

/**
 * Injects one scoped base stylesheet into the document head exactly once per id.
 * Uses :where() so any authored CSS selector or inline style can override without !important.
 */
export function injectBaseStyle(id: string, css: string): void {
  if (injected.has(id) || typeof globalThis.document === 'undefined') return
  injected.add(id)
  if (globalThis.document.getElementById(id)) return
  const el = globalThis.document.createElement('style')
  el.id = id
  el.textContent = css
  globalThis.document.head.appendChild(el)
}
