/** Parses one-level HTML or plaintext lists from clipboard data. */
export function parseListPaste(html: string, text: string): readonly string[] | null {
  let htmlItems: readonly string[] | null = null
  if (html.length > 0) {
    const parsed = new DOMParser().parseFromString(html, 'text/html')
    const list = parsed.body.querySelector('ul, ol')
    if (list !== null) {
      const items = Array.from(list.children).filter((child) => child.tagName.toLowerCase() === 'li')
      if (items.length > 0) htmlItems = items.map((item) => {
        const copy = item.cloneNode(true) as HTMLElement
        copy.querySelectorAll('ul, ol').forEach((nested) => nested.remove())
        return copy.textContent?.trim() ?? ''
      })
    }
  }
  const lines = text.replace(/&#(?:9|x0*9);/gi, '\t').split(/\r\n?|\n/).map((line) => line.trim()).filter(Boolean)
  const values = lines.map((line) => line.match(/^(?:(?:[•⁃*+\-]|\d+[.)])\s+)+(.+)$/)?.[1]?.trim())
  const textItems = values.length > 0 && values.every((value): value is string => value !== undefined) ? values : null
  if (textItems !== null && (htmlItems === null || textItems.length > htmlItems.length)) return textItems
  return htmlItems ?? textItems
}
