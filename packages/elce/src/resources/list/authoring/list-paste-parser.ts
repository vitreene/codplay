/** Parses one-level HTML or plaintext lists from clipboard data. */
export function parseListPaste(html: string, text: string): readonly string[] | null {
  if (html.length > 0) {
    const parsed = new DOMParser().parseFromString(html, 'text/html')
    const list = parsed.body.querySelector('ul, ol')
    if (list !== null) {
      const items = Array.from(list.children).filter((child) => child.tagName.toLowerCase() === 'li')
      if (items.length > 0) return items.map((item) => {
        const copy = item.cloneNode(true) as HTMLElement
        copy.querySelectorAll('ul, ol').forEach((nested) => nested.remove())
        return copy.textContent?.trim() ?? ''
      })
    }
  }
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length === 0) return null
  const values = lines.map((line) => line.match(/^(?:[•*+\-]|\d+[.)])\s+(.+)$/)?.[1]?.trim())
  return values.every((value): value is string => value !== undefined) ? values : null
}
